import { assert, assertEventually, settle, unlockPocketDesk } from "../harness.mjs";

export default async function run(ctx) {
  const { page, multiSelectModifier } = ctx;
  const runDialog = page.locator(".run-dialog");
  // 캡처 후에도 저장이 계속되어야 한다. A screenshot is the largest thing the
  // shell writes and the save limit is a budget for the whole snapshot; when
  // it overflowed, every later write failed and only the first said so.
  await page.keyboard.press("PrintScreen");
  await page
    .locator(".toast", { hasText: "스크린샷 저장됨" })
    .last()
    .waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("explorer");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const persistExplorer = page.locator('article[data-app-id="files"]').last();
  await persistExplorer.waitFor({ state: "visible" });
  await persistExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "문서", exact: true })
    .click();
  await persistExplorer.getByRole("button", { name: "새로 만들기" }).click();
  await page.getByRole("menuitem", { name: /텍스트 문서/ }).click();
  const persistNameInput = persistExplorer.getByLabel("파일 이름");
  await persistNameInput.waitFor({ state: "visible" });
  await persistNameInput.fill("캡처 후 저장.txt");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: "domcontentloaded" });
  await unlockPocketDesk(page);
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("explorer");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const reloadedExplorer = page.locator('article[data-app-id="files"]').last();
  await reloadedExplorer.waitFor({ state: "visible" });
  await reloadedExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "문서", exact: true })
    .click();
  await assertEventually(
    async () =>
      (await reloadedExplorer
        .locator(".file-list button", { hasText: "캡처 후 저장" })
        .count()) === 1,
    async () => "A file saved after a screenshot did not survive the reload",
  );
  await reloadedExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "사진", exact: true })
    .click();
  await assertEventually(
    async () =>
      (await reloadedExplorer.locator(".file-list button", { hasText: "스크린샷 " }).count()) >=
      1,
    async () => "The screenshot itself did not survive the reload",
  );
  await reloadedExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await reloadedExplorer.waitFor({ state: "detached" });

  // 설정: 키보드 단축키 lists what the shell listens for.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("설정");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const shortcutSettings = page.locator('article[data-app-id="settings"]').last();
  await shortcutSettings.waitFor({ state: "visible" });
  await shortcutSettings.getByRole("button", { name: "키보드 단축키" }).click();
  await assertEventually(
    async () =>
      (await shortcutSettings.locator(".shortcut-groups kbd").count()) > 20 &&
      (await shortcutSettings.innerText()).includes("PrintScreen"),
    async () => "설정 did not list the shell's shortcuts",
  );
  await shortcutSettings.getByRole("button", { name: "설정 닫기" }).click();
  await shortcutSettings.waitFor({ state: "detached" });

  // 그림판 도형 채우기: a filled rectangle leaves paint in its middle.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("mspaint");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const fillPaint = page.locator('article[data-app-id="paint"]').last();
  await fillPaint.waitFor({ state: "visible" });
  await fillPaint.getByRole("button", { name: "사각형" }).click();
  await fillPaint.getByLabel("도형 채우기").check();
  const fillCanvasBox = await fillPaint.locator(".paint-canvas").boundingBox();
  await page.mouse.move(fillCanvasBox.x + 40, fillCanvasBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(fillCanvasBox.x + 240, fillCanvasBox.y + 180, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  const filledMiddle = await fillPaint.locator(".paint-canvas").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const context = node.getContext("2d");
    const x = Math.round((140 / rect.width) * node.width);
    const y = Math.round((110 / rect.height) * node.height);
    return Array.from(context.getImageData(x, y, 1, 1).data);
  });
  assert(
    filledMiddle[3] > 0 &&
      !(filledMiddle[0] > 240 && filledMiddle[1] > 240 && filledMiddle[2] > 240),
    `도형 채우기 left the middle unpainted: ${JSON.stringify(filledMiddle)}`,
  );
  await fillPaint.getByRole("button", { name: "그림판 닫기" }).click();
  await settle(page);
  // 그림판's own save prompt is a .note-close-overlay, not a .window-dialog;
  // left standing it swallows every later click on the desktop.
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }

  /*
   * 그림판 스포이드와 크기 조정: the eyedropper reads a painted pixel into
   * 붓 색상 and hands the previous tool back, and 크기 조정 rescales the
   * bitmap — with one 실행 취소 putting the old size back, not stretching
   * the old picture over the new one.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("mspaint");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const pickPaint = page.locator('article[data-app-id="paint"]').last();
  await pickPaint.waitFor({ state: "visible" });
  const pickCanvas = pickPaint.locator(".paint-canvas");
  const pickColor = pickPaint.getByLabel("붓 색상");
  const pickedTool = () =>
    pickPaint
      .locator('.paint-tool-group button[aria-pressed="true"] span:last-child')
      .innerText();
  const canvasPixels = () => pickCanvas.evaluate((node) => `${node.width}x${node.height}`);
  await pickPaint.getByRole("button", { name: "#ef4444 색상 선택" }).click();
  const pickBox = await pickCanvas.boundingBox();
  await page.mouse.move(pickBox.x + 100, pickBox.y + 90);
  await page.mouse.down();
  await page.mouse.move(pickBox.x + 190, pickBox.y + 140, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  // A different colour is loaded, so the pick has something to change.
  await pickPaint.getByRole("button", { name: "#2563eb 색상 선택" }).click();
  await pickPaint.getByRole("button", { name: "스포이드" }).click();
  await page.mouse.click(pickBox.x + 145, pickBox.y + 115);
  await settle(page);
  assert(
    (await pickColor.inputValue()) === "#ef4444",
    `스포이드 read ${await pickColor.inputValue()} off a #ef4444 stroke`,
  );
  assert(
    (await pickedTool()) === "브러시",
    `스포이드 stayed selected instead of handing 브러시 back: ${await pickedTool()}`,
  );
  // Blank paper is white, not the transparent black the pixels hold.
  await pickPaint.getByRole("button", { name: "스포이드" }).click();
  await page.mouse.click(pickBox.x + 60, pickBox.y + 230);
  await settle(page);
  assert(
    (await pickColor.inputValue()) === "#ffffff",
    `스포이드 read ${await pickColor.inputValue()} off blank paper`,
  );

  const sizeBeforeResize = await canvasPixels();
  await pickPaint.getByRole("button", { name: "크기 조정" }).click();
  const resizeDialog = pickPaint.locator(".paint-resize-dialog");
  await resizeDialog.waitFor({ state: "visible" });
  const resizeWidth = resizeDialog.locator('input[type="number"]').first();
  const resizeHeight = resizeDialog.locator('input[type="number"]').nth(1);
  assert(
    (await resizeWidth.inputValue()) === "1120" && (await resizeHeight.inputValue()) === "720",
    `크기 조정 opened on ${await resizeWidth.inputValue()}×${await resizeHeight.inputValue()}, not the canvas size`,
  );
  await resizeWidth.fill("560");
  assert(
    (await resizeHeight.inputValue()) === "360",
    `비율 유지 left 세로 at ${await resizeHeight.inputValue()} when 가로 halved`,
  );
  await resizeDialog.getByRole("button", { name: "확인" }).click();
  await resizeDialog.waitFor({ state: "hidden" });
  assert(
    (await canvasPixels()) === "560x360",
    `크기 조정 left the canvas at ${await canvasPixels()}`,
  );
  // The picture is rescaled, not cleared: the stroke is still there.
  const scaledStroke = await pickCanvas.evaluate((node) => {
    const context = node.getContext("2d");
    const pixels = context.getImageData(0, 0, node.width, node.height).data;
    let painted = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 180 && pixels[i + 1] < 120 && pixels[i + 2] < 120) painted += 1;
    }
    return painted;
  });
  assert(scaledStroke > 0, "크기 조정 threw the drawing away instead of rescaling it");
  await page.keyboard.press("Control+z");
  await settle(page);
  assert(
    (await canvasPixels()) === sizeBeforeResize,
    `실행 취소 left the canvas at ${await canvasPixels()}, not ${sizeBeforeResize}`,
  );
  await pickPaint.getByRole("button", { name: "그림판 닫기" }).click();
  await settle(page);
  // 그림판's own save prompt is a .note-close-overlay, not a .window-dialog;
  // left standing it swallows every later click on the desktop.
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }

  /*
   * 그림판 선택·자르기·회전. Paint had eight drawing tools and nothing to take
   * hold of what was already drawn. A selection moves its pixels (leaving
   * paper behind), copies, pastes, deletes and crops, and 회전 turns either
   * the selection or the whole picture — each one undo step.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("mspaint");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const selectPaint = page.locator('article[data-app-id="paint"]').last();
  await selectPaint.waitFor({ state: "visible" });
  // At 50% the whole picture fits the stage, so every point below is on screen.
  await selectPaint.getByRole("button", { name: "보기", exact: true }).click();
  await selectPaint.getByLabel("확대/축소").fill("50");
  await selectPaint.getByRole("button", { name: "홈", exact: true }).click();
  const selectCanvas = selectPaint.locator(".paint-canvas");
  const selectCanvasSize = () =>
    selectCanvas.evaluate((node) => `${node.width}x${node.height}`);
  const selectPixel = (x, y) =>
    selectCanvas.evaluate(
      (node, point) =>
        [...node.getContext("2d").getImageData(point.x, point.y, 1, 1).data]
          .slice(0, 3)
          .join(","),
      { x, y },
    );
  const bitmapToScreen = async (x, y) => {
    const box = await selectCanvas.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return {
        bitmapHeight: node.height,
        bitmapWidth: node.width,
        height: node.clientHeight,
        left: rect.left + parseFloat(style.borderLeftWidth),
        top: rect.top + parseFloat(style.borderTopWidth),
        width: node.clientWidth,
      };
    });
    return {
      x: box.left + (x / box.bitmapWidth) * box.width,
      y: box.top + (y / box.bitmapHeight) * box.height,
    };
  };
  const dragOnBitmap = async (fromX, fromY, toX, toY) => {
    const from = await bitmapToScreen(fromX, fromY);
    const to = await bitmapToScreen(toX, toY);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await settle(page);
  };
  const red = "239,68,68";
  const paper = "255,255,255";
  const cropButton = selectPaint.getByRole("button", { name: "자르기" });

  await selectPaint.getByRole("button", { name: "#ef4444 색상 선택" }).click();
  await selectPaint.getByRole("button", { name: "사각형", exact: true }).click();
  await selectPaint.getByLabel("도형 채우기").check();
  await dragOnBitmap(100, 100, 200, 160);
  assert((await selectPixel(150, 130)) === red, "The red block was not drawn to select");

  await selectPaint.getByRole("button", { name: "선택", exact: true }).click();
  await dragOnBitmap(90, 90, 210, 170);
  assert(await cropButton.isEnabled(), "A drawn selection left 자르기 disabled");
  // Moving picks the pixels up and leaves paper behind.
  await dragOnBitmap(150, 130, 450, 130);
  await page.keyboard.press("Escape");
  await settle(page);
  assert(
    (await selectPixel(150, 130)) === paper && (await selectPixel(450, 130)) === red,
    `A moved selection left ${await selectPixel(150, 130)} behind and ${await selectPixel(450, 130)} where it went`,
  );
  assert(!(await cropButton.isEnabled()), "Escape left the selection standing");
  await page.keyboard.press("Control+z");
  await assertEventually(
    async () =>
      (await selectPixel(150, 130)) === red && (await selectPixel(450, 130)) === paper,
    async () => "One 실행 취소 did not take the move back",
  );

  // Copy, paste (it lands at the top-left, floating), put it down elsewhere.
  await dragOnBitmap(90, 90, 210, 170);
  await page.keyboard.press(`${multiSelectModifier}+c`);
  await page.keyboard.press(`${multiSelectModifier}+v`);
  await settle(page);
  await dragOnBitmap(60, 40, 660, 440);
  await page.keyboard.press("Escape");
  await settle(page);
  assert(
    (await selectPixel(660, 440)) === red && (await selectPixel(150, 130)) === red,
    `Copy and paste left ${await selectPixel(660, 440)} at the copy and ${await selectPixel(150, 130)} at the original`,
  );
  // Delete takes the selection back to paper.
  await dragOnBitmap(590, 390, 730, 490);
  await page.keyboard.press("Delete");
  await settle(page);
  assert(
    (await selectPixel(660, 440)) === paper,
    `Delete left ${await selectPixel(660, 440)} in the selection`,
  );

  // 자르기: the canvas becomes the selection; one undo puts the size back.
  await dragOnBitmap(80, 80, 240, 180);
  await cropButton.click();
  await settle(page);
  const [croppedWidth, croppedHeight] = (await selectCanvasSize()).split("x").map(Number);
  assert(
    Math.abs(croppedWidth - 160) <= 2 && Math.abs(croppedHeight - 100) <= 2,
    `자르기 left the canvas at ${croppedWidth}×${croppedHeight}, not about 160×100`,
  );
  await page.keyboard.press("Control+z");
  await assertEventually(
    async () => (await selectCanvasSize()) === "1120x720",
    async () => `실행 취소 after 자르기 left ${await selectCanvasSize()}`,
  );

  // 회전 with nothing selected turns the whole picture and swaps its sides.
  await selectPaint.getByRole("button", { name: "회전" }).click();
  await selectPaint
    .locator(".paint-rotate-menu button")
    .filter({ hasText: "오른쪽으로 90도 회전" })
    .click();
  await settle(page);
  assert(
    (await selectCanvasSize()) === "720x1120",
    `오른쪽으로 90도 회전 left ${await selectCanvasSize()}`,
  );
  // The block at x 100..200, y 100..160 turns to x 560..620, y 100..200.
  assert(
    (await selectPixel(590, 150)) === red,
    `The turned block is not where a right turn puts it: ${await selectPixel(590, 150)}`,
  );
  await page.keyboard.press("Control+z");
  await assertEventually(
    async () => (await selectCanvasSize()) === "1120x720",
    async () => `실행 취소 after 회전 left ${await selectCanvasSize()}`,
  );

  // Ctrl+A selects the whole picture with the 선택 tool.
  await page.keyboard.press(`${multiSelectModifier}+a`);
  await assertEventually(
    async () =>
      (await selectPaint
        .getByRole("button", { name: "선택", exact: true })
        .getAttribute("aria-pressed")) === "true" && (await cropButton.isEnabled()),
    async () => "Ctrl+A did not select the picture",
  );
  await page.keyboard.press("Escape");
  await selectPaint.getByRole("button", { name: "그림판 닫기" }).click();
  await settle(page);
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }
}
