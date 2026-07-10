import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { chromium } from "playwright";

const host = "127.0.0.1";
const outputUrl = new URL("../public/brand/pocketdesk-social.png", import.meta.url);
const outputPath = fileURLToPath(outputUrl);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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
      // Keep polling until the preview server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start: ${url}`);
}

async function launchBrowser() {
  const channel = process.env.PW_CHANNEL ?? "chrome";
  try {
    return await chromium.launch({ channel, headless: true });
  } catch (error) {
    if (process.env.PW_CHANNEL) throw error;
    return chromium.launch({ headless: true });
  }
}

async function captureSocialPreview(baseUrl) {
  const browser = await launchBrowser();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    viewport: { width: 1200, height: 630 },
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.removeItem("pocket-desk-installed-packages-v1");
      localStorage.removeItem("pocket-desk-taskbar-pinned-v1");
      localStorage.removeItem("pocket-desk-taskbar-pinned-v2");
      localStorage.removeItem("pocket-desk-windows-v1");
      localStorage.setItem("pocket-desk-theme", "lagoon");
      localStorage.setItem("pocket-desk-wallpaper-v2", "ribbon");
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
    await page.waitForTimeout(1400);

    const unlock = page.getByRole("button", { name: /PocketDesk 잠금 해제/ });
    if (await unlock.count()) {
      await unlock.click();
    }
    await page.waitForTimeout(3800);

    await mkdir(new URL("../public/brand/", import.meta.url), { recursive: true });
    await page.screenshot({ path: outputPath, type: "png" });
    console.log(`PocketDesk social preview written to ${outputPath}`);
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
  await captureSocialPreview(baseUrl);
} finally {
  preview.kill();
}
