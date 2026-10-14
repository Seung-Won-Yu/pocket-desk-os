/**
 * What every smoke scenario shares: the server, the browser, and the waits.
 */

import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const host = "127.0.0.1";
/*
 * The budget was 180s when this suite was a fraction of its size. It now walks
 * 폴더 옵션, 속성, 작업 표시줄 위치·자동 숨기기·작은 단추, 야간 조명, 캘린더
 * 일정, 그림판 텍스트, 그룹화 and 보내기 on top of everything it already did —
 * measured at 153s on this machine, which left the runner nothing and timed CI
 * out. 360s is headroom for a slower runner, not permission to be slow. The
 * fixed sleeps that were half of it (461 calls, 126s of a 237s run) are now
 * `settle` and `assertEventually`; the few `waitForTimeout` left wait on time
 * itself — a timer that must not tick, a toast that must not come, a delay
 * the shell keeps on purpose, a write that must land before a reload.
 */
export const smokeTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 360000);
export const viteBin = fileURLToPath(
  new URL("../../node_modules/vite/bin/vite.js", import.meta.url),
);

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * An assert for something a step should bring about: it polls until `check`
 * holds rather than reading once after a fixed sleep, so it passes the moment
 * the page catches up and fails with `message` (read at failure) if it never
 * does. Not for checking that something did *not* happen — that passes before
 * the wrong thing has had its chance; those settle first and read once.
 */
export async function assertEventually(check, message, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(await message());
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export function getDeterministicMineIndices({ rows, cols, mines, safeIndex }) {
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

export function getFreePort() {
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

export async function waitForServer(url) {
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

export async function launchBrowser() {
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

export async function stopProcess(child) {
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

export async function unlockPocketDesk(page) {
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
/**
 * A box read twice in a row with the same numbers. A window measured while it
 * is still animating open reports a rect that is nobody's final answer — CI is
 * slow enough for that to matter, and it has now cost two runs: a maximized
 * window measured mid-animation, and a touch drag whose "before" was taken
 * before the window had settled (Δy=-24 for a drag of +80).
 */
export async function settledBoxOf(page, locator, attempts = 40) {
  let previous = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const box = await locator.boundingBox();
    if (
      previous &&
      box &&
      previous.x === box.x &&
      previous.y === box.y &&
      previous.width === box.width &&
      previous.height === box.height
    ) {
      return box;
    }
    previous = box;
    await page.waitForTimeout(50);
  }
  return previous;
}

/**
 * Waits for the page to stop changing — no DOM mutation for `quietMs` and no
 * finite animation or transition still running — instead of sleeping a fixed
 * time after each step. The fixed sleeps were half the run (461 calls, 126s
 * of 237s) and still raced on a slow runner; this returns as soon as the UI
 * is still, and waits longer when it is not. A step that waits on a timer
 * rather than on the page (an autosave, a notification's delay) waits for
 * what it needs by name.
 */
export async function settle(page, { quietMs = 100, timeoutMs = 3000 } = {}) {
  await page.evaluate(
    ({ quietMs, timeoutMs }) =>
      new Promise((resolve) => {
        const start = performance.now();
        let lastChange = start;
        const observer = new MutationObserver(() => {
          lastChange = performance.now();
        });
        observer.observe(document, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
        // A spinner or a pulsing badge loops forever; it is not a step finishing.
        const animating = () =>
          document
            .getAnimations()
            .some(
              (animation) =>
                animation.playState === "running" &&
                animation.effect?.getTiming().iterations !== Infinity,
            );
        const check = () => {
          const now = performance.now();
          // The quiet counts from the end of the last animation too: a frame's
          // closing keyframes run 150ms and the timer that removes it 170ms.
          if (animating()) lastChange = now;
          if (now - lastChange >= quietMs || now - start >= timeoutMs) {
            observer.disconnect();
            resolve();
            return;
          }
          setTimeout(check, 16);
        };
        setTimeout(check, 16);
      }),
    { quietMs, timeoutMs },
  );
}

export async function runTerminalCommand(terminal, command) {
  const lines = terminal.locator(".terminal-line");
  const lineCountBefore = await lines.count();
  const input = terminal.getByLabel("명령 입력");
  await input.fill(command);
  await input.press("Enter");
  await lines.nth(lineCountBefore).waitFor({ state: "attached" });
  return (await lines.allInnerTexts()).slice(lineCountBefore + 1).join("\n");
}

export function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
