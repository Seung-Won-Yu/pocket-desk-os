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

    const unlock = page.getByRole("button", { name: /PocketDesk 잠금 해제/ });
    await unlock.waitFor({ state: "visible", timeout: 6000 }).catch(() => null);
    if (await unlock.count()) {
      await unlock.click();
    }

    await page.mouse.move(900, 180);
    await page.mouse.down();
    await page.mouse.move(380, 520, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert((await page.locator(".desktop").count()) === 1, "Desktop selection drag crashed the shell");
    assert((await page.locator(".desktop-icon").count()) === 2, "Desktop should only show core system icons");

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
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).click();
    await page.waitForTimeout(250);

    await page.getByRole("button", { name: "시작 메뉴" }).click();
    await startMenu.waitFor({ state: "visible" });

    await startMenu.locator(".start-pinned-grid").getByRole("button", { name: /내 PC/ }).click();
    const thisPc = page.locator('article[aria-label="내 PC"]');
    await thisPc.waitFor({ state: "visible" });
    const thisPcText = await thisPc.innerText();
    assert(thisPcText.includes("장치 및 드라이브"), "This PC did not show drive section");
    assert(thisPcText.includes("로컬 디스크 (C:)"), "This PC did not show local disk");
    await thisPc.getByRole("button", { name: /바탕 화면/ }).click();
    await page.locator('article[aria-label="파일 탐색기"]').waitFor({ state: "visible" });
    const files = page.locator('article[aria-label="파일 탐색기"]');
    await files.getByRole("button", { name: "문서", exact: true }).click();
    assert((await files.locator(".file-list button").count()) > 0, "Documents view is empty");
    assert((await files.locator(".file-list").innerText()).includes("notes.txt"), "Documents view did not filter notes");
    await files.getByRole("button", { name: "바탕 화면", exact: true }).click();

    await page.keyboard.press("Control+Alt+R");
    const runDialog = page.locator(".run-dialog");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill("calc");
    await runDialog.getByRole("button", { name: "확인" }).click();
    await page.locator('article[aria-label="계산기"]').waitFor({ state: "visible" });

    await page.locator(".taskbar-app", { hasText: "파일 탐색기" }).click();
    await files.waitFor({ state: "visible" });
    await files.locator(".file-list button", { hasText: "web-surf.url" }).click();
    const filePreviewText = await files.locator(".file-preview").innerText();
    assert(filePreviewText.includes("연결 프로그램: 웹 브라우저"), "File Explorer did not show URL association");
    await files.locator(".file-preview").getByRole("button", { name: "열기" }).click();
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
    await page.getByRole("button", { name: "시스템 트레이 열기" }).click();
    const quickSettings = page.locator(".quick-settings-panel");
    await quickSettings.waitFor({ state: "visible" });
    const quickSettingsText = await quickSettings.innerText();
    assert(quickSettingsText.includes("빠른 설정"), "Quick settings panel did not open");
    assert(quickSettingsText.includes("알림"), "Notification center section missing");
    assert(quickSettingsText.includes("네트워크"), "Network status missing");
    assert((await quickSettings.locator(".notification-item").count()) > 0, "Notification center did not keep recent alerts");
    await quickSettings.getByRole("button", { name: "모두 지우기" }).click();
    assert((await quickSettings.innerText()).includes("최근 알림 없음"), "Notification center did not clear alerts");
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
    await files.locator(".file-preview").getByRole("button", { name: "삭제" }).click();

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
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).click();
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(250);
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
