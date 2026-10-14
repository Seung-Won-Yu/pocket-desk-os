import { assert, settledBoxOf } from "../harness.mjs";

export default async function run(ctx) {
  const { browser, consoleErrors, baseUrl, state } = ctx;
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
      // One touch frame per display frame — the gesture's pace, not a wait.
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
  // Settled, not merely present: the open animation was still running when
  // this was read on CI, so the "before" was a rect the window never held.
  const touchBefore = await settledBoxOf(touchPage, touchNotepad);
  const touchBar = await settledBoxOf(touchPage, touchNotepad.locator(".window-titlebar"));
  await touchDrag(
    touchBar.x + touchBar.width / 2,
    touchBar.y + 10,
    touchBar.x + touchBar.width / 2 - 50,
    touchBar.y + 90,
  );
  const touchAfter = await settledBoxOf(touchPage, touchNotepad);
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
  const touchIconBox = await settledBoxOf(touchPage, touchIcon);
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
  const touchVolumeBox = await settledBoxOf(touchPage, touchVolume);
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
  Object.assign(state, {
    touchAfter,
    touchBar,
    touchBefore,
    touchCdp,
    touchContext,
    touchDrag,
    touchIcon,
    touchIconBox,
    touchLongPress,
    touchNotepad,
    touchPage,
    touchVolume,
    touchVolumeBox,
    volumeBefore,
  });
}
