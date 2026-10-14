import { spawn } from "node:child_process";
import {
  assert,
  getFreePort,
  host,
  launchBrowser,
  smokeTimeoutMs,
  stopProcess,
  unlockPocketDesk,
  viteBin,
  waitForServer,
  withTimeout,
} from "./smoke/harness.mjs";
import run01 from "./smoke/scenarios/01-desktop.mjs";
import run02 from "./smoke/scenarios/02-notepad.mjs";
import run03 from "./smoke/scenarios/03-explorer-list.mjs";
import run04 from "./smoke/scenarios/04-explorer-pane.mjs";
import run05 from "./smoke/scenarios/05-clock-focus.mjs";
import run06 from "./smoke/scenarios/06-windows.mjs";
import run07 from "./smoke/scenarios/07-guards-settings.mjs";
import run08 from "./smoke/scenarios/08-edge-explorer-tabs.mjs";
import run09 from "./smoke/scenarios/09-paint.mjs";
import run10 from "./smoke/scenarios/10-shell-settings.mjs";
import run11 from "./smoke/scenarios/11-touch.mjs";
import run12 from "./smoke/scenarios/12-shortcuts-bin.mjs";

/*
 * Each scenario starts from a clean, signed-in desktop of its own and sets up
 * whatever it needs, so they run side by side and one failure does not hide
 * the rest. SMOKE_ONLY=05,10 runs just those; SMOKE_WORKERS sets how many run
 * at once. An entry with more than one part runs them in order on one page.
 */
// Longest first (measured, seconds alone): the queue then finishes together
// instead of waiting on a long one that started last.
const scenarios = [
  ["10-shell-settings", run10], // 47
  // 탐색기 lists what 메모장 saved and picks up its own window where it left
  // off, so these three share a page.
  ["02-notepad-explorer", run02, run03, run04], // 39
  ["12-shortcuts-bin", run12], // 31
  ["05-clock-focus", run05], // 23
  ["08-edge-explorer-tabs", run08], // 17
  ["07-guards-settings", run07], // 16
  ["09-paint", run09], // 15
  ["06-windows", run06], // 13
  ["11-touch", run11], // 8
  ["01-desktop", run01], // 8
];
const only = process.env.SMOKE_ONLY?.split(",").filter(Boolean) ?? [];
const workers = Math.max(1, Number(process.env.SMOKE_WORKERS ?? 4));
const multiSelectModifier = process.platform === "darwin" ? "Meta" : "Control";

/**
 * A fresh page on a clean PocketDesk, signed in: no stored windows or pins,
 * an empty file system, the network calls the apps make answered locally.
 */
async function openDesktop(browser, baseUrl) {
  const page = await browser.newPage({
    serviceWorkers: "block",
    viewport: { width: 1280, height: 820 },
  });
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);

  /*
   * A CI runner is several times slower than this laptop, and three failures
   * in a row now have been races that only open up at that speed. This makes
   * the speed a knob: SMOKE_CPU_THROTTLE=6 npm run qa:smoke reproduces them
   * here instead of one push per hypothesis.
   */
  const cpuThrottle = Number(process.env.SMOKE_CPU_THROTTLE ?? 1);
  if (cpuThrottle > 1) {
    const throttleSession = await page.context().newCDPSession(page);
    await throttleSession.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
  }

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
  return { consoleErrors, cpuThrottle, page };
}

async function runScenario(browser, baseUrl, [name, ...parts]) {
  const started = Date.now();
  const { consoleErrors, cpuThrottle, page } = await openDesktop(browser, baseUrl);
  try {
    for (const run of parts) {
      await run({ baseUrl, browser, consoleErrors, cpuThrottle, multiSelectModifier, page });
    }
    assert(consoleErrors.length === 0, `Console errors found: ${consoleErrors.join(" | ")}`);
    return { name, seconds: (Date.now() - started) / 1000 };
  } catch (error) {
    return { error, name, seconds: (Date.now() - started) / 1000 };
  } finally {
    await page.close();
  }
}

async function runSmoke(baseUrl) {
  const chosen = scenarios.filter(
    ([name]) => !only.length || only.some((id) => name.startsWith(id)),
  );
  assert(chosen.length > 0, `SMOKE_ONLY=${only.join(",")} matched no scenario`);
  const browser = await launchBrowser();
  const results = [];
  try {
    const queue = [...chosen];
    await Promise.all(
      Array.from({ length: Math.min(workers, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const result = await runScenario(browser, baseUrl, next);
          results.push(result);
          console.log(
            `${result.error ? "FAIL" : "ok  "} ${result.name} (${result.seconds.toFixed(1)}s)`,
          );
        }
      }),
    );
  } finally {
    await browser.close();
  }
  const failed = results.filter((result) => result.error);
  for (const { error, name } of failed) {
    console.error(`\n[${name}] ${error.stack ?? error}`);
  }
  assert(failed.length === 0, `${failed.length} of ${results.length} smoke scenario(s) failed`);
  console.log(
    `PocketDesk smoke test passed (${results.length} scenarios, ${workers} at a time)`,
  );
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
