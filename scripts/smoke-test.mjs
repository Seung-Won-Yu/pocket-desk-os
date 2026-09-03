import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const host = "127.0.0.1";
const smokeTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180000);
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

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

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise((resolve) => {
    const forceStop = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => {
      clearTimeout(forceStop);
      resolve();
    });
    child.kill();
  });
}

async function unlockPocketDesk(page) {
  const shellGate = page.locator(".shell-gate");
  const lockScreen = page.locator('[aria-label="PocketDesk 잠금 화면"]');
  await lockScreen.waitFor({ state: "visible", timeout: 6000 });
  await lockScreen.click();
  const signInButton = page.getByRole("button", { name: "로그인", exact: true });
  await signInButton.waitFor({ state: "visible" });
  await signInButton.click();
  await shellGate.waitFor({ state: "hidden" });
  assert(
    await page
      .locator(".desktop")
      .evaluate((desktop) => desktop.classList.contains("is-unlocked")),
    "Desktop unlock transition state missing",
  );
}

/**
 * Types one line into the Command Prompt and returns only the output that line
 * produced, so each assertion reads the fresh result instead of the whole buffer.
 */
async function runTerminalCommand(terminal, command) {
  const lines = terminal.locator(".terminal-line");
  const lineCountBefore = await lines.count();
  const input = terminal.getByLabel("명령 입력");
  await input.fill(command);
  await input.press("Enter");
  await lines.nth(lineCountBefore).waitFor({ state: "attached" });
  return (await lines.allInnerTexts()).slice(lineCountBefore + 1).join("\n");
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
  await page.route("https://r.jina.ai/**", (route) => {
    const headers = {
      "access-control-allow-headers": "x-retain-images",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-origin": "*",
    };

    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ headers, status: 204 });
    }

    return route.fulfill({
      body: [
        "Title: Example Domain",
        "",
        "URL Source: https://example.com/",
        "",
        "Markdown Content:",
        "# Example Domain",
        "",
        "Reader mode content.",
        "",
        "[Learn more](https://iana.org/domains/example)",
      ].join("\n"),
      contentType: "text/plain; charset=utf-8",
      headers,
      status: 200,
    });
  });
  await page.route("https://seung-won-yu.github.io/apple-burst/**", (route) =>
    route.fulfill({
      body: [
        "<!doctype html>",
        '<html lang="ko">',
        "<head><title>사과 팡팡</title></head>",
        '<body data-screen="start">',
        '<main><h1>사과 팡팡</h1><button type="button">선택한 모드로 게임 시작</button></main>',
        "</body>",
        "</html>",
      ].join(""),
      contentType: "text/html; charset=utf-8",
      status: 200,
    }),
  );

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
    await page.evaluate(() => {
      window.__pocketDeskPwaTestRegistration = { waiting: { postMessage() {} } };
      window.dispatchEvent(
        new CustomEvent("pocketdesk:pwa-update", {
          detail: { registration: window.__pocketDeskPwaTestRegistration },
        }),
      );
    });
    const pwaUpdatePrompt = page.locator('[aria-label="PocketDesk 업데이트"]');
    await pwaUpdatePrompt.waitFor({ state: "visible" });
    await pwaUpdatePrompt.getByRole("button", { name: "업데이트 알림 닫기" }).click();
    await pwaUpdatePrompt.waitFor({ state: "hidden" });
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("pocketdesk:pwa-update", {
          detail: { registration: window.__pocketDeskPwaTestRegistration },
        }),
      );
    });
    await page.waitForTimeout(100);
    assert(
      !(await pwaUpdatePrompt.isVisible()),
      "Dismissed PWA update prompt reopened for the same worker",
    );
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("pocketdesk:pwa-update", {
          detail: { registration: { waiting: { postMessage() {} } } },
        }),
      );
      delete window.__pocketDeskPwaTestRegistration;
    });
    await pwaUpdatePrompt.waitFor({ state: "visible" });
    await pwaUpdatePrompt.getByRole("button", { name: "업데이트 알림 닫기" }).click();
    assert(
      (await page.locator(".taskbar-app.is-current").count()) === 0,
      "Pinned taskbar app appeared active without an open window",
    );

    await page.mouse.move(900, 180);
    await page.mouse.down();
    await page.mouse.move(380, 520, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert(
      (await page.locator(".desktop").count()) === 1,
      "Desktop selection drag crashed the shell",
    );
    assert(
      (await page.locator(".desktop-icon").count()) === 2,
      "Desktop should only show core system icons",
    );
    const defaultIconBoxes = await page.locator(".desktop-icon").evaluateAll((icons) =>
      icons.map((icon) => {
        const box = icon.getBoundingClientRect();
        return { left: box.left, top: box.top };
      }),
    );
    assert(
      defaultIconBoxes[0].left === defaultIconBoxes[1].left,
      "Desktop system icons are not vertically aligned",
    );
    assert(
      defaultIconBoxes[0].top < defaultIconBoxes[1].top,
      "Desktop system icon order is wrong",
    );

    const desktopThisPc = page.locator(".desktop-icon", { hasText: "내 PC" });
    await desktopThisPc.click();
    assert(
      (await page.locator('article[data-app-id="thispc"]').count()) === 0,
      "Desktop icon opened on a single click",
    );
    await desktopThisPc.dblclick();
    const desktopThisPcWindow = page.locator('article[data-app-id="thispc"]');
    await desktopThisPcWindow.waitFor({ state: "visible" });
    assert(
      (
        await desktopThisPcWindow.evaluate((frame) => getComputedStyle(frame).animationName)
      ).includes("window-open"),
      "Window open transition missing",
    );
    const showDesktopButton = page.getByRole("button", { name: "바탕 화면 표시" });
    await showDesktopButton.click();
    await desktopThisPcWindow.waitFor({ state: "hidden" });
    await showDesktopButton.click();
    await desktopThisPcWindow.waitFor({ state: "visible" });
    await desktopThisPcWindow.getByRole("button", { name: "내 PC 닫기" }).click();
    assert(
      await desktopThisPcWindow.evaluate((frame) => frame.classList.contains("is-closing")),
      "Window close transition missing",
    );
    await desktopThisPcWindow.waitFor({ state: "hidden" });

    await page.keyboard.press("Meta+e");
    const shortcutExplorer = page.locator('article[data-app-id="files"]');
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
    assert(
      await page
        .locator(".desktop")
        .evaluate((node) => node.classList.contains("desktop-view-large")),
      "Large desktop icon view did not apply",
    );
    const largeIconWidth = await page
      .locator(".desktop-icon")
      .first()
      .evaluate((node) => node.getBoundingClientRect().width);
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
    assert(
      sortedIconBoxes[0].left === sortedIconBoxes[1].left,
      "Desktop name sort did not form a vertical grid",
    );
    assert(sortedIconBoxes[0].top < sortedIconBoxes[1].top, "Desktop name sort order is wrong");

    // 새로 만들기 > 인터넷 바로 가기: the wizard refuses a non-http scheme,
    // writes a real .url onto the desktop, and opening it hands Edge the address.
    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 760,
      clientY: 420,
    });
    await desktopMenu.getByRole("menuitem", { name: "새로 만들기" }).hover();
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
      await page.waitForTimeout(150);
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
    await page.waitForTimeout(250);
    // Windows closes every app on restart; this used to bring the whole
    // session back as if nothing had happened.
    assert((await page.locator(".window-frame").count()) === 0, "Restart left windows running");

    await page.getByRole("button", { name: "시작 메뉴" }).click();
    await startMenu.waitFor({ state: "visible" });

    await startMenu
      .locator(".start-pinned-grid")
      .getByRole("button", { name: /내 PC/ })
      .click();
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
    await explorerSidebar.getByRole("button", { name: "문서", exact: true }).click();
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
    await page.waitForTimeout(200);
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
    await page.waitForTimeout(200);

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
    await page.waitForTimeout(150);
    const endName = await selectedName();
    await page.keyboard.press("Home");
    await page.waitForTimeout(150);
    const homeName = await selectedName();
    assert(
      endName !== null && homeName !== null && endName !== homeName,
      `Home and End both selected ${homeName}`,
    );
    await page.keyboard.press("Shift+ArrowDown");
    await page.waitForTimeout(150);
    assert(
      (await files.locator('[role="option"][aria-selected="true"]').count()) === 2,
      "Shift+ArrowDown replaced the selection instead of extending it",
    );

    // Typing a letter jumps to the next item that starts with it.
    await page.keyboard.press("Home");
    await page.waitForTimeout(120);
    const beforeTypeAhead = await selectedName();
    const typeAheadLetter = (
      await files.evaluate((node) => {
        const options = [...node.querySelectorAll('[role="option"]')];
        const names = options.map((option) => option.textContent?.trim().split("\n")[0] ?? "");
        const first = names[0] ?? "";
        // A letter that some other item starts with and the first one does not.
        return names.slice(1).find((name) => name[0] && name[0] !== first[0])?.[0] ?? "";
      })
    ).toLowerCase();
    assert(typeAheadLetter !== "", "No distinct first letter to test type-ahead with");
    await page.keyboard.press(typeAheadLetter);
    await page.waitForTimeout(200);
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
      .getByRole("button", { name: "사진", exact: true })
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
    await explorerSidebar.getByRole("button", { name: "바탕 화면", exact: true }).click();

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
    const ctrlClickSelectionCount = await files
      .locator(".file-list button.is-selected")
      .count();
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
    assert(
      propertiesLayout.windowScrollTop === 0,
      "Explorer Properties scrolled the whole app",
    );
    await propertiesDialog.getByRole("button", { name: "확인" }).click();

    await workNote.click();
    await page.keyboard.press("Control+c");
    await page.keyboard.press("Control+v");
    const copiedWorkNote = files.locator(".file-list button", {
      hasText: "작업 메모 - 복사본.txt",
    });
    await copiedWorkNote.waitFor({ state: "visible" });
    assert(
      (await copiedWorkNote.count()) === 1,
      "Explorer copy/paste did not create one persisted copy",
    );
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
              resolve(
                allEntries.result.some((entry) => entry.name === "작업 메모 - 복사본.txt"),
              );
              database.close();
            };
          };
        }),
    );
    assert(copiedFilePersisted, "Explorer copy was not persisted to IndexedDB");

    const vfsMetadata = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const request = indexedDB.open("pocket-desk-vfs");
          request.onerror = () => resolve(null);
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("meta")) {
              database.close();
              resolve(null);
              return;
            }
            const transaction = database.transaction(["entries", "meta"], "readonly");
            const entriesRequest = transaction.objectStore("entries").count();
            const metaRequest = transaction.objectStore("meta").get("snapshot");
            transaction.oncomplete = () => {
              resolve({
                databaseVersion: database.version,
                entryCount: entriesRequest.result,
                metadata: metaRequest.result,
              });
              database.close();
            };
            transaction.onerror = () => {
              database.close();
              resolve(null);
            };
          };
        }),
    );
    assert(
      vfsMetadata?.databaseVersion === 2,
      "VFS database did not migrate to schema version 2",
    );
    assert(vfsMetadata?.metadata?.schemaVersion === 2, "VFS snapshot metadata is missing");
    assert(
      vfsMetadata?.metadata?.entryCount === vfsMetadata?.entryCount,
      "VFS snapshot metadata count does not match persisted entries",
    );

    const explorerFileCountBeforeInvalidImport = await files
      .locator(".file-list button")
      .count();
    await files.locator('input[type="file"][accept*=".zip"]').setInputFiles({
      buffer: Buffer.from("not-a-pocketdesk-zip"),
      mimeType: "application/zip",
      name: "damaged-backup.zip",
    });
    await page.getByText("ZIP 가져오기 실패", { exact: true }).waitFor({ state: "visible" });
    assert(
      (await files.locator(".file-list button").count()) ===
        explorerFileCountBeforeInvalidImport,
      "Invalid ZIP import replaced the current VFS state",
    );

    await page.keyboard.press("Control+Alt+R");
    const runDialog = page.locator(".run-dialog");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("calc");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const calculator = page.locator('article[data-app-id="calculator"]');
    await calculator.waitFor({ state: "visible" });
    for (const key of ["7", "+", "5", "="]) {
      await calculator.getByRole("button", { name: key, exact: true }).click();
    }
    assert(
      (await calculator.getByLabel("계산기 표시창").innerText()) === "12",
      "Calculator result is wrong",
    );
    await calculator.getByRole("button", { name: "M+", exact: true }).click();
    await calculator.getByRole("button", { name: "C", exact: true }).click();
    await calculator.getByRole("button", { name: "MR", exact: true }).click();
    assert(
      (await calculator.getByLabel("계산기 표시창").innerText()) === "12",
      "Calculator memory recall failed",
    );
    await calculator.getByRole("button", { name: "기록", exact: true }).click();
    assert(
      (await calculator.locator(".calc-history-panel").innerText()).includes("7+5"),
      "Calculator history is empty",
    );

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
    await page.keyboard.press("Alt+F4");
    await jumpNotepad.waitFor({ state: "detached" });

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
    await page.waitForTimeout(150);
    assert(
      !(await focusNotepad.getAttribute("class"))?.includes("is-active") &&
        (await focusTaskbarButton.getAttribute("aria-current")) === null,
      "Pressing the desktop did not take focus off the window",
    );
    await focusTaskbarButton.click();
    await page.waitForTimeout(150);
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
    const completedTime = await minesweeper
      .locator(".mines-counter.is-time strong")
      .innerText();
    await page.waitForTimeout(1100);
    assert(
      (await minesweeper.locator(".mines-counter.is-time strong").innerText()) ===
        completedTime,
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

    await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
    await files.waitFor({ state: "visible" });
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
    assert(
      (await edgeFrame.count()) === 1,
      "Edge did not render the website inside its window",
    );
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
      .getByRole("button", { name: "문서", exact: true })
      .click();
    await page.waitForTimeout(300);
    assert(
      (await explorerFrames.nth(1).getAttribute("aria-label"))?.startsWith(
        "문서 - 파일 탐색기",
      ),
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
    await page.waitForTimeout(250);

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
    await explorerSidebar.getByRole("button", { name: "문서", exact: true }).click();
    const fileToTrash = files.locator(".file-list button", { hasText: "프로젝트" });
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
    await page.waitForTimeout(180);
    assert(
      !(await recycle.innerText()).includes(trashedFileName),
      "Recycle Bin still shows restored file",
    );

    await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
    await explorerSidebar.getByRole("button", { name: "문서", exact: true }).click();
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
    await page.waitForTimeout(180);
    assert(
      (await recycle.innerText()).includes("휴지통이 비어 있습니다"),
      "Recycle Bin did not empty",
    );

    const initialTaskbar = await page
      .locator(".taskbar-app")
      .evaluateAll((items) =>
        items.map((item) => item.textContent?.trim().replace(/\s+/g, " ")),
      );
    assert(
      initialTaskbar.some((text) => text?.includes("파일 탐색기")),
      "File Explorer pinned taskbar app missing",
    );
    await page
      .locator(".taskbar-app", { hasText: "파일 탐색기" })
      .dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await page.getByRole("menuitem", { name: "작업 표시줄에서 제거" }).click();
    await page.waitForTimeout(180);
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
    assert(
      (await snapLayoutMenu.getByRole("menuitem").count()) === 3,
      "Snap layout choices missing",
    );
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
    await page.waitForTimeout(250);

    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("cmd");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const terminal = page.locator('article[data-app-id="terminal"]');
    await terminal.waitFor({ state: "visible" });
    const terminalPrompt = terminal.locator(".terminal-path");
    assert(
      (await terminalPrompt.innerText()).startsWith("C:\\Users\\PocketDesk\\Desktop"),
      "Command Prompt did not start at the desktop path",
    );

    const helpOutput = await runTerminalCommand(terminal, "help");
    assert(helpOutput.includes("tasklist"), "Command Prompt help did not list commands");

    const madeFolder = await runTerminalCommand(terminal, "md 스모크폴더");
    assert(madeFolder.includes("스모크폴더"), "md did not confirm folder creation");
    const listedFolder = await runTerminalCommand(terminal, "dir");
    assert(listedFolder.includes("스모크폴더"), "dir did not list the new folder");
    assert(listedFolder.includes("<DIR>"), "dir output is missing the directory column");

    await runTerminalCommand(terminal, "cd 스모크폴더");
    assert(
      (await terminalPrompt.innerText()).endsWith("스모크폴더>"),
      "cd did not move the prompt into the new folder",
    );

    await runTerminalCommand(terminal, "echo 첫 줄 > 스모크.txt");
    await runTerminalCommand(terminal, "echo 둘째 줄 >> 스모크.txt");
    const fileContent = await runTerminalCommand(terminal, "type 스모크.txt");
    assert(fileContent.includes("첫 줄"), "type did not read back the written line");
    assert(fileContent.includes("둘째 줄"), "Append redirection did not keep both lines");

    await runTerminalCommand(terminal, "cd ..");
    assert(
      (await terminalPrompt.innerText()).endsWith("Desktop>"),
      "cd .. did not return to the desktop root",
    );
    const foundPath = await runTerminalCommand(terminal, "find 스모크.txt");
    assert(foundPath.includes("스모크폴더"), "find did not report the containing folder");

    await terminal.getByLabel("명령 입력").press("ArrowUp");
    assert(
      (await terminal.getByLabel("명령 입력").inputValue()) === "find 스모크.txt",
      "Command history did not recall the previous command",
    );
    await terminal.getByLabel("명령 입력").fill("");

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
    await page.waitForTimeout(300);
    const snappedLeft = await page.locator(".window-frame.is-active").boundingBox();
    await page.keyboard.press("Meta+ArrowRight");
    if (await page.locator(".snap-assist").count()) await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const snappedRight = await page.locator(".window-frame.is-active").boundingBox();
    const seam = Math.round(snappedRight.x - (snappedLeft.x + snappedLeft.width));
    assert(seam === 0, `Snapped halves left a ${seam}px seam`);
    assert(
      Math.round(snappedLeft.x) === 0 &&
        Math.round(snappedRight.x + snappedRight.width) === 1280,
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
    await page.waitForTimeout(120);
    assert(
      (await page.evaluate(() => document.activeElement?.textContent)) !== taskbarBefore,
      "ArrowRight did not move along the taskbar",
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
    await page.waitForTimeout(250);
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
    await page.waitForTimeout(150);
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
    await page.waitForTimeout(150);
    const afterKeyboardResize = await dragTarget.boundingBox();
    assert(
      Math.round(afterKeyboardResize.width - afterKeyboardCancel.width) === 10 &&
        Math.round(afterKeyboardResize.x - afterKeyboardCancel.x) === -10,
      `Keyboard resize changed the width by ${Math.round(afterKeyboardResize.width - afterKeyboardCancel.width)}px and x by ${Math.round(afterKeyboardResize.x - afterKeyboardCancel.x)}`,
    );
    await page.keyboard.press("Enter");
    await page.locator(".window-keyboard-drag-hint").waitFor({ state: "hidden" });
    await dragTarget.getByRole("button", { name: "계산기 닫기" }).click();
    await page.waitForTimeout(250);

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
      await page.waitForTimeout(300);
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
      await page.waitForTimeout(90);
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
    await page.waitForTimeout(300);
    assert(
      new Set(altTabSeen).size === 3,
      `Alt+Tab reached ${new Set(altTabSeen).size} windows in three presses: ${altTabSeen.join(", ")}`,
    );

    // Escape abandons the selection instead of switching, as Windows does.
    const beforeEscape = await page
      .locator(".window-frame.is-active")
      .getAttribute("aria-label");
    await page.keyboard.down("Alt");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(90);
    await page.keyboard.press("Escape");
    await page.keyboard.up("Alt");
    await page.waitForTimeout(300);
    assert(
      (await page.locator(".window-frame.is-active").getAttribute("aria-label")) ===
        beforeEscape,
      "Escape during Alt+Tab still switched windows",
    );

    // Restoring a maximized window puts it back exactly where it was. The
    // window controls sit inside the title bar, so their pointerdown bubbled
    // into the drag handler and moved the window before the click landed.
    const restoreTarget = page.locator(".window-frame.is-active");
    const beforeMaximize = await restoreTarget.boundingBox();
    await restoreTarget.getByRole("button", { name: /최대화$/ }).click();
    await page.waitForTimeout(350);
    await restoreTarget
      .getByRole("button", { name: /이전 크기로|최대화$/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    const afterRestore = await restoreTarget.boundingBox();
    assert(
      Math.round(afterRestore.x) === Math.round(beforeMaximize.x) &&
        Math.round(afterRestore.y) === Math.round(beforeMaximize.y),
      `Restore moved the window from ${Math.round(beforeMaximize.x)},${Math.round(beforeMaximize.y)} to ${Math.round(afterRestore.x)},${Math.round(afterRestore.y)}`,
    );

    // A snapped window re-tiles on a resize instead of being nudged into the
    // 8px float margin, which used to overlap two halves by 16px.
    await page.keyboard.press("Meta+ArrowLeft");
    await page.waitForTimeout(350);
    await page.setViewportSize({ height: 820, width: 1281 });
    await page.waitForTimeout(350);
    await page.setViewportSize({ height: 820, width: 1280 });
    await page.waitForTimeout(350);
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
    assert(
      (await snapAssist.locator(".snap-assist-card").count()) > 0,
      "Snap Assist offered no windows to pair with",
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
    // Drop clear of the Explorer window, or the window itself takes the drop.
    const explorerBox = await dragExplorer.boundingBox();
    await dragSource.dragTo(page.locator(".desktop"), {
      targetPosition: {
        x: Math.round((explorerBox?.x ?? 0) + (explorerBox?.width ?? 0) + 120),
        y: 700,
      },
    });
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
    await page.waitForTimeout(300);
    assert((await cellHeights()).length === 1, "Minefield cells started at mixed heights");
    await minesLayout.locator(".mine-cell:not([disabled])").first().click();
    await page.waitForTimeout(400);
    const revealedHeights = await cellHeights();
    assert(
      revealedHeights.length === 1,
      `Revealing a cell resized the minefield: heights ${revealedHeights.join(", ")}`,
    );
    await minesLayout.getByRole("button", { name: "지뢰찾기 닫기" }).click();

    // Every close path must consult the app's guard, not just the title bar's ✕.
    // Notepad autosaves 850ms after a keystroke, so each case re-dirties the
    // document immediately before closing.
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("notepad");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const guardNotepad = page.locator('article[data-app-id="notepad"]').first();
    await guardNotepad.waitFor({ state: "visible" });
    const guardEditor = guardNotepad.getByLabel("메모 내용");
    const closePrompt = page.getByRole("alertdialog");

    for (const path of ["close-button", "alt-f4", "system-menu"]) {
      await guardEditor.fill(`GUARD ${path}`);
      if (path === "close-button") {
        await guardNotepad.getByRole("button", { name: "메모장 닫기" }).click();
      } else if (path === "alt-f4") {
        await guardEditor.click();
        await page.keyboard.press("Alt+F4");
      } else {
        const titlebarBox = await guardNotepad.locator(".window-titlebar").boundingBox();
        await guardNotepad.locator(".window-titlebar").dispatchEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: titlebarBox.x + 80,
          clientY: titlebarBox.y + 16,
        });
        await page.locator(".window-system-menu").waitFor({ state: "visible" });
        await page
          .locator(".window-system-menu")
          .getByRole("menuitem", { name: "닫기" })
          .click();
      }
      await closePrompt.waitFor({ state: "visible" });
      await closePrompt.getByRole("button", { name: "취소" }).click();
      await closePrompt.waitFor({ state: "hidden" });
      assert(
        (await guardNotepad.count()) === 1,
        `Cancelling the ${path} prompt still closed the window`,
      );
    }

    await guardEditor.fill("GUARD DISCARD");
    await guardNotepad.getByRole("button", { name: "메모장 닫기" }).click();
    await closePrompt.waitFor({ state: "visible" });
    await closePrompt.getByRole("button", { name: "저장 안 함" }).click();
    await guardNotepad.waitFor({ state: "detached" });

    // Settings must fit its window and scroll when it does not. Its grid used to
    // grow past the content box, which clips, so the content pane never had a
    // bounded track and 86px of 개인 설정 was unreachable on first open.
    await page.keyboard.press("Meta+i");
    const settingsWindow = page.locator('article[data-app-id="settings"]');
    await settingsWindow.waitFor({ state: "visible" });
    const settingsFit = await settingsWindow.evaluate((frame) => {
      const content = frame.querySelector(".window-content");
      const app = frame.querySelector(".settings-app");
      if (!content || !app) return null;
      return Math.round(
        app.getBoundingClientRect().height - content.getBoundingClientRect().height,
      );
    });
    assert(
      settingsFit !== null && settingsFit <= 1,
      `Settings escaped its window by ${settingsFit}px`,
    );
    // An earlier step may have left another section showing; 개인 설정 is the one
    // whose content exceeds the window.
    await settingsWindow.getByRole("button", { name: "개인 설정" }).click();
    await page.waitForTimeout(250);
    const settingsPane = settingsWindow.locator(".settings-content");
    await settingsPane.hover();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(250);
    assert(
      (await settingsPane.evaluate((el) => el.scrollTop)) > 0,
      "Settings content did not scroll",
    );
    await settingsWindow.getByRole("button", { name: "설정 닫기" }).click();
    await page.waitForTimeout(200);

    // Hiding a window must not throw away what the app holds. Minimizing used to
    // unmount it, so an unsaved draft, the calculator display, terminal
    // scrollback and a game in progress were all lost — including on Win+D,
    // which is meant to be a peek.
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("notepad");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const draftNotepad = page.locator('article[data-app-id="notepad"]').first();
    await draftNotepad.waitFor({ state: "visible" });
    const draftEditor = draftNotepad.getByLabel("메모 내용");
    await draftEditor.fill("SMOKE UNSAVED DRAFT");

    // Windows marks an unsaved document with a leading asterisk and drops it
    // once the save lands. The title bar carried no dirty signal at all before.
    const draftTitle = draftNotepad.locator(".window-titlebar").first();
    await page.waitForTimeout(120);
    const dirtyTitle = await draftTitle.innerText();
    assert(
      dirtyTitle.startsWith("*") && dirtyTitle.endsWith("- 메모장"),
      `Unsaved Notepad title lacked the asterisk: ${JSON.stringify(dirtyTitle)}`,
    );

    for (const hide of ["minimize", "Meta+m", "Meta+d"]) {
      if (hide === "minimize") {
        await draftNotepad.getByRole("button", { name: "메모장 최소화" }).click();
      } else {
        await page.keyboard.press(hide);
      }
      await page.waitForTimeout(350);
      if (hide === "Meta+d") {
        await page.keyboard.press("Meta+d");
      } else {
        await page.locator(".taskbar-app", { hasText: "메모장" }).first().click();
      }
      await page.waitForTimeout(350);
      assert(
        (await draftEditor.inputValue()) === "SMOKE UNSAVED DRAFT",
        `Hiding the window with ${hide} discarded the unsaved draft`,
      );
    }
    const savedTitle = await draftTitle.innerText();
    assert(
      !savedTitle.startsWith("*") && savedTitle.endsWith("- 메모장"),
      `Saved Notepad title kept the asterisk: ${JSON.stringify(savedTitle)}`,
    );

    await draftNotepad.getByRole("button", { name: "메모장 닫기" }).click();
    await page.waitForTimeout(200);

    // A window shrunk to its own minimum must leave every control reachable —
    // either inside the content box, or scrollable into view. The calculator
    // used to lose its whole keypad to a single shared 320x240 floor.
    for (const [command, label, appId] of [
      ["calc", "계산기", "calculator"],
      ["mspaint", "그림판", "paint"],
      ["regedit", "레지스트리 편집기", "registry"],
      ["사진", "사진", "photos"],
    ]) {
      await page.keyboard.press("Control+Alt+R");
      await runDialog.waitFor({ state: "visible" });
      await runDialog.getByLabel("열기").fill(command);
      await runDialog.getByRole("button", { name: "확인" }).click();
      const shrinkTarget = page.locator(`article[data-app-id="${appId}"]`).first();
      await shrinkTarget.waitFor({ state: "visible" });

      const startBox = await shrinkTarget.boundingBox();
      await page.mouse.move(startBox.x + startBox.width - 2, startBox.y + startBox.height - 2);
      await page.mouse.down();
      await page.mouse.move(startBox.x + 40, startBox.y + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(250);

      const unreachable = await shrinkTarget.evaluate((frame) => {
        const content = frame.querySelector(".window-content");
        if (!content) return ["no content"];
        const box = content.getBoundingClientRect();
        const names = [];
        for (const el of content.querySelectorAll("button, input, select, a")) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const inside =
            rect.right <= box.right + 1 &&
            rect.bottom <= box.bottom + 1 &&
            rect.left >= box.left - 1;
          if (inside) continue;

          let node = el.parentElement;
          let scrollable = false;
          while (node && node !== content.parentElement) {
            const style = getComputedStyle(node);
            const scrolls = /(auto|scroll)/.test(style.overflowY + style.overflowX);
            if (
              scrolls &&
              (node.scrollHeight > node.clientHeight + 1 ||
                node.scrollWidth > node.clientWidth + 1)
            ) {
              scrollable = true;
              break;
            }
            node = node.parentElement;
          }
          if (!scrollable) {
            names.push((el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim());
          }
        }
        return names;
      });
      assert(
        unreachable.length === 0,
        `${label} at its minimum size hides ${unreachable.length} control(s): ${unreachable.slice(0, 4).join(", ")}`,
      );
      await shrinkTarget.getByRole("button", { name: `${label} 닫기` }).click();
      await page.waitForTimeout(150);
    }

    await page.keyboard.press("Control+Shift+Escape");
    const taskManager = page.locator('article[data-app-id="taskmanager"]');
    await taskManager.waitFor({ state: "visible" });
    const terminalRow = taskManager
      .locator(".taskmgr-row", { hasText: "명령 프롬프트" })
      .first();
    await terminalRow.waitFor({ state: "visible" });
    const endTaskButton = taskManager.getByRole("button", { name: "작업 끝내기" });
    assert(
      await endTaskButton.isDisabled(),
      "End task is enabled before a process is selected",
    );
    await terminalRow.click();
    assert(
      !(await endTaskButton.isDisabled()),
      "End task stayed disabled after selecting a process",
    );
    await endTaskButton.click();
    await terminal.waitFor({ state: "hidden" });

    await taskManager.getByRole("tab", { name: "성능" }).click();
    const cpuGraph = taskManager.locator(".taskmgr-graph").first();
    await cpuGraph.waitFor({ state: "visible" });
    // A flat sparkline has a zero-height box, so assert on the plotted points.
    const cpuPoints = await cpuGraph.locator("polyline").getAttribute("points");
    assert(
      typeof cpuPoints === "string" && cpuPoints.split(" ").length > 10,
      "Task Manager performance graph plotted no samples",
    );
    assert(
      (await taskManager.locator(".taskmgr-stats dd").count()) >= 3,
      "Task Manager performance stats are missing",
    );
    await taskManager.getByRole("tab", { name: "프로세스" }).click();

    const taskViewButton = page.getByRole("button", { name: /작업 보기/ });
    await taskViewButton.click();
    const taskView = page.locator(".task-view");
    await taskView.waitFor({ state: "visible" });
    assert(
      (await taskView.locator(".task-view-desktop").count()) === 1,
      "Task View started with more than one desktop",
    );
    await taskView.getByRole("button", { name: "새 데스크톱" }).click();
    await taskView.locator(".task-view-desktop").nth(1).waitFor({ state: "visible" });
    assert(
      (await taskView.locator(".task-view-desktop").count()) === 2,
      "New desktop button did not add a desktop",
    );
    // Windows creates the desktop and stays put; the current desktop's cards
    // are still the ones listed.
    // (A card count can drift here on its own: a window still closing when the
    // overview opened is gone a moment later. What must hold: the current
    // desktop stays current, and the new one starts empty.)
    const currentDesktops = await taskView
      .locator(".task-view-desktop")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-current")));
    assert(
      currentDesktops[0] === "true" &&
        (await taskView.locator(".task-view-desktop").nth(1).innerText()).includes("0개 창"),
      `Creating a desktop switched to it or moved windows (current ${JSON.stringify(currentDesktops)})`,
    );
    await taskView.locator(".task-view-desktop").nth(1).click();
    await taskView.waitFor({ state: "hidden" });
    assert(
      !(await taskManager.isVisible()),
      "A window from desktop 1 is still rendered on desktop 2",
    );

    await page.keyboard.press("Meta+Control+ArrowLeft");
    await taskManager.waitFor({ state: "visible" });
    assert(
      await taskManager.isVisible(),
      "Switching back to desktop 1 did not restore its windows",
    );

    await taskViewButton.click();
    await taskView.waitFor({ state: "visible" });
    // Dragging a window card onto a desktop thumbnail moves the window there,
    // as in Windows; closing that desktop below brings the window back.
    const cardsOnDesktopOne = await taskView.locator(".task-view-card").count();
    const draggedCard = taskView.locator(".task-view-card").first();
    const draggedTitle = await draggedCard.locator(".task-view-card-title strong").innerText();
    await draggedCard.dragTo(taskView.locator(".task-view-desktop").nth(1));
    await page.waitForTimeout(300);
    assert(
      (await taskView.locator(".task-view-card").count()) === cardsOnDesktopOne - 1,
      `Dragging ${draggedTitle} onto desktop 2 left it listed on desktop 1`,
    );
    assert(
      (await taskView.locator(".task-view-desktop").nth(1).innerText()).includes("1개 창"),
      "Desktop 2 does not count the dragged window",
    );
    await taskView.getByRole("button", { name: "데스크톱 2 닫기" }).click();
    await taskView.locator(".task-view-desktop").nth(1).waitFor({ state: "detached" });
    assert(
      (await taskView.locator(".task-view-desktop").count()) === 1,
      "Closing a desktop did not remove it",
    );
    await taskView.locator(".task-view-desktop").first().click();
    await taskView.waitFor({ state: "hidden" });

    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(250);
    const mobileExplorerSidebar = await files.locator("aside").boundingBox();
    assert(
      mobileExplorerSidebar && mobileExplorerSidebar.height >= 54,
      "Mobile Explorer navigation collapsed",
    );
    const visibleWindowBoxes = await page
      .locator(".window-frame:not(.window-thumbnail-clone):visible")
      .evaluateAll((frames) =>
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
    // Task View closes a window on Windows and stays open. Runs last, on a
    // window it opens itself, so it cannot pull a window out from under a
    // later step.
    await page.setViewportSize({ height: 820, width: 1280 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("calc");
    await runDialog.getByRole("button", { name: "확인" }).click();
    await page
      .locator('article[data-app-id="calculator"]')
      .first()
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: /작업 보기/ }).click();
    await page.locator(".task-view").waitFor({ state: "visible" });
    const cardsBefore = await page.locator(".task-view-card").count();
    // The window frame's own close button carries the same name, so scope the
    // click to the overlay.
    await page
      .locator(".task-view")
      .getByRole("button", { name: "계산기 닫기" })
      .first()
      .click();
    await page.waitForTimeout(450);
    assert(
      (await page.locator(".task-view-card").count()) === cardsBefore - 1,
      "Closing a Task View card did not remove the window",
    );
    assert(
      await page.locator(".task-view").isVisible(),
      "Closing a Task View card dismissed Task View",
    );
    await page.keyboard.press("Escape");
    await page.locator(".task-view").waitFor({ state: "hidden" });

    // Edge's tab strip was a single hardcoded tab; each tab now keeps its own
    // page, and none of that had a test.
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("msedge");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const edgeTabs = page.locator('article[data-app-id="browser"]').first();
    await edgeTabs.waitFor({ state: "visible" });
    await page.waitForTimeout(300);
    const addressBar = edgeTabs.locator(".browser-toolbar input").first();
    const firstTabAddress = await addressBar.inputValue();
    assert(
      (await edgeTabs.locator(".browser-tab").count()) === 1,
      "Edge did not start with one tab",
    );

    await edgeTabs.locator(".browser-tab-strip > button").click();
    await page.waitForTimeout(250);
    assert(
      (await edgeTabs.locator(".browser-tab").count()) === 2,
      "The new tab button did not open a tab",
    );
    assert(
      (await addressBar.inputValue()) === "",
      "A new tab opened showing the previous tab's address",
    );

    await addressBar.fill("example.com");
    await addressBar.press("Enter");
    await page.waitForTimeout(500);
    await edgeTabs.locator(".browser-tab button").first().click();
    await page.waitForTimeout(300);
    assert(
      (await addressBar.inputValue()) === firstTabAddress,
      `Switching back showed ${await addressBar.inputValue()} instead of the first tab's own address`,
    );

    await edgeTabs.locator(".browser-tab-close").last().click();
    await page.waitForTimeout(300);
    assert(
      (await edgeTabs.locator(".browser-tab").count()) === 1,
      "Closing a tab did not remove it",
    );
    await edgeTabs.getByRole("button", { name: "Microsoft Edge 닫기" }).click();
    await page.waitForTimeout(250);

    // 작업 표시줄 창 배열: 창 나란히 정렬 tiles the visible windows edge to
    // edge without overlap; 창 계단식 배열 stairs them one title bar apart.
    for (const command of ["notepad", "calc"]) {
      await page.keyboard.press("Control+Alt+R");
      await runDialog.waitFor({ state: "visible" });
      await runDialog.getByLabel("열기").fill(command);
      await runDialog.getByRole("button", { name: "확인" }).click();
      await page.waitForTimeout(250);
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
    await page.waitForTimeout(350);
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
    await page.waitForTimeout(350);
    const stairs = (await readFrameBoxes()).sort((first, second) => first.z - second.z);
    for (let index = 1; index < stairs.length; index += 1) {
      assert(
        Math.round(stairs[index].x - stairs[index - 1].x) === 28 &&
          Math.round(stairs[index].y - stairs[index - 1].y) === 28,
        `창 계단식 배열 stair ${index} is off: ${JSON.stringify(stairs)}`,
      );
    }

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
      await page.waitForTimeout(350);
    };
    const minimizedFrames = page.locator(
      ".window-frame:not(.window-thumbnail-clone).is-minimized",
    );
    const minimizedBeforeShake = await minimizedFrames.count();
    await shake();
    assert(
      (await minimizedFrames.count()) === minimizedBeforeShake + arrangeCount - 1 &&
        !(await shakeTarget.getAttribute("class"))?.includes("is-minimized"),
      `Aero Shake did not minimize the other windows (${await minimizedFrames.count()} minimized)`,
    );
    await shake();
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
    await page.waitForTimeout(400);
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
    await page.waitForTimeout(400);
    assert(
      (await page.locator(".window-layer.is-peeking").count()) === 0,
      "Peek stayed on after the pointer left the thumbnail",
    );
    await page.locator(".show-desktop-button").hover();
    await page.waitForTimeout(650);
    assert(
      (await page.locator(".window-layer.is-peeking-desktop").count()) === 1,
      "Resting on the show-desktop strip did not peek at the desktop",
    );
    await page.mouse.move(640, 300);
    await page.waitForTimeout(250);
    assert(
      (await page.locator(".window-layer.is-peeking-desktop").count()) === 0,
      "Desktop peek stayed on after the pointer left the strip",
    );
    for (const name of ["계산기 닫기", "메모장 닫기"]) {
      await page.getByRole("button", { name }).last().click();
      await page.waitForTimeout(200);
    }

    // 스크린샷: PrintScreen pictures the desktop for real — the DOM drawn to a
    // canvas — and saves a PNG into 사진. The pixels must be a picture, not a
    // blank: sampled colours have to vary.
    await page.keyboard.press("PrintScreen");
    const shotToast = page.locator(".toast", { hasText: "스크린샷 저장됨" });
    await shotToast.waitFor({ state: "visible", timeout: 15000 });
    // 열기 shows the screenshot itself in 사진 — not whatever 그림판 has open.
    await shotToast.getByRole("button", { name: "열기" }).click();
    const shotPhotos = page.locator('article[data-app-id="photos"]').last();
    await shotPhotos.waitFor({ state: "visible" });
    assert(
      (await shotPhotos.getAttribute("aria-label"))?.startsWith("스크린샷 "),
      `사진 opened ${await shotPhotos.getAttribute("aria-label")} instead of the screenshot`,
    );
    await shotPhotos.getByRole("button", { name: "사진 닫기" }).click();
    await shotPhotos.waitFor({ state: "detached" });
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("explorer");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const shotExplorer = page.locator('article[data-app-id="files"]').last();
    await shotExplorer.waitFor({ state: "visible" });
    await shotExplorer
      .locator("aside")
      .getByRole("button", { name: "사진", exact: true })
      .click();
    const shotRow = shotExplorer.locator(".file-list button", { hasText: "스크린샷 " });
    await shotRow.first().waitFor({ state: "visible" });
    assert(
      (await shotRow.first().locator(".file-row-thumbnail").count()) === 1,
      "The screenshot file has no thumbnail, so it holds no picture",
    );
    const shotPixels = await shotRow
      .first()
      .locator(".file-row-thumbnail")
      .evaluate(async (node) => {
        const image = new Image();
        image.src = node.getAttribute("src");
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const samples = [];
        for (const [fx, fy] of [
          [0.05, 0.05],
          [0.5, 0.5],
          [0.9, 0.1],
          [0.3, 0.8],
          [0.7, 0.4],
        ]) {
          const pixel = context.getImageData(
            Math.floor(image.naturalWidth * fx),
            Math.floor(image.naturalHeight * fy),
            1,
            1,
          ).data;
          samples.push(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
        }
        return {
          distinct: new Set(samples).size,
          height: image.naturalHeight,
          width: image.naturalWidth,
        };
      });
    assert(
      shotPixels.width === 1280 && shotPixels.height === 820,
      `Screenshot is ${shotPixels.width}×${shotPixels.height}, not the 1280×820 viewport`,
    );
    assert(
      shotPixels.distinct >= 3,
      `Screenshot pixels are uniform (${shotPixels.distinct} distinct samples)`,
    );
    // Win+Shift+S opens the capture tool; 새 캡처 pictures the screen without the
    // tool's own window, saves it and shows the preview.
    await page.keyboard.press("Meta+Shift+S");
    const snip = page.locator('article[data-app-id="snip"]');
    await snip.waitFor({ state: "visible" });
    await snip.getByRole("button", { name: "새 캡처" }).click();
    await snip.locator(".snip-preview").waitFor({ state: "visible", timeout: 15000 });
    assert(
      (await snip.getByRole("status").innerText()).includes("사진 폴더에 저장됨"),
      "Capture tool did not report the saved capture",
    );
    await snip.getByRole("button", { name: "캡처 도구 닫기" }).click();
    await snip.waitFor({ state: "detached" });
    // Alt+PrintScreen pictures the active window alone. Closing the tool hands
    // focus back to Explorer; its title bar is clear now if it did not.
    if (!(await shotExplorer.getAttribute("class"))?.includes("is-active")) {
      await shotExplorer.locator(".window-titlebar").click();
    }
    await page.waitForTimeout(200);
    await page.keyboard.press("Alt+PrintScreen");
    const windowShotToast = page.locator(".toast", { hasText: "창 스크린샷 저장됨" });
    await windowShotToast.waitFor({ state: "visible", timeout: 15000 });
    // 바탕 화면 배경으로 설정: the screenshot becomes the wallpaper; deleting the
    // file puts the preset back.
    const wallpaperVar = () =>
      page
        .locator("main.desktop")
        .evaluate((node) => node.style.getPropertyValue("--wallpaper-image"));
    await shotRow.first().click({ button: "right" });
    await shotExplorer
      .locator(".file-context-menu")
      .getByRole("menuitem", { name: "바탕 화면 배경으로 설정" })
      .click();
    await page.waitForTimeout(250);
    assert(
      (await wallpaperVar()).startsWith('url("data:image/png'),
      `Setting the picture as wallpaper left ${(await wallpaperVar()).slice(0, 40)}`,
    );
    await shotRow.first().click({ button: "right" });
    await shotExplorer
      .locator(".file-context-menu")
      .getByRole("menuitem", { name: "삭제" })
      .click();
    await page.waitForTimeout(300);
    assert(
      !(await wallpaperVar()).startsWith('url("data:'),
      "Deleting the wallpaper picture did not bring the preset back",
    );
    // Minimizing folds the window towards its taskbar button: the frame carries
    // the vector the animation ends on.
    await shotExplorer.getByRole("button", { name: "파일 탐색기 최소화" }).click();
    await page.waitForTimeout(80);
    const minimizeVector = await shotExplorer.evaluate((node) => [
      node.style.getPropertyValue("--minimize-dx"),
      node.style.getPropertyValue("--minimize-dy"),
    ]);
    assert(
      minimizeVector[0].endsWith("px") && minimizeVector[1].endsWith("px"),
      `Minimize did not aim at the taskbar button: ${JSON.stringify(minimizeVector)}`,
    );
    await page.waitForTimeout(300);
    await page.locator('.taskbar button[data-app-id="files"]').click();
    await shotExplorer.waitFor({ state: "visible" });
    await shotExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
    await shotExplorer.waitFor({ state: "detached" });

    // 스티커 메모: a note is a window bound to shell state — text survives a
    // reload, and 새 메모 opens a second window holding a different note.
    // Runs last on this page: the reload remounts every window, wiping
    // in-memory state (Explorer's details pane) the earlier sections rely on.
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("sticky");
    await runDialog.getByRole("button", { name: "확인" }).click();
    const stickyFrames = page.locator('article[data-app-id="stickynotes"]');
    await stickyFrames.first().waitFor({ state: "visible" });
    await stickyFrames.first().getByLabel("스티커 메모 내용").fill("장보기\n우유");
    await stickyFrames.first().getByRole("button", { name: "분홍 메모" }).click();
    assert(
      (await stickyFrames.first().getAttribute("aria-label"))?.startsWith(
        "장보기 - 스티커 메모",
      ),
      "Sticky note window is not titled after its first line",
    );
    await stickyFrames.first().getByRole("button", { name: "새 메모" }).click();
    await stickyFrames.nth(1).waitFor({ state: "visible" });
    assert(
      (await stickyFrames.nth(1).getByLabel("스티커 메모 내용").inputValue()) === "",
      "새 메모 reused the first note instead of creating a second",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await unlockPocketDesk(page);
    await stickyFrames.first().waitFor({ state: "visible" });
    const stickyTexts = await stickyFrames
      .locator("textarea")
      .evaluateAll((nodes) => nodes.map((node) => node.value).sort());
    assert(
      stickyTexts.length === 2 && stickyTexts[1] === "장보기\n우유",
      `Sticky notes did not survive the reload: ${JSON.stringify(stickyTexts)}`,
    );
    assert(
      (await stickyFrames.locator(".sticky-note.is-pink").count()) === 1,
      "Sticky note colour did not survive the reload",
    );
    for (let i = 0; i < 2; i += 1) {
      await stickyFrames.last().getByRole("button", { name: "메모 삭제" }).click();
      await page.waitForTimeout(250);
    }
    await stickyFrames.first().waitFor({ state: "detached" });

    // ---------- 터치: a phone-sized, touch-only context ----------
    // Everything below is a real regression once caught by measurement: the
    // title bar ignoring touch drags, long-press not being a right click, and
    // the tray buttons buried under the app strip on narrow screens.
    const touchContext = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      serviceWorkers: "block",
      viewport: { width: 390, height: 844 },
    });
    const touchPage = await touchContext.newPage();
    touchPage.on("pageerror", (error) => consoleErrors.push(`touch: ${error}`));
    const touchCdp = await touchContext.newCDPSession(touchPage);
    const touchDrag = async (x1, y1, x2, y2, steps = 10) => {
      await touchCdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: x1, y: y1 }],
      });
      for (let i = 1; i <= steps; i += 1) {
        await touchCdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }],
        });
        await touchPage.waitForTimeout(16);
      }
      await touchCdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    const touchLongPress = async (x, y) => {
      await touchCdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await touchPage.waitForTimeout(750);
      await touchCdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    await touchPage.goto(baseUrl);
    await touchPage.locator('[aria-label="PocketDesk 잠금 화면"]').tap();
    await touchPage.getByRole("button", { name: "로그인", exact: true }).tap();
    await touchPage.locator(".shell-gate").waitFor({ state: "hidden" });

    // 창 드래그: 타이틀바가 터치를 소유해야 한다.
    await touchPage.getByRole("button", { name: "시작 메뉴" }).tap();
    await touchPage.getByLabel("앱과 바탕화면 항목 검색").fill("메모장");
    await touchPage.locator(".start-result-list button").first().tap();
    const touchNotepad = touchPage.locator('article[data-app-id="notepad"]');
    await touchNotepad.waitFor({ state: "visible" });
    const touchBefore = await touchNotepad.boundingBox();
    const touchBar = await touchNotepad.locator(".window-titlebar").boundingBox();
    await touchDrag(
      touchBar.x + touchBar.width / 2,
      touchBar.y + 10,
      touchBar.x + touchBar.width / 2 - 50,
      touchBar.y + 90,
    );
    const touchAfter = await touchNotepad.boundingBox();
    assert(
      Math.abs(touchAfter.y - touchBefore.y) > 40,
      `Touch drag did not move the window (Δy=${Math.round(touchAfter.y - touchBefore.y)})`,
    );
    // Closing is not the touch behavior under test, and headless CI's tap
    // synthesis on this small control proved flaky — Alt+F4 is deterministic.
    await touchPage.keyboard.press("Alt+F4");
    await touchNotepad.waitFor({ state: "detached" });

    // 롱프레스 = 우클릭: 데스크톱과 아이콘 모두.
    await touchLongPress(200, 500);
    await touchPage.locator(".desktop-context-menu").waitFor({ state: "visible" });
    await touchPage.keyboard.press("Escape");
    const touchIcon = touchPage.locator(".desktop-icon", { hasText: "내 PC" }).first();
    const touchIconBox = await touchIcon.boundingBox();
    await touchLongPress(
      touchIconBox.x + touchIconBox.width / 2,
      touchIconBox.y + touchIconBox.height / 2,
    );
    await touchPage.locator(".desktop-icon-context-menu").waitFor({ state: "visible" });
    await touchPage.keyboard.press("Escape");

    // 좁은 화면에서 트레이 버튼이 실제로 탭 가능해야 한다 (오버랩 회귀).
    await touchPage.getByRole("button", { name: "빠른 설정 열기" }).tap();
    const touchVolume = touchPage.getByRole("slider", { name: "볼륨" });
    await touchVolume.waitFor({ state: "visible" });
    const touchVolumeBox = await touchVolume.boundingBox();
    const volumeBefore = await touchVolume.inputValue();
    await touchDrag(
      touchVolumeBox.x + touchVolumeBox.width * 0.7,
      touchVolumeBox.y + touchVolumeBox.height / 2,
      touchVolumeBox.x + touchVolumeBox.width * 0.2,
      touchVolumeBox.y + touchVolumeBox.height / 2,
      6,
    );
    assert(
      (await touchVolume.inputValue()) !== volumeBefore,
      "Touch drag did not move the volume slider",
    );
    await touchContext.close();

    assert(consoleErrors.length === 0, `Console errors found: ${consoleErrors.join(" | ")}`);

    console.log("PocketDesk smoke test passed");
  } finally {
    await browser.close();
  }
}

const port = await getFreePort();
const baseUrl = `http://${host}:${port}/`;
const preview = spawn(
  process.execPath,
  [viteBin, "preview", "--host", host, "--port", String(port), "--strictPort"],
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
  await stopProcess(preview);
}
