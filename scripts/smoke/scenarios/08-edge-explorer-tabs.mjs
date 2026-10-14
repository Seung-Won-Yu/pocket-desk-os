import { assert, assertEventually, settle } from "../harness.mjs";

export default async function run(ctx) {
  const { page } = ctx;
  const runDialog = page.locator(".run-dialog");
  // Edge's tab strip was a single hardcoded tab; each tab now keeps its own
  // page, and none of that had a test.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("msedge");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const edgeTabs = page.locator('article[data-app-id="browser"]').first();
  await edgeTabs.waitFor({ state: "visible" });
  await settle(page);
  const addressBar = edgeTabs.locator(".browser-toolbar input").first();
  const firstTabAddress = await addressBar.inputValue();
  assert(
    (await edgeTabs.locator(".browser-tab").count()) === 1,
    "Edge did not start with one tab",
  );

  await edgeTabs.locator(".browser-tab-strip > button").click();
  await assertEventually(
    async () => (await edgeTabs.locator(".browser-tab").count()) === 2,
    async () => "The new tab button did not open a tab",
  );
  assert(
    (await addressBar.inputValue()) === "",
    "A new tab opened showing the previous tab's address",
  );

  await addressBar.fill("example.com");
  await addressBar.press("Enter");
  await settle(page);
  await edgeTabs.locator(".browser-tab").first().click();
  await settle(page);
  assert(
    (await addressBar.inputValue()) === firstTabAddress,
    `Switching back showed ${await addressBar.inputValue()} instead of the first tab's own address`,
  );

  // Edge's strip answers the arrow keys as well, and the tab that becomes
  // the tab stop takes the focus with it.
  const currentBrowserTab = async () => {
    const flags = await edgeTabs
      .locator(".browser-tab")
      .evaluateAll((tabs) => tabs.map((tab) => tab.getAttribute("aria-selected")));
    return flags.indexOf("true");
  };
  assert((await currentBrowserTab()) === 0, "Clicking the first tab did not select it");
  await page.keyboard.press("ArrowRight");
  await assertEventually(
    async () => (await currentBrowserTab()) === 1,
    async () => `ArrowRight did not move Edge's tab (selected ${await currentBrowserTab()})`,
  );

  await edgeTabs.locator(".browser-tab-close").last().click();
  await assertEventually(
    async () => (await edgeTabs.locator(".browser-tab").count()) === 1,
    async () => "Closing a tab did not remove it",
  );
  // Middle-click closes a tab; on the last one Edge goes home instead.
  await edgeTabs.locator(".browser-tab-strip > button").click();
  await settle(page);
  await edgeTabs.locator(".browser-tab").last().click({ button: "middle" });
  await settle(page);
  assert(
    (await edgeTabs.locator(".browser-tab").count()) === 1,
    `Middle-clicking a tab did not close it (${await edgeTabs.locator(".browser-tab").count()} left)`,
  );
  await edgeTabs.getByRole("button", { name: "Microsoft Edge 닫기" }).click();
  await settle(page);

  // 작업 표시줄 창 배열: 창 나란히 정렬 tiles the visible windows edge to
  // edge without overlap; 창 계단식 배열 stairs them one title bar apart.
  for (const command of ["notepad", "calc"]) {
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill(command);
    await runDialog.getByRole("button", { name: "확인" }).click();
    await settle(page);
  }
  const arrangeFrames = page.locator(".window-frame:not(.window-thumbnail-clone):visible");
  const arrangeCount = await arrangeFrames.count();
  assert(arrangeCount >= 2, `Arrangement check needs 2 windows, found ${arrangeCount}`);
  const readFrameBoxes = () =>
    arrangeFrames.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          h: rect.height,
          w: rect.width,
          x: rect.x,
          y: rect.y,
          z: Number(node.style.zIndex),
        };
      }),
    );
  const openShellMenu = async () => {
    await page.locator(".taskbar").click({ button: "right", position: { x: 30, y: 24 } });
    const shellMenu = page.locator(".taskbar-context-menu.is-shell-menu");
    await shellMenu.waitFor({ state: "visible" });
    return shellMenu;
  };
  await (await openShellMenu()).getByRole("menuitem", { name: "창 나란히 정렬" }).click();
  await settle(page);
  const tiled = await readFrameBoxes();
  const overlapping = tiled.some((first, index) =>
    tiled.some(
      (second, otherIndex) =>
        index !== otherIndex &&
        first.x < second.x + second.w - 1 &&
        second.x < first.x + first.w - 1 &&
        first.y < second.y + second.h - 1 &&
        second.y < first.y + first.h - 1,
    ),
  );
  assert(!overlapping, `창 나란히 정렬 left windows overlapping: ${JSON.stringify(tiled)}`);
  assert(
    Math.round(Math.max(...tiled.map((box) => box.x + box.w))) === 1280,
    `창 나란히 정렬 did not reach the right edge: ${JSON.stringify(tiled)}`,
  );
  await (await openShellMenu()).getByRole("menuitem", { name: "창 계단식 배열" }).click();
  await settle(page);
  const stairs = (await readFrameBoxes()).sort((first, second) => first.z - second.z);
  for (let index = 1; index < stairs.length; index += 1) {
    assert(
      Math.round(stairs[index].x - stairs[index - 1].x) === 28 &&
        Math.round(stairs[index].y - stairs[index - 1].y) === 28,
      `창 계단식 배열 stair ${index} is off: ${JSON.stringify(stairs)}`,
    );
  }

  /*
   * 창 슬롯 memo: a commit that only moves a window has to hand every slot
   * the identical props object, or every window re-renders on every
   * pointermove. `data-shared-props` counts how many times that object was
   * rebuilt; one un-memoized function in its dependency list broke this
   * twice, and both times only a hand measurement noticed.
   */
  const windowLayer = page.locator(".window-layer");
  const sharedPropsGeneration = async () =>
    Number(await windowLayer.getAttribute("data-shared-props"));
  const moveTitle = await page
    .locator(".window-frame.is-active .window-titlebar")
    .boundingBox();
  const generationBeforeMove = await sharedPropsGeneration();
  await page.mouse.move(moveTitle.x + 120, moveTitle.y + 12);
  await page.mouse.down();
  // One direction only: a zig-zag here would be an Aero Shake.
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(moveTitle.x + 120 + step * 5, moveTitle.y + 12 + step * 3);
  }
  await page.mouse.up();
  await settle(page);
  const generationAfterMove = await sharedPropsGeneration();
  assert(
    Number.isFinite(generationBeforeMove) && generationAfterMove === generationBeforeMove,
    `Dragging a window rebuilt the shared props ${generationAfterMove - generationBeforeMove} time(s), so every window re-rendered with it`,
  );

  /*
   * 스냅 레이아웃: Win+Z offers the whole-screen arrangements, including the
   * thirds — which no screen edge can mean, so the picker is the only way to
   * them. Picking a cell goes through the shell's snap, so the window
   * remembers where it is.
   */
  await page.keyboard.press("Meta+z");
  const snapFlyout = page.locator(".snap-layout-flyout");
  await snapFlyout.waitFor({ state: "visible", timeout: 6000 });
  assert(
    (await snapFlyout.locator(".snap-layout-option").count()) === 4,
    `Win+Z offered ${await snapFlyout.locator(".snap-layout-option").count()} layouts`,
  );
  const middleThird = snapFlyout.getByRole("menuitem", { name: /가운데 3분의 1/ });
  assert(await middleThird.count(), "The thirds layout is missing its middle column");
  await middleThird.click();
  await settle(page);
  const thirdBox = await page.locator(".window-frame.is-active").boundingBox();
  const workAreaWidth = 1280;
  assert(
    Math.abs(thirdBox.x - Math.round(workAreaWidth / 3)) <= 1 &&
      Math.abs(thirdBox.width - Math.round(workAreaWidth / 3)) <= 2,
    `The middle third landed at ${JSON.stringify({ w: thirdBox.width, x: thirdBox.x })}`,
  );
  assert(
    (await page.locator(".snap-layout-flyout").count()) === 0,
    "Picking a layout left the flyout open",
  );
  // A snapped window is remembered as snapped: Win+↑ maximizes from here
  // rather than treating the column as a floating size.
  assert(
    await page.locator(".window-frame.is-active").evaluate((frame) => frame.style.width !== ""),
    "The snapped column has no width of its own",
  );

  // Aero Shake: shaking the front window's title bar minimizes every other
  // window; shaking again brings them back. A straight drag never does.
  const shakeTarget = page.locator(".window-frame.is-active");
  const shakeTitle = await shakeTarget.locator(".window-titlebar").boundingBox();
  const shakeFrom = { x: shakeTitle.x + 140, y: shakeTitle.y + 12 };
  const shake = async () => {
    await page.mouse.move(shakeFrom.x, shakeFrom.y);
    await page.mouse.down();
    for (let swing = 0; swing < 6; swing += 1) {
      await page.mouse.move(shakeFrom.x + (swing % 2 === 0 ? 70 : -70), shakeFrom.y, {
        steps: 2,
      });
    }
    await page.mouse.move(shakeFrom.x, shakeFrom.y, { steps: 2 });
    await page.mouse.up();
    await settle(page);
  };
  const minimizedFrames = page.locator(
    ".window-frame:not(.window-thumbnail-clone).is-minimized",
  );
  /*
   * Three reversals have to land inside 600ms. Each move is a round trip to
   * the browser, and on a loaded machine six of them can take longer than
   * that — the gesture then reads as a slow drag and, rightly, does nothing.
   * A shake that changed nothing is tried again; one that changed the wrong
   * thing still fails below.
   */
  const shakeUntil = async () => {
    const before = await minimizedFrames.count();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await shake();
      if ((await minimizedFrames.count()) !== before) return;
    }
  };
  const minimizedBeforeShake = await minimizedFrames.count();
  await shakeUntil();
  assert(
    (await minimizedFrames.count()) === minimizedBeforeShake + arrangeCount - 1 &&
      !(await shakeTarget.getAttribute("class"))?.includes("is-minimized"),
    `Aero Shake did not minimize the other windows (${await minimizedFrames.count()} minimized)`,
  );
  // The counter is not simply frozen: minimizing changes something the
  // shared props carry, so it has to move.
  assert(
    (await sharedPropsGeneration()) > generationAfterMove,
    "Minimizing windows did not rebuild the shared props, so the counter says nothing",
  );
  await shakeUntil();
  assert(
    (await minimizedFrames.count()) === minimizedBeforeShake,
    "A second Aero Shake did not bring the other windows back",
  );

  // Aero Peek: the thumbnail under the pointer shows its window alone; the
  // show-desktop strip under the pointer shows the desktop through them all.
  await page.locator(".taskbar-app", { hasText: "메모장" }).hover();
  const peekCard = page.locator(".taskbar-preview-card");
  await peekCard.waitFor({ state: "visible" });
  await peekCard.locator(".taskbar-preview-select").first().hover();
  await settle(page);
  // The card must survive the pointer entering it — its close and switch
  // buttons were unreachable by mouse when the hide timer outlived the enter.
  assert(await peekCard.isVisible(), "Moving the pointer into the preview card closed it");
  assert(
    (await page.locator(".window-layer.is-peeking").count()) === 1 &&
      (await page.locator(".window-frame.is-peeked").count()) === 1,
    "Hovering a taskbar thumbnail did not peek at its window",
  );
  const dimmedFilter = await page
    .locator(".window-frame:not(.window-thumbnail-clone):not(.is-peeked):visible")
    .first()
    .evaluate((node) => getComputedStyle(node).filter);
  assert(
    dimmedFilter.includes("opacity(0.08)"),
    `Peek left other windows at filter ${dimmedFilter}`,
  );
  await page.mouse.move(640, 300);
  await settle(page);
  assert(
    (await page.locator(".window-layer.is-peeking").count()) === 0,
    "Peek stayed on after the pointer left the thumbnail",
  );
  await page.locator(".show-desktop-button").hover();
  await assertEventually(
    async () => (await page.locator(".window-layer.is-peeking-desktop").count()) === 1,
    async () => "Resting on the show-desktop strip did not peek at the desktop",
  );
  await page.mouse.move(640, 300);
  await settle(page);
  assert(
    (await page.locator(".window-layer.is-peeking-desktop").count()) === 0,
    "Desktop peek stayed on after the pointer left the strip",
  );
  for (const name of ["계산기 닫기", "메모장 닫기"]) {
    await page.getByRole("button", { name }).last().click();
    await settle(page);
  }

  // 주소 표시줄: Ctrl+L turns the breadcrumbs into a path you can type.
  // Its own window: whatever Explorer the sections above left behind may be
  // minimized, and a hidden window cannot be typed into.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("explorer");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const pathExplorer = page.locator('article[data-app-id="files"]').last();
  await pathExplorer.waitFor({ state: "visible" });
  await pathExplorer.locator(".file-list").click({ position: { x: 8, y: 8 } });
  await page.keyboard.press("Control+l");
  // exact: "경로 입력" (the button that opens it) also contains "경로".
  const pathInput = pathExplorer.getByLabel("경로", { exact: true });
  await pathInput.waitFor({ state: "visible" });
  await pathInput.fill("바탕 화면\\문서");
  await page.keyboard.press("Enter");
  await assertEventually(
    async () => (await pathExplorer.getAttribute("aria-label"))?.startsWith("문서 - "),
    async () =>
      `Typing a path did not navigate: ${await pathExplorer.getAttribute("aria-label")}`,
  );
  // A path that names no folder says so and stays put. The box from the first
  // path has to be gone first: reopened while it was still closing, the new
  // path was typed into a box on its way out.
  await pathInput.waitFor({ state: "hidden" });
  await page.keyboard.press("Control+l");
  await pathInput.waitFor({ state: "visible" });
  await pathInput.fill("바탕 화면\\없는 폴더");
  await page.keyboard.press("Enter");
  await page
    .locator(".toast", { hasText: "경로를 찾을 수 없음" })
    .waitFor({ state: "visible" });
  assert(
    (await pathExplorer.getAttribute("aria-label"))?.startsWith("문서 - "),
    "A bad path moved the window anyway",
  );
  await page.keyboard.press("Escape");
  await pathInput.waitFor({ state: "hidden" });
  await pathExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "바탕 화면", exact: true })
    .click();
  await settle(page);

  // 검색: the matched text is marked in the names it matched.
  await pathExplorer.getByLabel("파일 검색").fill("문");
  await settle(page);
  assert(
    (await pathExplorer.locator(".file-list mark").count()) > 0,
    "The search marked nothing in the names it matched",
  );
  await pathExplorer.getByLabel("파일 검색").fill("");
  await settle(page);

  // 상태 표시줄: selecting a file shows what it weighs.
  await pathExplorer.locator(".file-list button").first().click();
  await settle(page);
  const statusText = await pathExplorer.locator(".file-statusbar").innerText();
  assert(
    /1개 선택됨( · [\d.]+ ?(B|KB|MB))?/.test(statusText.replace(/\s+/g, " ")),
    `The status bar did not report the selection: ${statusText.replace(/\s+/g, " ")}`,
  );

  await pathExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await pathExplorer.waitFor({ state: "detached" });

  // 탐색기 탭: each tab keeps its own place.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("explorer");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const tabExplorer = page.locator('article[data-app-id="files"]').last();
  await tabExplorer.waitFor({ state: "visible" });
  const explorerTabs = tabExplorer.locator(".file-tab");
  assert((await explorerTabs.count()) === 1, "Explorer started with more than one tab");
  await tabExplorer.getByRole("button", { name: "새 탭" }).click();
  await assertEventually(
    async () => (await explorerTabs.count()) === 2,
    async () => "새 탭 did not add a tab",
  );
  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "문서", exact: true })
    .click();
  await settle(page);
  assert(
    (await explorerTabs.nth(1).innerText()).includes("문서") &&
      (await explorerTabs.nth(0).innerText()).includes("바탕 화면"),
    `Navigating one tab moved the other: ${await explorerTabs.allInnerTexts()}`,
  );
  await explorerTabs.nth(0).click();
  await assertEventually(
    async () => (await tabExplorer.getAttribute("aria-label"))?.startsWith("바탕 화면"),
    async () => "Switching back did not return to the first tab's folder",
  );
  await explorerTabs
    .nth(1)
    .getByRole("button", { name: /탭 닫기/ })
    .click();
  await assertEventually(
    async () => (await explorerTabs.count()) === 1,
    async () => "Closing a tab did not remove it",
  );
  // Ctrl+T adds a tab, dragging reorders, Ctrl+Tab walks them, Ctrl+W closes.
  await page.keyboard.press("Control+t");
  await page.keyboard.press("Control+t");
  await assertEventually(
    async () => (await explorerTabs.count()) === 3,
    async () => "Ctrl+T did not add tabs",
  );
  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "사진", exact: true })
    .click();
  await settle(page);
  const beforeDrag = await explorerTabs.allInnerTexts();
  await explorerTabs.nth(2).dragTo(explorerTabs.nth(0));
  await settle(page);
  const afterDrag = await explorerTabs.allInnerTexts();
  assert(
    afterDrag[0] === beforeDrag[2] && afterDrag.length === beforeDrag.length,
    `Dragging a tab did not move it: ${JSON.stringify(beforeDrag)} → ${JSON.stringify(afterDrag)}`,
  );
  await page.keyboard.press("Control+Tab");
  await settle(page);
  assert(
    (await tabExplorer.locator(".file-tab.is-active").count()) === 1,
    "Ctrl+Tab left more than one tab active",
  );
  await page.keyboard.press("Control+w");
  await assertEventually(
    async () => (await explorerTabs.count()) === 2,
    async () => "Ctrl+W did not close a tab",
  );

  // role="tablist" promises the arrow keys, and a roving tab stop has to
  // carry focus with it or the next arrow comes from a stranded element.
  await explorerTabs.nth(0).click();
  await settle(page);
  // Compared by node, not by name: Ctrl+T opens the new tab at the folder the
  // old one showed, so every tab in the strip can carry the same name.
  const focusedTabIndex = () =>
    explorerTabs.evaluateAll((tabs) => tabs.findIndex((tab) => tab === document.activeElement));
  const selectedTabIndex = async () => {
    const flags = await explorerTabs.evaluateAll((tabs) =>
      tabs.map((tab) => tab.getAttribute("aria-selected")),
    );
    return flags.indexOf("true");
  };
  await page.keyboard.press("ArrowRight");
  await assertEventually(
    async () => (await selectedTabIndex()) === 1,
    async () =>
      `ArrowRight did not move to the next tab (selected ${await selectedTabIndex()})`,
  );
  assert(
    (await focusedTabIndex()) === 1,
    `ArrowRight left focus on tab ${await focusedTabIndex()} instead of the one it selected`,
  );
  await page.keyboard.press("Home");
  await assertEventually(
    async () => (await selectedTabIndex()) === 0,
    async () => "Home did not jump to the first tab",
  );
  // Up and Down belong to whatever is around a horizontal strip.
  await page.keyboard.press("ArrowDown");
  await settle(page);
  assert((await selectedTabIndex()) === 0, "ArrowDown moved a horizontal tab strip");

  // Middle-click closes a tab in Explorer and in every browser.
  await explorerTabs.nth(1).click({ button: "middle" });
  await settle(page);
  assert(
    (await explorerTabs.count()) === 1,
    `Middle-clicking a tab did not close it (${await explorerTabs.count()} left)`,
  );
  await page.keyboard.press("Control+t");
  await assertEventually(
    async () => (await explorerTabs.count()) === 2,
    async () => "Ctrl+T did not restore a second tab",
  );
  // 폴더를 새 탭에서 열기
  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "바탕 화면", exact: true })
    .click();
  await settle(page);
  await tabExplorer
    .locator(".file-list button", { hasText: "문서" })
    .first()
    .click({ button: "right" });
  await tabExplorer
    .locator(".file-context-menu")
    .getByRole("menuitem", { name: "새 탭에서 열기" })
    .click();
  await assertEventually(
    async () =>
      (await explorerTabs.count()) === 3 &&
      (await explorerTabs.last().innerText()).includes("문서"),
    async () =>
      `새 탭에서 열기 did not open a tab at 문서: ${await explorerTabs.allInnerTexts()}`,
  );
  for (let index = 0; index < 2; index += 1) {
    await page.keyboard.press("Control+w");
    await settle(page);
  }
  assert((await explorerTabs.count()) === 1, "Ctrl+W did not leave one tab");

  /*
   * 압축(ZIP) 파일로 압축 → 압축 풀기. The archive is a real stored ZIP built
   * from the file system's own shapes, so this walks the whole round trip:
   * compress a folder, find the .zip beside it, open it, and read the files
   * back out of the folder that was extracted.
   */
  /*
   * A system folder is compressed here on purpose: 압축 only reads, so 문서
   * may be zipped even though it may not be copied or deleted — the first
   * version disabled the row for both and the deployed build refused it.
   */
  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "바탕 화면", exact: true })
    .click();
  await settle(page);
  const documentRows = tabExplorer.locator(".file-list button");
  await documentRows.filter({ hasText: "문서" }).first().click({ button: "right" });
  const systemFolderMenu = tabExplorer.locator(".file-context-menu");
  await systemFolderMenu.waitFor({ state: "visible" });
  assert(
    await systemFolderMenu
      .getByRole("menuitem", { name: /압축\(ZIP\) 파일로 압축/ })
      .isEnabled(),
    "압축 was disabled for a system folder, which only reads it",
  );
  await page.keyboard.press("Escape");
  await settle(page);

  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "문서", exact: true })
    .click();
  await settle(page);
  const namesBeforeZip = (await documentRows.allInnerTexts()).map(
    (text) => text.split("\n")[0],
  );
  await documentRows.first().click({ button: "right" });
  const zipMenu = tabExplorer.locator(".file-context-menu");
  await zipMenu.waitFor({ state: "visible" });
  await zipMenu.getByRole("menuitem", { name: /압축\(ZIP\) 파일로 압축/ }).click();
  await page
    .locator(".toast", { hasText: "압축 파일을 만들었습니다" })
    .waitFor({ state: "visible", timeout: 8000 });
  const archiveRow = tabExplorer.locator(".file-list button", { hasText: ".zip" }).first();
  assert(await archiveRow.count(), "압축 did not create a .zip beside the selection");
  assert(
    (await archiveRow.innerText()).includes("압축(ZIP) 폴더"),
    `The archive was not typed as an archive: ${await archiveRow.innerText()}`,
  );

  await archiveRow.dblclick();
  const extractToast = page.locator(".toast", { hasText: "압축을 풀었습니다" });
  await extractToast.waitFor({ state: "visible", timeout: 8000 });
  // The toast opens the folder: the entries have only just reached the shell.
  await extractToast.getByRole("button", { name: "폴더 열기" }).click();
  await settle(page);
  assert(
    (await tabExplorer.getAttribute("aria-label"))?.startsWith(
      `${namesBeforeZip[0].replace(/\.[^.]+$/, "")} `,
    ),
    `압축 풀기 did not open the extracted folder: ${await tabExplorer.getAttribute("aria-label")}`,
  );
  const extractedNames = (await documentRows.allInnerTexts()).map(
    (text) => text.split("\n")[0],
  );
  assert(
    extractedNames.includes(namesBeforeZip[0]),
    `The extracted folder is missing what was compressed: ${JSON.stringify(extractedNames)}`,
  );

  /*
   * 빠른 액세스: a folder pinned from its own menu becomes a sidebar row that
   * survives a reload, because the pins belong to the shell rather than to
   * the window that made them.
   */
  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "바탕 화면", exact: true })
    .click();
  await settle(page);
  await tabExplorer
    .locator(".file-list button", { hasText: "문서" })
    .first()
    .click({ button: "right" });
  await zipMenu.waitFor({ state: "visible" });
  await zipMenu.getByRole("menuitem", { name: "빠른 액세스에 고정" }).click();
  await settle(page);
  const pinnedRow = tabExplorer.locator(".file-sidebar-pin");
  assert(
    (await pinnedRow.count()) === 1 && (await pinnedRow.first().innerText()).includes("문서"),
    `빠른 액세스에 고정 did not add a sidebar row: ${await tabExplorer.locator("aside").innerText()}`,
  );
  assert(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("pocket-desk-quick-access-v1"))) ?? "[]",
    ).length === 1,
    "The pin was not written to storage",
  );
  // Pinning again from the same menu is what removes it.
  await tabExplorer
    .locator(".file-list button", { hasText: "문서" })
    .first()
    .click({ button: "right" });
  await zipMenu.waitFor({ state: "visible" });
  await zipMenu.getByRole("menuitem", { name: "빠른 액세스에서 제거" }).click();
  await settle(page);
  assert((await pinnedRow.count()) === 0, "고정 해제 left the sidebar row behind");

  /*
   * 하위 폴더까지 검색: typing into the search box used to filter only what
   * was already on screen, so a file one folder down was invisible.
   */
  const explorerSearch = tabExplorer.getByPlaceholder(/검색/).first();
  await explorerSearch.fill("notes");
  await settle(page);
  const searchNames = (await documentRows.allInnerTexts()).map((text) => text.split("\n")[0]);
  assert(
    searchNames.some((name) => name.startsWith("notes")),
    `The recursive search found nothing under 바탕 화면: ${JSON.stringify(searchNames)}`,
  );
  assert(
    (await tabExplorer.locator(".file-row-location").count()) > 0,
    "A search result did not say which folder it is in",
  );
  assert(
    (await tabExplorer.locator(".file-statusbar span").first().innerText()).includes(
      "하위 폴더와 파일 내용까지 검색",
    ),
    "The status bar did not say the search went into subfolders and file contents",
  );
  await explorerSearch.fill("");
  await settle(page);

  // 폴더 메뉴: 새 창에서 열기 and 여기서 명령 프롬프트 열기.
  // Whichever tab survived the Ctrl+W pair may be showing another folder.
  await tabExplorer
    .locator("aside")
    .getByRole("treeitem", { name: "바탕 화면", exact: true })
    .click();
  await tabExplorer
    .locator(".file-list button", { hasText: "문서" })
    .first()
    .waitFor({ state: "visible" });
  const explorersBefore = await page.locator('article[data-app-id="files"]').count();
  await tabExplorer
    .locator(".file-list button", { hasText: "문서" })
    .first()
    .click({ button: "right" });
  await tabExplorer
    .locator(".file-context-menu")
    .getByRole("menuitem", { name: "새 창에서 열기" })
    .click();
  await settle(page);
  const spawnedExplorer = page.locator('article[data-app-id="files"]').last();
  assert(
    (await page.locator('article[data-app-id="files"]').count()) === explorersBefore + 1 &&
      (await spawnedExplorer.getAttribute("aria-label"))?.startsWith("문서 - "),
    `새 창에서 열기 did not open 문서 in a second window: ${await spawnedExplorer.getAttribute("aria-label")}`,
  );
  // `.last()` re-resolves: once this window closes it would point at the other
  // Explorer, which is still open. Wait on this window's own id.
  const spawnedExplorerId = await spawnedExplorer.getAttribute("data-window-id");
  await spawnedExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await page
    .locator(`article[data-window-id="${spawnedExplorerId}"]`)
    .waitFor({ state: "detached" });
  await tabExplorer
    .locator(".file-list button", { hasText: "문서" })
    .first()
    .click({ button: "right" });
  await tabExplorer
    .locator(".file-context-menu")
    .getByRole("menuitem", { name: "여기서 명령 프롬프트 열기" })
    .click();
  const spawnedTerminal = page.locator('article[data-app-id="terminal"]').last();
  await spawnedTerminal.waitFor({ state: "visible" });
  await assertEventually(
    async () => (await spawnedTerminal.innerText()).includes("Desktop\\문서"),
    async () =>
      `The prompt did not start in 문서: ${(await spawnedTerminal.innerText()).slice(-80)}`,
  );
  const spawnedTerminalId = await spawnedTerminal.getAttribute("data-window-id");
  await spawnedTerminal.getByRole("button", { name: "명령 프롬프트 닫기" }).click();
  await page
    .locator(`article[data-window-id="${spawnedTerminalId}"]`)
    .waitFor({ state: "detached" });
  // The request must not stand: a prompt opened plainly starts at home.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("cmd");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const plainTerminal = page.locator('article[data-app-id="terminal"]').last();
  await plainTerminal.waitFor({ state: "visible" });
  await settle(page);
  assert(
    !(await plainTerminal.innerText()).includes("Desktop\\문서"),
    "A plain prompt inherited the folder from an earlier 여기서 명령 프롬프트 열기",
  );
  const plainTerminalId = await plainTerminal.getAttribute("data-window-id");
  await plainTerminal.getByRole("button", { name: "명령 프롬프트 닫기" }).click();
  await page
    .locator(`article[data-window-id="${plainTerminalId}"]`)
    .waitFor({ state: "detached" });
  await tabExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await tabExplorer.waitFor({ state: "detached" });
}
