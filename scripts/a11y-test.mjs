import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { auditAria } from "./ariaAudit.mjs";

/**
 * The accessibility gate: opens every app and every shell surface, then reads
 * the markup back with `auditAria` and fails on what it finds. Three ARIA
 * defects shipped before this existed, all of them plain to see in the DOM.
 *
 * It also checks the one thing the audit cannot see: that focus stays inside a
 * window when the element holding it is removed. That bug shipped three times
 * — the address bar, then adding a tab, then closing one.
 */

const host = "127.0.0.1";
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  const lockScreen = page.locator('[aria-label="PocketDesk 잠금 화면"]');
  await lockScreen.waitFor({ state: "visible", timeout: 6000 });
  await lockScreen.click();
  const signInButton = page.getByRole("button", { name: "로그인", exact: true });
  await signInButton.waitFor({ state: "visible" });
  await signInButton.click();
  await page.locator(".shell-gate").waitFor({ state: "hidden" });
}

async function openAllApps(page) {
  const startButton = page.locator(".start-button");
  const startMenu = page.locator(".start-menu");
  const openAllAppsPanel = async () => {
    await startButton.click();
    await startMenu.waitFor({ state: "visible" });
    const toggle = startMenu.getByRole("button", { name: "모든 앱" });
    if ((await toggle.count()) > 0) await toggle.click();
    await page.locator(".start-app-list").waitFor({ state: "visible" });
  };

  await openAllAppsPanel();
  const total = await page.locator(".start-app-list > button").count();
  assert(total >= 15, `The all-apps list only holds ${total} apps`);
  await page.keyboard.press("Escape");
  await startMenu.waitFor({ state: "hidden" });

  const opened = [];
  for (let index = 0; index < total; index += 1) {
    await openAllAppsPanel();
    const entry = page.locator(".start-app-list > button").nth(index);
    const title = (await entry.innerText()).split("\n")[0];
    await entry.click();
    await startMenu.waitFor({ state: "hidden" });
    await page.waitForTimeout(180);
    opened.push(title);
  }
  return opened;
}

/** Reads the audit back for one surface and tags every defect with it. */
async function auditSurface(page, surface, rootSelector = "body") {
  const defects = await page.evaluate(auditAria, rootSelector);
  return defects.map((defect) => ({ ...defect, surface }));
}

async function checkFocusStaysInWindow(page) {
  // Explorer is where this went wrong three times, and it has all three shapes
  // of it: a field that unmounts on submit, and a strip whose buttons come and go.
  await page.keyboard.press("Control+Alt+R");
  const runDialog = page.locator(".run-dialog");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("explorer");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const explorer = page.locator('article[data-app-id="files"]').last();
  await explorer.waitFor({ state: "visible" });
  const windowId = await explorer.getAttribute("data-window-id");

  const focusIsInside = () =>
    page.evaluate(
      (id) => document.activeElement?.closest(`[data-window-id="${id}"]`) !== null,
      windowId,
    );

  const failures = [];
  const check = async (label) => {
    await page.waitForTimeout(220);
    if (!(await focusIsInside())) {
      const stranded = await page.evaluate(
        () => `${document.activeElement?.tagName} ${document.activeElement?.className}`,
      );
      failures.push(`${label}: focus left the window (now on ${stranded})`);
    }
  };

  await explorer.locator(".file-list").click();
  await page.keyboard.press("Control+t");
  await check("Ctrl+T (탭 추가)");
  await page.keyboard.press("Control+w");
  await check("Ctrl+W (탭 닫기)");
  await page.keyboard.press("Control+l");
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await check("Ctrl+L then Enter (주소 입력)");

  await explorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await page.waitForTimeout(200);
  return failures;
}

async function runAudit(baseUrl) {
  const browser = await launchBrowser();
  const page = await browser.newPage({
    serviceWorkers: "block",
    viewport: { width: 1280, height: 820 },
  });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(baseUrl, { waitUntil: "load" });
    await unlockPocketDesk(page);
    await page.waitForTimeout(300);

    const defects = [];
    defects.push(...(await auditSurface(page, "바탕 화면")));

    const opened = await openAllApps(page);
    console.log(`Opened ${opened.length} apps: ${opened.join(", ")}`);
    await page.waitForTimeout(400);
    defects.push(...(await auditSurface(page, "모든 앱 창")));

    // Shell surfaces only exist while open, so each is audited in place.
    await page.locator(".start-button").click();
    await page.locator(".start-menu").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "시작 메뉴", ".start-menu")));
    await page.keyboard.press("Escape");

    await page.locator(".tray-clock").click();
    await page.locator(".notification-center-panel").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "알림 센터", ".notification-center-panel")));
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "빠른 설정 열기" }).click();
    await page.locator(".quick-settings-panel").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "빠른 설정", ".quick-settings-panel")));
    await page.keyboard.press("Escape");

    await page.keyboard.press("Meta+Tab");
    await page.locator(".task-view").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "작업 보기", ".task-view")));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Menus are where roles come in pairs, so each kind gets a look.
    await page.locator(".start-button").click();
    await page.locator(".start-menu").waitFor({ state: "visible" });
    await page.locator(".start-menu").getByRole("button", { name: "모든 앱" }).click();
    await page.locator(".start-app-list").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "시작 메뉴 모든 앱", ".start-menu")));
    await page.keyboard.press("Escape");

    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 720,
      clientY: 180,
    });
    await page.locator(".desktop-context-menu").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "바탕 화면 메뉴", ".desktop-context-menu")));
    await page.keyboard.press("Escape");

    await page.locator(".taskbar-app").first().click({ button: "right" });
    await page.locator(".taskbar-context-menu").waitFor({ state: "visible" });
    defects.push(...(await auditSurface(page, "작업 표시줄 메뉴", ".taskbar-context-menu")));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    const focusFailures = await checkFocusStaysInWindow(page);

    if (defects.length > 0) {
      const byRule = new Map();
      for (const defect of defects) {
        const list = byRule.get(defect.rule) ?? [];
        // The same defect shows up on every surface it is visible from.
        if (!list.some((entry) => entry.detail === defect.detail)) list.push(defect);
        byRule.set(defect.rule, list);
      }
      for (const [rule, entries] of byRule) {
        console.error(`\n${rule} (${entries.length})`);
        for (const entry of entries) console.error(`  [${entry.surface}] ${entry.detail}`);
      }
    }
    for (const failure of focusFailures) console.error(`\nfocus-left-window\n  ${failure}`);

    const unique = new Set(defects.map((defect) => `${defect.rule}|${defect.detail}`));
    assert(
      unique.size === 0 && focusFailures.length === 0,
      `Accessibility gate found ${unique.size} ARIA defect(s) and ${focusFailures.length} focus failure(s)`,
    );
    assert(consoleErrors.length === 0, `Console errors found: ${consoleErrors.join(" | ")}`);
    console.log("PocketDesk accessibility gate passed");
  } finally {
    await browser.close();
  }
}

const port = await getFreePort();
const baseUrl = `http://${host}:${port}/`;
const preview = spawn(
  process.execPath,
  [viteBin, "preview", "--host", host, "--port", String(port), "--strictPort"],
  { shell: false, stdio: ["ignore", "pipe", "pipe"] },
);
preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
preview.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitForServer(baseUrl);
  await runAudit(baseUrl);
} finally {
  await stopProcess(preview);
}
