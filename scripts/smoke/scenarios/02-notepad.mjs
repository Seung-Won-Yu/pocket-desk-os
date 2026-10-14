import { assert, assertEventually, settle, unlockPocketDesk } from "../harness.mjs";

export default async function run(ctx) {
  const { page, multiSelectModifier, state } = ctx;
  const desktopMenu = page.locator(".desktop-context-menu");
  // 새로 만들기 > 인터넷 바로 가기: the wizard refuses a non-http scheme,
  // writes a real .url onto the desktop, and opening it hands Edge the address.
  await page.locator(".desktop").dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 760,
    clientY: 420,
  });
  await desktopMenu.getByRole("menuitem", { exact: true, name: "새로 만들기" }).hover();
  const desktopShortcutMenu = page.getByRole("menu", { name: "새로 만들기" });
  await desktopShortcutMenu.waitFor({ state: "visible" });
  await desktopShortcutMenu.getByRole("menuitem", { name: "인터넷 바로 가기" }).click();
  const shortcutDialog = page.locator(".run-dialog", { hasText: "인터넷 바로 가기 만들기" });
  await shortcutDialog.waitFor({ state: "visible" });
  await shortcutDialog.getByLabel("항목 위치").fill("ftp://예제");
  await shortcutDialog.getByRole("button", { name: "만들기", exact: true }).click();
  await shortcutDialog.getByRole("alert").waitFor({ state: "visible" });
  await shortcutDialog.getByLabel("항목 위치").fill("example.com");
  await shortcutDialog.getByLabel("바로 가기 이름").fill("스모크 바로 가기");
  await shortcutDialog.getByRole("button", { name: "만들기", exact: true }).click();
  await shortcutDialog.waitFor({ state: "detached" });
  const desktopShortcutIcon = page.locator(".desktop-icon", {
    hasText: "스모크 바로 가기.url",
  });
  await desktopShortcutIcon.waitFor({ state: "visible" });
  await desktopShortcutIcon.dblclick();
  const shortcutEdge = page.locator('article[data-app-id="browser"]');
  await shortcutEdge.waitFor({ state: "visible" });
  // The launch request lands through an effect; poll instead of racing it.
  const shortcutAddress = shortcutEdge.getByLabel("웹 주소 또는 검색어");
  let shortcutAddressValue = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    shortcutAddressValue = await shortcutAddress.inputValue();
    if (shortcutAddressValue === "https://example.com") break;
    await settle(page);
  }
  assert(
    shortcutAddressValue === "https://example.com",
    `Shortcut did not hand Edge its address: "${shortcutAddressValue}"`,
  );
  await page.keyboard.press("Alt+F4");
  await shortcutEdge.waitFor({ state: "detached" });

  await page.locator(".desktop").dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 720,
    clientY: 180,
  });
  await desktopMenu.getByRole("menuitem", { exact: true, name: "새로 만들기" }).hover();
  const desktopNewMenu = page.getByRole("menu", { name: "새로 만들기" });
  await desktopNewMenu.waitFor({ state: "visible" });
  await desktopNewMenu.getByRole("menuitem", { name: "텍스트 문서" }).click();
  const desktopRenameInput = page.getByLabel("바탕 화면 파일 이름");
  await desktopRenameInput.waitFor({ state: "visible" });
  await desktopRenameInput.fill("바탕 화면 메모.txt");
  await desktopRenameInput.press("Enter");
  const desktopNote = page.locator(".desktop-icon", { hasText: "바탕 화면 메모.txt" });
  await desktopNote.waitFor({ state: "visible" });
  await desktopNote.click();
  assert(
    (await page.locator('article[data-app-id="notepad"]').count()) === 0,
    "Desktop file opened on a single click",
  );
  await desktopNote.dblclick();
  const desktopNotepad = page.locator('article[data-app-id="notepad"]');
  await desktopNotepad.waitFor({ state: "visible" });
  await desktopNotepad.getByRole("button", { name: "보기", exact: true }).click();
  const noteViewMenu = desktopNotepad.getByRole("menu");
  await noteViewMenu.getByRole("menuitemcheckbox", { name: /자동 줄 바꿈/ }).click();
  assert(
    (await desktopNotepad.getByLabel("메모 내용").getAttribute("wrap")) === "off",
    "Notepad word wrap command did not apply",
  );
  await desktopNotepad.getByLabel("메모 내용").fill("공용 파일 대화상자 저장 테스트");
  await page.keyboard.press("Control+Shift+s");
  const notepadSaveDialog = desktopNotepad.getByRole("dialog", {
    name: "다른 이름으로 저장",
  });
  await notepadSaveDialog.waitFor({ state: "visible" });
  await desktopNotepad.locator(".file-dialog-overlay").click({ position: { x: 2, y: 2 } });
  assert(await notepadSaveDialog.isVisible(), "File dialog closed after a backdrop click");
  await notepadSaveDialog.getByRole("button", { name: "취소", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert(
    await notepadSaveDialog
      .getByRole("button", { name: "다른 이름으로 저장 닫기" })
      .evaluate((button) => button === document.activeElement),
    "File dialog did not keep keyboard focus inside the modal",
  );
  await notepadSaveDialog.getByRole("button", { name: "문서", exact: true }).click();
  await notepadSaveDialog.getByLabel("파일 이름").fill("대화상자 테스트");
  await notepadSaveDialog.getByRole("button", { name: "저장", exact: true }).click();
  await notepadSaveDialog.waitFor({ state: "hidden" });
  assert(
    (await desktopNotepad.locator('[role="tab"][aria-selected="true"]').innerText()).includes(
      "대화상자 테스트.txt",
    ),
    "Notepad Save As did not create and activate the text file",
  );
  await page.keyboard.press("Control+o");
  const notepadOpenDialog = desktopNotepad.getByRole("dialog", { name: "열기" });
  await notepadOpenDialog.waitFor({ state: "visible" });
  await notepadOpenDialog.getByRole("option", { name: /notes\.txt/ }).dblclick();
  await notepadOpenDialog.waitFor({ state: "hidden" });
  assert(
    (await desktopNotepad.locator('[role="tab"][aria-selected="true"]').innerText()).includes(
      "notes.txt",
    ),
    "Notepad Open dialog did not activate the selected document",
  );

  /*
   * 메모장 탭. The strip listed every text file on the disk and none of them
   * could be closed. A tab is a document that was opened now: Ctrl+W (or the
   * tab's ✕, a middle-click, its menu) puts it away and leaves the file —
   * with what was typed a moment before written, not dropped inside the
   * autosave's 850ms — and the tab beside it comes forward.
   */
  const noteTabNames = () =>
    desktopNotepad
      .locator('[role="tab"]')
      .evaluateAll((tabs) =>
        tabs.map(
          (tab) =>
            `${tab.textContent.trim()}${tab.getAttribute("aria-selected") === "true" ? "*" : ""}`,
        ),
      );
  const tabsBeforeNew = await noteTabNames();
  await desktopNotepad.getByLabel("메모 내용").click();
  await page.keyboard.press("Control+n");
  await settle(page);
  const newNoteName = (
    await desktopNotepad.locator('[role="tab"][aria-selected="true"]').innerText()
  ).trim();
  assert(
    (await noteTabNames()).length === tabsBeforeNew.length + 1,
    `Ctrl+N left the tabs at ${(await noteTabNames()).join(" | ")}`,
  );
  await page.keyboard.type("탭을 닫기 직전에 쓴 글");
  await page.keyboard.press("Control+w");
  await settle(page);
  assert(
    JSON.stringify(await noteTabNames()) ===
      JSON.stringify(
        tabsBeforeNew.map(
          (name, index) =>
            // The tab to the left comes forward when the last one closes.
            `${name.replace(/\*$/, "")}${index === tabsBeforeNew.length - 1 ? "*" : ""}`,
        ),
      ),
    `Ctrl+W left ${(await noteTabNames()).join(" | ")}`,
  );
  await page.keyboard.press("Control+o");
  await notepadOpenDialog.waitFor({ state: "visible" });
  await notepadOpenDialog
    .getByRole("option", { name: new RegExp(newNoteName.replace(/[()]/g, "\\$&")) })
    .dblclick();
  await notepadOpenDialog.waitFor({ state: "hidden" });
  // The document's text lands a render after the dialog closes — read too
  // soon, the editor still holds the tab that was in front (empty here).
  await page
    .waitForFunction(
      (expected) =>
        document.querySelector('article[data-app-id="notepad"] textarea')?.value === expected,
      "탭을 닫기 직전에 쓴 글",
      { timeout: 3000 },
    )
    .catch(() => {});
  const reopenedText = await desktopNotepad.getByLabel("메모 내용").inputValue();
  assert(
    reopenedText === "탭을 닫기 직전에 쓴 글",
    `Closing the tab dropped what had just been typed: ${newNoteName} reopened as ${JSON.stringify(
      reopenedText.slice(0, 80),
    )} with tabs ${(await noteTabNames()).join(" | ")}`,
  );
  /*
   * 탭 순서. The strip's order was fixed by when each document opened. A tab
   * dragged onto the left half of another lands before it, and
   * Ctrl+Shift+PageUp/PageDown moves the one on screen a place either way —
   * without a drop on the editor typing anything into the document.
   */
  const waitForNoteTabs = async (expected, label) => {
    await page
      .waitForFunction(
        (names) =>
          JSON.stringify(
            [...document.querySelectorAll('article[data-app-id="notepad"] [role="tab"]')].map(
              (tab) =>
                `${tab.textContent.trim()}${tab.getAttribute("aria-selected") === "true" ? "*" : ""}`,
            ),
          ) === JSON.stringify(names),
        expected,
        { timeout: 3000 },
      )
      .catch(() => {});
    assert(
      JSON.stringify(await noteTabNames()) === JSON.stringify(expected),
      `${label} left ${(await noteTabNames()).join(" | ")}, not ${expected.join(" | ")}`,
    );
  };
  const tabsBeforeDrag = await noteTabNames();
  assert(tabsBeforeDrag.length >= 3, `Too few tabs to reorder: ${tabsBeforeDrag.join(" | ")}`);
  const noteTabs = desktopNotepad.locator('[role="tab"]');
  assert(
    (await noteTabs.evaluateAll((tabs) => tabs.every((tab) => tab.draggable))) === true,
    "Notepad tabs are not draggable",
  );
  // The second tab, not the last: the strip scrolls in a narrow window, and
  // dragTo scrolling its target into view would slide another tab under the
  // pressed pointer.
  await noteTabs.nth(1).dragTo(noteTabs.first(), { targetPosition: { x: 4, y: 12 } });
  const draggedFirst = [tabsBeforeDrag[1], tabsBeforeDrag[0], ...tabsBeforeDrag.slice(2)];
  await waitForNoteTabs(draggedFirst, "Dragging the second tab onto the first one's left edge");
  // The tab on screen is the last one; the chords move it and nothing else.
  const editorBeforeReorder = await desktopNotepad.getByLabel("메모 내용").inputValue();
  await desktopNotepad.getByLabel("메모 내용").click();
  await page.keyboard.press("Control+Shift+PageUp");
  await waitForNoteTabs(
    [...draggedFirst.slice(0, -2), draggedFirst.at(-1), draggedFirst.at(-2)],
    "Ctrl+Shift+PageUp",
  );
  await page.keyboard.press("Control+Shift+PageDown");
  await waitForNoteTabs(draggedFirst, "Ctrl+Shift+PageDown");
  await noteTabs.first().dragTo(desktopNotepad.getByLabel("메모 내용"));
  assert(
    (await desktopNotepad.getByLabel("메모 내용").inputValue()) === editorBeforeReorder &&
      JSON.stringify(await noteTabNames()) === JSON.stringify(draggedFirst) &&
      (await desktopNotepad
        .locator(".is-dragging, .is-drop-before, .is-drop-after")
        .count()) === 0,
    "A tab dropped on the editor changed the document or the strip",
  );

  // The last tab has nothing to its right; 다른 탭 닫기 on notes.txt leaves it
  // alone, in front, for the steps after this one.
  const noteTabMenu = desktopNotepad.getByRole("menu", { name: "탭 메뉴" });
  await desktopNotepad.locator('[role="tab"]').last().click({ button: "right" });
  await noteTabMenu.waitFor({ state: "visible" });
  assert(
    await noteTabMenu.getByRole("menuitem", { name: "오른쪽 탭 닫기" }).isDisabled(),
    "오른쪽 탭 닫기 was offered on the last tab",
  );
  await page.keyboard.press("Escape");
  await noteTabMenu.waitFor({ state: "detached" });
  await desktopNotepad.getByRole("tab", { name: /notes\.txt/ }).click({ button: "right" });
  await noteTabMenu.waitFor({ state: "visible" });
  await noteTabMenu.getByRole("menuitem", { name: "다른 탭 닫기" }).click();
  await settle(page);
  assert(
    JSON.stringify(await noteTabNames()) === JSON.stringify(["notes.txt*"]),
    `다른 탭 닫기 left ${(await noteTabNames()).join(" | ")}`,
  );

  /*
   * 인쇄 (Ctrl+P). The browser's own print pictured the whole desktop. The
   * document prints from a frame of its own — the text as it reads now,
   * under Notepad's header and footer — and the page's print is never
   * called. Both prints are caught here: headless Chromium has no dialog.
   */
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      "contentWindow",
    );
    const pagePrint = window.print;
    window.__smokePrints = [];
    window.__restorePrints = () => {
      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", descriptor);
      window.print = pagePrint;
    };
    window.print = () => window.__smokePrints.push({ kind: "page" });
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      configurable: true,
      get() {
        const view = descriptor.get.call(this);
        if (view && !view.__smokeCaught) {
          view.__smokeCaught = true;
          view.print = () =>
            window.__smokePrints.push({
              css: [...view.document.querySelectorAll("style")]
                .map((style) => style.textContent)
                .join("\n"),
              kind: "frame",
              text: view.document.querySelector("pre")?.textContent ?? null,
              title: view.document.title,
            });
        }
        return view;
      },
    });
  });
  const printNoteEditor = desktopNotepad.getByLabel("메모 내용");
  const textBeforePrint = await printNoteEditor.inputValue();
  await printNoteEditor.click();
  await printNoteEditor.evaluate((node) =>
    node.setSelectionRange(node.value.length, node.value.length),
  );
  await page.keyboard.type(" 인쇄할 글");
  await page.keyboard.press("Control+p");
  await settle(page);
  const notePrints = await page.evaluate(() => {
    window.__restorePrints();
    return window.__smokePrints;
  });
  const printedValue = await printNoteEditor.inputValue();
  assert(
    notePrints.length === 1 &&
      notePrints[0].kind === "frame" &&
      notePrints[0].title === "notes.txt" &&
      notePrints[0].text === printedValue &&
      notePrints[0].css.includes('@top-center { content: "notes.txt";') &&
      notePrints[0].css.includes('content: "페이지 " counter(page);'),
    `Ctrl+P printed ${JSON.stringify(
      notePrints.map(({ css, ...rest }) => ({ ...rest, css: css?.slice(0, 80) })),
    )} for ${JSON.stringify(printedValue.slice(-40))}`,
  );
  // Typed for the print only: put the document back as it was.
  await printNoteEditor.fill(textBeforePrint);
  /*
   * 찾기 및 바꾸기. 찾기 could point at every occurrence and do nothing
   * about any of them. 바꾸기 takes the one the selection is sitting on;
   * 모두 바꾸기 takes the rest in a single undo step.
   */
  const noteEditor = desktopNotepad.getByLabel("메모 내용");
  const noteTextBefore = await noteEditor.inputValue();
  await noteEditor.fill("회의 준비\n회의 자료\n발표 회의");
  await page.keyboard.press("Control+h");
  const findBar = desktopNotepad.locator(".note-find-bar");
  await findBar.waitFor({ state: "visible" });
  assert(
    (await findBar.getAttribute("aria-label")) === "찾기 및 바꾸기",
    "Ctrl+H opened 찾기 without 바꾸기",
  );
  await desktopNotepad.getByLabel("찾을 내용").fill("회의");
  await settle(page);
  assert(
    (await findBar.locator(".note-find-count").first().innerText()).trim() === "1/3",
    `찾기 counted ${(await findBar.locator(".note-find-count").first().innerText()).trim()}`,
  );
  await desktopNotepad.getByLabel("바꿀 내용").fill("발표");
  // Both buttons carry words, so both must be wide enough to take their own
  // clicks: at 30px each, 바꾸기's overflowing label handed its press to
  // 모두 바꾸기 and one click replaced everything.
  const replaceOne = desktopNotepad.getByRole("button", { name: "바꾸기", exact: true });
  assert(
    (await replaceOne.boundingBox()).width > 40,
    "The 바꾸기 button is narrower than its own label",
  );
  await replaceOne.click();
  await settle(page);
  assert(
    (await noteEditor.inputValue()) === "발표 준비\n회의 자료\n발표 회의",
    `바꾸기 produced ${JSON.stringify(await noteEditor.inputValue())}`,
  );
  await desktopNotepad.getByRole("button", { name: "모두 바꾸기" }).click();
  await settle(page);
  assert(
    (await noteEditor.inputValue()) === "발표 준비\n발표 자료\n발표 발표",
    `모두 바꾸기 produced ${JSON.stringify(await noteEditor.inputValue())}`,
  );
  assert(
    (await desktopNotepad.locator(".note-replace-row .note-find-count").innerText()).includes(
      "2개 바꿈",
    ),
    "모두 바꾸기 did not say how many it changed",
  );
  // One undo takes the whole 모두 바꾸기 back, not one occurrence of it.
  await noteEditor.click();
  await page.keyboard.press("Control+z");
  await settle(page);
  assert(
    (await noteEditor.inputValue()) === "발표 준비\n회의 자료\n발표 회의",
    `One undo after 모두 바꾸기 left ${JSON.stringify(await noteEditor.inputValue())}`,
  );
  await page.keyboard.press("Control+z");
  await assertEventually(
    async () => (await noteEditor.inputValue()) === "회의 준비\n회의 자료\n발표 회의",
    async () => "A second undo did not take back the single 바꾸기",
  );
  await page.keyboard.press("Control+h");
  await findBar.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await findBar.waitFor({ state: "detached" });
  /*
   * 확대/축소와 줄 이동. The status bar printed a flat 100% while the text
   * moved between sizes, and Ctrl+G did nothing at all. The percentage is
   * the one the text is drawn at now, and a line the document does not have
   * is refused in the box rather than clamped.
   */
  const noteZoomLabel = desktopNotepad.locator(".note-statusbar span").nth(1);
  const noteCaretLabel = desktopNotepad.locator(".note-statusbar span").first();
  const noteFontSize = () =>
    noteEditor.evaluate((node) => window.getComputedStyle(node).fontSize);
  await noteEditor.click();
  await noteEditor.fill(
    Array.from({ length: 40 }, (_, index) => `${index + 1}번째 줄`).join("\n"),
  );
  assert(
    (await noteZoomLabel.innerText()) === "100%",
    `메모장 opened at ${await noteZoomLabel.innerText()}`,
  );
  const noteFontAt100 = await noteFontSize();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");
  await settle(page);
  assert(
    (await noteZoomLabel.innerText()) === "110%",
    `Ctrl+휠 left the zoom at ${await noteZoomLabel.innerText()}`,
  );
  assert(
    (await noteFontSize()) !== noteFontAt100,
    `The text stayed at ${await noteFontSize()} while the bar said 110%`,
  );
  await page.keyboard.press("Control+0");
  await settle(page);
  assert(
    (await noteZoomLabel.innerText()) === "100%" && (await noteFontSize()) === noteFontAt100,
    `Ctrl+0 left the zoom at ${await noteZoomLabel.innerText()} / ${await noteFontSize()}`,
  );

  await page.keyboard.press("Control+g");
  const goToDialog = desktopNotepad.locator(".note-goto-dialog");
  await goToDialog.waitFor({ state: "visible" });
  assert(
    (await goToDialog.locator("label span").innerText()).includes("1 - 40"),
    `줄 이동 named the wrong range: ${await goToDialog.locator("label span").innerText()}`,
  );
  // A line past the end is refused, and the number typed stays on screen.
  await goToDialog.locator("input").fill("99");
  await goToDialog.getByRole("button", { name: "이동" }).click();
  await assertEventually(
    async () => (await goToDialog.locator(".note-goto-error").innerText()).includes("1에서 40"),
    async () => "줄 이동 accepted a line the document does not have",
  );
  assert(
    (await goToDialog.locator("input").inputValue()) === "99",
    "줄 이동 threw away the number it refused",
  );
  await goToDialog.locator("input").fill("30");
  await goToDialog.locator("input").press("Enter");
  await goToDialog.waitFor({ state: "detached" });
  assert(
    (await noteCaretLabel.innerText()) === "Ln 30, Col 1",
    `줄 이동 left the caret at ${await noteCaretLabel.innerText()}`,
  );
  // Jumping back to the top scrolls the view, not just the caret.
  const noteScrollAtLine30 = await noteEditor.evaluate((node) => node.scrollTop);
  await page.keyboard.press("Control+g");
  await goToDialog.waitFor({ state: "visible" });
  assert(
    (await goToDialog.locator("input").inputValue()) === "30",
    `줄 이동 opened on ${await goToDialog.locator("input").inputValue()}, not the caret's line`,
  );
  await goToDialog.locator("input").fill("1");
  await goToDialog.locator("input").press("Enter");
  await goToDialog.waitFor({ state: "detached" });
  await settle(page);
  assert(
    (await noteEditor.evaluate((node) => node.scrollTop)) < noteScrollAtLine30,
    "줄 이동 moved the caret to line 1 without scrolling there",
  );

  /*
   * Put the document back as it was found and save it outright: 메모장 asks
   * before closing a dirty one, and a window left standing here covers the
   * desktop for every step after it. Ctrl+S rather than a wait on the
   * autosave, whose 850ms debounce is a coin toss on a slow runner, and the
   * title is checked afterwards so a failure says so here.
   */
  await noteEditor.click();
  await noteEditor.fill(noteTextBefore);
  await page.keyboard.press("Control+s");
  await settle(page);
  const restoredTitle = await desktopNotepad.getAttribute("aria-label");
  assert(
    !restoredTitle.startsWith("*"),
    `메모장 is still dirty after the restore: ${restoredTitle}`,
  );

  await desktopNotepad.getByRole("button", { name: "메모장 닫기" }).click();

  await page.keyboard.press("Control+Alt+r");
  const earlyRunDialog = page.locator(".run-dialog");
  await earlyRunDialog.waitFor({ state: "visible" });
  await earlyRunDialog.getByLabel("열기").fill("mspaint");
  await earlyRunDialog.getByRole("button", { name: "확인" }).click();
  const paint = page.locator('article[data-app-id="paint"]');
  await paint.waitFor({ state: "visible" });
  await page.keyboard.press("Control+Shift+s");
  const paintSaveDialog = paint.getByRole("dialog", { name: "다른 이름으로 저장" });
  await paintSaveDialog.waitFor({ state: "visible" });
  await paintSaveDialog.getByLabel("파일 이름").fill("QA 그림");
  await paintSaveDialog.getByRole("button", { name: "저장", exact: true }).click();
  await paintSaveDialog.waitFor({ state: "hidden" });
  assert(
    (await paint.locator(".canvas-file-label").innerText()).includes("QA 그림.png"),
    "Paint Save As did not create and activate the PNG file",
  );
  /*
   * 그림판 텍스트 도구. A click places a field over the canvas at the point
   * clicked; Enter puts the letters on the bitmap. Blur deliberately does not
   * commit — measured, the window frame takes focus back the moment the click
   * that opened the field activates the window, and a blur commit wrote half
   * a word and closed the field before a key was pressed.
   */
  const paintCanvas = paint.locator(".paint-canvas");
  const canvasBytes = () => paintCanvas.evaluate((node) => node.toDataURL("image/png").length);
  const beforeText = await canvasBytes();
  await paint.getByRole("button", { name: "텍스트" }).click();
  const paintCanvasBox = await paintCanvas.boundingBox();
  await page.mouse.click(paintCanvasBox.x + 120, paintCanvasBox.y + 90);
  const paintTextField = paint.getByLabel("캔버스에 넣을 텍스트");
  await paintTextField.waitFor({ state: "visible" });
  await paintTextField.fill("취소할 글");
  await page.keyboard.press("Escape");
  await settle(page);
  assert((await canvasBytes()) === beforeText, "Escape left the cancelled text on the drawing");

  await page.mouse.click(paintCanvasBox.x + 120, paintCanvasBox.y + 90);
  await paintTextField.waitFor({ state: "visible" });
  await paintTextField.fill("PocketDesk");
  await paintTextField.press("Enter");
  await settle(page);
  assert(
    (await paint.getByLabel("캔버스에 넣을 텍스트").count()) === 0,
    "The text field stayed open after Enter committed it",
  );
  assert((await canvasBytes()) !== beforeText, "The text never reached the drawing");
  // One undo step for the whole word, not one per keystroke.
  await paint.getByRole("button", { name: /실행 취소/ }).click();
  await assertEventually(
    async () => (await canvasBytes()) === beforeText,
    async () => "실행 취소 did not take the text back off in one step",
  );
  await paint.getByRole("button", { name: "브러시" }).click();

  await page.keyboard.press("Control+o");
  const paintOpenDialog = paint.getByRole("dialog", { name: "열기" });
  await paintOpenDialog.waitFor({ state: "visible" });
  await paintOpenDialog.getByRole("option", { name: /QA 그림\.png/ }).dblclick();
  await paintOpenDialog.waitFor({ state: "hidden" });
  await paint.getByRole("button", { name: "그림판 닫기" }).click();

  await desktopNote.dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 320,
    clientY: 240,
  });
  const desktopItemMenu = page.getByRole("menu", { name: "바탕 화면 항목 메뉴" });
  await desktopItemMenu.waitFor({ state: "visible" });
  assert(
    (await desktopItemMenu.innerText()).includes("복사"),
    "Desktop item menu is missing Copy",
  );
  assert(
    (await desktopItemMenu.innerText()).includes("속성"),
    "Desktop item menu is missing Properties",
  );
  await desktopItemMenu.getByRole("menuitem", { name: "속성" }).click();
  const desktopProperties = page.getByRole("dialog", { name: "바탕 화면 파일 속성" });
  await desktopProperties.waitFor({ state: "visible" });
  assert(
    (await desktopProperties.innerText()).includes("바탕 화면 메모.txt"),
    "Desktop Properties did not show the file name",
  );
  await desktopProperties.getByRole("button", { name: "확인" }).click();

  await desktopNote.dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 320,
    clientY: 240,
  });
  await desktopItemMenu.getByRole("menuitem", { name: "복사" }).click();
  await page.locator(".desktop").dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 760,
    clientY: 260,
  });
  await desktopMenu.getByRole("menuitem", { name: "붙여넣기" }).click();
  const desktopNoteCopy = page.locator(".desktop-icon", {
    hasText: "바탕 화면 메모 - 복사본.txt",
  });
  await desktopNoteCopy.waitFor({ state: "visible" });
  await desktopNote.click();
  await desktopNoteCopy.click({ modifiers: [multiSelectModifier] });
  await page.keyboard.press("Delete");
  await desktopNote.waitFor({ state: "hidden" });
  await desktopNoteCopy.waitFor({ state: "hidden" });

  const startButton = page.getByRole("button", { name: "시작 메뉴" });
  await startButton.waitFor({ state: "visible" });
  // The Start button used to listen on pointerdown only, which a keyboard
  // activation never fires.
  await startButton.focus();
  await page.keyboard.press("Enter");
  await page.locator(".start-menu").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.locator(".start-menu").waitFor({ state: "hidden" });
  await startButton.click();
  const startMenu = page.locator(".start-menu");
  await startMenu.waitFor({ state: "visible" });
  const startText = await startMenu.innerText();
  assert(startText.includes("고정됨"), "Start menu pinned section missing");
  assert(startText.includes("모든 앱"), "Start menu all-apps action missing");
  assert(startText.includes("추천"), "Start menu recommended section missing");
  assert(
    (await page.locator(".start-pinned-grid button").count()) >= 6,
    "Pinned app grid is too sparse",
  );
  await startMenu.getByRole("button", { name: "전원 옵션" }).click();
  await startMenu.getByRole("menuitem", { name: "다시 시작" }).click();
  await page.locator('[aria-label="부팅 화면"]').waitFor({ state: "visible" });
  await unlockPocketDesk(page);
  await settle(page);
  // Windows closes every app on restart; this used to bring the whole
  // session back as if nothing had happened.
  assert((await page.locator(".window-frame").count()) === 0, "Restart left windows running");

  await page.getByRole("button", { name: "시작 메뉴" }).click();
  await startMenu.waitFor({ state: "visible" });
  Object.assign(state, {
    beforeText,
    canvasBytes,
    desktopItemMenu,
    desktopNewMenu,
    desktopNote,
    desktopNoteCopy,
    desktopNotepad,
    desktopProperties,
    desktopRenameInput,
    desktopShortcutIcon,
    desktopShortcutMenu,
    draggedFirst,
    earlyRunDialog,
    editorBeforeReorder,
    findBar,
    goToDialog,
    newNoteName,
    noteCaretLabel,
    noteEditor,
    noteFontAt100,
    noteFontSize,
    notePrints,
    noteScrollAtLine30,
    noteTabMenu,
    noteTabNames,
    noteTabs,
    noteTextBefore,
    noteViewMenu,
    noteZoomLabel,
    notepadOpenDialog,
    notepadSaveDialog,
    paint,
    paintCanvas,
    paintCanvasBox,
    paintOpenDialog,
    paintSaveDialog,
    paintTextField,
    printNoteEditor,
    printedValue,
    reopenedText,
    replaceOne,
    restoredTitle,
    shortcutAddress,
    shortcutAddressValue,
    shortcutDialog,
    shortcutEdge,
    startButton,
    startMenu,
    startText,
    tabsBeforeDrag,
    tabsBeforeNew,
    textBeforePrint,
    waitForNoteTabs,
  });
}
