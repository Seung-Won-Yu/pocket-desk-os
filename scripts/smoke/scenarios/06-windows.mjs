import {
  assert,
  assertEventually,
  runTerminalCommand,
  settle,
  unlockPocketDesk,
} from "../harness.mjs";

export default async function run(ctx) {
  const { page, state } = ctx;
  const runDialog = page.locator(".run-dialog");
  const terminal = page.locator('article[data-app-id="terminal"]');
  /*
   * 파일 내용 검색. 스모크.txt holds "둘째 줄" and its name does not, so a
   * box that only reads names cannot find it. Explorer's did search notes
   * before this — by accident, through the description field, which for a
   * note *is* its text — with nothing on the row to say why it matched.
   */
  await page.keyboard.press("Meta+e");
  const searchExplorer = page
    .locator(".window-frame", { has: page.locator(".files-app") })
    .first();
  await searchExplorer.waitFor({ state: "visible" });
  await settle(page);
  const searchRows = searchExplorer.locator('.file-list button[role="option"]');
  await searchExplorer.getByLabel("파일 검색").fill("둘째");
  await searchRows.filter({ hasText: "스모크.txt" }).first().waitFor();
  assert(
    (await searchRows.count()) === 1,
    `내용 검색 for 둘째 returned ${await searchRows.count()} rows`,
  );
  const snippet = searchExplorer.locator(".file-row-snippet").first();
  await snippet.waitFor();
  assert(
    (await snippet.innerText()).includes("둘째 줄"),
    `The row did not show the line it matched on: ${await snippet.innerText()}`,
  );
  assert(
    (await snippet.locator("mark").innerText()) === "둘째",
    "The matched word was not marked inside the snippet",
  );
  assert(
    (await searchExplorer.locator(".file-statusbar").innerText()).includes(
      "파일 내용까지 검색",
    ),
    "The status bar did not say the search went inside the files",
  );
  // A canned description is not content: this phrase is every folder's own
  // 세부 정보 line, and it used to answer the search through the same field
  // the note's text came from.
  await searchExplorer.getByLabel("파일 검색").fill("하위 폴더를 보관");
  await settle(page);
  assert(
    (await searchRows.count()) === 0,
    `A folder's own description still answers the search (${await searchRows.count()} rows)`,
  );
  await searchExplorer.locator(".window-titlebar").click();
  await page.keyboard.press("Alt+F4");
  await searchExplorer.waitFor({ state: "detached" });

  // 시작 메뉴 finds it by the same word, and says where the match came from.
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  await page.getByLabel("앱과 바탕화면 항목 검색").fill("둘째");
  const contentResult = page.locator(".start-result-list button", { hasText: "스모크.txt" });
  await contentResult.waitFor();
  assert(
    (await contentResult.innerText()).includes("일치: 파일 내용 — "),
    `시작 메뉴 did not name the match source: ${(await contentResult.innerText()).replace(/\n/g, " | ")}`,
  );
  await page.keyboard.press("Escape");
  // Not the taskbar button: pressing an active app's button minimizes it,
  // the way Windows does, and the next command would have nowhere to land.
  await terminal.getByLabel("명령 입력").click();

  const unknownOutput = await runTerminalCommand(terminal, "frobnicate");
  assert(unknownOutput.includes("frobnicate"), "Unknown command was not reported");
  assert(
    (await terminal.locator(".terminal-line.is-error").count()) > 0,
    "Unknown command was not styled as an error",
  );

  await runTerminalCommand(terminal, "set GREETING=안녕하세요");
  const expandedVar = await runTerminalCommand(terminal, "echo %GREETING%");
  assert(expandedVar.includes("안녕하세요"), "Environment variable was not expanded");
  const expandedCwd = await runTerminalCommand(terminal, "echo %CD%");
  assert(
    expandedCwd.includes("C:\\Users\\PocketDesk\\Desktop"),
    "Built-in %CD% was not expanded",
  );

  await runTerminalCommand(terminal, "echo 하나 > 스모크폴더\\a.txt");
  await runTerminalCommand(terminal, "echo 둘 > 스모크폴더\\b.txt");
  const wildcardList = await runTerminalCommand(terminal, "dir 스모크폴더\\*.txt");
  assert(
    wildcardList.includes("a.txt") && wildcardList.includes("b.txt"),
    "Wildcard dir did not list both matches",
  );
  const piped = await runTerminalCommand(terminal, "dir 스모크폴더 | find a.txt");
  assert(piped.includes("a.txt"), "Pipe did not keep the matching line");
  assert(!piped.includes("b.txt"), "Pipe did not filter out the other line");

  await runTerminalCommand(terminal, "echo md 배치결과 > 설치.bat");
  await runTerminalCommand(terminal, "echo echo 배치 성공 ^> 배치결과\\결과.txt >> 설치.bat");
  await terminal.getByLabel("명령 입력").fill("설치.bat");
  await terminal.getByLabel("명령 입력").press("Enter");
  // Each batch line runs on its own commit, so wait for the file the last one writes.
  await terminal
    .locator(".terminal-line", { hasText: "결과.txt에 저장했습니다." })
    .first()
    .waitFor({ state: "attached" });
  const batchOutput = await runTerminalCommand(terminal, "type 배치결과\\결과.txt");
  assert(batchOutput.includes("배치 성공"), "Batch file did not write its output file");

  await runTerminalCommand(terminal, "del 스모크폴더\\*.txt");
  const afterDelete = await runTerminalCommand(terminal, "dir 스모크폴더");
  assert(!afterDelete.includes("a.txt"), "Wildcard delete left a matching file behind");

  // cls empties the buffer, so runTerminalCommand's "wait for a new line" contract
  // cannot apply here.
  await terminal.getByLabel("명령 입력").fill("cls");
  await terminal.getByLabel("명령 입력").press("Enter");
  await terminal.locator(".terminal-line").first().waitFor({ state: "detached" });
  assert(
    (await terminal.locator(".terminal-line").count()) === 0,
    "cls did not clear the Command Prompt buffer",
  );

  // shutdown /l goes through the same path as the Start menu's 잠금 — the
  // lock screen appears, and unlocking brings the session back with the
  // terminal still running.
  await terminal.getByLabel("명령 입력").fill("shutdown /l");
  await terminal.getByLabel("명령 입력").press("Enter");
  await page
    .locator('[aria-label="PocketDesk 잠금 화면"]')
    .waitFor({ state: "visible", timeout: 5000 });
  await unlockPocketDesk(page);
  await terminal.waitFor({ state: "visible" });

  const explorerAfterShell = page.locator('article[data-app-id="files"]').first();
  if (await explorerAfterShell.isVisible()) {
    await explorerAfterShell
      .getByRole("button", { name: "새로 고침" })
      .click()
      .catch(() => {});
  }

  // Snapped halves tile flush, as a maximized window does. They used to float
  // with a 10px gutter, so the same gesture produced two different geometries.
  await page.keyboard.press("Meta+ArrowLeft");
  if (await page.locator(".snap-assist").count()) await page.keyboard.press("Escape");
  await settle(page);
  const snappedLeft = await page.locator(".window-frame.is-active").boundingBox();
  await page.keyboard.press("Meta+ArrowRight");
  if (await page.locator(".snap-assist").count()) await page.keyboard.press("Escape");
  await settle(page);
  const snappedRight = await page.locator(".window-frame.is-active").boundingBox();
  const seam = Math.round(snappedRight.x - (snappedLeft.x + snappedLeft.width));
  assert(seam === 0, `Snapped halves left a ${seam}px seam`);
  assert(
    Math.round(snappedLeft.x) === 0 && Math.round(snappedRight.x + snappedRight.width) === 1280,
    "Snapped halves did not reach the viewport edges",
  );

  // One tab stop per band, arrows to move inside it. Every icon and every
  // taskbar button used to be its own stop, and the arrow keys did nothing.
  const rovingCounts = await page.evaluate(() => ({
    icons: document.querySelectorAll(".desktop-icon").length,
    iconStops: [...document.querySelectorAll(".desktop-icon")].filter(
      (node) => node.tabIndex === 0,
    ).length,
    taskbar: document.querySelectorAll(".taskbar-app").length,
    taskbarStops: [...document.querySelectorAll(".taskbar-app")].filter(
      (node) => node.tabIndex === 0,
    ).length,
  }));
  assert(
    rovingCounts.iconStops === 1 && rovingCounts.icons > 1,
    `Desktop icons had ${rovingCounts.iconStops} tab stops across ${rovingCounts.icons} icons`,
  );
  assert(
    rovingCounts.taskbarStops === 1 && rovingCounts.taskbar > 1,
    `Taskbar had ${rovingCounts.taskbarStops} tab stops across ${rovingCounts.taskbar} buttons`,
  );
  await page.locator(".taskbar-app").first().focus();
  const taskbarBefore = await page.evaluate(() => document.activeElement?.textContent);
  await page.keyboard.press("ArrowRight");
  await assertEventually(
    async () =>
      (await page.evaluate(() => document.activeElement?.textContent)) !== taskbarBefore,
    async () => "ArrowRight did not move along the taskbar",
  );

  // Alt+Space opens the system menu on the first item that can take focus.
  // 복원 is disabled on an unmaximized window, so the menu used to open with
  // focus still on <body> and the arrow keys doing nothing.
  await page.locator(".window-frame.is-active").click({ position: { x: 60, y: 8 } });
  await page.keyboard.press("Alt+ ");
  await page.locator(".window-system-menu").waitFor({ state: "visible" });
  // The menu focuses its first item a frame after it mounts, and a slower
  // machine takes longer than any fixed wait worth writing.
  await page
    .waitForFunction(
      () => Boolean(document.activeElement?.closest(".window-system-menu")),
      undefined,
      { timeout: 5000 },
    )
    .catch(() => {
      throw new Error("Alt+Space left focus outside the system menu");
    });
  assert(
    !(await page.evaluate(() => document.activeElement?.disabled ?? true)),
    "Alt+Space focused a disabled system menu item",
  );
  await page.keyboard.press("Escape");
  await page.locator(".window-system-menu").waitFor({ state: "hidden" });

  /*
   * Windows moves and resizes a window from this menu with the arrow keys.
   * Both items were missing, and the eight resize handles are hidden from
   * assistive technology, so a keyboard user could not move or resize at all.
   * Runs on a window opened here, so a snapped or edge-clamped window left
   * over from an earlier step cannot swallow the step being measured.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("calc");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const dragTarget = page.locator('article[data-app-id="calculator"]').first();
  await dragTarget.waitFor({ state: "visible" });
  await settle(page);
  const beforeKeyboardMove = await dragTarget.boundingBox();
  await page.keyboard.press("Alt+ ");
  await page.locator(".window-system-menu").waitFor({ state: "visible" });
  await page.getByRole("menuitem", { name: "이동" }).click();
  await page.locator(".window-keyboard-drag-hint").waitFor({ state: "visible" });
  // Move away from the edges, where the 8px margin would clamp the step and
  // the measurement would say nothing about whether the keys work.
  assert(
    beforeKeyboardMove.x > 20 && beforeKeyboardMove.y > 20,
    `Keyboard move check needs room to the left and above, window at ${Math.round(beforeKeyboardMove.x)},${Math.round(beforeKeyboardMove.y)}`,
  );
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await settle(page);
  const afterKeyboardMove = await dragTarget.boundingBox();
  assert(
    Math.round(afterKeyboardMove.x - beforeKeyboardMove.x) === -10 &&
      Math.round(afterKeyboardMove.y - beforeKeyboardMove.y) === -10,
    `Keyboard move shifted the window by ${Math.round(afterKeyboardMove.x - beforeKeyboardMove.x)},${Math.round(afterKeyboardMove.y - beforeKeyboardMove.y)}`,
  );
  // Escape puts it back where it started, as Windows does.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await page.locator(".window-keyboard-drag-hint").waitFor({ state: "hidden" });
  const afterKeyboardCancel = await dragTarget.boundingBox();
  assert(
    Math.round(afterKeyboardCancel.x) === Math.round(beforeKeyboardMove.x) &&
      Math.round(afterKeyboardCancel.y) === Math.round(beforeKeyboardMove.y),
    "Escape did not put the window back where the keyboard move started",
  );

  await page.keyboard.press("Alt+ ");
  await page.locator(".window-system-menu").waitFor({ state: "visible" });
  await page.getByRole("menuitem", { name: "크기 조정" }).click();
  await page.locator(".window-keyboard-drag-hint").waitFor({ state: "visible" });
  // The first arrow picks the edge; the ones after it move that edge only.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  const afterKeyboardResize = await dragTarget.boundingBox();
  assert(
    Math.round(afterKeyboardResize.width - afterKeyboardCancel.width) === 10 &&
      Math.round(afterKeyboardResize.x - afterKeyboardCancel.x) === -10,
    `Keyboard resize changed the width by ${Math.round(afterKeyboardResize.width - afterKeyboardCancel.width)}px and x by ${Math.round(afterKeyboardResize.x - afterKeyboardCancel.x)}`,
  );
  await page.keyboard.press("Enter");
  await page.locator(".window-keyboard-drag-hint").waitFor({ state: "hidden" });
  await dragTarget.getByRole("button", { name: "계산기 닫기" }).click();
  await settle(page);

  // Alt+Tab walks every window in one hold and switches on release. Focusing
  // on each press instead raised the selection to the top of the z-order, so
  // re-sorting by z put it back at index 0 and Tab bounced between two
  // windows no matter how many were open. Power actions now close every
  // window, so this opens its own three instead of leaning on leftovers.
  for (const command of ["notepad", "calc"]) {
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill(command);
    await runDialog.getByRole("button", { name: "확인" }).click();
    await settle(page);
  }
  // Window pictures on a lingering taskbar card are frames too, by class.
  const openWindowCount = await page
    .locator(".window-frame:not(.window-thumbnail-clone)")
    .count();
  assert(openWindowCount >= 3, `Alt+Tab check needs 3 windows, found ${openWindowCount}`);
  await page.keyboard.down("Alt");
  const altTabSeen = [];
  for (let tap = 0; tap < 3; tap += 1) {
    await page.keyboard.press("Tab");
    await settle(page);
    altTabSeen.push(
      await page
        .locator(".alt-tab-item.is-selected > strong")
        .innerText()
        .catch(() => null),
    );
  }
  // Every item is a picture of its window (a scaled clone of the live
  // frame), not the program's icon — as the Windows 10 switcher shows them.
  const altTabPictures = await page.locator(".alt-tab-item .window-thumbnail-clone").count();
  assert(
    altTabPictures === openWindowCount,
    `Alt+Tab showed ${altTabPictures} window pictures for ${openWindowCount} windows`,
  );
  assert(
    (
      await page
        .locator(".alt-tab-item .window-thumbnail-clone")
        .first()
        .evaluate((node) => node.style.transform)
    ).startsWith("scale("),
    "Alt+Tab picture is not scaled down",
  );
  await page.keyboard.up("Alt");
  await settle(page);
  assert(
    new Set(altTabSeen).size === 3,
    `Alt+Tab reached ${new Set(altTabSeen).size} windows in three presses: ${altTabSeen.join(", ")}`,
  );

  // Escape abandons the selection instead of switching, as Windows does.
  const beforeEscape = await page.locator(".window-frame.is-active").getAttribute("aria-label");
  await page.keyboard.down("Alt");
  await page.keyboard.press("Tab");
  await settle(page);
  await page.keyboard.press("Escape");
  await page.keyboard.up("Alt");
  await settle(page);
  assert(
    (await page.locator(".window-frame.is-active").getAttribute("aria-label")) === beforeEscape,
    "Escape during Alt+Tab still switched windows",
  );
  // Clicking a picture in the switcher switches to that window.
  await page.keyboard.down("Alt");
  await page.keyboard.press("Tab");
  await settle(page);
  const clickedItem = page.locator(".alt-tab-item").last();
  const clickedTitle = await clickedItem.locator("> strong").innerText();
  await clickedItem.click();
  await page.keyboard.up("Alt");
  await assertEventually(
    async () =>
      (await page.locator(".alt-tab-switcher").count()) === 0 &&
      (await page.locator(".window-frame.is-active").getAttribute("aria-label"))?.startsWith(
        clickedTitle,
      ),
    async () => `Clicking ${clickedTitle} in Alt+Tab did not switch to it`,
  );

  // Restoring a maximized window puts it back exactly where it was. The
  // window controls sit inside the title bar, so their pointerdown bubbled
  // into the drag handler and moved the window before the click landed.
  const restoreTarget = page.locator(".window-frame.is-active");
  const beforeMaximize = await restoreTarget.boundingBox();
  await restoreTarget.getByRole("button", { name: /최대화$/ }).click();
  await settle(page);
  await restoreTarget
    .getByRole("button", { name: /이전 크기로|최대화$/ })
    .first()
    .click();
  await settle(page);
  const afterRestore = await restoreTarget.boundingBox();
  assert(
    Math.round(afterRestore.x) === Math.round(beforeMaximize.x) &&
      Math.round(afterRestore.y) === Math.round(beforeMaximize.y),
    `Restore moved the window from ${Math.round(beforeMaximize.x)},${Math.round(beforeMaximize.y)} to ${Math.round(afterRestore.x)},${Math.round(afterRestore.y)}`,
  );

  // A snapped window re-tiles on a resize instead of being nudged into the
  // 8px float margin, which used to overlap two halves by 16px.
  await page.keyboard.press("Meta+ArrowLeft");
  await settle(page);
  await page.setViewportSize({ height: 820, width: 1281 });
  await settle(page);
  await page.setViewportSize({ height: 820, width: 1280 });
  await settle(page);
  // Window motion animations translate the frame while they run, so a box
  // read mid-flight is a couple of pixels off its committed position.
  await restoreTarget.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished));
  });
  const resnapped = await restoreTarget.boundingBox();
  const taskbarTop = (await page.locator(".taskbar").boundingBox()).y;
  assert(
    Math.round(resnapped.x) === 0 && Math.round(resnapped.y) === 0,
    `Resize moved the snapped window to ${Math.round(resnapped.x)},${Math.round(resnapped.y)}`,
  );
  assert(
    Math.abs(resnapped.y + resnapped.height - taskbarTop) <= 1,
    `Snapped window stopped ${Math.round(taskbarTop - resnapped.y - resnapped.height)}px short of the taskbar`,
  );

  // Task View leaves the taskbar reachable, as Windows does.
  await page.getByRole("button", { name: /작업 보기/ }).click();
  await page.locator(".task-view").waitFor({ state: "visible" });
  // The open animation scales the panel past its final size, so a bounding box
  // read mid-flight is 2% too tall. Settle first, then measure.
  await page.locator(".task-view").evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished));
  });
  const taskViewBox = await page.locator(".task-view").boundingBox();
  const taskbarBox = await page.locator(".taskbar").boundingBox();
  assert(
    Math.round(taskViewBox.y + taskViewBox.height) <= Math.round(taskbarBox.y) + 1,
    `Task View bottom ${Math.round(taskViewBox.y + taskViewBox.height)} covered the taskbar at ${Math.round(taskbarBox.y)}`,
  );
  // A card names its window, not the app, and its preview is proportional to
  // where the window sits. Pixel dimensions used to stand in for both, so two
  // windows of the same app were indistinguishable.
  const firstCard = page.locator(".task-view-card").first();
  // The card's own title — the window picture inside it has bold text of its own.
  const cardTitle = await firstCard.locator(".task-view-card-title strong").innerText();
  assert(cardTitle.length > 0, "Task View card had no window title");
  assert(
    (await firstCard.locator(".task-view-card-shape").count()) === 1,
    "Task View card had no window preview",
  );
  // Each card shows the window itself: a clone of the live frame, inert and
  // stripped of the attributes tests address real frames by.
  const taskViewCards = await page.locator(".task-view-card").count();
  const taskViewPictures = await page
    .locator(".task-view-card .window-thumbnail-clone")
    .count();
  assert(
    taskViewPictures === taskViewCards,
    `Task View showed ${taskViewPictures} window pictures for ${taskViewCards} cards`,
  );
  assert(
    (await page
      .locator(".window-thumbnail-clone[data-app-id], .window-thumbnail-clone [data-app-id]")
      .count()) === 0,
    "A Task View picture kept a data-app-id and could be mistaken for a window",
  );

  await page.keyboard.press("Escape");
  await page.locator(".task-view").waitFor({ state: "hidden" });

  // Snap Assist offers the opposite half once a window takes one side.
  await page.keyboard.press("Meta+ArrowLeft");
  const snapAssist = page.locator(".snap-assist");
  await snapAssist.waitFor({ state: "visible" });
  const assistCards = await snapAssist.locator(".snap-assist-card").count();
  assert(assistCards > 0, "Snap Assist offered no windows to pair with");
  // Each candidate is the window itself, not its program's icon.
  assert(
    (await snapAssist.locator(".snap-assist-card .window-thumbnail-clone").count()) ===
      assistCards,
    "Snap Assist showed icons instead of the windows",
  );
  await snapAssist.locator(".snap-assist-card").first().click();
  await snapAssist.waitFor({ state: "hidden" });
  const snappedEdges = await page
    .locator(".window-frame:not(.window-thumbnail-clone):visible")
    .evaluateAll((frames) =>
      frames.map((frame) => Math.round(frame.getBoundingClientRect().left)),
    );
  assert(
    Math.max(...snappedEdges) > 300,
    "Snap Assist did not move the chosen window to the opposite half",
  );

  // A file dragged out of Explorer lands on the desktop.
  await page.keyboard.press("Meta+e");
  const dragExplorer = page.locator('article[data-app-id="files"]').first();
  await dragExplorer.waitFor({ state: "visible" });
  // Pick a draggable file by name, not `.first()`: the row order depends on
  // collation, so the first row was a folder on CI and a file locally — the
  // same test dragging different things on different machines.
  const dragSource = dragExplorer
    .locator('[role="option"][draggable="true"]')
    .filter({ hasNotText: "파일 폴더" })
    .first();
  await dragSource.waitFor({ state: "visible" });
  const draggedName = (await dragSource.innerText()).split("\n")[0].trim();
  /*
   * Clear of the window, and now it has to be: a drop over a window is that
   * window's business and no longer falls through to the desktop. To the
   * right used to be clear enough; it is not once the window is wide, so
   * the point is taken below the window and above the taskbar, and asserted
   * to be outside it before the drag starts.
   */
  /*
   * Room to drop into. This step used to aim beside the window and land on
   * it, which worked only because a drop over a window fell through to the
   * desktop underneath — the bug the window layer now stops. A maximized
   * window leaves no desktop at all, so it is restored first.
   */
  // Win+M, then bring back only the window this drags from: by now several
  // windows are open and between them they cover every pixel of desktop.
  await page.keyboard.press("Meta+m");
  await settle(page);
  await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).first().click();
  await dragExplorer.waitFor({ state: "visible" });
  await settle(page);
  const restoreDragExplorer = dragExplorer.getByRole("button", {
    name: /이전 크기로 복원/,
  });
  if ((await restoreDragExplorer.count()) > 0) {
    await restoreDragExplorer.click();
    await settle(page);
  }
  const dropPoint = await page.evaluate(() => {
    const taskbar = document.querySelector(".taskbar")?.getBoundingClientRect();
    const floor = (taskbar?.top ?? window.innerHeight) - 24;
    for (let y = floor; y > 120; y -= 40) {
      for (let x = 40; x < window.innerWidth - 40; x += 80) {
        const at = document.elementFromPoint(x, y);
        if (at && !at.closest(".window-frame") && at.closest(".desktop")) {
          return { x, y };
        }
      }
    }
    return null;
  });
  assert(dropPoint !== null, "No bare desktop left to drop on");
  await dragSource.dragTo(page.locator(".desktop"), { targetPosition: dropPoint });
  await page
    .locator(".desktop-icon", { hasText: draggedName })
    .first()
    .waitFor({ state: "visible" });

  // Revealing cells must not resize the board. Implicit grid rows took their
  // height from their content, so a row showing a number grew taller than an
  // empty one and everything below it shifted.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("지뢰찾기");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const minesLayout = page.locator('article[data-app-id="minesweeper"]');
  await minesLayout.waitFor({ state: "visible" });
  const cellHeights = () =>
    minesLayout
      .locator(".mine-cell")
      .evaluateAll((cells) => [
        ...new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().height))),
      ]);
  // An earlier step may already have played this board, so restart it and pick
  // a cell that is actually still covered.
  await minesLayout.getByRole("button", { name: "새 게임" }).click();
  await settle(page);
  assert((await cellHeights()).length === 1, "Minefield cells started at mixed heights");
  await minesLayout.locator(".mine-cell:not([disabled])").first().click();
  await settle(page);
  const revealedHeights = await cellHeights();
  assert(
    revealedHeights.length === 1,
    `Revealing a cell resized the minefield: heights ${revealedHeights.join(", ")}`,
  );
  await minesLayout.getByRole("button", { name: "지뢰찾기 닫기" }).click();
  Object.assign(state, {
    afterDelete,
    afterKeyboardCancel,
    afterKeyboardMove,
    afterKeyboardResize,
    afterRestore,
    altTabPictures,
    altTabSeen,
    assistCards,
    batchOutput,
    beforeEscape,
    beforeKeyboardMove,
    beforeMaximize,
    cardTitle,
    cellHeights,
    clickedItem,
    clickedTitle,
    contentResult,
    dragExplorer,
    dragSource,
    dragTarget,
    draggedName,
    dropPoint,
    expandedCwd,
    expandedVar,
    explorerAfterShell,
    firstCard,
    minesLayout,
    openWindowCount,
    piped,
    resnapped,
    restoreDragExplorer,
    restoreTarget,
    revealedHeights,
    rovingCounts,
    seam,
    searchExplorer,
    searchRows,
    snapAssist,
    snappedEdges,
    snappedLeft,
    snappedRight,
    snippet,
    taskViewBox,
    taskViewCards,
    taskViewPictures,
    taskbarBefore,
    taskbarBox,
    taskbarTop,
    unknownOutput,
    wildcardList,
  });
}
