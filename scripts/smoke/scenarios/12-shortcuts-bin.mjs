import { assert, assertEventually, settle, unlockPocketDesk } from "../harness.mjs";

export default async function run(ctx) {
  const { page, multiSelectModifier, state } = ctx;
  const runDialog = page.locator(".run-dialog");
  /*
   * 마우스 관례: Ctrl+휠 on the bare desktop sizes the icons, Shift+클릭 on a
   * taskbar button opens another window, and Win+X opens the power user menu.
   * All three are Windows' and none of them did anything here.
   */
  await page.keyboard.press("Meta+d");
  await settle(page);
  const desktopViewClass = async () =>
    (await page.locator("main.desktop").getAttribute("class")).match(/desktop-view-\w+/)[0];
  const desktopIconSize = async () => {
    const box = await page.locator(".desktop-icon").first().boundingBox();
    return Math.round(box.width);
  };
  const viewBeforeWheel = await desktopViewClass();
  await page.mouse.move(900, 400);
  await page.keyboard.down("Control");
  // Down to the smallest first, so the run starts from a known size whatever
  // the steps before it left behind.
  await page.mouse.wheel(0, 120);
  await page.mouse.wheel(0, 120);
  await settle(page);
  assert(
    (await desktopViewClass()) === "desktop-view-small",
    `Ctrl+휠 down left the desktop at ${await desktopViewClass()}`,
  );
  const iconAtSmall = await desktopIconSize();
  // The bottom holds rather than wrapping round to 큰 아이콘.
  await page.mouse.wheel(0, 120);
  await settle(page);
  assert(
    (await desktopViewClass()) === "desktop-view-small",
    `Ctrl+휠 past 작은 아이콘 wrapped to ${await desktopViewClass()}`,
  );
  await page.mouse.wheel(0, -120);
  await settle(page);
  const iconAtMedium = await desktopIconSize();
  assert(
    (await desktopViewClass()) === "desktop-view-medium" && iconAtMedium > iconAtSmall,
    `Ctrl+휠 up gave ${await desktopViewClass()} (${iconAtMedium}px from ${iconAtSmall}px)`,
  );
  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, -120);
  await settle(page);
  assert(
    (await desktopViewClass()) === "desktop-view-large",
    `Ctrl+휠 up twice more gave ${await desktopViewClass()}`,
  );
  // Back to the size this run found, so nothing after it sees a new desktop.
  const stepsBack = {
    "desktop-view-large": 0,
    "desktop-view-medium": 1,
    "desktop-view-small": 2,
  }[viewBeforeWheel];
  for (let step = 0; step < stepsBack; step += 1) {
    await page.mouse.wheel(0, 120);
    await settle(page);
  }
  await page.keyboard.up("Control");
  assert(
    (await desktopViewClass()) === viewBeforeWheel,
    `The desktop did not come back to ${viewBeforeWheel}`,
  );

  // Win+X: the menu the Start button's right-click opens, on the keyboard.
  await page.keyboard.press("Meta+x");
  const powerUserMenu = page.locator("[aria-label='작업 표시줄 메뉴']");
  await powerUserMenu.waitFor({ state: "visible" });
  assert(
    (await powerUserMenu.innerText()).includes("작업 관리자"),
    `Win+X opened ${(await powerUserMenu.innerText()).replace(/\n/g, " | ")}`,
  );
  await page.keyboard.press("Escape");
  await powerUserMenu.waitFor({ state: "detached" });

  // Shift+클릭 on a taskbar button opens another window of that app.
  await page.keyboard.press("Meta+e");
  await settle(page);
  const filesWindows = () => page.locator('article[data-app-id="files"]').count();
  const filesBeforeShift = await filesWindows();
  await page
    .locator(".taskbar-app")
    .filter({ hasText: "파일 탐색기" })
    .first()
    .click({ modifiers: ["Shift"] });
  await assertEventually(
    async () => (await filesWindows()) === filesBeforeShift + 1,
    async () =>
      `Shift+클릭 left ${await filesWindows()} 파일 탐색기 windows, not ${filesBeforeShift + 1}`,
  );
  // Put the extra windows away again; the steps after this one own the desktop.
  await page.keyboard.press("Alt+F4");
  await settle(page);
  await page.keyboard.press("Alt+F4");
  await settle(page);

  /*
   * 브라우저 단축키와 기록. The browser had no keyboard at all — no Ctrl+T,
   * Ctrl+W, Ctrl+L, F5, Alt+← — and its visits were only listed on the
   * new-tab page. Edge's keys, and its 기록 flyout on Ctrl+H.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("edge");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const keyEdge = page.locator('article[data-app-id="browser"]').last();
  await keyEdge.waitFor({ state: "visible" });
  await settle(page);
  const keyAddress = keyEdge.getByLabel("웹 주소 또는 검색어");
  const keyTabs = () => keyEdge.locator("[role=tab]").count();
  const activeLabel = () =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  for (const target of ["https://example.com/", "https://developer.mozilla.org/"]) {
    await keyAddress.fill(target);
    await keyAddress.press("Enter");
    await settle(page);
  }
  const tabsBeforeKeys = await keyTabs();
  await keyEdge.locator("[role=tab]").first().focus();
  await page.keyboard.press("Control+t");
  await assertEventually(
    async () =>
      (await keyTabs()) === tabsBeforeKeys + 1 &&
      (await activeLabel()) === "웹 주소 또는 검색어",
    async () => "Ctrl+T did not open a tab with the caret in the address bar",
  );
  await page.keyboard.press("Control+w");
  await assertEventually(
    async () => (await keyTabs()) === tabsBeforeKeys,
    async () => "Ctrl+W did not close the tab",
  );
  await keyEdge.locator("[role=tab]").first().focus();
  await page.keyboard.press("Control+l");
  await settle(page);
  const addressSelection = await keyAddress.evaluate((node) => [
    node.selectionStart,
    node.selectionEnd,
    node.value.length,
  ]);
  assert(
    (await activeLabel()) === "웹 주소 또는 검색어" &&
      addressSelection[0] === 0 &&
      addressSelection[1] === addressSelection[2],
    `Ctrl+L left the address bar at ${JSON.stringify(addressSelection)}`,
  );
  await keyEdge.locator("[role=tab]").first().focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await settle(page);
  assert(
    (await keyAddress.inputValue()) === "https://example.com/",
    `Alt+← went to ${await keyAddress.inputValue()}`,
  );
  await page.keyboard.press("Alt+ArrowRight");
  await settle(page);

  // Ctrl+H: newest first, searchable, a click opens the page here.
  await page.keyboard.press("Control+h");
  const historyFlyout = keyEdge.locator(".browser-history-panel");
  await historyFlyout.waitFor({ state: "visible" });
  const historyTitles = () =>
    historyFlyout
      .locator(".browser-history-list button strong")
      .evaluateAll((els) => els.map((el) => el.innerText));
  const flyoutTitles = await historyTitles();
  assert(
    flyoutTitles.indexOf("developer.mozilla.org") === 0 && flyoutTitles.includes("example.com"),
    `기록 listed ${flyoutTitles.join(", ")}`,
  );
  await historyFlyout.getByLabel("기록 검색").fill("example");
  await settle(page);
  // The search reads titles and addresses; an earlier step's visit to an
  // example-domains page on iana.org matches too, and should.
  const searchedTitles = await historyTitles();
  assert(
    searchedTitles[0] === "example.com" && !searchedTitles.includes("developer.mozilla.org"),
    `기록 검색 "example" left ${searchedTitles.join(", ")}`,
  );
  await historyFlyout.locator(".browser-history-list button").first().click();
  await historyFlyout.waitFor({ state: "detached" });
  assert(
    (await keyAddress.inputValue()) === "https://example.com/",
    "Opening a 기록 entry did not go to it",
  );
  await keyEdge.getByRole("button", { name: "Microsoft Edge 닫기" }).click();
  await settle(page);

  /*
   * 연결 프로그램. A file opened in its default app and nowhere else; the
   * menu offers the apps 설정 > 기본 앱 offers for the type, and 다른 앱 선택
   * with 항상 이 앱을 사용 changes that same setting.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("cmd");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const openWithTerminal = page.locator('article[data-app-id="terminal"]').last();
  await openWithTerminal.waitFor({ state: "visible" });
  await settle(page);
  await page.keyboard.type("cd 문서");
  await page.keyboard.press("Enter");
  await page.keyboard.type("echo 연결 프로그램 확인 > 연결 테스트.txt");
  await page.keyboard.press("Enter");
  await settle(page);
  await openWithTerminal.getByRole("button", { name: "명령 프롬프트 닫기" }).click();
  await openWithTerminal.waitFor({ state: "detached" });

  await page.keyboard.press("Meta+e");
  const openWithFiles = page.locator('article[data-app-id="files"]').last();
  await openWithFiles.waitFor({ state: "visible" });
  await settle(page);
  await openWithFiles.getByRole("option", { name: /^문서/ }).first().dblclick();
  const openWithRow = openWithFiles.getByRole("option", { name: /연결 테스트\.txt/ }).first();
  await openWithRow.waitFor({ state: "visible" });
  const openWithItems = async () => {
    await openWithRow.click({ button: "right" });
    const menu = page.locator(".file-context-menu").last();
    await menu.waitFor({ state: "visible" });
    await menu.locator(".desktop-menu-row", { hasText: "연결 프로그램" }).hover();
    const submenu = menu.locator(".desktop-context-submenu[aria-label='연결 프로그램']");
    await submenu.waitFor({ state: "visible" });
    return {
      items: await submenu
        .locator("button")
        .evaluateAll((buttons) => buttons.map((button) => button.innerText.trim())),
      submenu,
    };
  };
  const firstOpenWith = await openWithItems();
  assert(
    JSON.stringify(firstOpenWith.items) ===
      JSON.stringify(["메모장 (기본값)", "명령 프롬프트", "다른 앱 선택…"]),
    `연결 프로그램 offered ${firstOpenWith.items.join(", ")}`,
  );
  // 명령 프롬프트 shows the file the way cmd would: `type`, in its own folder.
  await firstOpenWith.submenu.locator("button", { hasText: "명령 프롬프트" }).click();
  const typedTerminal = page.locator('article[data-app-id="terminal"]').last();
  await typedTerminal.waitFor({ state: "visible" });
  await typedTerminal
    .locator("text=연결 프로그램 확인")
    .first()
    .waitFor({ state: "visible", timeout: 5000 });
  await typedTerminal.getByRole("button", { name: "명령 프롬프트 닫기" }).click();
  await typedTerminal.waitFor({ state: "detached" });

  // 다른 앱 선택 with 항상 이 앱을 사용 makes the pick the default.
  const chooseOther = async (appTitle) => {
    const { submenu } = await openWithItems();
    await submenu.locator("button", { hasText: "다른 앱 선택" }).click();
    const dialog = page.locator(".open-with-dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.locator(".open-with-choice", { hasText: appTitle }).click();
    await dialog.locator(".open-with-remember input").check();
    await dialog.getByRole("button", { name: "확인", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await settle(page);
  };
  await chooseOther("명령 프롬프트");
  await page
    .locator('article[data-app-id="terminal"]')
    .last()
    .getByRole("button", { name: "명령 프롬프트 닫기" })
    .click();
  await settle(page);
  const afterRemember = await openWithItems();
  assert(
    afterRemember.items[0] === "명령 프롬프트 (기본값)",
    `항상 이 앱을 사용 left the default as ${afterRemember.items[0]}`,
  );
  await page.keyboard.press("Escape");
  // Back to 메모장 for everything after this.
  await chooseOther("메모장");
  await page
    .locator('article[data-app-id="notepad"]')
    .last()
    .getByRole("button", { name: "메모장 닫기" })
    .click();
  await settle(page);
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }
  await openWithFiles.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await settle(page);

  /*
   * 창 관리 단축키: Win+Home, Win+Shift+↑/↓, Alt+Esc, F11, Win+Ctrl+D/F4.
   * Windows has every one of these; here they did nothing, or — Win+Shift+↑ —
   * maximized instead of stretching.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const chordNote = page.locator('article[data-app-id="notepad"]').last();
  await chordNote.waitFor({ state: "visible" });
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("calc");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const chordCalc = page.locator('article[data-app-id="calculator"]').last();
  await chordCalc.waitFor({ state: "visible" });
  await settle(page);
  const isMinimized = (frame) =>
    frame.evaluate((node) => node.classList.contains("is-minimized"));
  const frameBox = async (frame) => {
    const box = await frame.boundingBox();
    return {
      height: Math.round(box.height),
      width: Math.round(box.width),
      x: Math.round(box.x),
      y: Math.round(box.y),
    };
  };

  // Win+Home: everything but the window in front goes; the second press brings it back.
  await page.keyboard.press("Meta+Home");
  await assertEventually(
    async () => (await isMinimized(chordNote)) && !(await isMinimized(chordCalc)),
    async () => "Win+Home did not put away every window but the active one",
  );
  await page.keyboard.press("Meta+Home");
  await assertEventually(
    async () => !(await isMinimized(chordNote)),
    async () => "The second Win+Home did not bring the windows back",
  );
  assert(
    (await chordCalc.getAttribute("class")).includes("is-active"),
    "The window in front lost its place to the ones Win+Home brought back",
  );

  // Win+Shift+↑ stretches top to bottom and keeps the width; ↓ gives the height back.
  const calcBefore = await frameBox(chordCalc);
  await page.keyboard.press("Meta+Shift+ArrowUp");
  await settle(page);
  const calcStretched = await frameBox(chordCalc);
  assert(
    calcStretched.y === 0 &&
      calcStretched.height > calcBefore.height &&
      calcStretched.width === calcBefore.width &&
      calcStretched.x === calcBefore.x,
    `Win+Shift+↑ gave ${JSON.stringify(calcStretched)} from ${JSON.stringify(calcBefore)}`,
  );
  await page.keyboard.press("Meta+Shift+ArrowDown");
  await settle(page);
  assert(
    JSON.stringify(await frameBox(chordCalc)) === JSON.stringify(calcBefore),
    `Win+Shift+↓ left ${JSON.stringify(await frameBox(chordCalc))}`,
  );

  // Alt+Esc: the front window goes to the back and the next comes forward.
  await page.keyboard.press("Alt+Escape");
  await settle(page);
  assert(
    !(await chordCalc.getAttribute("class")).includes("is-active"),
    "Alt+Esc left the same window in front",
  );
  const lowestZ = await page
    .locator(".window-frame")
    .evaluateAll((els) => Math.min(...els.map((el) => Number(el.style.zIndex) || 1)));
  assert(lowestZ >= 1, `Alt+Esc pushed a window to z ${lowestZ}, behind the desktop`);
  // Back to the calculator from its taskbar button — its title bar is under
  // the window Alt+Esc brought forward.
  const calcTaskbarButton = page.locator(".taskbar-app").filter({ hasText: "계산기" }).first();
  await calcTaskbarButton.click();
  await settle(page);

  // F11: the whole screen, taskbar included; F11 again restores the frame.
  await page.keyboard.press("F11");
  await settle(page);
  const calcFull = await frameBox(chordCalc);
  const fullscreenViewport = page.viewportSize();
  assert(
    calcFull.x === 0 &&
      calcFull.y === 0 &&
      calcFull.width === fullscreenViewport.width &&
      calcFull.height === fullscreenViewport.height,
    `F11 gave ${JSON.stringify(calcFull)}`,
  );
  const underTaskbar = await page.evaluate(() => {
    const bar = document.querySelector(".taskbar").getBoundingClientRect();
    const hit = document.elementFromPoint(bar.left + 200, bar.top + bar.height / 2);
    return hit?.closest(".window-frame") ? "window" : "taskbar";
  });
  assert(underTaskbar === "window", "F11 left the taskbar over the window");
  await page.keyboard.press("F11");
  await settle(page);
  assert(
    JSON.stringify(await frameBox(chordCalc)) === JSON.stringify(calcBefore),
    `F11 again left ${JSON.stringify(await frameBox(chordCalc))}`,
  );

  // Win+Ctrl+D makes a desktop and goes there; Win+Ctrl+F4 closes it again.
  const desktopLabels = async () => {
    await page.keyboard.press("Meta+Tab");
    await page.locator(".task-view-desktop").first().waitFor({ state: "visible" });
    const labels = await page
      .locator(".task-view-desktop")
      .evaluateAll((els) => els.map((el) => el.classList.contains("is-active")));
    // Task View takes focus a frame after it opens and hears Escape only
    // from inside. On CI the Escape landed first, the view stayed open, and
    // the next Win+Tab — a toggle — closed it instead.
    await page.waitForFunction(() =>
      document.querySelector(".task-view")?.contains(document.activeElement),
    );
    await page.keyboard.press("Escape");
    await page.locator(".task-view").waitFor({ state: "detached" });
    await settle(page);
    return labels;
  };
  const desktopsBefore = await desktopLabels();
  await page.keyboard.press("Meta+Control+d");
  await settle(page);
  const desktopsAfterAdd = await desktopLabels();
  assert(
    desktopsAfterAdd.length === desktopsBefore.length + 1 && desktopsAfterAdd.at(-1) === true,
    `Win+Ctrl+D left the desktops as ${JSON.stringify(desktopsAfterAdd)}`,
  );
  await page.keyboard.press("Meta+Control+F4");
  await settle(page);
  // Read once: desktopLabels opens Task View and closes it, not a thing to poll.
  assert(
    (await desktopLabels()).length === desktopsBefore.length,
    "Win+Ctrl+F4 did not close the desktop it was on",
  );
  // The two windows this opened go again.
  await chordCalc.getByRole("button", { name: "계산기 닫기" }).click();
  await settle(page);
  // A taskbar click on the window already in front minimizes it, so it is
  // only for bringing back one that is down.
  if (await isMinimized(chordNote)) {
    await page.locator(".taskbar-app").filter({ hasText: "메모장" }).first().click();
    await settle(page);
  }
  await chordNote.getByRole("button", { name: "메모장 닫기" }).click();
  await settle(page);
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }

  /*
   * 이모지 패널 (Win+. / Win+;). Windows puts one behind both chords and the
   * shell had neither; the pick lands at the caret of the field the panel
   * was opened over, and 최근 사용 remembers what was used.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const emojiNote = page.locator('article[data-app-id="notepad"]').last();
  await emojiNote.waitFor({ state: "visible" });
  await settle(page);
  const emojiEditor = emojiNote.getByLabel("메모 내용");
  await emojiEditor.click();
  await emojiEditor.fill("오늘 기분은 ");
  await emojiEditor.evaluate((node) => {
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  });
  await page.keyboard.press("Meta+.");
  const emojiPanel = page.locator(".emoji-panel");
  await emojiPanel.waitFor({ state: "visible" });
  await settle(page);
  assert(
    (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ===
      "이모지 검색",
    "이모지 패널 opened without the caret in its search box",
  );
  // 검색 narrows to what the keyword names.
  await emojiPanel.getByLabel("이모지 검색").fill("커피");
  await settle(page);
  const coffeeOnly = await emojiPanel
    .locator(".emoji-grid button")
    .evaluateAll((els) => els.map((el) => el.innerText));
  assert(
    JSON.stringify(coffeeOnly) === JSON.stringify(["☕"]),
    `이모지 검색 "커피" showed ${JSON.stringify(coffeeOnly)}`,
  );
  await emojiPanel.locator(".emoji-grid button").first().click();
  await emojiPanel.waitFor({ state: "detached" });
  await settle(page);
  assert(
    (await emojiEditor.inputValue()) === "오늘 기분은 ☕",
    `이모지 패널 left the note as ${JSON.stringify(await emojiEditor.inputValue())}`,
  );

  // Win+; is the same panel, and it opens on 최근 사용 now that there is one.
  await emojiEditor.evaluate((node) => {
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  });
  await page.keyboard.press("Meta+;");
  await emojiPanel.waitFor({ state: "visible" });
  const emojiSections = await emojiPanel
    .locator("h2")
    .evaluateAll((els) => els.map((el) => el.innerText));
  assert(emojiSections[0] === "최근 사용", `이모지 패널 opened on ${emojiSections.join(", ")}`);
  assert(
    (await emojiPanel.locator(".emoji-grid button").first().innerText()).trim() === "☕",
    "최근 사용 did not lead with the emoji just used",
  );
  await page.keyboard.press("Escape");
  await emojiPanel.waitFor({ state: "detached" });
  await emojiNote.getByRole("button", { name: "메모장 닫기" }).click();
  await settle(page);
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }

  /*
   * 클립보드 기록 (Win+V). The shell kept a clipboard for files and nothing
   * at all for text: whatever was copied last was the only thing that
   * existed. The panel reaches back past the newest copy.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const clipNote = page.locator('article[data-app-id="notepad"]').last();
  await clipNote.waitFor({ state: "visible" });
  await settle(page);
  const clipEditor = clipNote.getByLabel("메모 내용");
  await clipEditor.click();
  await clipEditor.fill("첫 번째 복사\n두 번째 복사");
  // The native copy event is what the history listens to, and on macOS only
  // ⌘C fires it — the same modifier the rest of the run uses for multi-select.
  const copyRange = async (start, end) => {
    await clipEditor.evaluate(
      (node, range) => {
        node.focus();
        node.setSelectionRange(range.start, range.end);
      },
      { end, start },
    );
    await page.keyboard.press(`${multiSelectModifier}+c`);
    await settle(page);
  };
  await copyRange(0, 7);
  await copyRange(8, 15);

  const clipboardPanel = page.locator(".clipboard-panel");
  const clipboardRows = () =>
    clipboardPanel
      .locator(".clipboard-entry span")
      .evaluateAll((els) => els.map((el) => el.innerText));
  /*
   * On a Mac ⌘V inside a text field is the system's paste, and the shell
   * leaves it alone — so the panel is opened with the window, not the field,
   * focused. The field still owns the caret the pick goes to.
   */
  const openClipboardPanel = async () => {
    if (process.platform === "darwin") await clipNote.focus();
    await page.keyboard.press("Meta+v");
    await clipboardPanel.waitFor({ state: "visible" });
  };
  if (process.platform === "darwin") {
    // ⌘V and ⌘X edit the text on a Mac; they used to open the panel and the
    // power user menu instead and leave the text as it was.
    await clipEditor.evaluate((node) => {
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    });
    const beforeNativePaste = await clipEditor.inputValue();
    await page.keyboard.press("Meta+v");
    await settle(page);
    assert(
      (await clipEditor.inputValue()) !== beforeNativePaste &&
        (await clipboardPanel.count()) === 0,
      "⌘V in a text field opened 클립보드 기록 instead of pasting",
    );
    await clipEditor.fill("첫 번째 복사\n두 번째 복사");
  }
  await openClipboardPanel();
  assert(
    JSON.stringify(await clipboardRows()) === JSON.stringify(["두 번째 복사", "첫 번째 복사"]),
    `클립보드 기록 listed ${JSON.stringify(await clipboardRows())}`,
  );

  // Reaching back past the newest copy is the whole point: the older entry
  // lands at the caret in the field the panel was opened over.
  await page.keyboard.press("Escape");
  await clipboardPanel.waitFor({ state: "detached" });
  await clipEditor.evaluate((node) => {
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  });
  await openClipboardPanel();
  await clipboardPanel.locator(".clipboard-entry").nth(1).click();
  await clipboardPanel.waitFor({ state: "detached" });
  await settle(page);
  assert(
    (await clipEditor.inputValue()) === "첫 번째 복사\n두 번째 복사첫 번째 복사",
    `클립보드 기록 pasted: ${JSON.stringify(await clipEditor.inputValue())}`,
  );

  await openClipboardPanel();
  const clipBeforeRemove = (await clipboardRows()).length;
  await clipboardPanel.locator(".clipboard-remove").first().click();
  await settle(page);
  assert(
    (await clipboardRows()).length === clipBeforeRemove - 1,
    `지우기 left ${(await clipboardRows()).length} of ${clipBeforeRemove} rows`,
  );
  await clipboardPanel.getByRole("button", { name: "모두 지우기" }).click();
  await settle(page);
  assert(
    (await clipboardPanel.innerText()).includes("복사한 내용이 여기에 표시됩니다"),
    `모두 지우기 left ${(await clipboardPanel.innerText()).replace(/\n/g, " | ")}`,
  );
  await page.keyboard.press("Escape");
  await clipboardPanel.waitFor({ state: "detached" });
  await clipNote.getByRole("button", { name: "메모장 닫기" }).click();
  await settle(page);
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }

  /*
   * 시작 프로그램. Windows lists what a sign-in opens by itself in 작업
   * 관리자; the shell had no such list. 사용 is real: the first sign-in after
   * a boot opens the app — a reload is a boot here — and unlocking after
   * Win+L, the same session carrying on, does not.
   */
  const calcWindows = () => page.locator('article[data-app-id="calculator"]').count();
  while ((await calcWindows()) > 0) {
    await page
      .locator('article[data-app-id="calculator"]')
      .first()
      .getByRole("button", { name: "계산기 닫기" })
      .click();
    await settle(page);
  }
  const setCalculatorStartup = async (wanted) => {
    await page.keyboard.press("Control+Shift+Escape");
    const startupManager = page.locator('article[data-app-id="taskmanager"]').last();
    await startupManager.waitFor({ state: "visible" });
    await startupManager.getByRole("tab", { name: /시작 프로그램/ }).click();
    const calcRow = startupManager.getByRole("row", { name: /계산기/ });
    await calcRow.click();
    const toggle = startupManager.locator(".taskmgr-startup .taskmgr-actions button");
    if ((await toggle.innerText()).trim() === wanted) await toggle.click();
    await settle(page);
    const state = (await calcRow.innerText()).includes("사용 안 함") ? "사용 안 함" : "사용";
    await startupManager.getByRole("button", { name: "작업 관리자 닫기" }).click();
    await startupManager.waitFor({ state: "detached" });
    return state;
  };
  assert(
    (await setCalculatorStartup("사용")) === "사용",
    "시작 프로그램 did not turn 계산기 on",
  );
  await page.keyboard.press("Meta+l");
  await unlockPocketDesk(page);
  await settle(page);
  assert(
    (await calcWindows()) === 0,
    "Unlocking after Win+L ran 시작 프로그램, as if it were a new session",
  );
  await page.reload();
  await unlockPocketDesk(page);
  await page.locator('article[data-app-id="calculator"]').first().waitFor({ state: "visible" });
  assert(
    (await calcWindows()) === 1,
    `A boot opened ${await calcWindows()} 계산기 windows, not 1`,
  );
  assert(
    (await setCalculatorStartup("사용 안 함")) === "사용 안 함",
    "시작 프로그램 did not turn 계산기 off again",
  );

  /*
   * 휴지통 as a drop target and its own 비우기. Dropping a file on the bin is
   * how Windows throws it away, and the icon's menu says how much it is
   * about to destroy — both of which the desktop simply did not do.
   */
  // Every window out of the way first: an open frame covers the icons. This
  // is the last thing the run does, so nothing needs them back.
  await page.keyboard.press("Meta+m");
  await settle(page);
  const desktopBin = page.locator('[data-desktop-drop="trash"]');
  const binMenuItems = async () => {
    await desktopBin.click({ button: "right" });
    await settle(page);
    const items = await page
      .locator(".desktop-icon-context-menu button")
      .evaluateAll((buttons) =>
        buttons.map(
          (button) => `${button.innerText.trim()}${button.disabled ? "(disabled)" : ""}`,
        ),
      );
    return items;
  };
  // The menu's own label counts what the bin holds; that count is the
  // measurement the drop and the undo move.
  const binCount = async () => {
    const items = await binMenuItems();
    await page.keyboard.press("Escape");
    await settle(page);
    const label = items.find((item) => item.startsWith("휴지통 비우기"));
    assert(label, `휴지통's menu offered no 비우기 at all: ${items.join(", ")}`);
    if (label.includes("(disabled)")) return 0;
    const match = label.match(/\((\d+)개 항목\)/);
    assert(match, `휴지통 비우기 did not say how many: ${label}`);
    return Number(match[1]);
  };
  const binCountBefore = await binCount();

  // A file icon on the desktop to throw away — the one 보내기 put there.
  const desktopFileNames = await page
    .locator(".desktop-icon")
    .evaluateAll((els) => els.map((el) => el.innerText.split("\n").pop()));
  const droppableName = desktopFileNames.find(
    (name) => name && !["내 PC", "휴지통"].includes(name),
  );
  assert(droppableName, `No file icon on the desktop to drop: ${desktopFileNames.join(", ")}`);
  const dropIcon = page.locator(".desktop-icon", { hasText: droppableName }).first();
  const dropFrom = await dropIcon.boundingBox();
  const binBox = await desktopBin.boundingBox();
  await page.mouse.move(dropFrom.x + dropFrom.width / 2, dropFrom.y + dropFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2, {
    steps: 18,
  });
  let binLit = false;
  const binClasses = [];
  for (let step = 0; step < 4; step += 1) {
    await page.mouse.move(
      binBox.x + binBox.width / 2 + (step % 2),
      binBox.y + binBox.height / 2,
    );
    await settle(page);
    const binClass = await desktopBin.getAttribute("class");
    binClasses.push(binClass);
    binLit = binLit || binClass.includes("is-drop-target");
  }
  assert(
    binLit,
    `휴지통 never lit up while ${droppableName} was held over it: from ${JSON.stringify(dropFrom)} to ${JSON.stringify(binBox)} :: ${binClasses.join(" / ")}`,
  );
  await page.mouse.up();
  await settle(page);
  assert(
    (await page.locator(".desktop-icon", { hasText: droppableName }).count()) === 0,
    `Dropping ${droppableName} on 휴지통 left it on the desktop`,
  );
  assert(
    (await binCount()) === binCountBefore + 1,
    `휴지통 holds ${await binCount()} after a drop, not ${binCountBefore + 1}`,
  );

  // The same 삭제 the menu uses, so one Ctrl+Z puts it back.
  await page.keyboard.press("Control+z");
  await assertEventually(
    async () => (await page.locator(".desktop-icon", { hasText: droppableName }).count()) === 1,
    async () => `실행 취소 did not bring ${droppableName} back from 휴지통`,
  );
  assert(
    (await binCount()) === binCountBefore,
    `실행 취소 left 휴지통 holding ${await binCount()}, not ${binCountBefore}`,
  );

  await page.mouse.move(dropFrom.x + dropFrom.width / 2, dropFrom.y + dropFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2, {
    steps: 18,
  });
  await page.mouse.up();
  await settle(page);
  const filledBinItems = await binMenuItems();
  assert(
    filledBinItems.some((item) => item.startsWith("휴지통 비우기 (")),
    `A full 휴지통 offered ${filledBinItems.join(", ")}`,
  );
  await page.evaluate(() => {
    const target = [...document.querySelectorAll(".desktop-icon-context-menu button")].find(
      (button) => button.textContent.includes("휴지통 비우기"),
    );
    target?.click();
  });
  const emptyBinDialog = page.locator(".run-dialog").last();
  await emptyBinDialog.waitFor({ state: "visible" });
  assert(
    (await emptyBinDialog.innerText()).includes("영구적으로 삭제"),
    `휴지통 비우기 asked: ${(await emptyBinDialog.innerText()).replace(/\n/g, " | ")}`,
  );
  await emptyBinDialog.getByRole("button", { name: "휴지통 비우기" }).click();
  await settle(page);
  const afterEmptyItems = await binMenuItems();
  assert(
    afterEmptyItems.some((item) => item === "휴지통 비우기(disabled)"),
    `휴지통 did not empty: ${afterEmptyItems.join(", ")}`,
  );
  await page.keyboard.press("Escape");
  await settle(page);

  Object.assign(state, {
    activeLabel,
    addressSelection,
    afterEmptyItems,
    afterRemember,
    binBox,
    binClasses,
    binCount,
    binCountBefore,
    binLit,
    binMenuItems,
    calcBefore,
    calcFull,
    calcStretched,
    calcTaskbarButton,
    calcWindows,
    chooseOther,
    chordCalc,
    chordNote,
    clipBeforeRemove,
    clipEditor,
    clipNote,
    clipboardPanel,
    clipboardRows,
    coffeeOnly,
    copyRange,
    desktopBin,
    desktopFileNames,
    desktopIconSize,
    desktopLabels,
    desktopViewClass,
    desktopsAfterAdd,
    desktopsBefore,
    dropFrom,
    dropIcon,
    droppableName,
    emojiEditor,
    emojiNote,
    emojiPanel,
    emojiSections,
    emptyBinDialog,
    filesBeforeShift,
    filesWindows,
    filledBinItems,
    firstOpenWith,
    flyoutTitles,
    frameBox,
    fullscreenViewport,
    historyFlyout,
    historyTitles,
    iconAtMedium,
    iconAtSmall,
    isMinimized,
    keyAddress,
    keyEdge,
    keyTabs,
    lowestZ,
    openClipboardPanel,
    openWithFiles,
    openWithItems,
    openWithRow,
    openWithTerminal,
    powerUserMenu,
    searchedTitles,
    setCalculatorStartup,
    stepsBack,
    tabsBeforeKeys,
    typedTerminal,
    underTaskbar,
    viewBeforeWheel,
  });
}
