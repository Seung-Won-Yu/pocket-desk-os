import {
  assert,
  assertEventually,
  getDeterministicMineIndices,
  settle,
  unlockPocketDesk,
} from "../harness.mjs";

export default async function run(ctx) {
  const { page } = ctx;
  const startMenu = page.locator(".start-menu");
  const files = page.locator('article[data-app-id="files"]');
  const explorerSidebar = files.locator("aside");
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
  const runDialog = page.locator(".run-dialog");
  // 알람 및 시계: the timer must fire from the shell — the app window is
  // closed before the deadline, and the completion toast still has to appear.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("알람");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const clock = page.locator('article[data-app-id="clock"]');
  await clock.waitFor({ state: "visible" });
  await clock.getByRole("tab", { name: "타이머" }).click();
  await clock.getByLabel("타이머 시간 (분)").fill("0");
  await clock.getByLabel("타이머 시간 (초)").fill("2");
  await clock.getByRole("button", { name: "시작" }).click();
  await page.keyboard.press("Alt+F4");
  await clock.waitFor({ state: "detached" });
  await page
    .locator(".toast", { hasText: "타이머 완료" })
    .waitFor({ state: "visible", timeout: 8000 });
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("알람 및 시계");
  await runDialog.getByRole("button", { name: "확인" }).click();
  await clock.waitFor({ state: "visible" });
  await clock.getByRole("tab", { name: "타이머" }).click();
  assert(
    (await clock.getByRole("timer").innerText()) === "00:02",
    "Fired timer did not reset to its configured length",
  );
  // 세계 시계: real Intl timezones — the default trio renders a reading,
  // and an added city appears and persists through the app's own storage.
  await clock.getByRole("tab", { name: "세계 시계" }).click();
  const worldList = clock.getByLabel("세계 시계 목록");
  assert((await worldList.innerText()).includes("서울"), "Default world clocks missing");
  await clock.getByLabel("추가할 도시").selectOption("Asia/Tokyo");
  await clock.getByRole("button", { name: "도시 추가" }).click();
  assert((await worldList.innerText()).includes("도쿄"), "Added world clock did not appear");
  assert(
    /\d{2}:\d{2}/.test(await worldList.innerText()),
    "World clock rows show no time reading",
  );
  await page.keyboard.press("Alt+F4");
  await clock.waitFor({ state: "detached" });

  // 점프 리스트: right-clicking a taskbar button lists the documents that
  // app would open; picking one opens it in that app.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const jumpNotepad = page.locator('article[data-app-id="notepad"]');
  await jumpNotepad.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "메모장", exact: true }).click({ button: "right" });
  const jumpMenu = page.locator(".taskbar-context-menu");
  await jumpMenu.waitFor({ state: "visible" });
  assert(
    (await jumpMenu.innerText()).includes("최근 항목"),
    "Taskbar jump list has no recent-items section",
  );
  // The top entry is whatever is newest — earlier smoke steps create files,
  // so pin the behaviour (picked item opens) rather than one filename.
  const firstRecent = jumpMenu.getByRole("menuitem").first();
  const firstRecentName = (await firstRecent.innerText()).trim();
  await firstRecent.click();
  await jumpMenu.waitFor({ state: "detached" });
  assert(
    (await jumpNotepad.locator(".window-titlebar").innerText()).includes(firstRecentName),
    "Jump list pick did not open the document in Notepad",
  );
  // Alt+F4 needs a window the shell already calls active: pressed in the gap
  // between the jump-list click and the window taking focus it reaches
  // nobody, which is what a slow runner opened up.
  await page.locator('article[data-app-id="notepad"].is-active').waitFor();
  await page.keyboard.press("Alt+F4");
  try {
    await jumpNotepad.waitFor({ state: "detached", timeout: 8000 });
  } catch {
    // A timeout here says only "still open". Say what it is holding, so a
    // CI-only failure does not need another round trip to explain itself.
    const stuck = await page.evaluate(() => {
      const win = document.querySelector('article[data-app-id="notepad"]');
      if (!win) return "gone by the time this ran";
      return JSON.stringify({
        active: win.classList.contains("is-active"),
        focus:
          document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName,
        prompt: Boolean(win.querySelector(".note-close-overlay")),
        tabs: Array.from(win.querySelectorAll('[role="tab"]')).map((tab) =>
          (tab.textContent ?? "").trim(),
        ),
        title: win.getAttribute("aria-label"),
      });
    });
    assert(false, `Alt+F4 left 메모장 open: ${stuck}`);
  }

  // Desktop focus: like Windows, pressing the bare desktop takes focus off
  // every window (title bar quiet, taskbar button not current) so desktop
  // shortcuts work while windows stay open; the taskbar button then
  // re-activates the window instead of minimizing it.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const focusNotepad = page.locator('article[data-app-id="notepad"]').last();
  await focusNotepad.waitFor({ state: "visible" });
  const focusTaskbarButton = page.locator('.taskbar button[data-app-id="notepad"]');
  assert(
    (await focusNotepad.getAttribute("class"))?.includes("is-active") &&
      (await focusTaskbarButton.getAttribute("aria-current")) === "true",
    "A freshly opened window is not the active one",
  );
  const bareDesktopSpot = await page.evaluate(() => {
    for (const [x, y] of [
      [1240, 700],
      [1240, 560],
      [700, 730],
      [400, 730],
    ]) {
      const element = document.elementFromPoint(x, y);
      if (
        element &&
        !element.closest(".window-frame, .desktop-icon, .taskbar, .toast-stack, .start-menu")
      ) {
        return { x, y };
      }
    }
    return null;
  });
  assert(bareDesktopSpot, "No bare desktop pixel to press");
  await page.mouse.click(bareDesktopSpot.x, bareDesktopSpot.y);
  await assertEventually(
    async () =>
      !(await focusNotepad.getAttribute("class"))?.includes("is-active") &&
      (await focusTaskbarButton.getAttribute("aria-current")) === null,
    async () => "Pressing the desktop did not take focus off the window",
  );
  await focusTaskbarButton.click();
  await settle(page);
  assert(
    (await focusNotepad.getAttribute("class"))?.includes("is-active") &&
      (await focusNotepad.isVisible()),
    "The taskbar button minimized a window the desktop had focus from",
  );
  await page.keyboard.press("Alt+F4");
  await focusNotepad.waitFor({ state: "detached" });

  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("지뢰찾기");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const minesweeper = page.locator('article[data-app-id="minesweeper"]');
  await minesweeper.waitFor({ state: "visible" });
  const difficultySelect = minesweeper.getByLabel("지뢰찾기 난이도");
  await difficultySelect.selectOption("medium");
  assert(
    (await minesweeper.locator(".mine-cell").count()) === 256,
    "Minesweeper intermediate board is not 16x16",
  );
  assert(
    (await minesweeper.locator(".mines-commandbar").innerText()).includes("16 × 16"),
    "Minesweeper intermediate dimensions are wrong",
  );
  await difficultySelect.selectOption("hard");
  assert(
    (await minesweeper.locator(".mine-cell").count()) === 480,
    "Minesweeper expert board is not 30x16",
  );
  assert(
    (await minesweeper.locator(".mines-commandbar").innerText()).includes("30 × 16"),
    "Minesweeper expert dimensions are wrong",
  );
  await difficultySelect.selectOption("easy");
  await page.evaluate(() => {
    window.__pocketDeskOriginalRandom = Math.random;
    Math.random = () => 0;
  });
  const mineCells = minesweeper.locator(".mine-cell");
  const deterministicMines = getDeterministicMineIndices({
    cols: 9,
    mines: 10,
    rows: 9,
    safeIndex: 0,
  });
  await minesweeper.getByRole("button", { name: "깃발 모드" }).click();
  await mineCells.nth(80).click();
  assert(
    await mineCells.nth(80).evaluate((node) => node.classList.contains("is-flagged")),
    "Minesweeper touch flag mode failed",
  );
  assert(
    (await minesweeper.locator(".mines-counter.is-time strong").innerText()) === "0:00",
    "Minesweeper timer started before the first reveal",
  );
  await mineCells.nth(80).click();
  await minesweeper.getByRole("button", { name: "깃발 모드" }).click();

  await mineCells.first().click();
  assert(
    (await minesweeper.locator(".mine-cell.is-open").count()) > 0,
    "Minesweeper first click opened no cells",
  );
  assert(
    (await minesweeper.locator(".mine-cell.is-mine").count()) === 0,
    "Minesweeper first click hit a mine",
  );
  const wrongFlagIndex = (
    await Promise.all(
      [...Array(81).keys()]
        .filter((index) => !deterministicMines.has(index))
        .map(async (index) => ({
          index,
          open: await mineCells
            .nth(index)
            .evaluate((node) => node.classList.contains("is-open")),
        })),
    )
  ).find((cell) => !cell.open)?.index;
  assert(
    wrongFlagIndex !== undefined,
    "Minesweeper deterministic board has no closed safe cell",
  );
  await mineCells
    .nth(wrongFlagIndex)
    .dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
  await mineCells.nth([...deterministicMines][0]).click();
  const lostDialog = minesweeper.getByRole("dialog");
  await lostDialog.waitFor({ state: "visible" });
  assert(
    (await lostDialog.innerText()).includes("게임 종료"),
    "Minesweeper loss result was not shown",
  );
  assert(
    (await minesweeper.locator(".mine-cell.is-detonated").count()) === 1,
    "Minesweeper did not mark the detonated mine",
  );
  assert(
    (await minesweeper.locator(".mine-cell.is-wrong-flag").count()) === 1,
    "Minesweeper did not mark the wrong flag",
  );
  await lostDialog.getByRole("button", { name: "보드 보기" }).click();
  await lostDialog.waitFor({ state: "hidden" });
  assert(
    await mineCells.first().isDisabled(),
    "Minesweeper board stayed interactive after loss",
  );
  await minesweeper.getByRole("button", { name: "새 게임" }).click();

  await mineCells.first().click();
  for (const index of [...Array(81).keys()].filter(
    (cellIndex) => !deterministicMines.has(cellIndex),
  )) {
    const cell = mineCells.nth(index);
    if (!(await cell.evaluate((node) => node.classList.contains("is-open")))) {
      await cell.click();
    }
  }
  const wonDialog = minesweeper.getByRole("dialog");
  await wonDialog.waitFor({ state: "visible" });
  assert(
    (await wonDialog.innerText()).includes("게임 완료"),
    "Minesweeper win result was not shown",
  );
  assert(
    (await minesweeper.locator(".mine-cell.is-flagged").count()) === 10,
    "Minesweeper did not auto-flag every mine on win",
  );
  assert(
    (await minesweeper.locator(".mines-counter").first().locator("strong").innerText()) ===
      "000",
    "Minesweeper counter did not finish at zero across its three digits",
  );
  const completedTime = await minesweeper.locator(".mines-counter.is-time strong").innerText();
  await page.waitForTimeout(1100);
  assert(
    (await minesweeper.locator(".mines-counter.is-time strong").innerText()) === completedTime,
    "Minesweeper timer kept running after completion",
  );
  await wonDialog.getByRole("button", { name: "보드 보기" }).click();
  assert(
    await mineCells.first().isDisabled(),
    "Minesweeper board stayed interactive after victory",
  );
  await page.evaluate(() => {
    Math.random = window.__pocketDeskOriginalRandom;
    delete window.__pocketDeskOriginalRandom;
  });

  // An Explorer of its own on 바탕 화면, where web-surf.url lives, with the
  // details pane open — it starts closed.
  await page.keyboard.press("Meta+e");
  await files.waitFor({ state: "visible" });
  await files
    .locator("aside")
    .getByRole("treeitem", { name: "바탕 화면", exact: true })
    .click();
  await files.getByRole("button", { name: "세부 정보 창" }).click();
  await files.locator(".file-preview").waitFor({ state: "visible" });
  await files.locator(".file-list button", { hasText: "web-surf.url" }).click();
  const filePreviewText = await files.locator(".file-preview").innerText();
  assert(
    filePreviewText.includes("연결 프로그램: Microsoft Edge"),
    "File Explorer did not show URL association",
  );
  await page.keyboard.press("Enter");
  const edge = page.locator('article[data-app-id="browser"]');
  await edge.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const browser = document.querySelector('article[data-app-id="browser"]');
    const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
    return input instanceof HTMLInputElement && input.value.includes("https://example.com");
  });
  const edgeFrame = edge.locator("iframe");
  assert((await edgeFrame.count()) === 1, "Edge did not render the website inside its window");
  assert(
    (await edgeFrame.getAttribute("src"))?.startsWith("https://example.com"),
    "Edge web view did not load the requested website",
  );
  assert(
    page.context().pages().length === 1,
    "Edge opened an external tab during normal navigation",
  );
  await edge.getByRole("button", { name: "읽기 보기" }).click();
  const readerView = edge.locator(".browser-reader");
  await readerView.waitFor({ state: "visible" });
  // The Markdown renderer is a lazily loaded chunk behind Suspense, so the
  // container can be visible a beat before the content: wait for the text.
  await readerView.getByText("Reader mode content").waitFor({ state: "visible" });
  await readerView.getByRole("link", { name: "Learn more" }).click();
  await page.waitForFunction(() => {
    const browser = document.querySelector('article[data-app-id="browser"]');
    const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
    return input instanceof HTMLInputElement && input.value.includes("iana.org");
  });
  await edge.getByRole("button", { name: "뒤로" }).click();
  await page.waitForFunction(() => {
    const browser = document.querySelector('article[data-app-id="browser"]');
    const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
    return input instanceof HTMLInputElement && input.value === "https://example.com";
  });
  await readerView.waitFor({ state: "visible" });
  await edge.getByRole("button", { name: "앞으로" }).click();
  await page.waitForFunction(() => {
    const browser = document.querySelector('article[data-app-id="browser"]');
    const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
    return input instanceof HTMLInputElement && input.value.includes("iana.org");
  });
  await readerView.waitFor({ state: "visible" });
  await edge.getByRole("button", { name: "뒤로" }).click();
  await page.waitForFunction(() => {
    const browser = document.querySelector('article[data-app-id="browser"]');
    const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
    return input instanceof HTMLInputElement && input.value === "https://example.com";
  });
  await readerView.waitFor({ state: "visible" });
  await edge.getByRole("button", { name: "웹 보기" }).click();
  await edgeFrame.waitFor({ state: "visible" });
  await edge.getByRole("link", { name: "새 탭에서 열기" }).waitFor({ state: "visible" });
  await edge.getByRole("button", { name: "설정 및 기타" }).click();
  await edge.getByRole("menuitem", { name: "페이지 표시 문제" }).click();
  const frameFallback = edge.locator(".browser-frame-fallback");
  await frameFallback.waitFor({ state: "visible" });
  assert(
    (await frameFallback.innerText()).includes("사이트 보안 정책"),
    "Edge iframe recovery panel did not explain the display failure",
  );
  await frameFallback.getByRole("button", { name: "읽기 보기" }).click();
  await readerView.waitFor({ state: "visible" });
  await edge.getByRole("button", { name: "웹 보기" }).click();
  await edgeFrame.waitFor({ state: "visible" });

  const edgeAddress = edge.getByLabel("웹 주소 또는 검색어");
  await edgeAddress.fill("https://github.com");
  await edgeAddress.press("Enter");
  await readerView.waitFor({ state: "visible" });
  assert(
    (await edge.locator("iframe").count()) === 0,
    "Known iframe-blocked host did not prefer reader view",
  );
  await edge.getByRole("button", { name: "뒤로" }).click();
  await edgeFrame.waitFor({ state: "visible" });
  await edge.getByRole("button", { name: "홈" }).click();
  await edge.getByRole("button", { name: "사과게임" }).click();
  await page.waitForFunction(() => {
    const browser = document.querySelector('article[data-app-id="browser"]');
    const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
    return input instanceof HTMLInputElement && input.value.includes("/apple-burst/");
  });
  const appleGameFrame = edge.locator("iframe");
  await appleGameFrame.waitFor({ state: "visible" });
  await appleGameFrame
    .contentFrame()
    .getByRole("button", { name: "선택한 모드로 게임 시작" })
    .waitFor({ state: "visible" });
  assert(page.context().pages().length === 1, "Apple game opened outside Microsoft Edge");
  await page.locator(".taskbar-app", { hasText: "Microsoft Edge" }).hover();
  const taskbarPreview = page.locator(".taskbar-preview-card");
  await taskbarPreview.waitFor({ state: "visible" });
  assert(
    (await taskbarPreview.innerText()).includes("Microsoft Edge"),
    "Taskbar preview did not show browser",
  );
  // 창 단위 문서 라벨: 같은 앱의 두 창이 폴더에 따라 서로 다른 이름을 갖고,
  // 그 이름이 미리보기·Alt+Tab·제목 표시줄에 함께 쓰인다.
  // Hover moves on; the single preview card swaps its content per slot, so
  // nothing below depends on the hide-grace timing.
  await page.mouse.move(640, 300);
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("explorer");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const firstExplorer = page.locator('article[data-app-id="files"]').first();
  await firstExplorer.waitFor({ state: "visible" });
  await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click({ button: "right" });
  const filesJumpMenu = page.locator(".taskbar-context-menu");
  await filesJumpMenu.waitFor({ state: "visible" });
  await filesJumpMenu.getByRole("menuitem", { name: "새 창" }).click();
  await filesJumpMenu.waitFor({ state: "detached" });
  const explorerFrames = page.locator('article[data-app-id="files"]');
  await explorerFrames.nth(1).waitFor({ state: "visible" });
  await explorerFrames
    .nth(1)
    .locator("aside")
    .getByRole("treeitem", { name: "문서", exact: true })
    .click();
  await settle(page);
  assert(
    (await explorerFrames.nth(1).getAttribute("aria-label"))?.startsWith("문서 - 파일 탐색기"),
    "The second Explorer window is not titled after its folder",
  );
  await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).hover();
  await page
    .locator('.taskbar-preview-card[aria-label="파일 탐색기 창 미리보기"]')
    .waitFor({ state: "visible" });
  const previewText = await taskbarPreview.innerText();
  assert(
    previewText.includes("바탕 화면 - 파일 탐색기") &&
      previewText.includes("문서 - 파일 탐색기"),
    `Taskbar preview did not tell the two Explorer windows apart: ${previewText.replace(/\s+/g, " ").slice(0, 120)}`,
  );
  // Each row is a picture of its window — a scaled clone of the live frame —
  // so the two Explorer windows look different, not just read differently.
  const previewPictures = taskbarPreview.locator(".window-thumbnail-clone");
  assert(
    (await previewPictures.count()) === 2,
    `Taskbar preview showed ${await previewPictures.count()} window pictures for 2 windows`,
  );
  assert(
    (await previewPictures.first().evaluate((node) => node.style.transform)).startsWith(
      "scale(",
    ) && (await previewPictures.first().getAttribute("inert")) !== null,
    "Taskbar preview picture is not a scaled, inert clone",
  );
  await page.mouse.move(640, 300);
  // Only the window this block opened goes away; later sections keep using
  // the original Explorer window.
  await explorerFrames.nth(1).getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await explorerFrames.nth(1).waitFor({ state: "detached" });
  // Put Edge back on top — the sections below were written with the
  // Explorer window underneath, and a raised Explorer intercepts their clicks.
  await page.locator(".taskbar-app", { hasText: "Microsoft Edge" }).click();
  await settle(page);

  // Edge 다운로드: outside reader view the honest download is the address —
  // a .url shortcut written into the real 다운로드 system folder, which the
  // start search then finds with its folder chain.
  await edge.getByRole("button", { name: "페이지 다운로드" }).click();
  await page
    .locator(".toast", { hasText: "다운로드 완료" })
    .waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  await page.getByLabel("앱과 바탕화면 항목 검색").fill("github");
  const startMenuPanel = page.locator(".start-menu");
  await startMenuPanel
    .locator(".start-result-list button", { hasText: "바탕 화면 > 다운로드" })
    .first()
    .waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await startMenuPanel.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "알림 센터 열기" }).click();
  const notificationCenter = page.locator(".notification-center-panel");
  await notificationCenter.waitFor({ state: "visible" });
  assert(
    (await notificationCenter.locator(".notification-item").count()) > 0,
    "Notification center did not keep recent alerts",
  );
  await notificationCenter.getByRole("button", { name: "모두 지우기" }).click();
  assert(
    (await notificationCenter.innerText()).includes("새 알림 없음"),
    "Notification center did not clear alerts",
  );
  const calendarMonth = notificationCenter.locator(".notification-calendar header strong");
  const initialCalendarMonth = await calendarMonth.innerText();
  await notificationCenter.getByRole("button", { name: "다음 달" }).click();
  assert(
    (await calendarMonth.innerText()) !== initialCalendarMonth,
    "Notification calendar did not advance to the next month",
  );
  await page.getByRole("button", { name: "알림 센터 열기" }).click();
  await page.getByRole("button", { name: "빠른 설정 열기" }).click();
  const quickSettings = page.locator(".quick-settings-panel");
  await quickSettings.waitFor({ state: "visible" });
  const quickSettingsText = await quickSettings.innerText();
  assert(quickSettingsText.includes("네트워크"), "Network status missing");
  const brightnessSlider = quickSettings.getByRole("slider", { name: "화면 밝기" });
  await brightnessSlider.fill("55");
  assert(
    (await page.evaluate(() => localStorage.getItem("pocket-desk-display-brightness-v1"))) ===
      "55",
    "Quick Settings brightness was not persisted",
  );
  assert(
    Number(
      await page
        .locator(".desktop")
        .evaluate((desktop) => getComputedStyle(desktop).getPropertyValue("--display-dim")),
    ) > 0,
    "Quick Settings brightness did not dim the desktop",
  );
  await brightnessSlider.fill("100");
  await quickSettings.getByRole("button", { name: "설정", exact: true }).click();
  const settings = page.locator('article[data-app-id="settings"]');
  await settings.waitFor({ state: "visible" });
  await settings.getByRole("button", { name: "시스템", exact: true }).click();
  assert(
    (await settings.innerText()).includes("창과 바탕 화면"),
    "Settings System tab is not functional",
  );
  await settings.getByRole("button", { name: "소리", exact: true }).click();
  assert(
    (await settings.locator('input[type="checkbox"]').count()) === 1,
    "Settings Sound tab is not functional",
  );
  await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
  await explorerSidebar.getByRole("treeitem", { name: "문서", exact: true }).click();
  // A folder of its own to throw away, with a note inside — the whole tree goes.
  const newInExplorer = async (kind, name) => {
    await files.getByRole("button", { name: "새로 만들기" }).click();
    await files
      .getByRole("menu", { name: "새로 만들기" })
      .getByRole("menuitem", { name: kind })
      .click();
    await files.getByLabel("파일 이름").fill(name);
    await files.getByLabel("파일 이름").press("Enter");
  };
  await newInExplorer("폴더", "프로젝트");
  const fileToTrash = files.locator(".file-list button", { hasText: "프로젝트" });
  await fileToTrash.dblclick();
  await newInExplorer("텍스트 문서", "이동할 메모.txt");
  await files.locator(".file-list button", { hasText: "이동할 메모" }).waitFor();
  await explorerSidebar.getByRole("treeitem", { name: "문서", exact: true }).click();
  await fileToTrash.waitFor({ state: "visible" });
  const trashedFileName = await fileToTrash.locator("span").innerText();
  await fileToTrash.click();
  await page.keyboard.press("Delete");

  const folderTreeTrashed = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("pocket-desk-vfs");
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("entries", "readonly");
          const allEntries = transaction.objectStore("entries").getAll();
          allEntries.onsuccess = () => {
            const project = allEntries.result.find((entry) => entry.name === "프로젝트");
            const child = allEntries.result.find((entry) => entry.name === "이동할 메모.txt");
            resolve(Boolean(project?.trashed && child?.trashedRootId === project.id));
            database.close();
          };
          allEntries.onerror = () => resolve(false);
        };
      }),
  );
  assert(folderTreeTrashed, "Explorer did not move the full folder tree to Recycle Bin");

  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("recycle");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const recycle = page.locator('article[data-app-id="recycle"]');
  await recycle.waitFor({ state: "visible" });
  assert(
    (await recycle.innerText()).includes(trashedFileName),
    "Recycle Bin did not show deleted file",
  );
  await recycle.getByRole("button", { name: "복원" }).click();
  await settle(page);
  assert(
    !(await recycle.innerText()).includes(trashedFileName),
    "Recycle Bin still shows restored file",
  );

  await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
  await explorerSidebar.getByRole("treeitem", { name: "문서", exact: true }).click();
  const restoredFolder = files.locator(".file-list button", { hasText: trashedFileName });
  await restoredFolder.dblclick();
  await files
    .locator(".file-list button", { hasText: "이동할 메모.txt" })
    .waitFor({ state: "visible" });
  await files.getByRole("button", { name: "위로" }).click();
  await restoredFolder.click();
  await files.locator(".file-preview").getByRole("button", { name: "삭제" }).click();
  await page.locator(".taskbar-app", { hasText: "휴지통" }).click();
  await recycle.getByRole("button", { name: "휴지통 비우기" }).click();
  await recycle.getByRole("button", { name: "모두 삭제" }).click();
  await assertEventually(
    async () => (await recycle.innerText()).includes("휴지통이 비어 있습니다"),
    async () => "Recycle Bin did not empty",
  );

  /*
   * A permanent delete has no 실행 취소 in Windows, and neither does this:
   * every step that named one of the destroyed rows leaves the stack rather
   * than standing ready to resurrect a file the user threw away on purpose.
   */
  await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
  const undoAfterEmpty = await readUndoRow();
  assert(
    !undoAfterEmpty.text.includes("삭제"),
    `휴지통 비우기 left "${undoAfterEmpty.text}" on the undo stack`,
  );

  const initialTaskbar = await page
    .locator(".taskbar-app")
    .evaluateAll((items) => items.map((item) => item.textContent?.trim().replace(/\s+/g, " ")));
  assert(
    initialTaskbar.some((text) => text?.includes("파일 탐색기")),
    "File Explorer pinned taskbar app missing",
  );
  await page
    .locator(".taskbar-app", { hasText: "파일 탐색기" })
    .dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
  await page.getByRole("menuitem", { name: "작업 표시줄에서 제거" }).click();
  await settle(page);
  const pinnedAfterUnpin = await page.evaluate(() =>
    localStorage.getItem("pocket-desk-taskbar-pinned-v2"),
  );
  assert(
    pinnedAfterUnpin && !pinnedAfterUnpin.includes("files"),
    "Taskbar unpin did not persist",
  );

  await page.locator(".taskbar-app", { hasText: "Microsoft Edge" }).click();
  const frame = page.locator('article[data-app-id="browser"]');
  const titlebar = frame.locator(".window-titlebar");
  await frame.getByRole("button", { name: "Microsoft Edge 최대화" }).hover();
  const snapLayoutMenu = frame.getByRole("menu", { name: "스냅 레이아웃" });
  await snapLayoutMenu.waitFor({ state: "visible" });
  // Four whole-screen arrangements, eleven places between them.
  assert(
    (await snapLayoutMenu.locator(".snap-layout-option").count()) === 4 &&
      (await snapLayoutMenu.getByRole("menuitem").count()) === 11,
    `Snap layout choices missing: ${await snapLayoutMenu.getByRole("menuitem").count()} cells`,
  );
  await page.mouse.move(8, 8);
  await snapLayoutMenu.waitFor({ state: "hidden" });
  const box = await titlebar.boundingBox();
  assert(box, "Internet titlebar missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(0, box.y + box.height / 2, { steps: 12 });
  await page.locator(".snap-preview").waitFor({ state: "visible", timeout: 1000 });
  // The preview holds a picture of the window that will land there.
  assert(
    (await page.locator(".snap-preview .window-thumbnail-clone").count()) === 1,
    "The snap preview showed no picture of the dragged window",
  );
  await page.mouse.up();
  await settle(page);
  const snapped = await frame.boundingBox();
  assert(
    snapped && snapped.x <= 20 && snapped.width >= 560 && snapped.width <= 680,
    "Window did not snap left",
  );
  const titlebarAfterSnap = frame.locator(".window-titlebar");
  await titlebarAfterSnap.dispatchEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: snapped.x + 80,
    clientY: snapped.y + 18,
  });
  const windowSystemMenu = page.locator(".window-system-menu");
  await windowSystemMenu.waitFor({ state: "visible" });
  assert(
    (await windowSystemMenu.innerText()).includes("최대화"),
    "Window system menu missing maximize action",
  );
  await page.keyboard.press("Escape");
  await windowSystemMenu.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "시작 메뉴" }).click();
  await startMenu.waitFor({ state: "visible" });
  await startMenu.getByRole("button", { name: "전원 옵션" }).click();
  await startMenu.getByRole("menuitem", { name: "시스템 종료" }).click();
  await page.locator('[aria-label="PocketDesk 전원 꺼짐"]').waitFor({ state: "visible" });
  await page.getByRole("button", { name: "전원 켜기" }).click();
  await page.locator('[aria-label="부팅 화면"]').waitFor({ state: "visible" });
  await unlockPocketDesk(page);
  await settle(page);
}
