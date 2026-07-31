import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";

const host = "127.0.0.1";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const smokeTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180000);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getDeterministicMineIndices({ rows, cols, mines, safeIndex }) {
  const excluded = new Set([safeIndex]);
  const safeRow = Math.floor(safeIndex / cols);
  const safeColumn = safeIndex % cols;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const row = safeRow + rowOffset;
      const column = safeColumn + columnOffset;
      if (row >= 0 && row < rows && column >= 0 && column < cols) {
        excluded.add(row * cols + column);
      }
    }
  }

  const candidates = Array.from({ length: rows * cols }, (_, index) => index).filter(
    (index) => !excluded.has(index),
  );

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    [candidates[index], candidates[0]] = [candidates[0], candidates[index]];
  }

  return new Set(candidates.slice(0, mines));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 4173;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite preview is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start: ${url}`);
}

async function launchBrowser() {
  const channel = process.env.PW_CHANNEL || (process.env.CI ? "" : "chrome");
  if (channel) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (error) {
      if (process.env.PW_CHANNEL) throw error;
    }
  }
  return chromium.launch({ headless: true });
}

async function unlockPocketDesk(page) {
  const lockScreen = page.locator('[aria-label="PocketDesk 잠금 화면"]');
  await lockScreen.waitFor({ state: "visible", timeout: 6000 });
  await lockScreen.click();
  const signInButton = page.getByRole("button", { name: "로그인", exact: true });
  await signInButton.waitFor({ state: "visible" });
  await signInButton.click();
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function runSmoke(baseUrl) {
  const multiSelectModifier = process.platform === "darwin" ? "Meta" : "Control";
  const browser = await launchBrowser();
  const page = await browser.newPage({
    serviceWorkers: "block",
    viewport: { width: 1280, height: 820 },
  });
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.removeItem("pocket-desk-taskbar-pinned-v1");
      localStorage.removeItem("pocket-desk-taskbar-pinned-v2");
      localStorage.removeItem("pocket-desk-windows-v1");
    });
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.deleteDatabase("pocket-desk-vfs");
          request.onsuccess = () => resolve(null);
          request.onerror = () => resolve(null);
          request.onblocked = () => resolve(null);
        }),
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    await unlockPocketDesk(page);
    assert(
      (await page.locator(".taskbar-app.is-current").count()) === 0,
      "Pinned taskbar app appeared active without an open window",
    );

    await page.mouse.move(900, 180);
    await page.mouse.down();
    await page.mouse.move(380, 520, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert((await page.locator(".desktop").count()) === 1, "Desktop selection drag crashed the shell");
    assert((await page.locator(".desktop-icon").count()) === 2, "Desktop should only show core system icons");
    const defaultIconBoxes = await page.locator(".desktop-icon").evaluateAll((icons) =>
      icons.map((icon) => {
        const box = icon.getBoundingClientRect();
        return { left: box.left, top: box.top };
      }),
    );
    assert(defaultIconBoxes[0].left === defaultIconBoxes[1].left, "Desktop system icons are not vertically aligned");
    assert(defaultIconBoxes[0].top < defaultIconBoxes[1].top, "Desktop system icon order is wrong");

    const desktopThisPc = page.locator(".desktop-icon", { hasText: "내 PC" });
    await desktopThisPc.click();
    assert(
      (await page.locator('article[aria-label="내 PC"]').count()) === 0,
      "Desktop icon opened on a single click",
    );
    await desktopThisPc.dblclick();
    const desktopThisPcWindow = page.locator('article[aria-label="내 PC"]');
    await desktopThisPcWindow.waitFor({ state: "visible" });
    const showDesktopButton = page.getByRole("button", { name: "바탕 화면 표시" });
    await showDesktopButton.click();
    await desktopThisPcWindow.waitFor({ state: "hidden" });
    await showDesktopButton.click();
    await desktopThisPcWindow.waitFor({ state: "visible" });
    await desktopThisPcWindow.getByRole("button", { name: "내 PC 닫기" }).click();
    await desktopThisPcWindow.waitFor({ state: "hidden" });

    await page.keyboard.press("Meta+e");
    const shortcutExplorer = page.locator('article[aria-label="파일 탐색기"]');
    await shortcutExplorer.waitFor({ state: "visible" });
    await page.keyboard.press("Alt+F4");
    await shortcutExplorer.waitFor({ state: "hidden" });

    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 720,
      clientY: 180,
    });
    const desktopMenu = page.locator(".desktop-context-menu");
    await desktopMenu.waitFor({ state: "visible" });
    const desktopMenuText = await desktopMenu.innerText();
    assert(desktopMenuText.includes("보기"), "Desktop context menu is missing View");
    assert(desktopMenuText.includes("정렬 기준"), "Desktop context menu is missing Sort by");
    assert(desktopMenuText.includes("새로 고침"), "Desktop context menu is missing Refresh");
    await desktopMenu.getByRole("menuitem", { name: "보기" }).hover();
    const viewMenu = page.getByRole("menu", { name: "보기" });
    await viewMenu.waitFor({ state: "visible" });
    await viewMenu.getByRole("menuitemradio", { name: "큰 아이콘" }).click();
    assert(await page.locator(".desktop").evaluate((node) => node.classList.contains("desktop-view-large")), "Large desktop icon view did not apply");
    const largeIconWidth = await page.locator(".desktop-icon").first().evaluate((node) => node.getBoundingClientRect().width);
    assert(largeIconWidth > 86, "Large desktop icon view did not increase icon width");

    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 720,
      clientY: 180,
    });
    await desktopMenu.getByRole("menuitem", { name: "정렬 기준" }).hover();
    const sortMenu = page.getByRole("menu", { name: "정렬 기준" });
    await sortMenu.waitFor({ state: "visible" });
    await sortMenu.getByRole("menuitemradio", { name: "이름" }).click();
    const sortedIconBoxes = await page.locator(".desktop-icon").evaluateAll((icons) =>
      icons.map((icon) => {
        const box = icon.getBoundingClientRect();
        return { left: box.left, top: box.top };
      }),
    );
    assert(sortedIconBoxes[0].left === sortedIconBoxes[1].left, "Desktop name sort did not form a vertical grid");
    assert(sortedIconBoxes[0].top < sortedIconBoxes[1].top, "Desktop name sort order is wrong");

    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 720,
      clientY: 180,
    });
    await desktopMenu.getByRole("menuitem", { name: "새로 만들기" }).hover();
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
      (await page.locator('article[aria-label="메모장"]').count()) === 0,
      "Desktop file opened on a single click",
    );
    await desktopNote.dblclick();
    const desktopNotepad = page.locator('article[aria-label="메모장"]');
    await desktopNotepad.waitFor({ state: "visible" });
    await desktopNotepad.getByRole("button", { name: "보기", exact: true }).click();
    const noteViewMenu = desktopNotepad.getByRole("menu");
    await noteViewMenu.getByRole("menuitemcheckbox", { name: /자동 줄 바꿈/ }).click();
    assert(
      (await desktopNotepad.getByLabel("메모 내용").getAttribute("wrap")) === "off",
      "Notepad word wrap command did not apply",
    );
    await desktopNotepad.getByRole("button", { name: "메모장 닫기" }).click();

    await desktopNote.dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 320,
      clientY: 240,
    });
    const desktopItemMenu = page.getByRole("menu", { name: "바탕 화면 항목 메뉴" });
    await desktopItemMenu.waitFor({ state: "visible" });
    assert((await desktopItemMenu.innerText()).includes("복사"), "Desktop item menu is missing Copy");
    assert((await desktopItemMenu.innerText()).includes("속성"), "Desktop item menu is missing Properties");
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
    await startButton.click();
    const startMenu = page.locator(".start-menu");
    await startMenu.waitFor({ state: "visible" });
    const startText = await startMenu.innerText();
    assert(startText.includes("고정됨"), "Start menu pinned section missing");
    assert(startText.includes("모든 앱"), "Start menu all-apps action missing");
    assert(startText.includes("추천"), "Start menu recommended section missing");
    assert(await page.locator(".start-pinned-grid button").count() >= 6, "Pinned app grid is too sparse");
    await startMenu.getByRole("button", { name: "전원 옵션" }).click();
    await startMenu.getByRole("menuitem", { name: "다시 시작" }).click();
    await page.locator('[aria-label="부팅 화면"]').waitFor({ state: "visible" });
    await unlockPocketDesk(page);
    await page.waitForTimeout(250);

    await page.getByRole("button", { name: "시작 메뉴" }).click();
    await startMenu.waitFor({ state: "visible" });

    await startMenu.locator(".start-pinned-grid").getByRole("button", { name: /내 PC/ }).click();
    const thisPc = page.locator('article[aria-label="내 PC"]');
    await thisPc.waitFor({ state: "visible" });
    const thisPcText = await thisPc.innerText();
    assert(thisPcText.includes("장치 및 드라이브"), "This PC did not show drive section");
    assert(thisPcText.includes("로컬 디스크 (C:)"), "This PC did not show local disk");
    await thisPc.getByRole("button", { name: "자세히 보기" }).click();
    assert(
      await thisPc.locator(".this-pc-drive-list").evaluate((node) => node.classList.contains("is-details")),
      "This PC details view did not apply",
    );
    const thisPcSearch = thisPc.getByLabel("내 PC 검색");
    await thisPcSearch.fill("없는 드라이브");
    assert((await thisPc.innerText()).includes("검색 결과 없음"), "This PC search did not filter drives");
    await thisPcSearch.fill("");
    await thisPc.getByRole("button", { name: /로컬 디스크/ }).click();
    assert(await thisPc.getByRole("button", { name: "열기" }).isEnabled(), "This PC Open command stayed disabled");
    await thisPc.getByRole("button", { name: /바탕 화면/ }).click();
    await page.locator('article[aria-label="파일 탐색기"]').waitFor({ state: "visible" });
    const files = page.locator('article[aria-label="파일 탐색기"]');
    await files.getByRole("button", { name: "문서", exact: true }).click();
    assert((await files.locator(".file-list button").count()) > 0, "Documents view is empty");
    assert((await files.locator(".file-list").innerText()).includes("notes.txt"), "Documents view did not filter notes");
    await files.getByRole("button", { name: "바탕 화면", exact: true }).click();

    await files.getByRole("button", { name: "정렬" }).click();
    const explorerSortMenu = files.getByRole("menu", { name: "파일 정렬" });
    await explorerSortMenu.waitFor({ state: "visible" });
    await explorerSortMenu.getByRole("menuitemradio", { name: "이름" }).click();
    await files.getByRole("button", { name: "정렬" }).click();
    await explorerSortMenu.getByRole("menuitemradio", { name: "내림차순" }).click();
    const descendingNames = await files.locator(".file-list button > span").allInnerTexts();
    assert(descendingNames[0] === "web-surf.url", "Explorer descending name sort is wrong");

    await files.getByRole("button", { name: "큰 아이콘 보기" }).click();
    assert(await files.locator(".file-list").evaluate((node) => node.classList.contains("file-view-icons")), "Explorer icon view did not apply");
    await files.locator(".file-list button").first().click();
    await page.keyboard.press("Control+a");
    assert((await files.locator(".file-list button.is-selected").count()) === 4, "Explorer Ctrl+A did not select all files");
    await files.locator(".file-list button").first().click({ modifiers: [multiSelectModifier] });
    const ctrlClickSelectionCount = await files.locator(".file-list button.is-selected").count();
    assert(ctrlClickSelectionCount === 3, `Explorer Ctrl+click did not toggle selection: ${ctrlClickSelectionCount}`);
    assert(!(await files.locator(".file-preview h3").innerText()).includes("web-surf.url"), "Explorer kept a deselected file active");
    await files.locator(".file-list button", { hasText: "web-surf.url" }).click();
    await page.keyboard.press("F2");
    await files.getByLabel("파일 이름").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await files.getByLabel("파일 이름").waitFor({ state: "hidden" });
    await page.keyboard.press("ArrowDown");
    const arrowSelectedName = await files.locator(".file-list button.is-selected span").innerText();
    assert(arrowSelectedName === "sketch.canvas", `Explorer arrow navigation did not move selection: ${arrowSelectedName}`);
    await files.getByRole("button", { name: "자세히 보기" }).click();
    await files.getByRole("button", { name: "정렬" }).click();
    await files.locator(".file-address").click();
    await explorerSortMenu.waitFor({ state: "hidden" });

    await files.getByRole("button", { name: "새로 만들기" }).click();
    const newFileMenu = files.getByRole("menu", { name: "새로 만들기" });
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
    assert((await fileContextMenu.innerText()).includes("열기"), "Explorer file context menu is missing Open");
    assert((await fileContextMenu.innerText()).includes("복사"), "Explorer file context menu is missing Copy");
    assert((await fileContextMenu.innerText()).includes("속성"), "Explorer file context menu is missing Properties");
    await fileContextMenu.getByRole("menuitem", { name: "속성" }).click();
    const propertiesDialog = files.getByRole("dialog", { name: "파일 속성" });
    await propertiesDialog.waitFor({ state: "visible" });
    const propertiesText = await propertiesDialog.innerText();
    assert(propertiesText.includes("작업 메모.txt"), "Explorer Properties did not show the file name");
    assert(propertiesText.includes("크기"), "Explorer Properties did not show file size");
    assert(propertiesText.includes("만든 날짜"), "Explorer Properties did not show creation time");
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
    await propertiesDialog.getByRole("button", { name: "확인" }).click();

    await workNote.click();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    const copiedWorkNote = files.locator(".file-list button", { hasText: "작업 메모 - 복사본.txt" });
    await copiedWorkNote.waitFor({ state: "visible" });
    assert((await copiedWorkNote.count()) === 1, "Explorer copy/paste did not create one persisted copy");
    await page.waitForTimeout(180);
    const copiedFilePersisted = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.open("pocket-desk-vfs");
          request.onerror = () => resolve(false);
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("entries", "readonly");
            const allEntries = transaction.objectStore("entries").getAll();
            allEntries.onerror = () => resolve(false);
            allEntries.onsuccess = () => {
              resolve(allEntries.result.some((entry) => entry.name === "작업 메모 - 복사본.txt"));
              database.close();
            };
          };
        }),
    );
    assert(copiedFilePersisted, "Explorer copy was not persisted to IndexedDB");

    await page.keyboard.press("Control+Alt+R");
    const runDialog = page.locator(".run-dialog");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("calc");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const calculator = page.locator('article[aria-label="계산기"]');
    await calculator.waitFor({ state: "visible" });
    for (const key of ["7", "+", "5", "="]) {
      await calculator.getByRole("button", { name: key, exact: true }).click();
    }
    assert((await calculator.getByLabel("계산기 표시창").innerText()) === "12", "Calculator result is wrong");
    await calculator.getByRole("button", { name: "M+", exact: true }).click();
    await calculator.getByRole("button", { name: "C", exact: true }).click();
    await calculator.getByRole("button", { name: "MR", exact: true }).click();
    assert((await calculator.getByLabel("계산기 표시창").innerText()) === "12", "Calculator memory recall failed");
    await calculator.getByRole("button", { name: "기록", exact: true }).click();
    assert((await calculator.locator(".calc-history-panel").innerText()).includes("7+5"), "Calculator history is empty");

    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("지뢰찾기");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const minesweeper = page.locator('article[aria-label="지뢰찾기"]');
    await minesweeper.waitFor({ state: "visible" });
    const difficultySelect = minesweeper.getByLabel("지뢰찾기 난이도");
    await difficultySelect.selectOption("medium");
    assert((await minesweeper.locator(".mine-cell").count()) === 256, "Minesweeper intermediate board is not 16x16");
    assert((await minesweeper.locator(".mines-commandbar").innerText()).includes("16 × 16"), "Minesweeper intermediate dimensions are wrong");
    await difficultySelect.selectOption("hard");
    assert((await minesweeper.locator(".mine-cell").count()) === 480, "Minesweeper expert board is not 30x16");
    assert((await minesweeper.locator(".mines-commandbar").innerText()).includes("30 × 16"), "Minesweeper expert dimensions are wrong");
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
    assert(await mineCells.nth(80).evaluate((node) => node.classList.contains("is-flagged")), "Minesweeper touch flag mode failed");
    assert((await minesweeper.locator(".mines-counter.is-time strong").innerText()) === "0:00", "Minesweeper timer started before the first reveal");
    await mineCells.nth(80).click();
    await minesweeper.getByRole("button", { name: "깃발 모드" }).click();

    await mineCells.first().click();
    assert((await minesweeper.locator(".mine-cell.is-open").count()) > 0, "Minesweeper first click opened no cells");
    assert((await minesweeper.locator(".mine-cell.is-mine").count()) === 0, "Minesweeper first click hit a mine");
    const wrongFlagIndex = (
      await Promise.all(
        [...Array(81).keys()]
          .filter((index) => !deterministicMines.has(index))
          .map(async (index) => ({
            index,
            open: await mineCells.nth(index).evaluate((node) => node.classList.contains("is-open")),
          })),
      )
    ).find((cell) => !cell.open)?.index;
    assert(wrongFlagIndex !== undefined, "Minesweeper deterministic board has no closed safe cell");
    await mineCells.nth(wrongFlagIndex).dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await mineCells.nth([...deterministicMines][0]).click();
    const lostDialog = minesweeper.getByRole("dialog");
    await lostDialog.waitFor({ state: "visible" });
    assert((await lostDialog.innerText()).includes("게임 종료"), "Minesweeper loss result was not shown");
    assert((await minesweeper.locator(".mine-cell.is-detonated").count()) === 1, "Minesweeper did not mark the detonated mine");
    assert((await minesweeper.locator(".mine-cell.is-wrong-flag").count()) === 1, "Minesweeper did not mark the wrong flag");
    await lostDialog.getByRole("button", { name: "보드 보기" }).click();
    await lostDialog.waitFor({ state: "hidden" });
    assert(await mineCells.first().isDisabled(), "Minesweeper board stayed interactive after loss");
    await minesweeper.getByRole("button", { name: "새 게임" }).click();

    await mineCells.first().click();
    for (const index of [...Array(81).keys()].filter((cellIndex) => !deterministicMines.has(cellIndex))) {
      const cell = mineCells.nth(index);
      if (!(await cell.evaluate((node) => node.classList.contains("is-open")))) {
        await cell.click();
      }
    }
    const wonDialog = minesweeper.getByRole("dialog");
    await wonDialog.waitFor({ state: "visible" });
    assert((await wonDialog.innerText()).includes("게임 완료"), "Minesweeper win result was not shown");
    assert((await minesweeper.locator(".mine-cell.is-flagged").count()) === 10, "Minesweeper did not auto-flag every mine on win");
    assert((await minesweeper.locator(".mines-counter").first().locator("strong").innerText()) === "00", "Minesweeper counter did not finish at zero");
    const completedTime = await minesweeper.locator(".mines-counter.is-time strong").innerText();
    await page.waitForTimeout(1100);
    assert((await minesweeper.locator(".mines-counter.is-time strong").innerText()) === completedTime, "Minesweeper timer kept running after completion");
    await wonDialog.getByRole("button", { name: "보드 보기" }).click();
    assert(await mineCells.first().isDisabled(), "Minesweeper board stayed interactive after victory");
    await page.evaluate(() => {
      Math.random = window.__pocketDeskOriginalRandom;
      delete window.__pocketDeskOriginalRandom;
    });

    await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
    await files.waitFor({ state: "visible" });
    await files.locator(".file-list button", { hasText: "web-surf.url" }).click();
    const filePreviewText = await files.locator(".file-preview").innerText();
    assert(filePreviewText.includes("연결 프로그램: 웹 브라우저"), "File Explorer did not show URL association");
    await page.keyboard.press("Enter");
    await page.locator('article[aria-label="웹 브라우저"]').waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const browser = document.querySelector('article[aria-label="웹 브라우저"]');
      const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
      return input instanceof HTMLInputElement && input.value.includes("https://example.com");
    });
    assert((await page.locator('article[aria-label="웹 브라우저"] iframe').count()) === 0, "Browser kept unreliable iframe rendering");
    await page.locator('article[aria-label="웹 브라우저"] .browser-external-page').getByRole("link", { name: "새 탭에서 열기" }).waitFor({ state: "visible" });
    await page.locator(".taskbar-app", { hasText: "웹 브라우저" }).hover();
    const taskbarPreview = page.locator(".taskbar-preview-card");
    await taskbarPreview.waitFor({ state: "visible" });
    assert((await taskbarPreview.innerText()).includes("웹 브라우저"), "Taskbar preview did not show browser");
    await page.getByRole("button", { name: "알림 센터 열기" }).click();
    const notificationCenter = page.locator(".notification-center-panel");
    await notificationCenter.waitFor({ state: "visible" });
    assert((await notificationCenter.locator(".notification-item").count()) > 0, "Notification center did not keep recent alerts");
    await notificationCenter.getByRole("button", { name: "모두 지우기" }).click();
    assert((await notificationCenter.innerText()).includes("새 알림 없음"), "Notification center did not clear alerts");
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
      (await page.evaluate(() => localStorage.getItem("pocket-desk-display-brightness-v1"))) === "55",
      "Quick Settings brightness was not persisted",
    );
    assert(
      Number(
        await page.locator(".desktop").evaluate((desktop) =>
          getComputedStyle(desktop).getPropertyValue("--display-dim"),
        ),
      ) > 0,
      "Quick Settings brightness did not dim the desktop",
    );
    await brightnessSlider.fill("100");
    await quickSettings.getByRole("button", { name: "설정", exact: true }).click();
    const settings = page.locator('article[aria-label="설정"]');
    await settings.waitFor({ state: "visible" });
    await settings.getByRole("button", { name: "시스템", exact: true }).click();
    assert((await settings.innerText()).includes("창과 바탕 화면"), "Settings System tab is not functional");
    await settings.getByRole("button", { name: "소리", exact: true }).click();
    assert((await settings.locator('input[type="checkbox"]').count()) === 1, "Settings Sound tab is not functional");
    await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
    const fileToTrash = files.locator(".file-list button").first();
    const trashedFileName = await fileToTrash.locator("span").innerText();
    await fileToTrash.click();
    await page.keyboard.press("Delete");

    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("recycle");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const recycle = page.locator('article[aria-label="휴지통"]');
    await recycle.waitFor({ state: "visible" });
    assert((await recycle.innerText()).includes(trashedFileName), "Recycle Bin did not show deleted file");
    await recycle.getByRole("button", { name: "복원" }).click();
    await page.waitForTimeout(180);
    assert(!(await recycle.innerText()).includes(trashedFileName), "Recycle Bin still shows restored file");

    await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
    await files.locator(".file-list button", { hasText: trashedFileName }).click();
    await files.locator(".file-preview").getByRole("button", { name: "삭제" }).click();
    await page.locator(".taskbar-app", { hasText: "휴지통" }).click();
    await recycle.getByRole("button", { name: "휴지통 비우기" }).click();
    await recycle.getByRole("button", { name: "모두 삭제" }).click();
    await page.waitForTimeout(180);
    assert((await recycle.innerText()).includes("휴지통이 비어 있습니다"), "Recycle Bin did not empty");

    const initialTaskbar = await page
      .locator(".taskbar-app")
      .evaluateAll((items) => items.map((item) => item.textContent?.trim().replace(/\s+/g, " ")));
    assert(initialTaskbar.some((text) => text?.includes("파일 탐색기")), "File Explorer pinned taskbar app missing");
    await page
      .locator(".taskbar-app", { hasText: "파일 탐색기" })
      .dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await page.getByRole("menuitem", { name: "작업 표시줄에서 제거" }).click();
    await page.waitForTimeout(180);
    const pinnedAfterUnpin = await page.evaluate(() => localStorage.getItem("pocket-desk-taskbar-pinned-v2"));
    assert(pinnedAfterUnpin && !pinnedAfterUnpin.includes("files"), "Taskbar unpin did not persist");

    await page.locator(".taskbar-app", { hasText: "웹 브라우저" }).click();
    const frame = page.locator('article[aria-label="웹 브라우저"]');
    const titlebar = frame.locator(".window-titlebar");
    await frame.getByRole("button", { name: "웹 브라우저 최대화" }).hover();
    const snapLayoutMenu = frame.getByRole("menu", { name: "스냅 레이아웃" });
    await snapLayoutMenu.waitFor({ state: "visible" });
    assert((await snapLayoutMenu.getByRole("menuitem").count()) === 3, "Snap layout choices missing");
    await page.mouse.move(8, 8);
    await snapLayoutMenu.waitFor({ state: "hidden" });
    const box = await titlebar.boundingBox();
    assert(box, "Internet titlebar missing");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(0, box.y + box.height / 2, { steps: 12 });
    await page.locator(".snap-preview").waitFor({ state: "visible", timeout: 1000 });
    await page.mouse.up();
    await page.waitForTimeout(220);
    const snapped = await frame.boundingBox();
    assert(snapped && snapped.x <= 20 && snapped.width >= 560 && snapped.width <= 680, "Window did not snap left");
    const titlebarAfterSnap = frame.locator(".window-titlebar");
    await titlebarAfterSnap.dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: snapped.x + 80,
      clientY: snapped.y + 18,
    });
    const windowSystemMenu = page.locator(".window-system-menu");
    await windowSystemMenu.waitFor({ state: "visible" });
    assert((await windowSystemMenu.innerText()).includes("최대화"), "Window system menu missing maximize action");
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
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(250);
    const mobileExplorerSidebar = await files.locator("aside").boundingBox();
    assert(mobileExplorerSidebar && mobileExplorerSidebar.height >= 54, "Mobile Explorer navigation collapsed");
    const visibleWindowBoxes = await page.locator(".window-frame:visible").evaluateAll((frames) =>
      frames.map((frame) => {
        const box = frame.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    );
    assert(
      visibleWindowBoxes.every((box) => box.left >= 0 && box.right <= 390),
      "Mobile window escaped viewport bounds",
    );
    assert(await page.locator(".start-glyph").isVisible(), "Mobile Start glyph is hidden");
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    assert(!hasHorizontalOverflow, "Mobile viewport has horizontal overflow");
    assert(consoleErrors.length === 0, `Console errors found: ${consoleErrors.join(" | ")}`);

    console.log("PocketDesk smoke test passed");
  } finally {
    await browser.close();
  }
}

const port = await getFreePort();
const baseUrl = `http://${host}:${port}/`;
const preview = spawn(
  npmCommand,
  ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"],
  {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
preview.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitForServer(baseUrl);
  await withTimeout(runSmoke(baseUrl), smokeTimeoutMs, "PocketDesk smoke test");
} finally {
  preview.kill();
}
