import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

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
    const forceStop = setTimeout(() => {
      child.kill("SIGKILL");
    }, 3000);
    child.once("exit", () => {
      clearTimeout(forceStop);
      resolve();
    });
    child.kill();
  });
}

async function unlockPocketDesk(page) {
  const lockScreen = page.locator('[aria-label="PocketDesk 잠금 화면"]');
  await lockScreen.waitFor({ state: "visible" });
  await lockScreen.click();
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.locator(".shell-gate").waitFor({ state: "hidden" });
}

async function runPwaTest(baseUrl) {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    serviceWorkers: "allow",
    viewport: { height: 820, width: 1280 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        });
      }
    });

    const cacheState = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open("pocketdesk-os-v4");
      const urls = (await cache.keys()).map((request) => request.url);
      return { names, urls };
    });
    assert(cacheState.names.includes("pocketdesk-os-v4"), "PWA cache was not created");
    assert(
      cacheState.urls.some((url) => url.includes("/assets/") && url.endsWith(".js")),
      "JS bundle was not precached",
    );
    assert(
      cacheState.urls.some((url) => url.includes("/assets/") && url.endsWith(".css")),
      "CSS bundle was not precached",
    );

    await context.setOffline(true);
    const offlineResponse = await page.reload({ waitUntil: "domcontentloaded" });
    const offlineDiagnostics = await page.evaluate(async () => ({
      bodyText: document.body.innerText.slice(0, 240),
      cacheNames: await caches.keys(),
      controlled: Boolean(navigator.serviceWorker.controller),
      desktopCount: document.querySelectorAll(".desktop").length,
      rootChildren: document.getElementById("root")?.childElementCount ?? -1,
    }));
    assert(
      offlineResponse?.ok() && offlineDiagnostics.controlled,
      `Offline navigation failed: ${JSON.stringify({ diagnostics: offlineDiagnostics, status: offlineResponse?.status() })}`,
    );
    assert(
      offlineDiagnostics.desktopCount === 1,
      `Offline app did not render: ${JSON.stringify({ consoleErrors, diagnostics: offlineDiagnostics })}`,
    );
    await page.locator(".desktop").waitFor({ state: "visible" });
    assert(
      (await page.title()).includes("PocketDesk"),
      "Offline shell did not restore the document",
    );
    assert(
      !(await page.evaluate(() => navigator.onLine)),
      "Browser did not enter offline state",
    );

    await unlockPocketDesk(page);
    await page.getByRole("button", { name: "빠른 설정 열기" }).click();
    const quickSettings = page.locator('[aria-label="빠른 설정"]');
    await quickSettings.waitFor({ state: "visible" });
    assert(
      (await quickSettings.innerText()).includes("오프라인"),
      "System tray did not report offline state",
    );

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine);
    assert(consoleErrors.length === 0, `Console errors found: ${consoleErrors.join(" | ")}`);
    console.log("PocketDesk PWA offline test passed");
  } finally {
    await context.close();
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
  await runPwaTest(baseUrl);
} finally {
  await stopProcess(preview);
}
