import { assert, assertEventually, settle } from "../harness.mjs";

export default async function run(ctx) {
  const { page, state } = ctx;
  const files = page.locator('article[data-app-id="files"]');
  const runDialog = page.locator(".run-dialog");
  const terminal = page.locator('article[data-app-id="terminal"]');
  // Every close path must consult the app's guard, not just the title bar's ✕.
  // Notepad autosaves 850ms after a keystroke, so each case re-dirties the
  // document immediately before closing.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const guardNotepad = page.locator('article[data-app-id="notepad"]').first();
  await guardNotepad.waitFor({ state: "visible" });
  const guardEditor = guardNotepad.getByLabel("메모 내용");
  const closePrompt = page.getByRole("alertdialog");

  for (const path of ["close-button", "alt-f4", "system-menu"]) {
    await guardEditor.fill(`GUARD ${path}`);
    if (path === "close-button") {
      await guardNotepad.getByRole("button", { name: "메모장 닫기" }).click();
    } else if (path === "alt-f4") {
      await guardEditor.click();
      await page.keyboard.press("Alt+F4");
    } else {
      const titlebarBox = await guardNotepad.locator(".window-titlebar").boundingBox();
      await guardNotepad.locator(".window-titlebar").dispatchEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: titlebarBox.x + 80,
        clientY: titlebarBox.y + 16,
      });
      await page.locator(".window-system-menu").waitFor({ state: "visible" });
      await page.locator(".window-system-menu").getByRole("menuitem", { name: "닫기" }).click();
    }
    await closePrompt.waitFor({ state: "visible" });
    await closePrompt.getByRole("button", { name: "취소" }).click();
    await closePrompt.waitFor({ state: "hidden" });
    assert(
      (await guardNotepad.count()) === 1,
      `Cancelling the ${path} prompt still closed the window`,
    );
  }

  await guardEditor.fill("GUARD DISCARD");
  await guardNotepad.getByRole("button", { name: "메모장 닫기" }).click();
  await closePrompt.waitFor({ state: "visible" });
  await closePrompt.getByRole("button", { name: "저장 안 함" }).click();
  await guardNotepad.waitFor({ state: "detached" });

  // Settings must fit its window and scroll when it does not. Its grid used to
  // grow past the content box, which clips, so the content pane never had a
  // bounded track and 86px of 개인 설정 was unreachable on first open.
  await page.keyboard.press("Meta+i");
  const settingsWindow = page.locator('article[data-app-id="settings"]');
  await settingsWindow.waitFor({ state: "visible" });
  const settingsFit = await settingsWindow.evaluate((frame) => {
    const content = frame.querySelector(".window-content");
    const app = frame.querySelector(".settings-app");
    if (!content || !app) return null;
    return Math.round(
      app.getBoundingClientRect().height - content.getBoundingClientRect().height,
    );
  });
  assert(
    settingsFit !== null && settingsFit <= 1,
    `Settings escaped its window by ${settingsFit}px`,
  );
  // An earlier step may have left another section showing; 개인 설정 is the one
  // whose content exceeds the window.
  await settingsWindow.getByRole("button", { name: "개인 설정" }).click();
  await settle(page);
  const settingsPane = settingsWindow.locator(".settings-content");
  await settingsPane.hover();
  await page.mouse.wheel(0, 400);
  await assertEventually(
    async () => (await settingsPane.evaluate((el) => el.scrollTop)) > 0,
    async () => "Settings content did not scroll",
  );

  /*
   * 배경 > 슬라이드 쇼. The desktop kept one picture until it was changed by
   * hand. Starting the show keeps a wallpaper that is already in the album,
   * 다음 바탕 화면 배경 on the desktop's menu moves to the album's next
   * picture at once, and 사진 stops it and brings the gallery back. The
   * timer itself is measured on a controlled clock outside this run — a
   * minute is the shortest interval, too long to wait out here.
   */
  const presetShown = () =>
    page
      .locator("main.desktop")
      .evaluate(
        (node) =>
          /wallpapers\/([a-z-]+)\.jpg/.exec(
            node.style.getPropertyValue("--wallpaper-image"),
          )?.[1] ?? null,
      );
  const galleryOrder = [
    "green-vista",
    "blue-ribbon",
    "aurora-lake",
    "dawn-lake",
    "sunny-field",
    "glass-wave",
    "misty-peak",
    "moon-coast",
  ];
  const openDesktopMenuAt = async () => {
    await page.locator(".desktop").dispatchEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 1150,
      clientY: 700,
    });
    const menu = page.locator(".desktop-context-menu").first();
    await menu.waitFor({ state: "visible" });
    return menu;
  };
  const backgroundMode = settingsWindow.getByRole("combobox", { exact: true, name: "배경" });
  const shownBefore = (await presetShown()) ?? galleryOrder[0];
  await backgroundMode.selectOption("slideshow");
  await assertEventually(
    async () =>
      (await settingsWindow.locator('.wallpaper-slideshow-strip [role="listitem"]').count()) ===
      8,
    async () => "The gallery album does not show its eight pictures",
  );
  assert(
    (await presetShown()) === shownBefore,
    `Starting the show swapped ${shownBefore} for ${await presetShown()}`,
  );
  let showMenu = await openDesktopMenuAt();
  await showMenu.getByRole("menuitem", { name: "다음 바탕 화면 배경" }).click();
  await settle(page);
  const expectedNext = galleryOrder[(galleryOrder.indexOf(shownBefore) + 1) % 8];
  assert(
    (await presetShown()) === expectedNext,
    `다음 바탕 화면 배경 went from ${shownBefore} to ${await presetShown()}, not ${expectedNext}`,
  );
  await backgroundMode.selectOption("picture");
  await assertEventually(
    async () => (await settingsWindow.locator(".wallpaper-options button").count()) === 8,
    async () => "사진 did not bring the gallery back",
  );
  showMenu = await openDesktopMenuAt();
  assert(
    !(await showMenu.innerText()).includes("다음 바탕 화면 배경"),
    "다음 바탕 화면 배경 stayed on the menu after the show stopped",
  );
  await page.keyboard.press("Escape");
  await showMenu.waitFor({ state: "detached" });
  await settingsWindow.getByRole("button", { name: "설정 닫기" }).click();
  await settle(page);

  // Hiding a window must not throw away what the app holds. Minimizing used to
  // unmount it, so an unsaved draft, the calculator display, terminal
  // scrollback and a game in progress were all lost — including on Win+D,
  // which is meant to be a peek.
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("notepad");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const draftNotepad = page.locator('article[data-app-id="notepad"]').first();
  await draftNotepad.waitFor({ state: "visible" });
  const draftEditor = draftNotepad.getByLabel("메모 내용");
  await draftEditor.fill("SMOKE UNSAVED DRAFT");

  // Windows marks an unsaved document with a leading asterisk and drops it
  // once the save lands. The title bar carried no dirty signal at all before.
  const draftTitle = draftNotepad.locator(".window-titlebar").first();
  await settle(page);
  const dirtyTitle = await draftTitle.innerText();
  assert(
    dirtyTitle.startsWith("*") && dirtyTitle.endsWith("- 메모장"),
    `Unsaved Notepad title lacked the asterisk: ${JSON.stringify(dirtyTitle)}`,
  );

  for (const hide of ["minimize", "Meta+m", "Meta+d"]) {
    if (hide === "minimize") {
      await draftNotepad.getByRole("button", { name: "메모장 최소화" }).click();
    } else {
      await page.keyboard.press(hide);
    }
    await settle(page);
    if (hide === "Meta+d") {
      await page.keyboard.press("Meta+d");
    } else {
      await page.locator(".taskbar-app", { hasText: "메모장" }).first().click();
    }
    await settle(page);
    assert(
      (await draftEditor.inputValue()) === "SMOKE UNSAVED DRAFT",
      `Hiding the window with ${hide} discarded the unsaved draft`,
    );
  }
  const savedTitle = await draftTitle.innerText();
  assert(
    !savedTitle.startsWith("*") && savedTitle.endsWith("- 메모장"),
    `Saved Notepad title kept the asterisk: ${JSON.stringify(savedTitle)}`,
  );

  await draftNotepad.getByRole("button", { name: "메모장 닫기" }).click();
  await settle(page);

  // A window shrunk to its own minimum must leave every control reachable —
  // either inside the content box, or scrollable into view. The calculator
  // used to lose its whole keypad to a single shared 320x240 floor.
  for (const [command, label, appId] of [
    ["calc", "계산기", "calculator"],
    ["mspaint", "그림판", "paint"],
    ["regedit", "레지스트리 편집기", "registry"],
    ["사진", "사진", "photos"],
  ]) {
    await page.keyboard.press("Control+Alt+R");
    await runDialog.waitFor({ state: "visible" });
    await runDialog.getByLabel("열기").fill(command);
    await runDialog.getByRole("button", { name: "확인" }).click();
    const shrinkTarget = page.locator(`article[data-app-id="${appId}"]`).first();
    await shrinkTarget.waitFor({ state: "visible" });

    const startBox = await shrinkTarget.boundingBox();
    await page.mouse.move(startBox.x + startBox.width - 2, startBox.y + startBox.height - 2);
    await page.mouse.down();
    await page.mouse.move(startBox.x + 40, startBox.y + 40, { steps: 8 });
    await page.mouse.up();
    await settle(page);

    const unreachable = await shrinkTarget.evaluate((frame) => {
      const content = frame.querySelector(".window-content");
      if (!content) return ["no content"];
      const box = content.getBoundingClientRect();
      const names = [];
      for (const el of content.querySelectorAll("button, input, select, a")) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const inside =
          rect.right <= box.right + 1 &&
          rect.bottom <= box.bottom + 1 &&
          rect.left >= box.left - 1;
        if (inside) continue;

        let node = el.parentElement;
        let scrollable = false;
        while (node && node !== content.parentElement) {
          const style = getComputedStyle(node);
          const scrolls = /(auto|scroll)/.test(style.overflowY + style.overflowX);
          if (
            scrolls &&
            (node.scrollHeight > node.clientHeight + 1 ||
              node.scrollWidth > node.clientWidth + 1)
          ) {
            scrollable = true;
            break;
          }
          node = node.parentElement;
        }
        if (!scrollable) {
          names.push((el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim());
        }
      }
      return names;
    });
    assert(
      unreachable.length === 0,
      `${label} at its minimum size hides ${unreachable.length} control(s): ${unreachable.slice(0, 4).join(", ")}`,
    );
    await shrinkTarget.getByRole("button", { name: `${label} 닫기` }).click();
    await settle(page);
  }

  await page.keyboard.press("Control+Shift+Escape");
  const taskManager = page.locator('article[data-app-id="taskmanager"]');
  await taskManager.waitFor({ state: "visible" });
  const terminalRow = taskManager.locator(".taskmgr-row", { hasText: "명령 프롬프트" }).first();
  await terminalRow.waitFor({ state: "visible" });
  const endTaskButton = taskManager.getByRole("button", { name: "작업 끝내기" });
  assert(await endTaskButton.isDisabled(), "End task is enabled before a process is selected");
  await terminalRow.click();
  assert(
    !(await endTaskButton.isDisabled()),
    "End task stayed disabled after selecting a process",
  );
  await endTaskButton.click();
  await terminal.waitFor({ state: "hidden" });

  await taskManager.getByRole("tab", { name: "성능" }).click();
  const cpuGraph = taskManager.locator(".taskmgr-graph").first();
  await cpuGraph.waitFor({ state: "visible" });
  // A flat sparkline has a zero-height box, so assert on the plotted points.
  const cpuPoints = await cpuGraph.locator("polyline").getAttribute("points");
  assert(
    typeof cpuPoints === "string" && cpuPoints.split(" ").length > 10,
    "Task Manager performance graph plotted no samples",
  );
  assert(
    (await taskManager.locator(".taskmgr-stats dd").count()) >= 3,
    "Task Manager performance stats are missing",
  );
  await taskManager.getByRole("tab", { name: "프로세스" }).click();

  const taskViewButton = page.getByRole("button", { name: /작업 보기/ });
  await taskViewButton.click();
  const taskView = page.locator(".task-view");
  await taskView.waitFor({ state: "visible" });
  assert(
    (await taskView.locator(".task-view-desktop").count()) === 1,
    "Task View started with more than one desktop",
  );
  await taskView.getByRole("button", { name: "새 데스크톱" }).click();
  await taskView.locator(".task-view-desktop").nth(1).waitFor({ state: "visible" });
  assert(
    (await taskView.locator(".task-view-desktop").count()) === 2,
    "New desktop button did not add a desktop",
  );
  // Windows creates the desktop and stays put; the current desktop's cards
  // are still the ones listed.
  // (A card count can drift here on its own: a window still closing when the
  // overview opened is gone a moment later. What must hold: the current
  // desktop stays current, and the new one starts empty.)
  const currentDesktops = await taskView
    .locator(".task-view-desktop")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-current")));
  assert(
    currentDesktops[0] === "true" &&
      (await taskView.locator(".task-view-desktop").nth(1).innerText()).includes("0개 창"),
    `Creating a desktop switched to it or moved windows (current ${JSON.stringify(currentDesktops)})`,
  );
  /*
   * 데스크톱 이름 바꾸기: Windows 11 renames a desktop in place in Task View.
   * The name replaces the number everywhere the number was — the card, its
   * ✕, and the taskbar's own button.
   */
  await taskView.getByRole("button", { name: "데스크톱 2 이름 바꾸기" }).click();
  const desktopNameField = taskView.getByRole("textbox", { name: /이름 바꾸기/ });
  await desktopNameField.waitFor({ state: "visible" });
  await desktopNameField.fill("게임");
  await desktopNameField.press("Enter");
  await assertEventually(
    async () =>
      (await taskView.locator(".task-view-desktop-label").nth(1).innerText()).startsWith(
        "게임",
      ),
    async () =>
      `이름 바꾸기 did not rename the desktop: ${await taskView.locator(".task-view-desktop-label").nth(1).innerText()}`,
  );
  assert(
    await taskView.getByRole("button", { name: "게임 닫기" }).count(),
    "The desktop's ✕ is still named after its number",
  );
  assert(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("pocket-desk-desktop-names-v1"))) ?? "[]",
    )[1] === "게임",
    "The desktop name was not written to storage",
  );

  await taskView.locator(".task-view-desktop").nth(1).click();
  await taskView.waitFor({ state: "hidden" });
  assert(
    await page.getByRole("button", { name: /작업 보기 \(게임, 2\/2\)/ }).count(),
    "The taskbar does not call the desktop by its name",
  );
  assert(
    !(await taskManager.isVisible()),
    "A window from desktop 1 is still rendered on desktop 2",
  );

  await page.keyboard.press("Meta+Control+ArrowLeft");
  await taskManager.waitFor({ state: "visible" });
  assert(
    await taskManager.isVisible(),
    "Switching back to desktop 1 did not restore its windows",
  );

  await taskViewButton.click();
  await taskView.waitFor({ state: "visible" });
  // Dragging a window card onto a desktop thumbnail moves the window there,
  // as in Windows; closing that desktop below brings the window back.
  const cardsOnDesktopOne = await taskView.locator(".task-view-card").count();
  const draggedCard = taskView.locator(".task-view-card").first();
  const draggedTitle = await draggedCard.locator(".task-view-card-title strong").innerText();
  await draggedCard.dragTo(taskView.locator(".task-view-desktop").nth(1));
  await settle(page);
  assert(
    (await taskView.locator(".task-view-card").count()) === cardsOnDesktopOne - 1,
    `Dragging ${draggedTitle} onto desktop 2 left it listed on desktop 1`,
  );
  assert(
    (await taskView.locator(".task-view-desktop").nth(1).innerText()).includes("1개 창"),
    "Desktop 2 does not count the dragged window",
  );
  // By position, not by name: a desktop can be renamed, and one was above.
  await taskView
    .locator(".task-view-desktop-slot")
    .nth(1)
    .locator(".task-view-desktop-close")
    .click();
  await settle(page);
  // The names move up with their desktops. 게임 was desktop 2 and is gone, so
  // nothing may be called 게임 any more — the name must not slide onto
  // whichever desktop took its place.
  assert(
    !(await taskView.locator(".task-view-desktop-label").first().innerText()).includes("게임"),
    "Closing a desktop handed its name to the one that replaced it",
  );
  await taskView.locator(".task-view-desktop").nth(1).waitFor({ state: "detached" });
  assert(
    (await taskView.locator(".task-view-desktop").count()) === 1,
    "Closing a desktop did not remove it",
  );
  await taskView.locator(".task-view-desktop").first().click();
  await taskView.waitFor({ state: "hidden" });

  await page.setViewportSize({ width: 390, height: 780 });
  await settle(page);
  const mobileExplorerSidebar = await files.locator("aside").boundingBox();
  assert(
    mobileExplorerSidebar && mobileExplorerSidebar.height >= 54,
    "Mobile Explorer navigation collapsed",
  );
  const visibleWindowBoxes = await page
    .locator(".window-frame:not(.window-thumbnail-clone):visible")
    .evaluateAll((frames) =>
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
  // Task View closes a window on Windows and stays open. Runs last, on a
  // window it opens itself, so it cannot pull a window out from under a
  // later step.
  await page.setViewportSize({ height: 820, width: 1280 });
  await settle(page);
  await page.keyboard.press("Control+Alt+R");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("calc");
  await runDialog.getByRole("button", { name: "확인" }).click();
  await page.locator('article[data-app-id="calculator"]').first().waitFor({ state: "visible" });
  await page.getByRole("button", { name: /작업 보기/ }).click();
  await page.locator(".task-view").waitFor({ state: "visible" });
  const cardsBefore = await page.locator(".task-view-card").count();
  // The window frame's own close button carries the same name, so scope the
  // click to the overlay.
  await page.locator(".task-view").getByRole("button", { name: "계산기 닫기" }).first().click();
  await assertEventually(
    async () => (await page.locator(".task-view-card").count()) === cardsBefore - 1,
    async () => "Closing a Task View card did not remove the window",
  );
  assert(
    await page.locator(".task-view").isVisible(),
    "Closing a Task View card dismissed Task View",
  );
  await page.keyboard.press("Escape");
  await page.locator(".task-view").waitFor({ state: "hidden" });
  Object.assign(state, {
    backgroundMode,
    cardsBefore,
    cardsOnDesktopOne,
    closePrompt,
    cpuGraph,
    cpuPoints,
    currentDesktops,
    desktopNameField,
    dirtyTitle,
    draftEditor,
    draftNotepad,
    draftTitle,
    draggedCard,
    draggedTitle,
    endTaskButton,
    expectedNext,
    galleryOrder,
    guardEditor,
    guardNotepad,
    hasHorizontalOverflow,
    mobileExplorerSidebar,
    openDesktopMenuAt,
    presetShown,
    savedTitle,
    settingsFit,
    settingsPane,
    settingsWindow,
    showMenu,
    shownBefore,
    taskManager,
    taskView,
    taskViewButton,
    terminalRow,
    visibleWindowBoxes,
  });
}
