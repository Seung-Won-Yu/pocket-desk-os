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
      localStorage.removeItem("pocket-desk-installed-packages-v1");
      localStorage.removeItem("pocket-desk-taskbar-pinned-v1");
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

    const startButton = page.getByRole("button", { name: "시작 메뉴" });
    await startButton.waitFor({ state: "visible" });
    await startButton.click();
    const startMenu = page.locator(".start-menu");
    await startMenu.waitFor({ state: "visible" });
    const startText = await startMenu.innerText();
    assert(startText.includes("Pinned"), "Start menu Pinned section missing");
    assert(startText.includes("All apps"), "Start menu All apps section missing");
    assert(startText.includes("Recent"), "Start menu Recent section missing");
    assert(await page.locator(".start-pinned-grid button").count() >= 6, "Pinned app grid is too sparse");
    await startMenu.getByRole("button", { name: "전원 옵션" }).click();
    await startMenu.getByRole("menuitem", { name: "Restart" }).click();
    await page.locator('[aria-label="부팅 화면"]').waitFor({ state: "visible" });
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).click();
    await page.waitForTimeout(250);

    await page.getByRole("button", { name: "시작 메뉴" }).click();
    await startMenu.waitFor({ state: "visible" });

    await startMenu.locator(".start-pinned-grid").getByRole("button", { name: /Setup Center/ }).click();
    const setup = page.locator('article[aria-label="Setup Center"]');
    await setup.waitFor({ state: "visible" });
    await setup.getByRole("button", { name: "설치" }).first().click();
    await page.waitForFunction(() =>
      localStorage.getItem("pocket-desk-installed-packages-v1")?.includes("python"),
    );
    await setup.getByRole("button", { name: "실행" }).first().click();

    const python = page.locator('article[aria-label="Python Lab"]');
    await python.waitFor({ state: "visible" });
    await python.getByRole("button", { name: "Run" }).click();
    const pythonOutput = await python.locator('[aria-label="Python 실행 결과"]').innerText();
    assert(pythonOutput.includes("Hello, PocketDesk"), "Python Lab did not print greeting");
    assert(pythonOutput.includes("14"), "Python Lab did not print arithmetic result");

    await page.keyboard.press("Control+Alt+R");
    const runDialog = page.locator(".run-dialog");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("Open").fill("calc");
    await runDialog.getByRole("button", { name: "OK" }).click();
    await page.locator('article[aria-label="Calc"]').waitFor({ state: "visible" });

    await page.locator(".taskbar-app", { hasText: "Files" }).click();
    const files = page.locator('article[aria-label="Files"]');
    await files.waitFor({ state: "visible" });
    await files.locator(".file-list button", { hasText: "web-surf.url" }).click();
    const filePreviewText = await files.locator(".file-preview").innerText();
    assert(filePreviewText.includes("Open with Web Surf"), "Files app did not show URL association");
    await files.getByRole("button", { name: "열기" }).click();
    await page.locator('article[aria-label="Web Surf"]').waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const browser = document.querySelector('article[aria-label="Web Surf"]');
      const input = browser?.querySelector('input[aria-label="웹 주소 또는 검색어"]');
      return input instanceof HTMLInputElement && input.value.includes("https://example.com");
    });
    await page.locator(".taskbar-app", { hasText: "Web Surf" }).hover();
    const taskbarPreview = page.locator(".taskbar-preview-card");
    await taskbarPreview.waitFor({ state: "visible" });
    assert((await taskbarPreview.innerText()).includes("Web Surf"), "Taskbar preview did not show Web Surf");
    await page.getByRole("button", { name: "시스템 트레이 열기" }).click();
    const quickSettings = page.locator(".quick-settings-panel");
    await quickSettings.waitFor({ state: "visible" });
    const quickSettingsText = await quickSettings.innerText();
    assert(quickSettingsText.includes("Quick settings"), "Quick settings panel did not open");
    assert(quickSettingsText.includes("Notifications"), "Notification center section missing");
    assert((await quickSettings.getByLabel("볼륨").count()) === 1, "Quick settings volume slider missing");
    assert((await quickSettings.locator(".notification-item").count()) > 0, "Notification center did not keep recent alerts");
    await quickSettings.getByRole("button", { name: "Clear all" }).click();
    assert((await quickSettings.innerText()).includes("최근 알림 없음"), "Notification center did not clear alerts");
    await quickSettings.getByRole("button", { name: "Settings", exact: true }).click();
    await page.locator('article[aria-label="Settings"]').waitFor({ state: "visible" });
    await page.locator(".taskbar-app", { hasText: "Files" }).click();
    const fileToTrash = files.locator(".file-list button").first();
    const trashedFileName = await fileToTrash.locator("span").innerText();
    await fileToTrash.click();
    await files.getByRole("button", { name: "삭제" }).click();

    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("Open").fill("recycle");
    await runDialog.getByRole("button", { name: "OK" }).click();
    const recycle = page.locator('article[aria-label="Recycle Bin"]');
    await recycle.waitFor({ state: "visible" });
    assert((await recycle.innerText()).includes(trashedFileName), "Recycle Bin did not show deleted file");
    await recycle.getByRole("button", { name: "복원" }).click();
    await page.waitForTimeout(180);
    assert(!(await recycle.innerText()).includes(trashedFileName), "Recycle Bin still shows restored file");

    await page.locator(".taskbar-app", { hasText: "Files" }).click();
    await files.locator(".file-list button", { hasText: trashedFileName }).click();
    await files.getByRole("button", { name: "삭제" }).click();
    await page.locator(".taskbar-app", { hasText: "Recycle Bin" }).click();
    await recycle.getByRole("button", { name: "휴지통 비우기" }).click();
    await page.waitForTimeout(180);
    assert((await recycle.innerText()).includes("휴지통이 비어 있습니다"), "Recycle Bin did not empty");

    const initialTaskbar = await page
      .locator(".taskbar-app")
      .evaluateAll((items) => items.map((item) => item.textContent?.trim().replace(/\s+/g, " ")));
    assert(initialTaskbar.some((text) => text?.includes("Files")), "Files pinned taskbar app missing");
    await page
      .locator(".taskbar-app", { hasText: "Files" })
      .dispatchEvent("contextmenu", { bubbles: true, cancelable: true });
    await page.waitForTimeout(180);
    const pinnedAfterUnpin = await page.evaluate(() => localStorage.getItem("pocket-desk-taskbar-pinned-v1"));
    assert(pinnedAfterUnpin && !pinnedAfterUnpin.includes("files"), "Taskbar unpin did not persist");

    const frame = page.locator('article[aria-label="Web Surf"]');
    const titlebar = frame.locator(".window-titlebar");
    const box = await titlebar.boundingBox();
    assert(box, "Web Surf titlebar missing");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(1, box.y + box.height / 2, { steps: 8 });
    await page.waitForTimeout(100);
    assert((await page.locator(".snap-preview").count()) > 0, "Snap preview did not appear");
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
    assert((await windowSystemMenu.innerText()).includes("Move to center"), "Window system menu missing move action");
    await windowSystemMenu.getByRole("menuitem", { name: "Move to center" }).click();
    await page.waitForTimeout(180);
    const centered = await frame.boundingBox();
    assert(centered && centered.x > 120, "Window system menu did not move window toward center");

    await page.getByRole("button", { name: "시작 메뉴" }).click();
    await startMenu.waitFor({ state: "visible" });
    await startMenu.getByRole("button", { name: "전원 옵션" }).click();
    await startMenu.getByRole("menuitem", { name: "Shut down" }).click();
    await page.locator('[aria-label="PocketDesk 전원 꺼짐"]').waitFor({ state: "visible" });
    await page.getByRole("button", { name: "전원 켜기" }).click();
    await page.locator('[aria-label="부팅 화면"]').waitFor({ state: "visible" });
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /PocketDesk 잠금 해제/ }).click();
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(250);
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
