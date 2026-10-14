import { assert, assertEventually, settle } from "../harness.mjs";

export default async function run(ctx) {
  const { page, state } = ctx;
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
  await settle(page);
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

  /*
   * 바탕 화면 아이콘 표시. Off takes the field out rather than dimming it:
   * an icon nobody can see must not answer Tab or a rubber-band selection,
   * and the desktop's own menu — which the bare desktop still opens — is
   * the way back.
   */
  const visibleIcons = page.locator(".desktop-icon:visible");
  const iconsBefore = await visibleIcons.count();
  assert(iconsBefore > 0, "The desktop had no icons to hide");
  const toggleDesktopIcons = async () => {
    // Dispatched rather than clicked: a window may be standing over the
    // desktop by now, and the menu is the subject here, not hit testing.
    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      // Bottom right, clear of the cascade a window opens into: the
      // submenu has to be reachable, not merely open.
      clientX: 1150,
      clientY: 700,
    });
    const iconsMenu = page.locator(".desktop-context-menu").first();
    await iconsMenu.waitFor({ state: "visible" });
    await iconsMenu.getByRole("menuitem", { exact: true, name: "보기" }).hover();
    await page.getByRole("menuitemcheckbox", { name: "바탕 화면 아이콘 표시" }).click();
    await settle(page);
  };
  await toggleDesktopIcons();
  assert(
    (await visibleIcons.count()) === 0,
    `바탕 화면 아이콘 표시 off left ${await visibleIcons.count()} icons on screen`,
  );
  assert(
    (await page.evaluate(() => localStorage.getItem("pocket-desk-desktop-icons-v1"))) === "off",
    "The desktop-icons preference was not written down",
  );
  await toggleDesktopIcons();
  assert((await visibleIcons.count()) === iconsBefore, "The icons did not come back");

  /*
   * Win+1…9 addresses the taskbar's buttons from the left, off the same
   * order the bar is built from. Windows launches an app that is not
   * running, sends its own single window to the taskbar when it is already
   * in front, and walks along several.
   */
  const numberedTaskbarOrder = await page
    .locator(".taskbar-app")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  const explorerSlot =
    numberedTaskbarOrder.findIndex((label) => label?.includes("파일 탐색기")) + 1;
  assert(
    explorerSlot > 0,
    `파일 탐색기 is not on the bar: ${JSON.stringify(numberedTaskbarOrder)}`,
  );
  const numberedExplorers = page.locator('article[data-app-id="files"]');
  assert((await numberedExplorers.count()) === 0, "An Explorer window was already open");

  await page.keyboard.press(`Meta+${explorerSlot}`);
  await numberedExplorers.first().waitFor({ state: "visible" });
  await page.keyboard.press(`Meta+${explorerSlot}`);
  await page
    .locator('article[data-app-id="files"].is-minimized')
    .first()
    .waitFor({ state: "attached" });
  await page.keyboard.press(`Meta+${explorerSlot}`);
  await page
    .locator('article[data-app-id="files"].is-minimized')
    .first()
    .waitFor({ state: "detached" });

  // Win+Shift+N is always a new window. The digit has to be read off the
  // physical key: with Shift held, 1 reports "!" and 2 reports "@".
  await page.keyboard.press(`Meta+Shift+${explorerSlot}`);
  await assertEventually(
    async () => (await numberedExplorers.count()) === 2,
    async () =>
      `Win+Shift+${explorerSlot} left ${await numberedExplorers.count()} Explorer window(s)`,
  );
  // With two, the same chord walks along them instead of minimizing.
  const frontmost = () =>
    page
      .locator('article[data-app-id="files"]')
      .evaluateAll((frames) =>
        frames.findIndex((frame) => frame.classList.contains("is-active")),
      );
  const beforeCycle = await frontmost();
  await page.keyboard.press(`Meta+${explorerSlot}`);
  await assertEventually(
    async () => (await frontmost()) !== beforeCycle && (await numberedExplorers.count()) === 2,
    async () => "Win+N did not walk along the two windows",
  );
  await page.keyboard.press("Alt+F4");
  await settle(page);
  await page.keyboard.press("Alt+F4");
  await numberedExplorers.first().waitFor({ state: "detached" });
  // Past the last button the chord does nothing at all.
  const windowsBeforeNine = await page.locator(".window-frame").count();
  await page.keyboard.press("Meta+9");
  await settle(page);
  assert(
    (await page.locator(".window-frame").count()) === windowsBeforeNine,
    "Win+9 opened something with fewer than nine buttons on the bar",
  );

  await page.mouse.move(900, 180);
  await page.mouse.down();
  await page.mouse.move(380, 520, { steps: 10 });
  await page.mouse.up();
  await settle(page);
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
  Object.assign(state, {
    beforeCycle,
    defaultIconBoxes,
    desktopMenu,
    desktopMenuText,
    desktopThisPc,
    desktopThisPcWindow,
    explorerSlot,
    frontmost,
    iconsBefore,
    largeIconWidth,
    numberedExplorers,
    numberedTaskbarOrder,
    pwaUpdatePrompt,
    shortcutExplorer,
    showDesktopButton,
    sortMenu,
    sortedIconBoxes,
    toggleDesktopIcons,
    viewMenu,
    visibleIcons,
    windowsBeforeNine,
  });
}
