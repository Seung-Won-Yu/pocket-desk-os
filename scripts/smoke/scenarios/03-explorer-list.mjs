import { assert, assertEventually, settle } from "../harness.mjs";

export default async function run(ctx) {
  const { page, multiSelectModifier } = ctx;
  const startMenu = page.locator(".start-menu");
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  await startMenu.waitFor({ state: "visible" });
  /*
   * 시작 메뉴 항목 메뉴. The tile's menu offered 시작 화면에서 제거 and
   * nothing else — not 열기, and nothing about 작업 표시줄, which is where
   * Windows' own menu pins from.
   */
  const startTileMenuItems = () =>
    page
      .locator(".start-tile-menu button")
      .evaluateAll((buttons) => buttons.map((button) => button.innerText.trim()));
  const taskbarAppNames = () =>
    page
      .locator(".taskbar-app")
      .evaluateAll((items) =>
        items.map((item) => item.textContent.trim().replace(/\s+/g, " ")),
      );
  const calcTile = startMenu
    .locator(".start-pinned-grid button")
    .filter({ hasText: "계산기" })
    .first();
  await calcTile.click({ button: "right" });
  await page.locator(".start-tile-menu").waitFor({ state: "visible" });
  assert(
    JSON.stringify(await startTileMenuItems()) ===
      JSON.stringify(["열기", "시작 화면에서 제거", "작업 표시줄에 고정"]),
    `A pinned tile offered ${(await startTileMenuItems()).join(", ")}`,
  );
  const taskbarBeforePin = await taskbarAppNames();
  await page
    .locator(".start-tile-menu button")
    .filter({ hasText: "작업 표시줄에 고정" })
    .first()
    .click();
  await settle(page);
  const taskbarAfterPin = await taskbarAppNames();
  assert(
    taskbarAfterPin.length === taskbarBeforePin.length + 1 &&
      taskbarAfterPin.some((name) => name.includes("계산기")),
    `작업 표시줄에 고정 left the bar as ${taskbarAfterPin.join(", ")}`,
  );
  // The same menu now offers the way back off the bar, and takes it.
  await calcTile.click({ button: "right" });
  await page.locator(".start-tile-menu").waitFor({ state: "visible" });
  assert(
    (await startTileMenuItems()).includes("작업 표시줄에서 제거"),
    `A pinned app still offered ${(await startTileMenuItems()).join(", ")}`,
  );
  await page
    .locator(".start-tile-menu button")
    .filter({ hasText: "작업 표시줄에서 제거" })
    .first()
    .click();
  await settle(page);
  assert(
    JSON.stringify(await taskbarAppNames()) === JSON.stringify(taskbarBeforePin),
    `작업 표시줄에서 제거 left the bar as ${(await taskbarAppNames()).join(", ")}`,
  );

  await startMenu.locator(".start-pinned-grid").getByRole("button", { name: /내 PC/ }).click();
  const thisPc = page.locator('article[data-app-id="thispc"]');
  await thisPc.waitFor({ state: "visible" });
  const thisPcText = await thisPc.innerText();
  assert(thisPcText.includes("장치 및 드라이브"), "This PC did not show drive section");
  assert(thisPcText.includes("로컬 디스크 (C:)"), "This PC did not show local disk");
  await thisPc.getByRole("button", { name: "자세히 보기" }).click();
  assert(
    await thisPc
      .locator(".this-pc-drive-list")
      .evaluate((node) => node.classList.contains("is-details")),
    "This PC details view did not apply",
  );
  const thisPcSearch = thisPc.getByLabel("내 PC 검색");
  await thisPcSearch.fill("없는 드라이브");
  assert(
    (await thisPc.innerText()).includes("검색 결과 없음"),
    "This PC search did not filter drives",
  );
  await thisPcSearch.fill("");
  await thisPc.getByRole("button", { name: /로컬 디스크/ }).click();
  assert(
    await thisPc.getByRole("button", { name: "열기" }).isEnabled(),
    "This PC Open command stayed disabled",
  );
  await thisPc.getByRole("button", { name: /바탕 화면/ }).click();
  await page.locator('article[data-app-id="files"]').waitFor({ state: "visible" });
  const files = page.locator('article[data-app-id="files"]');
  const explorerSidebar = files.locator("aside");
  // The details pane now starts closed, the way the Windows preview pane does,
  // so the assertions below that read it open it first. That also covers the
  // toggle itself.
  await files.getByRole("button", { name: "세부 정보 창" }).click();
  await files.locator(".file-preview").waitFor({ state: "visible" });
  await explorerSidebar.getByRole("treeitem", { name: "문서", exact: true }).click();
  assert((await files.locator(".file-list button").count()) > 0, "Documents view is empty");
  assert(
    (await files.locator(".file-list").innerText()).includes("notes.txt"),
    "Documents view did not filter notes",
  );

  // Windows sorts a details view from its column headers; these were inert
  // spans, so sorting was only reachable from the background menu.
  const nameHeader = files.locator(".file-list-header button").first();
  const readOrder = () =>
    files.evaluate((node) =>
      [...node.querySelectorAll('[role="option"]')].map(
        (option) => option.textContent?.trim().split("\n")[0] ?? "",
      ),
    );
  const beforeSort = await readOrder();
  await nameHeader.click();
  await settle(page);
  const afterSort = await readOrder();
  // The sort state rides on the accessible name now (aria-sort is only
  // valid inside a real table, and this header is a group of buttons).
  assert(
    (await nameHeader.getAttribute("aria-label")) === "이름 정렬 (내림차순)",
    "Clicking the name header did not flip the sort direction",
  );
  assert(
    beforeSort.join("|") !== afterSort.join("|"),
    "Clicking the name header did not reorder the list",
  );
  await nameHeader.click();
  await settle(page);

  // Home/End and type-ahead are how a Windows list is walked; neither did
  // anything here, so a long folder could only be crossed one arrow at a time.
  const selectedName = () =>
    files.evaluate(
      (node) =>
        node
          .querySelector('[role="option"][aria-selected="true"]')
          ?.textContent?.trim()
          .split("\n")[0] ?? null,
    );
  await files.locator('[role="option"]').first().click();
  await page.keyboard.press("End");
  await settle(page);
  const endName = await selectedName();
  await page.keyboard.press("Home");
  await settle(page);
  const homeName = await selectedName();
  assert(
    endName !== null && homeName !== null && endName !== homeName,
    `Home and End both selected ${homeName}`,
  );
  await page.keyboard.press("Shift+ArrowDown");
  await settle(page);
  assert(
    (await files.locator('[role="option"][aria-selected="true"]').count()) === 2,
    "Shift+ArrowDown replaced the selection instead of extending it",
  );

  // Typing a letter jumps to the next item that starts with it.
  await page.keyboard.press("Home");
  await settle(page);
  const beforeTypeAhead = await selectedName();
  const typeAheadLetter = (
    await files.evaluate((node) => {
      const options = [...node.querySelectorAll('[role="option"]')];
      const names = options.map((option) => option.textContent?.trim().split("\n")[0] ?? "");
      const first = names[0] ?? "";
      // A letter that some other item starts with and the first one does not —
      // one a key press can type: a Hangul name ("새 텍스트 문서.txt") has
      // no key of its own, only an IME composition.
      return (
        names.slice(1).find((name) => /^[a-z0-9]/i.test(name) && name[0] !== first[0])?.[0] ??
        ""
      );
    })
  ).toLowerCase();
  assert(typeAheadLetter !== "", "No distinct first letter to test type-ahead with");
  await page.keyboard.press(typeAheadLetter);
  await settle(page);
  const afterTypeAhead = await selectedName();
  assert(
    afterTypeAhead !== beforeTypeAhead &&
      afterTypeAhead.toLowerCase().startsWith(typeAheadLetter),
    `Typing ${typeAheadLetter} selected ${afterTypeAhead} instead of jumping to a match`,
  );

  await files.getByRole("button", { name: "새 파일 탐색기 창" }).click();
  const explorerWindows = page.locator('article[data-app-id="files"]');
  await page.waitForFunction(
    () => document.querySelectorAll('article[data-app-id="files"]').length === 2,
  );
  const secondExplorer = explorerWindows.nth(1);
  await secondExplorer.waitFor({ state: "visible" });
  assert(
    (await page.locator(".taskbar-window-count").filter({ hasText: "2" }).count()) > 0,
    "Taskbar did not show the File Explorer window count",
  );
  await secondExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "사진", exact: true })
    .click();
  assert(
    (await secondExplorer.locator(".file-address").innerText()).includes("사진"),
    "Second Explorer window did not navigate independently",
  );
  assert(
    (await explorerWindows.first().locator(".file-address").innerText()).includes("문서"),
    "Second Explorer navigation changed the first Explorer window",
  );
  await secondExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('article[data-app-id="files"]').length === 1,
  );

  await files.getByRole("button", { name: "새로 만들기" }).click();
  let newFileMenu = files.getByRole("menu", { name: "새로 만들기" });
  await newFileMenu.getByRole("menuitem", { name: "폴더" }).click();
  const folderNameInput = files.getByLabel("파일 이름");
  await folderNameInput.fill("프로젝트");
  await folderNameInput.press("Enter");
  const projectFolder = files.locator(".file-list button", { hasText: "프로젝트" });
  await projectFolder.waitFor({ state: "visible" });

  await files.getByRole("button", { name: "새로 만들기" }).click();
  await files
    .getByRole("menu", { name: "새로 만들기" })
    .getByRole("menuitem", { name: "텍스트 문서" })
    .click();
  const movingNoteNameInput = files.getByLabel("파일 이름");
  await movingNoteNameInput.fill("이동할 메모.txt");
  await movingNoteNameInput.press("Enter");
  const movingNote = files.locator(".file-list button", { hasText: "이동할 메모.txt" });
  await movingNote.dragTo(projectFolder);
  await movingNote.waitFor({ state: "hidden" });
  await projectFolder.dblclick();
  await files
    .locator(".file-list button", { hasText: "이동할 메모.txt" })
    .waitFor({ state: "visible" });
  assert(
    (await files.locator(".file-address").innerText()).includes("프로젝트"),
    "Explorer did not enter a folder",
  );
  await files.getByRole("button", { name: "위로" }).click();
  await projectFolder.waitFor({ state: "visible" });
  await files.getByRole("button", { name: "뒤로" }).click();
  await files
    .locator(".file-list button", { hasText: "이동할 메모.txt" })
    .waitFor({ state: "visible" });
  await files.getByRole("button", { name: "앞으로" }).click();
  await projectFolder.waitFor({ state: "visible" });
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();

  await files.getByRole("button", { name: "정렬", exact: true }).click();
  const explorerSortMenu = files.getByRole("menu", { name: "파일 정렬" });
  await explorerSortMenu.waitFor({ state: "visible" });
  await explorerSortMenu.getByRole("menuitemradio", { name: "이름" }).click();
  await files.getByRole("button", { name: "정렬", exact: true }).click();
  await explorerSortMenu.getByRole("menuitemradio", { name: "내림차순" }).click();
  const descendingNames = await files.locator(".file-list button > span").allInnerTexts();
  // Folders stay grouped above files whatever the direction — so with a
  // descending name sort, the very last row must still be a file, not a
  // folder. Pinning one literal filename broke as soon as the desktop
  // gained a second file.
  assert(
    (descendingNames.at(-1) ?? "").endsWith(".url"),
    `Explorer did not keep folders grouped before files: ${descendingNames.join(", ")}`,
  );

  await files.getByRole("button", { name: "큰 아이콘 보기" }).click();
  assert(
    await files
      .locator(".file-list")
      .evaluate((node) => node.classList.contains("file-view-icons")),
    "Explorer icon view did not apply",
  );
  const firstExplorerFile = files.locator(".file-list button").first();
  const firstExplorerFileName = await firstExplorerFile.locator("span").innerText();
  await firstExplorerFile.click();
  await page.keyboard.press("Control+a");
  // Select-all must cover every row — compare to the live row count instead
  // of a literal, which broke the day a new system folder shipped.
  assert(
    (await files.locator(".file-list button.is-selected").count()) ===
      (await files.locator(".file-list button").count()),
    "Explorer Ctrl+A did not select all files",
  );
  assert(
    (await files.locator(".file-list button.is-selected").count()) >= 4,
    "Explorer Ctrl+A selected suspiciously few rows",
  );
  const selectAllCount = await files.locator(".file-list button.is-selected").count();
  await firstExplorerFile.click({ modifiers: [multiSelectModifier] });
  const ctrlClickSelectionCount = await files.locator(".file-list button.is-selected").count();
  assert(
    ctrlClickSelectionCount === selectAllCount - 1,
    `Explorer Ctrl+click did not toggle selection: ${ctrlClickSelectionCount}`,
  );
  assert(
    !(await files.locator(".file-preview h3").innerText()).includes(firstExplorerFileName),
    "Explorer kept a deselected file active",
  );
  await files.locator(".file-list button", { hasText: "web-surf.url" }).click();
  await page.keyboard.press("F2");
  await files.getByLabel("파일 이름").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await files.getByLabel("파일 이름").waitFor({ state: "hidden" });
  await page.keyboard.press("ArrowUp");
  const arrowSelectedName = await files
    .locator(".file-list button.is-selected span")
    .innerText();
  assert(
    arrowSelectedName !== "web-surf.url",
    `Explorer arrow navigation did not move selection: ${arrowSelectedName}`,
  );
  /*
   * 끌어서 선택: a drag from the list's empty space draws a band and takes
   * the rows it crosses, the way the desktop's own band always has. A press
   * on empty space that never becomes a drag clears the selection instead,
   * and a press that starts on a row belongs to drag & drop — no band.
   */
  const explorerList = files.locator(".file-list");
  const explorerRowButtons = files.locator(".file-list button");
  const selectedRowNames = () =>
    files
      .locator(".file-list button.is-selected")
      .evaluateAll((els) => els.map((el) => el.innerText.split("\n")[0]));
  await explorerRowButtons.first().click();
  assert((await selectedRowNames()).length === 1, "Explorer would not select one row");
  const marqueeListBox = await explorerList.boundingBox();
  const marqueeRowCount = await explorerRowButtons.count();
  const marqueeLastRow = await explorerRowButtons.last().boundingBox();
  const marqueeBlankY = marqueeLastRow.y + marqueeLastRow.height + 30;
  assert(
    marqueeBlankY < marqueeListBox.y + marqueeListBox.height - 8,
    "The file list has no empty space under its rows to drag from",
  );
  await page.mouse.click(marqueeListBox.x + marqueeListBox.width / 2, marqueeBlankY);
  await settle(page);
  assert(
    (await selectedRowNames()).length === 0,
    `A click on the list's empty space kept ${(await selectedRowNames()).length} rows selected`,
  );

  const marqueeSecondLast = await explorerRowButtons.nth(marqueeRowCount - 2).boundingBox();
  await page.mouse.move(marqueeListBox.x + marqueeListBox.width - 40, marqueeBlankY);
  await page.mouse.down();
  await page.mouse.move(marqueeListBox.x + 30, marqueeSecondLast.y + 6, { steps: 12 });
  await settle(page);
  const marqueeBandBox = await files.locator(".file-marquee").boundingBox();
  assert(
    marqueeBandBox && marqueeBandBox.height > 10 && marqueeBandBox.width > 10,
    `끌어서 선택 drew no band: ${JSON.stringify(marqueeBandBox)}`,
  );
  await page.mouse.up();
  await settle(page);
  const bandedNames = await selectedRowNames();
  assert(
    bandedNames.length === 2,
    `끌어서 선택 took ${bandedNames.length} rows where the band covered 2: ${bandedNames.join(", ")}`,
  );
  assert(
    (await files.locator(".file-marquee").count()) === 0,
    "The selection band stayed on screen after the drag ended",
  );

  /*
   * Ctrl (⌘ on macOS) adds the band's rows to what was already selected.
   * The same rectangle as above runs again, so what it covers is known: a
   * row it misses is selected first, and both have to survive.
   */
  const allRowNames = await explorerRowButtons.evaluateAll((els) =>
    els.map((el) => el.innerText.split("\n")[0]),
  );
  const outsideBand = allRowNames.find((name) => !bandedNames.includes(name));
  assert(outsideBand, `Every row was under the band: ${allRowNames.join(", ")}`);
  await explorerRowButtons.filter({ hasText: outsideBand }).first().click();
  const beforeAdditive = await selectedRowNames();
  // Selecting a row can move the list — the preview pane beside it grows with
  // what it has to show — so the band's own points are measured again here.
  const additiveListBox = await explorerList.boundingBox();
  const additiveLastRow = await explorerRowButtons.last().boundingBox();
  const additiveBlankY = additiveLastRow.y + additiveLastRow.height + 30;
  assert(
    additiveBlankY < additiveListBox.y + additiveListBox.height - 8,
    "The file list has no empty space left to start the second band from",
  );
  // The end point is re-measured with the start: half a stale rectangle can
  // collapse into a press that never becomes a band.
  const additiveSecondLast = await explorerRowButtons.nth(marqueeRowCount - 2).boundingBox();
  assert(
    additiveBlankY - (additiveSecondLast.y + 6) > 20,
    `The second band would be ${additiveBlankY - (additiveSecondLast.y + 6)}px tall`,
  );
  // The band failed on the Linux runner and nowhere else; the events the list
  // actually saw are collected so the failure can name the cause.
  await explorerList.evaluate((list) => {
    window.__marqueeTrace = [];
    const record = (event) => {
      const target = event.target;
      window.__marqueeTrace.push(
        `${event.type}:${target === list ? "list" : (target.className || target.tagName).toString().slice(0, 24)}` +
          (event.type === "pointerdown"
            ? `:button=${event.button}:ctrl=${event.ctrlKey}:meta=${event.metaKey}`
            : ""),
      );
    };
    for (const type of [
      "pointerdown",
      "pointercancel",
      "lostpointercapture",
      "dragstart",
      "contextmenu",
    ]) {
      list.addEventListener(type, record, true);
    }
  });
  await page.keyboard.down(multiSelectModifier);
  await page.mouse.move(additiveListBox.x + additiveListBox.width - 40, additiveBlankY);
  await page.mouse.down();
  await page.mouse.move(additiveListBox.x + 30, additiveSecondLast.y + 6, { steps: 10 });
  await settle(page);
  // Kept for the failure message: a band that never appeared and a band that
  // appeared but added nothing are different bugs.
  const additiveBandCount = await files.locator(".file-marquee").count();
  const marqueeTrace = await page.evaluate(() => window.__marqueeTrace ?? []);
  assert(
    additiveBandCount === 1,
    `Ctrl+끌어서 선택 drew no band at all (events: ${marqueeTrace.join(" / ") || "none"})`,
  );
  await page.mouse.up();
  await page.keyboard.up(multiSelectModifier);
  await settle(page);
  const additiveNames = await selectedRowNames();
  assert(
    beforeAdditive.every((name) => additiveNames.includes(name)) &&
      additiveNames.length > beforeAdditive.length,
    `Ctrl+끌어서 선택 gave ${additiveNames.join(", ")} where ${beforeAdditive.join(", ")} was selected before it`,
  );

  // A press that lands on a row is a drag & drop, not a band.
  const marqueeFirstRow = await explorerRowButtons.first().boundingBox();
  await page.mouse.move(marqueeFirstRow.x + 60, marqueeFirstRow.y + marqueeFirstRow.height / 2);
  await page.mouse.down();
  await page.mouse.move(marqueeFirstRow.x + 60, marqueeFirstRow.y + 90, { steps: 8 });
  const bandFromRow = await files.locator(".file-marquee").count();
  await page.mouse.up();
  await settle(page);
  assert(bandFromRow === 0, "A drag that started on a row drew a selection band");

  /*
   * 탐색기의 가장자리: 검색 단축키, 상태 표시줄 보기 단추, 새로 만들기의
   * 인터넷 바로 가기. Windows has all three and this window had none of them.
   */
  await explorerRowButtons.first().click();
  await page.keyboard.press("Control+f");
  await settle(page);
  assert(
    (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ===
      "파일 검색",
    `Ctrl+F focused ${await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))}`,
  );
  await explorerList.click({ position: { x: 300, y: 300 } });
  await page.keyboard.press("F3");
  await assertEventually(
    async () =>
      (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ===
      "파일 검색",
    async () => "F3 did not reach 파일 검색",
  );

  const statusViewButtons = files.locator(".file-statusbar-views button");
  await statusViewButtons.nth(1).click();
  await settle(page);
  assert(
    (await explorerList.getAttribute("class")).includes("file-view-icons"),
    `The status bar's 큰 아이콘 button left the list as ${await explorerList.getAttribute("class")}`,
  );
  assert(
    (await statusViewButtons.nth(1).getAttribute("aria-pressed")) === "true",
    "The status bar's view buttons do not say which view is on",
  );
  await statusViewButtons.nth(0).click();
  await assertEventually(
    async () => (await explorerList.getAttribute("class")).includes("file-view-details"),
    async () => "The status bar's 자세히 button did not switch back",
  );

  await files.getByRole("button", { name: "새로 만들기" }).click();
  const shortcutNewMenu = files.getByRole("menu", { name: "새로 만들기" });
  await shortcutNewMenu.waitFor({ state: "visible" });
  await shortcutNewMenu.getByRole("menuitem", { name: "인터넷 바로 가기" }).click();
  const explorerShortcutDialog = page.getByRole("dialog", { name: /바로 가기/ });
  await explorerShortcutDialog.waitFor({ state: "visible" });
  await explorerShortcutDialog.getByLabel("항목 위치").fill("https://example.com/");
  await explorerShortcutDialog.getByLabel("바로 가기 이름").fill("스모크 탐색기 바로 가기");
  await explorerShortcutDialog.getByRole("button", { name: "만들기", exact: true }).click();
  await explorerShortcutDialog.waitFor({ state: "detached" });
  const madeShortcut = files
    .locator(".file-list button", { hasText: "스모크 탐색기 바로 가기" })
    .first();
  await madeShortcut.waitFor({ state: "visible" });
  // It belongs to the folder that was open, not the desktop.
  assert(
    (await madeShortcut.getAttribute("aria-selected")) === "true",
    "The new shortcut was not the selection after it was made",
  );
  await page.keyboard.press("Delete");
  await settle(page);
  assert(
    (await files
      .locator(".file-list button", { hasText: "스모크 탐색기 바로 가기" })
      .count()) === 0,
    "The smoke's own shortcut is still in the folder",
  );

  await files.getByRole("button", { name: "자세히 보기" }).click();
  await files.getByRole("button", { name: "정렬", exact: true }).click();
  await files.locator(".file-address").click();
  await explorerSortMenu.waitFor({ state: "hidden" });

  await files.getByRole("button", { name: "새로 만들기" }).click();
  newFileMenu = files.getByRole("menu", { name: "새로 만들기" });
  await newFileMenu.waitFor({ state: "visible" });
  await newFileMenu.getByRole("menuitem", { name: "텍스트 문서" }).click();
  const newFileNameInput = files.getByLabel("파일 이름");
  await newFileNameInput.waitFor({ state: "visible" });
  await newFileNameInput.fill("작업 메모.txt");
  await newFileNameInput.press("Enter");
  const workNote = files.locator(".file-list button", { hasText: "작업 메모.txt" });
  await workNote.waitFor({ state: "visible" });

  await workNote.dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
  const fileContextMenu = page.getByRole("menu", { name: "파일 메뉴" });
  await fileContextMenu.waitFor({ state: "visible" });
  assert(
    (await fileContextMenu.innerText()).includes("열기"),
    "Explorer file context menu is missing Open",
  );
  assert(
    (await fileContextMenu.innerText()).includes("복사"),
    "Explorer file context menu is missing Copy",
  );
  assert(
    (await fileContextMenu.innerText()).includes("속성"),
    "Explorer file context menu is missing Properties",
  );
  await fileContextMenu.getByRole("menuitem", { name: "속성" }).click();
  const propertiesDialog = files.getByRole("dialog", { name: "파일 속성" });
  await propertiesDialog.waitFor({ state: "visible" });
  const propertiesText = await propertiesDialog.innerText();
  assert(
    propertiesText.includes("작업 메모.txt"),
    "Explorer Properties did not show the file name",
  );
  assert(propertiesText.includes("크기"), "Explorer Properties did not show file size");
  assert(
    propertiesText.includes("만든 날짜"),
    "Explorer Properties did not show creation time",
  );
  const propertiesLayout = await propertiesDialog.evaluate((dialog) => {
    const overlay = dialog.parentElement;
    const windowContent = dialog.closest(".window-content");
    const dialogBox = dialog.getBoundingClientRect();
    const overlayBox = overlay?.getBoundingClientRect();
    return {
      contained:
        Boolean(overlayBox) &&
        dialogBox.top >= overlayBox.top &&
        dialogBox.bottom <= overlayBox.bottom,
      windowScrollTop: windowContent?.scrollTop ?? -1,
    };
  });
  assert(propertiesLayout.contained, "Explorer Properties overflowed its window");
  assert(propertiesLayout.windowScrollTop === 0, "Explorer Properties scrolled the whole app");
  /*
   * 폴더 속성과 폴더 옵션. 사진 holds the PNG the Paint step saved, so its
   * size is a real total — which is the point: 속성 called the per-entry size
   * helper, and a folder's own size is zero, so every folder reported "0 B"
   * however much was inside it.
   */
  assert(
    propertiesText.includes("특성") && propertiesText.includes("숨김"),
    "Explorer Properties does not offer the 숨김 attribute",
  );
  await propertiesDialog.getByRole("button", { name: "확인" }).click();
  await settle(page);

  const explorerRows = files.locator('.file-list button[role="option"]');
  const readProperties = async (rowText) => {
    await explorerRows.filter({ hasText: rowText }).first().click({ button: "right" });
    await fileContextMenu.getByRole("menuitem", { name: "속성" }).click();
    await propertiesDialog.waitFor({ state: "visible" });
    return propertiesDialog.innerText();
  };
  const parseFolderBytes = (text) => {
    const match = /크기\n([\d.]+)\s*(B|KB|MB)/.exec(text);
    if (!match) return -1;
    return Number(match[1]) * { B: 1, KB: 1024, MB: 1024 * 1024 }[match[2]];
  };

  const picturesProperties = await readProperties("사진");
  assert(
    parseFolderBytes(picturesProperties) > 0,
    `사진 holds a saved PNG and 속성 reports ${parseFolderBytes(picturesProperties)} bytes; a folder's size is the sum of what is inside it`,
  );
  assert(
    /내용\n파일 \d+개, 폴더 \d+개/.test(picturesProperties),
    `Folder Properties did not say what the folder holds: ${picturesProperties}`,
  );
  // A system folder cannot be hidden: 사진 would leave the sidebar while
  // every path still ran through it.
  assert(
    await propertiesDialog.getByLabel("숨김").isDisabled(),
    "속성 offered to hide a system folder",
  );
  await propertiesDialog.getByRole("button", { name: "확인" }).click();
  await settle(page);

  /*
   * 속성 on more than one row describes the selection, not the first of
   * them: it used to open the single-file dialog for whichever row the
   * menu was aimed at and say nothing about the rest. The status bar's
   * size had the same hole — it summed entry sizes, and a folder's own
   * size is zero.
   */
  await explorerRows.first().click();
  await explorerRows.nth(1).click({ modifiers: [multiSelectModifier] });
  const groupProperties = files.getByRole("dialog", { name: "선택 항목 속성" });
  await page.keyboard.press("Alt+Enter");
  await groupProperties.waitFor({ state: "visible" });
  const groupText = await groupProperties.innerText();
  assert(groupText.includes("2개 항목"), `선택 항목 속성 said ${groupText.split("\n")[0]}`);
  assert(
    /내용\n파일 \d+개, 폴더 \d+개/.test(groupText),
    `선택 항목 속성 did not say what the selection holds: ${groupText}`,
  );
  assert(
    parseFolderBytes(groupText) > 0,
    `선택 항목 속성 reported ${parseFolderBytes(groupText)} bytes for a selection holding a folder`,
  );
  assert(
    (await files.locator(".file-statusbar").innerText()).includes("2개 선택됨"),
    "The status bar lost the selection count",
  );
  // Two system folders: 숨김 has nothing it may change, and says so.
  assert(
    await groupProperties.getByLabel("숨김").isDisabled(),
    "선택 항목 속성 offered to hide a selection of system folders",
  );
  await page.keyboard.press("Escape");
  await groupProperties.waitFor({ state: "detached" });

  // 숨김 is set from the entry's own 속성, and the dialog stays open when it
  // is — looking its own subject up in the filtered list used to close it.
  const rowsBeforeHide = await explorerRows.count();
  await readProperties("작업 메모.txt");
  await propertiesDialog.getByLabel("숨김").check();
  assert(await propertiesDialog.isVisible(), "Ticking 숨김 closed the dialog it was ticked in");
  await propertiesDialog.getByRole("button", { name: "확인" }).click();
  await settle(page);
  assert(
    (await explorerRows.count()) === rowsBeforeHide - 1,
    "A hidden file stayed in the list",
  );
  assert(
    (await page.locator(".toast").allInnerTexts()).some((toast) =>
      toast.includes("숨긴 항목 보기"),
    ),
    "Hiding an entry offered no way back to it",
  );

  await files.getByRole("button", { name: "보기 옵션" }).click();
  await files.getByRole("menuitemcheckbox", { name: "숨긴 항목" }).click();
  await assertEventually(
    async () => (await explorerRows.count()) === rowsBeforeHide,
    async () => "숨긴 항목 did not bring the hidden file back",
  );

  // 파일 확장명 changes what the list shows, not what is stored.
  const namesWithExtensions = await explorerRows.allInnerTexts();
  await files.getByRole("menuitemcheckbox", { name: "파일 확장명" }).click();
  await settle(page);
  const namesWithoutExtensions = await explorerRows.allInnerTexts();
  assert(
    namesWithExtensions.some((row) => row.startsWith("작업 메모.txt")) &&
      namesWithoutExtensions.some((row) => row.startsWith("작업 메모\n")),
    `확장명 on/off read ${JSON.stringify([namesWithExtensions, namesWithoutExtensions])}`,
  );
  assert(
    namesWithoutExtensions.some((row) => row.startsWith("사진")),
    "The extension toggle took a name apart that had no extension to hide",
  );
  await files.getByRole("menuitemcheckbox", { name: "파일 확장명" }).click();
  await settle(page);

  /*
   * 그룹화 and 보내기. Grouping is a second sort applied first, so the check
   * that matters is that the rows are still one list the keyboard can walk —
   * headers appear between them, nothing is lost, and turning it off leaves
   * the list as it was.
   */
  const groupHeaders = files.locator(".file-group-header");
  assert((await groupHeaders.count()) === 0, "The list was grouped before it was asked to be");
  const rowsBeforeGrouping = await explorerRows.count();
  await files.getByRole("button", { name: "정렬", exact: true }).click();
  await files.getByRole("menuitemradio", { name: "유형", exact: true }).click();
  await settle(page);
  const headerLabels = await groupHeaders.allInnerTexts();
  assert(
    headerLabels.length >= 2 && headerLabels.includes("파일 폴더"),
    `그룹화(유형) produced headings ${JSON.stringify(headerLabels)}`,
  );
  assert(
    (await explorerRows.count()) === rowsBeforeGrouping,
    "Grouping added or dropped rows instead of only reordering them",
  );
  await explorerRows.first().click();
  await page.keyboard.press("ArrowDown");
  assert(
    (await files.locator(".file-list button.is-selected").count()) === 1,
    "The arrow keys stopped walking the list once it was grouped",
  );
  await files.getByRole("button", { name: "정렬", exact: true }).click();
  await files.getByRole("menuitemradio", { name: "없음", exact: true }).click();
  await settle(page);
  assert((await groupHeaders.count()) === 0, "그룹화 없음 left the headings behind");

  // 보내기 copies: the original stays where it is, and one toast names where
  // the copy went — the generic paste toast beside it was two for one action.
  await explorerRows.filter({ hasText: "web-surf.url" }).first().click({ button: "right" });
  await fileContextMenu.getByRole("menuitem", { name: "보내기" }).click();
  await settle(page);
  const sendMenu = page.locator('[aria-label="보내기"]');
  await sendMenu.waitFor({ state: "visible" });
  // Compared with what was already on screen: earlier steps leave toasts of
  // their own, and the claim is that this action adds one, not that the
  // screen holds one. By text, not by count — the stack shows four at most,
  // so a fifth pushes the oldest out and the count stays put.
  const toastsBeforeSend = await page.locator(".toast").allInnerTexts();
  await sendMenu.getByRole("menuitem", { name: "문서", exact: true }).click();
  await settle(page);
  const sendToasts = await page.locator(".toast").allInnerTexts();
  const addedToasts = sendToasts.filter((toast) => !toastsBeforeSend.includes(toast));
  assert(
    addedToasts.length === 1 && addedToasts[0].includes("문서(으)로 보냄"),
    `보내기 added ${addedToasts.length} toast(s): ${addedToasts.join(" | ").replace(/\n/g, " ")}`,
  );
  assert(
    (await explorerRows.filter({ hasText: "web-surf.url" }).count()) === 1,
    "보내기 moved the original instead of copying it",
  );
  await explorerSidebar.getByRole("treeitem", { name: "문서", exact: true }).click();
  await assertEventually(
    async () => (await explorerRows.filter({ hasText: "web-surf" }).count()) === 1,
    async () => "The copy 보내기 made never arrived in 문서",
  );
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
  await settle(page);

  /*
   * 실행 취소. The stack belongs to the shell, so a rename made in Explorer
   * comes back through the same Ctrl+Z the desktop uses. Pressing Enter on
   * the rename box used to commit twice — the submit, and then the unmount's
   * blur — so how many toasts one rename raises is part of the claim.
   */
  const renameTarget = explorerRows.filter({ hasText: "web-surf.url" }).first();
  await renameTarget.click({ button: "right" });
  await fileContextMenu.getByRole("menuitem", { name: "이름 바꾸기", exact: true }).click();
  const renameBox = files.locator(".file-inline-rename input");
  await renameBox.waitFor({ state: "visible" });
  // An earlier rename's toast can still be standing; only this one's count.
  const toastsBeforeRename = await page.locator(".toast").allInnerTexts();
  await renameBox.fill("발표자료.url");
  await renameBox.press("Enter");
  await explorerRows.filter({ hasText: "발표자료.url" }).first().waitFor();
  await settle(page);
  const renameToasts = (await page.locator(".toast").allInnerTexts()).filter(
    (toast) => toast.includes("이름 변경됨") && !toastsBeforeRename.includes(toast),
  );
  assert(
    renameToasts.length === 1,
    `One rename raised ${renameToasts.length} 이름 변경됨 toast(s)`,
  );

  const folderMenu = files.locator('[aria-label="폴더 메뉴"]');
  const readUndoRow = async () => {
    await files.locator(".file-list").click({ button: "right", position: { x: 300, y: 300 } });
    await folderMenu.waitFor({ state: "visible" });
    const row = folderMenu.locator(".menu-undo-item").first();
    const text = (await row.innerText()).trim();
    const box = await row.boundingBox();
    await page.keyboard.press("Escape");
    await folderMenu.waitFor({ state: "hidden" });
    return { box, text };
  };
  const afterRenameRow = await readUndoRow();
  assert(
    afterRenameRow.text === "실행 취소 — 이름 바꾸기",
    `The Explorer menu offered "${afterRenameRow.text}"`,
  );
  // One line. The label is the longest row in the menu and used to wrap,
  // which pushed its own text out of a fixed-height desktop row.
  assert(
    afterRenameRow.box.height <= 40,
    `The 실행 취소 row stood ${afterRenameRow.box.height}px tall, so the label wrapped`,
  );

  await explorerRows.first().click();
  await page.keyboard.press("Control+z");
  await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor();
  assert(
    (await explorerRows.filter({ hasText: "발표자료.url" }).count()) === 0,
    "실행 취소 left the new name on the row",
  );
  await page.keyboard.press("Control+y");
  await explorerRows.filter({ hasText: "발표자료.url" }).first().waitFor();
  await page.keyboard.press("Control+z");
  await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor();

  // 삭제 comes back too, and the row returns out of the 휴지통 whole.
  await explorerRows.filter({ hasText: "web-surf.url" }).first().click();
  await page.keyboard.press("Delete");
  await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor({ state: "detached" });
  await page.keyboard.press("Control+z");
  await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor();

  /*
   * 파일 바꾸기 또는 건너뛰기. The shell used to answer this by itself: every
   * copy went through the copy-namer, so a file landing in a folder that did
   * not have the name still arrived as "- 복사본".
   */
  const focusFileList = async () => {
    await files.locator(".file-list").click({ position: { x: 320, y: 320 } });
    await settle(page);
  };
  const copyDesktopShortcutInto = async (folder) => {
    await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
    await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor();
    await explorerRows.filter({ hasText: "web-surf.url" }).first().click();
    await page.keyboard.press("Control+c");
    await explorerSidebar.getByRole("treeitem", { name: folder, exact: true }).click();
    await settle(page);
    await focusFileList();
    await page.keyboard.press("Control+v");
  };
  const conflictDialog = page.locator(".name-conflict-dialog");

  await copyDesktopShortcutInto("다운로드");
  await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor();
  assert(
    (await conflictDialog.count()) === 0,
    "A copy into a folder with no such name still asked about a conflict",
  );
  assert(
    (await explorerRows.filter({ hasText: "복사본" }).count()) === 0,
    "A copy into an empty folder was renamed - 복사본 with nothing to collide with",
  );

  await copyDesktopShortcutInto("다운로드");
  await conflictDialog.waitFor({ state: "visible" });
  const conflictText = (await conflictDialog.innerText()).replace(/\s+/g, " ");
  assert(
    conflictText.includes("다운로드 폴더에 이미") && conflictText.includes("web-surf.url"),
    `파일 바꾸기 또는 건너뛰기 said: ${conflictText}`,
  );
  // Focus is on the dialog, not on a choice: every answer is one keystroke
  // away and one of them writes over a file.
  assert(
    await page.evaluate(() =>
      document.activeElement?.classList.contains("name-conflict-dialog"),
    ),
    "The conflict dialog put focus on one of its answers",
  );
  await conflictDialog.getByRole("button", { name: /건너뛰기/ }).click();
  await conflictDialog.waitFor({ state: "hidden" });
  await settle(page);
  assert(
    (await explorerRows.count()) === 1,
    `건너뛰기 still copied — 다운로드 holds ${await explorerRows.count()} rows`,
  );

  await copyDesktopShortcutInto("다운로드");
  await conflictDialog.waitFor({ state: "visible" });
  await conflictDialog.getByRole("button", { name: "두 파일 모두 유지" }).click();
  await explorerRows.filter({ hasText: "web-surf - 복사본.url" }).first().waitFor();

  // 바꾸기 writes over the row already there rather than adding one, and
  // 실행 취소 brings the row it wrote over back — with its own id.
  const rowIdOf = (name) =>
    explorerRows.filter({ hasText: name }).first().getAttribute("data-file-id");
  const replacedRowId = await rowIdOf("web-surf.url");
  await copyDesktopShortcutInto("다운로드");
  await conflictDialog.waitFor({ state: "visible" });
  await conflictDialog.getByRole("button", { name: "대상 폴더의 파일 바꾸기" }).click();
  await conflictDialog.waitFor({ state: "hidden" });
  await settle(page);
  assert(
    (await explorerRows.count()) === 2,
    `바꾸기 added a row instead of replacing one — 다운로드 holds ${await explorerRows.count()}`,
  );
  assert(
    (await rowIdOf("web-surf.url")) !== replacedRowId,
    "바꾸기 left the row that was supposed to be written over",
  );
  await explorerRows.first().click();
  await page.keyboard.press("Control+z");
  await assertEventually(
    async () => (await rowIdOf("web-surf.url")) === replacedRowId,
    async () => "실행 취소 did not bring back the row 바꾸기 wrote over",
  );

  // Leave 다운로드 as it was found.
  await focusFileList();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await settle(page);
  assert(
    (await explorerRows.count()) === 0,
    "The conflict checks left rows behind in 다운로드",
  );
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
  await settle(page);
}
