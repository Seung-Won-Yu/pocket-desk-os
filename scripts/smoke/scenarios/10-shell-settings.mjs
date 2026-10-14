import {
  assert,
  assertEventually,
  settle,
  settledBoxOf,
  unlockPocketDesk,
} from "../harness.mjs";

export default async function run(ctx) {
  const { page, browser, baseUrl, state } = ctx;
  const runDialog = page.locator(".run-dialog");
  // 스크린샷: PrintScreen pictures the desktop for real — the DOM drawn to a
  // canvas — and saves a PNG into 사진. The pixels must be a picture, not a
  // blank: sampled colours have to vary.
  await page.keyboard.press("PrintScreen");
  const shotToast = page.locator(".toast", { hasText: "스크린샷 저장됨" });
  await shotToast.waitFor({ state: "visible", timeout: 15000 });
  // The toast carries the picture it is about.
  assert(
    (await shotToast.locator(".toast-image").getAttribute("src"))?.startsWith("data:image/png"),
    "The screenshot toast showed no picture",
  );
  // 열기 shows the screenshot itself in 사진 — not whatever 그림판 has open.
  await shotToast.getByRole("button", { name: "열기" }).click();
  const shotPhotos = page.locator('article[data-app-id="photos"]').last();
  await shotPhotos.waitFor({ state: "visible" });
  assert(
    (await shotPhotos.getAttribute("aria-label"))?.startsWith("스크린샷 "),
    `사진 opened ${await shotPhotos.getAttribute("aria-label")} instead of the screenshot`,
  );
  /*
   * 슬라이드 쇼. The viewer could step through pictures and never walk
   * through them by itself. Driven on a controlled clock — three seconds a
   * slide is a real pace, and waiting it out twice is not.
   */
  const shownPicture = () => shotPhotos.locator(".photos-statusbar span").first().innerText();
  const slideshowButton = shotPhotos.getByRole("button", {
    name: "슬라이드 쇼",
    exact: true,
  });
  if (await slideshowButton.isEnabled()) {
    const firstSlide = (await shownPicture()).trim();
    await slideshowButton.click();
    await shotPhotos.getByRole("button", { name: /슬라이드 쇼 중지/ }).waitFor();
    // Waited for, not fast-forwarded: this page's clock is the real one,
    // and the tick is the thing under test.
    await shotPhotos
      .locator(".photos-statusbar span")
      .first()
      .filter({ hasNotText: firstSlide })
      .waitFor({ timeout: 9000 });
    const secondSlide = (await shownPicture()).trim();
    assert(secondSlide !== firstSlide, `슬라이드 쇼 stayed on ${firstSlide} after a tick`);
    // Escape stops it, and time passing changes nothing after that.
    await page.keyboard.press("Escape");
    await slideshowButton.waitFor();
    await page.waitForTimeout(4000);
    assert(
      (await shownPicture()).trim() === secondSlide,
      "슬라이드 쇼 kept going after Escape",
    );
  }

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
    .getByRole("treeitem", { name: "사진", exact: true })
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
  /*
   * 사각형 캡처 is what the tool opens on, as Windows' does: a crosshair over
   * everything, and the picture is the band that was dragged. Escape and a
   * press that never became a drag both come back with nothing.
   */
  assert(
    (await snip.getByLabel("캡처 모드").inputValue()) === "region",
    `캡처 도구 opened on ${await snip.getByLabel("캡처 모드").inputValue()}`,
  );
  await snip.getByRole("button", { name: "새 캡처" }).click();
  const regionOverlay = page.locator(".region-capture-overlay");
  await regionOverlay.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await regionOverlay.waitFor({ state: "detached" });
  assert(
    (await snip.getByRole("status").innerText()).includes("영역을 고르지 않아"),
    `Escape over the crosshair said: ${await snip.getByRole("status").innerText()}`,
  );

  await snip.getByRole("button", { name: "새 캡처" }).click();
  await regionOverlay.waitFor({ state: "visible" });
  await page.mouse.move(280, 180);
  await page.mouse.down();
  await page.mouse.move(600, 420, { steps: 10 });
  await settle(page);
  const regionBandBox = await page.locator(".region-capture-band").boundingBox();
  assert(
    regionBandBox && Math.round(regionBandBox.width) === 320,
    `The crosshair's band is ${JSON.stringify(regionBandBox)}`,
  );
  await page.mouse.up();
  await regionOverlay.waitFor({ state: "detached" });
  await snip.locator(".snip-preview").waitFor({ state: "visible", timeout: 20000 });
  const regionShot = await snip
    .locator(".snip-preview")
    .evaluate((image) => ({ height: image.naturalHeight, width: image.naturalWidth }));
  assert(
    regionShot.width === 320 && regionShot.height === 240,
    `사각형 캡처 saved ${regionShot.width}×${regionShot.height}, not the 320×240 that was dragged`,
  );

  await snip.getByLabel("캡처 모드").selectOption("screen");
  await snip.getByRole("button", { name: "새 캡처" }).click();
  await snip.locator(".snip-preview").waitFor({ state: "visible", timeout: 15000 });
  // The region shot is still on screen while this one is drawn, so the wait
  // is for the picture to become the whole screen, not merely for a picture.
  let screenShotSize = regionShot;
  for (
    let attempt = 0;
    attempt < 40 && screenShotSize.width === regionShot.width;
    attempt += 1
  ) {
    await settle(page);
    screenShotSize = await snip
      .locator(".snip-preview")
      .evaluate((image) => ({ height: image.naturalHeight, width: image.naturalWidth }));
  }
  assert(
    screenShotSize.width > regionShot.width,
    `전체 화면 capture stayed at ${screenShotSize.width}×${screenShotSize.height}; status: ${await snip.getByRole("status").innerText()}; toasts: ${(await page.locator(".toast").allInnerTexts()).join(" / ").replace(/\n/g, " ")}`,
  );
  assert(
    (await snip.getByRole("status").innerText()).includes("사진 폴더에 저장됨"),
    `Capture tool did not report the saved capture: ${await snip.getByRole("status").innerText()}`,
  );
  // 활성 창 with no delay: the tool must picture the window you were on, not
  // refuse because clicking 새 캡처 made the tool itself active. (With only
  // the tool open there is genuinely nothing to picture, so open a window.)
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const snipSubject = page.locator('article[data-app-id="notepad"]').last();
  await snipSubject.waitFor({ state: "visible" });
  await page.keyboard.press("Meta+Shift+S");
  await snip.waitFor({ state: "visible" });
  await settle(page);
  await snip.getByLabel("캡처 모드").selectOption("window");
  await snip.getByRole("button", { name: "새 캡처" }).click();
  await snip.locator(".snip-preview").waitFor({ state: "visible", timeout: 15000 });
  // The status settles a beat after the preview appears.
  await snip
    .getByRole("status")
    .filter({ hasText: "사진 폴더에 저장됨" })
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => undefined);
  assert(
    (await snip.getByRole("status").innerText()).includes("사진 폴더에 저장됨"),
    `활성 창 capture failed: ${await snip.getByRole("status").innerText()}`,
  );
  await snip.getByRole("button", { name: "캡처 도구 닫기" }).click();
  await snip.waitFor({ state: "detached" });
  await snipSubject.getByRole("button", { name: "메모장 닫기" }).click();
  await settle(page);
  // 그림판's own save prompt is a .note-close-overlay, not a .window-dialog;
  // left standing it swallows every later click on the desktop.
  if (await page.locator(".note-close-overlay, .window-dialog").count()) {
    await page.getByRole("button", { name: /저장하지 않고 닫기|저장 안 함/ }).click();
    await settle(page);
  }
  // Alt+PrintScreen pictures the active window alone. Closing the tool hands
  // focus back to Explorer; its title bar is clear now if it did not.
  if (!(await shotExplorer.getAttribute("class"))?.includes("is-active")) {
    await shotExplorer.locator(".window-titlebar").click();
  }
  await settle(page);
  /*
   * Counted, not matched: an earlier window capture in this same section
   * leaves its own 창 스크린샷 저장됨 toast on screen, and waiting for "a
   * toast with that text" resolved to two of them — a strict-mode
   * violation the failure handler then reported as "no toast", which is
   * the opposite of what had happened.
   */
  const windowShotToast = page.locator(".toast", { hasText: "창 스크린샷 저장됨" });
  const windowShotsBefore = await windowShotToast.count();
  await page.keyboard.press("Alt+PrintScreen");
  // A capture can also be refused for space or fail outright, and both of
  // those are toasts of their own; say what the shell actually said.
  await page
    .waitForFunction(
      (expected) =>
        Array.from(document.querySelectorAll(".toast")).filter((toast) =>
          (toast.textContent ?? "").includes("창 스크린샷 저장됨"),
        ).length > expected,
      windowShotsBefore,
      { timeout: 15000 },
    )
    .catch(async (error) => {
      const said = (await page.locator(".toast").allInnerTexts()).join(" | ") || "(no toast)";
      throw new Error(
        `Alt+PrintScreen added no 창 스크린샷 저장됨 (${windowShotsBefore} before). On screen: ${said} — ${String(error).split("\n")[0]}`,
      );
    });
  /*
   * 텍스트 크기: one multiplier on the root font size, which every rem in the
   * stylesheet reads — so the whole shell grows with one setting, and the
   * chrome around the text keeps its pixel sizes, as in Windows.
   */
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("settings");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const scaleSettings = page.locator('article[data-app-id="settings"]').last();
  await scaleSettings.waitFor({ state: "visible" });
  await scaleSettings.getByRole("button", { name: "접근성" }).click();
  await settle(page);
  const rootFontSize = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  const baseFontSize = await rootFontSize();
  await scaleSettings.getByRole("radio", { name: /150/ }).click();
  await settle(page);
  assert(
    parseFloat(await rootFontSize()) === parseFloat(baseFontSize) * 1.5,
    `텍스트 크기 150% left the root at ${await rootFontSize()} (was ${baseFontSize})`,
  );
  assert(
    (await page.evaluate(() => localStorage.getItem("pocket-desk-text-scale-v1"))) === "150",
    "The text size was not written to storage",
  );
  // The taskbar is outside the settings window and grows with it.
  assert(
    parseFloat(
      await page.evaluate(
        () => getComputedStyle(document.querySelector(".system-tray-clock-button")).fontSize,
      ),
    ) > parseFloat(baseFontSize),
    "The taskbar did not follow the text size",
  );
  await scaleSettings.getByRole("radio", { name: /100/ }).click();
  await assertEventually(
    async () => (await rootFontSize()) === baseFontSize,
    async () => "100% did not put the text size back where it started",
  );

  /*
   * 작업 표시줄 위치: the bar moves to another screen edge and the work area
   * moves with it. What is worth asserting is not where the bar is drawn but
   * what measures against it — a maximized window, a snapped one, and the
   * desktop icon grid all have to leave the bar its edge.
   */
  await scaleSettings.getByRole("button", { name: "개인 설정" }).click();
  await settle(page);
  /*
   * A window that has just maximized or restored is still running its
   * transform animation, and a box read mid-animation is both fractional and
   * wrong — CI once read a "maximized" window as 1193.82x807.70 at x=77.09.
   * Read until two reads in a row agree instead of guessing at a delay.
   */
  const settledBox = (locator, attempts = 40) => settledBoxOf(page, locator, attempts);
  const barBox = () => settledBox(page.locator(".taskbar"));
  const dismissSnapAssist = async () => {
    const assist = page.locator(".snap-assist");
    if ((await assist.count()) === 0) return;
    await page.keyboard.press("Escape");
    await assist.waitFor({ state: "detached" });
  };
  const activeWindowBox = () =>
    settledBox(page.locator('article[data-app-id="settings"]').last());
  const leftmostIcon = () =>
    page.evaluate(() =>
      Math.min(
        ...[...document.querySelectorAll(".desktop-icon")].map(
          (icon) => icon.getBoundingClientRect().left,
        ),
      ),
    );

  await page.keyboard.press("Meta+ArrowLeft");
  await settle(page);
  const snappedAtBottomBar = await activeWindowBox();
  assert(
    Math.round(snappedAtBottomBar.x) === 0,
    `With the bar at the bottom, Win+Left snapped to x=${snappedAtBottomBar.x}`,
  );
  // Snapping a half opens Snap Assist over the other one; it is modal.
  await dismissSnapAssist();

  await scaleSettings.getByRole("radio", { name: "왼쪽" }).click();
  await settle(page);
  const sideBar = await barBox();
  assert(
    Math.round(sideBar.x) === 0 && Math.round(sideBar.width) === 68,
    `The side bar landed at x=${sideBar.x} width=${sideBar.width}`,
  );
  assert(
    (await page.evaluate(() => localStorage.getItem("pocket-desk-taskbar-position-v1"))) ===
      "left",
    "작업 표시줄 위치 was not written to storage",
  );
  assert(
    (await leftmostIcon()) >= 68,
    `A desktop icon stayed under the side bar (leftmost ${await leftmostIcon()})`,
  );

  await page.keyboard.press("Meta+ArrowLeft");
  await settle(page);
  const snappedBesideBar = await activeWindowBox();
  assert(
    Math.round(snappedBesideBar.x) === 68,
    `Win+Left snapped to x=${snappedBesideBar.x}, under the side bar`,
  );
  await dismissSnapAssist();

  const viewport = await page.evaluate(() => ({
    height: window.innerHeight,
    width: window.innerWidth,
  }));
  await scaleSettings.getByRole("button", { name: "최대화" }).click();
  await settle(page);
  const maximizedBesideBar = await activeWindowBox();
  assert(
    Math.round(maximizedBesideBar.x) === 68 &&
      Math.round(maximizedBesideBar.width) === viewport.width - 68 &&
      Math.round(maximizedBesideBar.height) === viewport.height,
    `A maximized window is ${maximizedBesideBar.width}x${maximizedBesideBar.height} at x=${maximizedBesideBar.x}; the side bar should own 68px of the width and none of the height`,
  );

  await scaleSettings.getByRole("radio", { name: "아래쪽" }).click();
  await settle(page);
  const bottomBar = await barBox();
  assert(
    Math.round(bottomBar.y + bottomBar.height) === viewport.height &&
      Math.round(bottomBar.height) === 48,
    `The bar did not go back to the bottom (y=${bottomBar.y} h=${bottomBar.height})`,
  );
  // The same window, still maximized, now fills the area the bottom bar leaves.
  const maximizedAgain = await activeWindowBox();
  assert(
    Math.round(maximizedAgain.x) === 0 &&
      Math.round(maximizedAgain.width) === viewport.width &&
      Math.round(maximizedAgain.height) === viewport.height - 48,
    `Back at the bottom, the maximized window is ${maximizedAgain.width}x${maximizedAgain.height} at x=${maximizedAgain.x}`,
  );
  await scaleSettings.getByRole("button", { name: "복원" }).click();
  await settle(page);

  /*
   * 작은 작업 표시줄 단추 and 자동 숨기기. Both are settings about the work
   * area, so what is asserted is the work area: a thinner bar gives the
   * windows the pixels it stopped using, and a hidden one gives them all of
   * them.
   */
  await scaleSettings.getByRole("button", { name: "최대화" }).click();
  await settle(page);
  await scaleSettings.getByLabel(/작은 작업 표시줄 단추/).check();
  await settle(page);
  const smallBar = await barBox();
  const smallMaximized = await activeWindowBox();
  assert(
    Math.round(smallBar.height) === 32 &&
      Math.round(smallMaximized.height) === viewport.height - 32,
    `작은 단추: bar ${smallBar.height}px, maximized ${smallMaximized.height}px of ${viewport.height}`,
  );
  await scaleSettings.getByLabel(/작은 작업 표시줄 단추/).uncheck();
  await settle(page);

  await scaleSettings.getByLabel(/자동 숨기기/).check();
  await page.waitForTimeout(500);
  const hiddenMaximized = await activeWindowBox();
  assert(
    Math.round(hiddenMaximized.height) === viewport.height,
    `자동 숨기기 left the window ${hiddenMaximized.height}px of ${viewport.height}; a hidden bar takes none of the work area`,
  );
  const hiddenBar = await barBox();
  assert(
    Math.round(hiddenBar.y + hiddenBar.height) === viewport.height + 46,
    `The hidden bar sits at y=${hiddenBar.y}; all but a 2px sliver belongs off screen`,
  );

  // Pointing at the edge brings it back, and moving away puts it away.
  await page.mouse.move(viewport.width / 2, viewport.height - 1);
  await assertEventually(
    async () => Math.round((await barBox()).y + hiddenBar.height) === viewport.height,
    async () => "The bar did not come back when the pointer reached the edge",
  );
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await settle(page);
  assert(
    Math.round((await barBox()).y + hiddenBar.height) === viewport.height + 46,
    "The bar stayed out after the pointer left it",
  );

  // An open Start menu keeps it out, or the menu would hang over an empty edge.
  await page.mouse.move(viewport.width / 2, viewport.height - 1);
  await settle(page);
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  await page.locator(".start-menu").waitFor({ state: "visible" });
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await settle(page);
  assert(
    Math.round((await barBox()).y + hiddenBar.height) === viewport.height,
    "The bar slid away from under its own Start menu",
  );
  await page.keyboard.press("Escape");
  await settle(page);

  await scaleSettings.getByLabel(/자동 숨기기/).uncheck();
  await assertEventually(
    async () => Math.round((await activeWindowBox()).height) === viewport.height - 48,
    async () => "Turning 자동 숨기기 off did not give the bar its space back",
  );
  await scaleSettings.getByRole("button", { name: "복원" }).click();
  await settle(page);

  /*
   * 야간 조명. What matters is that the warm overlay actually paints, and that
   * its strength is remembered separately from the switch — turning it off
   * and on again has to come back where it was.
   */
  const nightAlpha = () =>
    page.evaluate(() =>
      Number(
        getComputedStyle(document.querySelector(".desktop"))
          .getPropertyValue("--night-light")
          .trim() || 0,
      ),
    );
  assert((await nightAlpha()) === 0, "야간 조명 was already painting before it was turned on");
  await scaleSettings.getByRole("button", { name: "시스템" }).click();
  await settle(page);
  const nightToggle = scaleSettings
    .locator(".settings-toggle", { hasText: "야간 조명" })
    .first()
    .locator("input");
  await nightToggle.check();
  await settle(page);
  const defaultWarmth = await nightAlpha();
  assert(
    defaultWarmth > 0 && defaultWarmth < 0.5,
    `야간 조명 painted ${defaultWarmth}; it should warm the screen without hiding it`,
  );
  await scaleSettings.getByLabel("야간 조명 세기").fill("100");
  await settle(page);
  const fullWarmth = await nightAlpha();
  assert(
    fullWarmth > defaultWarmth,
    `세기 100 painted ${fullWarmth}, no warmer than the default ${defaultWarmth}`,
  );
  await nightToggle.uncheck();
  await settle(page);
  assert((await nightAlpha()) === 0, "야간 조명 kept painting after it was turned off");
  await nightToggle.check();
  await settle(page);
  assert(
    (await nightAlpha()) === fullWarmth,
    "야간 조명 forgot its strength when it was switched off and on",
  );
  await nightToggle.uncheck();
  await settle(page);

  await scaleSettings.getByRole("button", { name: "설정 닫기" }).click();
  await settle(page);

  /*
   * 집중 지원: the notification still arrives, the toast is what is held
   * back. That distinction is the whole feature, so it is what is asserted.
   */
  await page.getByRole("button", { name: "빠른 설정 열기" }).click();
  await page.getByRole("button", { name: /집중 지원/ }).click();
  await page.keyboard.press("Escape");
  await assertEventually(
    async () => await page.getByRole("button", { name: /집중 지원 켜짐/ }).count(),
    async () => "The tray does not say 집중 지원 is on",
  );
  await page.keyboard.press("PrintScreen");
  await page.waitForTimeout(2500);
  assert(
    (await page.locator(".toast").count()) === 0,
    `집중 지원 let ${await page.locator(".toast").count()} toast(s) through`,
  );
  await page.locator(".system-tray-clock-button").click();
  const quietCentre = page.locator(".notification-center-panel");
  await quietCentre.waitFor({ state: "visible" });
  assert(
    (await quietCentre.locator(".notification-focus-banner").count()) === 1,
    "The notification centre does not say why it is quiet",
  );
  assert(
    (await quietCentre.innerText()).includes("스크린샷"),
    "집중 지원 dropped the notification instead of holding the toast",
  );
  await quietCentre.locator(".notification-focus-banner button").click();
  await assertEventually(
    async () => (await page.getByRole("button", { name: /집중 지원 켜짐/ }).count()) === 0,
    async () => "끄기 in the centre did not turn 집중 지원 off",
  );
  await page.keyboard.press("Escape");
  await settle(page);

  /*
   * 캘린더 일정: the tray calendar keeps appointments and the shell reminds
   * about them. The reminder is the part worth asserting — an entry that only
   * sits in a list is a note, not an appointment — so this drives a clock the
   * test owns and watches the reminder arrive rather than waiting out a real
   * minute.
   */
  await page.locator(".system-tray-clock-button").click();
  const calendarCentre = page.locator(".notification-center-panel");
  await calendarCentre.waitFor({ state: "visible" });
  assert(
    (await calendarCentre.locator(".tray-calendar-selection span").innerText()).trim() ===
      "일정 없음",
    "The tray calendar claims to have entries before any were added",
  );

  const todayKey = await page.evaluate(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });
  await calendarCentre.getByLabel(/일정 제목/).fill("치과 예약");
  await calendarCentre.getByLabel(/일정 제목/).press("Enter");
  await settle(page);
  // A minute from now, so the reminder is armed rather than already past.
  const soonTime = await page.evaluate(() => {
    const soon = new Date(Date.now() + 60000);
    return `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
  });
  await calendarCentre.getByLabel("일정 시간 (선택)").fill(soonTime);
  await calendarCentre.getByLabel(/일정 제목/).fill("팀 회의");
  await calendarCentre.getByLabel(/일정 제목/).press("Enter");
  await settle(page);

  const agendaRows = calendarCentre.locator(".tray-agenda-list li");
  const agenda = await agendaRows.allInnerTexts();
  assert(
    agenda.length === 2 && agenda[0].startsWith("종일") && agenda[0].includes("치과 예약"),
    `The agenda reads ${JSON.stringify(agenda)}; an all-day entry belongs first`,
  );
  assert(
    (await calendarCentre.locator(".calendar-days button.has-event").count()) === 1,
    "The day carrying the entries is not marked on the grid",
  );
  const storedEvents = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pocket-desk-calendar-events-v1") ?? "[]"),
  );
  assert(
    storedEvents.length === 2 &&
      storedEvents.every((event) => event.date === todayKey) &&
      storedEvents.some((event) => event.time === null && event.remindAt === null),
    `The entries were stored as ${JSON.stringify(storedEvents)}`,
  );

  /*
   * An entry written for a moment that has already gone by must not set off a
   * reminder for it. Checked with the centre closed: an open centre holds all
   * banners back, so leaving it open would prove nothing.
   */
  await calendarCentre.getByLabel("일정 시간 (선택)").fill("00:01");
  await calendarCentre.getByLabel(/일정 제목/).fill("지난 일정");
  await calendarCentre.getByLabel(/일정 제목/).press("Enter");
  await settle(page);
  await page.keyboard.press("Escape");
  await calendarCentre.waitFor({ state: "hidden" });
  await page.waitForTimeout(900);
  assert(
    (await page.locator(".toast").count()) === 0,
    `Writing down a past appointment set off ${await page.locator(".toast").count()} reminder(s)`,
  );
  await page.locator(".system-tray-clock-button").click();
  await calendarCentre.waitFor({ state: "visible" });

  await calendarCentre.getByRole("button", { name: "일정 삭제: 치과 예약" }).click();
  await settle(page);
  assert(
    (await agendaRows.allInnerTexts()).every((row) => !row.includes("치과 예약")),
    "일정 삭제 left the entry on the agenda",
  );
  await page.keyboard.press("Escape");
  await settle(page);

  // The reminder itself, on a clock this test drives forward.
  const reminderContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  try {
    await reminderContext.clock.install({ time: new Date("2026-09-08T10:00:00") });
    const reminderPage = await reminderContext.newPage();
    await reminderPage.goto(baseUrl, { waitUntil: "load" });
    await unlockPocketDesk(reminderPage);
    await reminderPage.locator(".system-tray-clock-button").click();
    const reminderCentre = reminderPage.locator(".notification-center-panel");
    await reminderCentre.waitFor({ state: "visible" });
    await reminderCentre.getByLabel("일정 시간 (선택)").fill("10:05");
    await reminderCentre.getByLabel(/일정 제목/).fill("팀 회의");
    await reminderCentre.getByLabel(/일정 제목/).press("Enter");
    await settle(reminderPage);
    assert(
      (await reminderPage.locator(".toast").count()) === 0,
      "The reminder arrived before its moment",
    );

    /*
     * With the centre open Windows raises no banner — the panel is already
     * showing the same notification, and both are anchored to the tray. The
     * notification still has to land in the centre.
     */
    await reminderContext.clock.fastForward("05:30");
    await settle(reminderPage);
    assert(
      (await reminderPage.locator(".toast").count()) === 0,
      "A banner was raised on top of the open notification centre",
    );
    assert(
      (await reminderCentre.innerText()).includes("팀 회의"),
      "The reminder did not reach the notification centre",
    );

    // Closed, and the next reminder does raise a banner.
    await reminderCentre.getByLabel("일정 시간 (선택)").fill("10:20");
    await reminderCentre.getByLabel(/일정 제목/).fill("점심 약속");
    await reminderCentre.getByLabel(/일정 제목/).press("Enter");
    await settle(reminderPage);
    await reminderPage.keyboard.press("Escape");
    await reminderCentre.waitFor({ state: "hidden" });
    await reminderContext.clock.fastForward("15:10");
    await settle(reminderPage);
    const reminderToasts = await reminderPage.locator(".toast").allInnerTexts();
    assert(
      reminderToasts.some((toast) => toast.includes("점심 약속") && toast.includes("10:20")),
      `The reminder did not arrive. On screen: ${reminderToasts.join(" | ") || "(nothing)"}`,
    );
    const deliveredOnce = await reminderPage.locator(".toast").count();
    await reminderContext.clock.fastForward("05:00");
    await settle(reminderPage);
    assert(
      (await reminderPage.locator(".toast").count()) <= deliveredOnce,
      "The reminder arrived a second time",
    );
    assert(
      (await reminderPage
        .evaluate(() =>
          JSON.parse(localStorage.getItem("pocket-desk-calendar-events-v1") ?? "[]"),
        )
        .then((events) => events.every((event) => event.notified))) === true,
      "A delivered reminder was not marked delivered, so a reload would repeat it",
    );
  } finally {
    await reminderContext.close();
  }

  // 알림 센터: a notification that names a file opens it.
  await page.locator(".tray-clock").click();
  const centre = page.locator(".notification-center-panel");
  await centre.waitFor({ state: "visible" });
  // A notification can be dropped on its own, not only all at once.
  const notificationsBefore = await centre.locator(".notification-item").count();
  await centre.locator(".notification-item").first().hover();
  await centre.locator(".notification-dismiss").first().click();
  await assertEventually(
    async () =>
      (await centre.locator(".notification-item").count()) === notificationsBefore - 1,
    async () => "Dismissing one notification did not drop exactly one",
  );
  // The read marker pointed at the notification just dropped; counting the
  // whole history then brought the badge back.
  assert(
    (await page.locator(".tray-notification-badge").count()) === 0,
    "Dismissing one notification resurrected the unread badge",
  );
  const openableRow = centre.locator(".notification-item.is-openable").first();
  const openableNotification = openableRow.locator(".notification-open");
  assert(
    (await openableNotification.count()) === 1,
    "The screenshot notification was not clickable in the notification centre",
  );
  // The ✕ used to sit inside that button, where a button's children are
  // presentational — so the only notifications anything could dismiss were
  // the ones nothing could open.
  assert(
    (await openableRow.locator(".notification-open .notification-dismiss").count()) === 0 &&
      (await openableRow.locator(".notification-dismiss").count()) === 1,
    "The dismiss button is nested inside the openable notification's button",
  );
  await openableNotification.click();
  const notifiedPhotos = page.locator('article[data-app-id="photos"]').last();
  await notifiedPhotos.waitFor({ state: "visible" });
  assert(
    (await notifiedPhotos.getAttribute("aria-label"))?.startsWith("스크린샷 "),
    `Clicking the notification opened ${await notifiedPhotos.getAttribute("aria-label")}`,
  );
  await notifiedPhotos.getByRole("button", { name: "사진 닫기" }).click();
  await notifiedPhotos.waitFor({ state: "detached" });

  /*
   * 바탕 화면 배경으로 설정: the screenshot becomes the wallpaper; deleting the
   * file puts the preset back. CSS gets the picture as a blob: URL — a
   * full-screen PNG runs past 2 MiB as a data URL, and Chrome drops a custom
   * property that long, so the variable kept the preset and nothing changed.
   * The blob is decoded here to prove it is the screenshot itself.
   */
  const wallpaperVar = () =>
    page
      .locator("main.desktop")
      .evaluate((node) => node.style.getPropertyValue("--wallpaper-image"));
  const wallpaperPictureSize = (locator) =>
    locator.evaluate(async (node) => {
      const value = node.style.getPropertyValue("--wallpaper-image");
      const url = /^url\("(blob:[^"]+)"\)$/.exec(value)?.[1];
      if (!url) return value.slice(0, 40);
      const image = new Image();
      image.src = url;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    });
  await shotRow.first().click({ button: "right" });
  await shotExplorer
    .locator(".file-context-menu")
    .getByRole("menuitem", { name: "바탕 화면 배경으로 설정" })
    .click();
  await settle(page);
  const desktopPicture = await wallpaperPictureSize(page.locator("main.desktop"));
  assert(
    desktopPicture === "1280x820",
    `Setting the screenshot as wallpaper left ${desktopPicture}`,
  );
  // The lock screen shows the same picture.
  await page.keyboard.press("Meta+l");
  const lockScreen = page.locator('[aria-label="PocketDesk 잠금 화면"]');
  await lockScreen.waitFor({ state: "visible" });
  const lockPicture = await wallpaperPictureSize(lockScreen);
  assert(
    lockPicture === "1280x820",
    `The lock screen did not show the custom wallpaper: ${lockPicture}`,
  );
  await unlockPocketDesk(page);
  await shotExplorer.waitFor({ state: "visible" });
  await shotRow.first().click({ button: "right" });
  await shotExplorer
    .locator(".file-context-menu")
    .getByRole("menuitem", { name: "삭제" })
    .click();
  await settle(page);
  assert(
    /wallpapers\/[a-z-]+\.jpg/.test(await wallpaperVar()),
    `Deleting the wallpaper picture left ${(await wallpaperVar()).slice(0, 40)}`,
  );
  // Something is in the bin now: the desktop icon says so.
  assert(
    (
      await page.locator(".desktop-icon", { hasText: "휴지통" }).getAttribute("aria-label")
    )?.includes("개 항목"),
    "The recycle bin icon does not show it is full",
  );
  // Minimizing folds the window towards its taskbar button: the frame carries
  // the vector the animation ends on.
  // Read mid-motion, not after it settles: the vector goes with the motion.
  await shotExplorer.getByRole("button", { name: "파일 탐색기 최소화" }).click();
  const minimizeVector = await shotExplorer.evaluate((node) => [
    node.style.getPropertyValue("--minimize-dx"),
    node.style.getPropertyValue("--minimize-dy"),
  ]);
  assert(
    minimizeVector[0].endsWith("px") && minimizeVector[1].endsWith("px"),
    `Minimize did not aim at the taskbar button: ${JSON.stringify(minimizeVector)}`,
  );
  await settle(page);
  // Mid-motion again: the class goes when the unfold ends.
  await page.locator('.taskbar button[data-app-id="files"]').click();
  assert(
    (await shotExplorer.getAttribute("class"))?.includes("is-restoring"),
    "Restoring from the taskbar did not play the unfold animation",
  );
  await shotExplorer.waitFor({ state: "visible" });
  await shotExplorer.getByRole("button", { name: "파일 탐색기 닫기" }).click();
  await shotExplorer.waitFor({ state: "detached" });

  // 고정된 앱을 끌어서 순서 바꾸기 — Start menu tiles and taskbar buttons.
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  const dragMenu = page.locator(".start-menu");
  await dragMenu.waitFor({ state: "visible" });
  const tiles = dragMenu.locator(".start-pinned-grid button");
  const tilesBefore = await tiles.evaluateAll((nodes) => nodes.map((node) => node.textContent));
  // Near the edge the tile takes that slot, as Windows 11 reorders.
  const tileBox = await tiles.nth(0).boundingBox();
  await tiles.nth(2).dragTo(tiles.nth(0), { targetPosition: { x: 4, y: tileBox.height / 2 } });
  await settle(page);
  const tilesAfter = await tiles.evaluateAll((nodes) => nodes.map((node) => node.textContent));
  assert(
    tilesAfter[0] === tilesBefore[2] && tilesAfter.length === tilesBefore.length,
    `Dragging a tile to an edge did not move it: ${JSON.stringify(tilesBefore)} → ${JSON.stringify(tilesAfter)}`,
  );
  // On the middle, the two become a folder — one tile fewer, and it opens.
  await tiles.nth(1).dragTo(tiles.nth(0), {
    targetPosition: { x: tileBox.width / 2, y: tileBox.height / 2 },
  });
  await assertEventually(
    async () =>
      (await tiles.count()) === tilesAfter.length - 1 &&
      (await dragMenu.locator(".start-tile-folder").count()) === 1,
    async () =>
      `Dropping a tile on another did not make a folder (${await tiles.count()} tiles)`,
  );
  await dragMenu.locator(".start-tile-folder").click();
  const folderFlyout = dragMenu.locator(".start-folder-flyout");
  await folderFlyout.waitFor({ state: "visible" });
  assert(
    (await folderFlyout.locator(".start-folder-apps button").count()) === 2,
    "The folder did not hold the two tiles that made it",
  );
  // The folder can be named, as Windows lets you name a tile folder.
  await folderFlyout.locator(".start-folder-name").click();
  const tileFolderNameInput = folderFlyout.getByLabel("폴더 이름");
  await tileFolderNameInput.waitFor({ state: "visible" });
  await tileFolderNameInput.fill("작업 도구");
  await page.keyboard.press("Enter");
  await assertEventually(
    async () =>
      (await dragMenu.locator(".start-tile-folder").innerText()).includes("작업 도구"),
    async () =>
      `Renaming the folder did not take: ${await dragMenu.locator(".start-tile-folder").innerText()}`,
  );
  await folderFlyout.getByRole("button", { name: "폴더 닫기" }).click();
  await dragMenu.locator(".start-tile-folder").click({ button: "right" });
  await page.getByRole("menuitem", { name: "그룹 해제" }).click();
  await assertEventually(
    async () =>
      (await tiles.count()) === tilesAfter.length &&
      (await dragMenu.locator(".start-tile-folder").count()) === 0,
    async () => "그룹 해제 did not put the tiles back",
  );
  await page.keyboard.press("Escape");
  await dragMenu.waitFor({ state: "hidden" });
  const pinnedSlots = page.locator(".taskbar-slot[draggable='true']");
  const readPinned = () =>
    pinnedSlots.evaluateAll((nodes) =>
      nodes.map((node) => node.querySelector("[data-app-id]")?.getAttribute("data-app-id")),
    );
  // Two pinned apps ship by default, but earlier sections may have unpinned
  // one; pin whatever is open until there are two. (Guarding on a count and
  // skipping would have made this check silently do nothing.)
  for (const app of await page
    .locator(".taskbar-slot:not([draggable='true']) [data-app-id]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-app-id")))) {
    if ((await pinnedSlots.count()) >= 2) break;
    await page.locator(`.taskbar button[data-app-id="${app}"]`).click({ button: "right" });
    const pinMenu = page.locator(".taskbar-context-menu");
    await pinMenu.waitFor({ state: "visible" });
    await pinMenu.getByRole("menuitem", { name: "작업 표시줄에 고정" }).click();
    await settle(page);
  }
  const pinnedBefore = await readPinned();
  assert(
    pinnedBefore.length >= 2,
    `Reordering needs two pinned taskbar apps, found ${pinnedBefore.length}`,
  );
  await pinnedSlots.nth(1).dragTo(pinnedSlots.nth(0));
  await settle(page);
  const pinnedAfter = await readPinned();
  assert(
    pinnedAfter[0] === pinnedBefore[1] && pinnedAfter.length === pinnedBefore.length,
    `Dragging a taskbar button did not move it: ${JSON.stringify(pinnedBefore)} → ${JSON.stringify(pinnedAfter)}`,
  );

  // The Start menu's 추천 shows a picture file as its picture.
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  const recommendMenu = page.locator(".start-menu");
  await recommendMenu.waitFor({ state: "visible" });
  assert(
    (await recommendMenu.locator(".start-recommended-thumbnail").count()) > 0,
    "The Start menu's recommended list showed no picture thumbnails",
  );
  await page.keyboard.press("Escape");
  await recommendMenu.waitFor({ state: "hidden" });

  // 시계 우클릭: 날짜 및 시간 조정 opens 설정 at its own page.
  await page.locator(".system-tray-clock-button").click({ button: "right" });
  const clockMenu = page.locator('[aria-label="시계 메뉴"]');
  await clockMenu.waitFor({ state: "visible" });
  await clockMenu.getByRole("menuitem", { name: "날짜 및 시간 조정" }).click();
  const clockSettings = page.locator('article[data-app-id="settings"]').last();
  await clockSettings.waitFor({ state: "visible" });
  await assertEventually(
    async () => (await clockSettings.innerText()).includes("24시간"),
    async () => "날짜 및 시간 조정 did not open 설정 at 시간 및 언어",
  );
  await clockSettings.getByRole("button", { name: "설정 닫기" }).click();
  await clockSettings.waitFor({ state: "detached" });

  // 절전: the display goes dark; a key brings the lock screen back.
  await page.getByRole("button", { name: "시작 메뉴" }).click();
  const sleepStartMenu = page.locator(".start-menu");
  await sleepStartMenu.waitFor({ state: "visible" });
  await sleepStartMenu.getByRole("button", { name: "전원 옵션" }).click();
  await sleepStartMenu.getByRole("menuitem", { name: "절전" }).click();
  const sleepScreen = page.locator(".sleep-screen");
  await sleepScreen.waitFor({ state: "visible" });
  await settle(page);
  await page.keyboard.press("Space");
  await sleepScreen.waitFor({ state: "detached" });
  await unlockPocketDesk(page);

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
    (await stickyFrames.first().getAttribute("aria-label"))?.startsWith("장보기 - 스티커 메모"),
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
    await settle(page);
  }
  await stickyFrames.first().waitFor({ state: "detached" });
  Object.assign(state, {
    activeWindowBox,
    agenda,
    agendaRows,
    barBox,
    baseFontSize,
    bottomBar,
    calendarCentre,
    centre,
    clockMenu,
    clockSettings,
    defaultWarmth,
    desktopPicture,
    dismissSnapAssist,
    dragMenu,
    folderFlyout,
    fullWarmth,
    hiddenBar,
    hiddenMaximized,
    leftmostIcon,
    lockPicture,
    lockScreen,
    maximizedAgain,
    maximizedBesideBar,
    minimizeVector,
    nightAlpha,
    nightToggle,
    notificationsBefore,
    notifiedPhotos,
    openableNotification,
    openableRow,
    pinnedAfter,
    pinnedBefore,
    pinnedSlots,
    quietCentre,
    readPinned,
    recommendMenu,
    regionBandBox,
    regionOverlay,
    regionShot,
    reminderContext,
    rootFontSize,
    scaleSettings,
    screenShotSize,
    settledBox,
    shotExplorer,
    shotPhotos,
    shotPixels,
    shotRow,
    shotToast,
    shownPicture,
    sideBar,
    sleepScreen,
    sleepStartMenu,
    slideshowButton,
    smallBar,
    smallMaximized,
    snappedAtBottomBar,
    snappedBesideBar,
    snip,
    snipSubject,
    soonTime,
    stickyFrames,
    stickyTexts,
    storedEvents,
    tileBox,
    tileFolderNameInput,
    tiles,
    tilesAfter,
    tilesBefore,
    todayKey,
    viewport,
    wallpaperPictureSize,
    wallpaperVar,
    windowShotToast,
    windowShotsBefore,
  });
}
