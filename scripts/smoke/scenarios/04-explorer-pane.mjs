import { assert, assertEventually, settle } from "../harness.mjs";

export default async function run(ctx) {
  const { page, multiSelectModifier, state } = ctx;
  let rowsBeforeHide = state.rowsBeforeHide;
  const files = page.locator('article[data-app-id="files"]');
  const explorerSidebar = files.locator("aside");
  const workNote = files.locator(".file-list button", { hasText: "작업 메모.txt" });
  const fileContextMenu = page.getByRole("menu", { name: "파일 메뉴" });
  const propertiesDialog = files.getByRole("dialog", { name: "파일 속성" });
  const explorerRows = files.locator('.file-list button[role="option"]');
  const readProperties = async (rowText) => {
    await explorerRows.filter({ hasText: rowText }).first().click({ button: "right" });
    await fileContextMenu.getByRole("menuitem", { name: "속성" }).click();
    await propertiesDialog.waitFor({ state: "visible" });
    return propertiesDialog.innerText();
  };
  /*
   * 탐색 창. The pane was five fixed shortcuts side by side, so a folder you
   * made never appeared in it and nothing said where the window was. It is
   * the file system's own shape now — one root with the system folders
   * under it — and it follows the address bar.
   */
  const folderTree = files.locator('[aria-label="탐색 창"]');
  const treeRows = folderTree.locator('[role="treeitem"]');
  const readTree = () =>
    treeRows.evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          `${node.getAttribute("aria-level")}:${node.textContent.trim()}` +
          `${node.getAttribute("aria-expanded") === "true" ? "[open]" : ""}` +
          `${node.getAttribute("aria-selected") === "true" ? "*" : ""}`,
      ),
    );
  const tree = await readTree();
  assert(
    tree.filter((row) => row.startsWith("1:")).join() === "1:바탕 화면[open]*",
    `탐색 창 has roots ${JSON.stringify(tree.filter((row) => row.startsWith("1:")))}`,
  );
  assert(
    ["게임", "다운로드", "문서", "사진"].every((name) =>
      tree.some((row) => row.startsWith(`2:${name}`)),
    ),
    `The system folders are not one level under 바탕 화면: ${JSON.stringify(tree)}`,
  );
  // 프로젝트 was made inside 문서 earlier in this run. The old pane could
  // not show it at any depth; this one has it two levels down.
  assert(
    tree.some((row) => row.startsWith("3:프로젝트")),
    `탐색 창 did not reach 문서/프로젝트: ${JSON.stringify(tree)}`,
  );

  const documentsRow = folderTree.getByRole("treeitem", { name: "문서", exact: true });
  const projectRow = folderTree.getByRole("treeitem", { name: "프로젝트", exact: true });
  await documentsRow.locator(".file-tree-twisty").click();
  await projectRow.waitFor({ state: "detached" });
  await documentsRow.locator(".file-tree-twisty").click();
  await projectRow.waitFor();

  // The pane follows the window, and the single tab stop goes with the mark.
  await projectRow.click();
  await assertEventually(
    async () => (await projectRow.getAttribute("aria-selected")) === "true",
    async () => "탐색 창 did not mark the folder it had just opened",
  );
  assert(
    (await folderTree.locator('[tabindex="0"]').count()) === 1,
    "탐색 창 offered more than one tab stop",
  );

  // Left closes a branch and Right opens it again — including a branch the
  // window is standing inside, which an always-forced pane could not close.
  await folderTree.locator('[tabindex="0"]').first().focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  assert(
    (await treeRows.count()) === 1,
    `Left did not collapse 바탕 화면 — ${await treeRows.count()} rows left`,
  );
  await page.keyboard.press("ArrowRight");
  await documentsRow.waitFor();
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
  await settle(page);

  /*
   * 주소 표시줄의 ">" — Windows turns each separator into a way sideways.
   * The address bar clips its crumbs so a long path does not spill, which
   * also clipped this menu out of sight; it hangs off the row instead.
   */
  const crumbBar = files.locator(".file-address");
  await explorerRows.filter({ hasText: "문서" }).first().dblclick();
  await settle(page);
  await crumbBar.getByRole("button", { name: "바탕 화면 하위 폴더" }).click();
  const crumbMenu = files.locator(".file-breadcrumb-menu");
  await crumbMenu.waitFor({ state: "visible" });
  const crumbNames = await crumbMenu.getByRole("menuitem").allInnerTexts();
  assert(
    ["게임", "다운로드", "문서", "사진"].every((name) => crumbNames.includes(name)),
    `The crumb menu listed ${JSON.stringify(crumbNames)}`,
  );
  const menuBox = await crumbMenu.boundingBox();
  const windowBox = await files.boundingBox();
  assert(
    menuBox.width > 0 &&
      menuBox.x >= windowBox.x &&
      menuBox.x + menuBox.width <= windowBox.x + windowBox.width,
    `The crumb menu is not inside its window (${JSON.stringify(menuBox)})`,
  );
  // Escape closes it and goes nowhere.
  await page.keyboard.press("Escape");
  await crumbMenu.waitFor({ state: "detached" });
  assert(
    (await crumbBar.innerText()).includes("문서"),
    "Escape on the crumb menu moved the window",
  );
  // Picking a neighbour goes there without walking back up first.
  await crumbBar.getByRole("button", { name: "바탕 화면 하위 폴더" }).click();
  await crumbMenu.waitFor({ state: "visible" });
  await crumbMenu.getByRole("menuitem", { name: "사진", exact: true }).click();
  await crumbMenu.waitFor({ state: "detached" });
  await assertEventually(
    async () =>
      (await crumbBar.innerText()).includes("사진") &&
      !(await crumbBar.innerText()).includes("문서"),
    async () =>
      `The crumb menu did not move the window: ${(await crumbBar.innerText()).replace(/\n/g, " > ")}`,
  );
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
  await settle(page);

  /*
   * 열 너비. The three trailing columns were hard-coded, so 유형 showed
   * "인터넷 바로 가…" with no way to widen it. 이름 is still the track that
   * absorbs the pane — widening 유형 takes the space from 이름 — which is
   * what keeps this list free of the sideways scroll its header, a sibling
   * of the scroller, could not follow.
   */
  const typeGrip = files.locator('.file-column-grip[data-column="type"]');
  const columnEdges = async () => {
    const head = await files.locator(".file-column-head").nth(2).boundingBox();
    const cell = await explorerRows
      .first()
      .evaluate((row) => row.children[3].getBoundingClientRect().left);
    return { cell: Math.round(cell), head: Math.round(head.x) };
  };
  const typeCellWidth = () =>
    explorerRows
      .first()
      .evaluate((row) => Math.round(row.children[3].getBoundingClientRect().width));

  const edgesBefore = await columnEdges();
  assert(
    Math.abs(edgesBefore.head - edgesBefore.cell) <= 2,
    `The 유형 heading stands at ${edgesBefore.head} over a column at ${edgesBefore.cell}`,
  );
  const typeBefore = await typeCellWidth();
  // Narrowed rather than widened: 이름 has a 96px floor, and in a window
  // this size it is already close enough to it that widening 유형 has
  // almost nowhere to take the space from.
  const gripBox = await typeGrip.boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2 - 40, gripBox.y + gripBox.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await settle(page);
  const typeAfter = await typeCellWidth();
  assert(
    typeAfter <= typeBefore - 30,
    `Dragging the 유형 grip 40px left took it from ${typeBefore} to ${typeAfter}`,
  );
  const edgesAfter = await columnEdges();
  assert(
    Math.abs(edgesAfter.head - edgesAfter.cell) <= 2,
    `The heading drifted off its column after a resize (${edgesAfter.head} vs ${edgesAfter.cell})`,
  );
  assert(
    JSON.parse(await page.evaluate(() => localStorage.getItem("pocket-desk-file-columns-v1")))
      .type === typeAfter,
    "The resized width was not written down",
  );
  // The keyboard drives the same separator, and Home puts it back.
  await typeGrip.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await settle(page);
  assert(
    (await typeCellWidth()) === typeAfter + 32,
    `Shift+Right moved 유형 from ${typeAfter} to ${await typeCellWidth()}`,
  );
  await page.keyboard.press("Home");
  await assertEventually(
    async () => (await typeCellWidth()) === typeBefore,
    async () => `Home did not put 유형 back (${await typeCellWidth()} vs ${typeBefore})`,
  );

  /*
   * 열 선택. Right-clicking the heading is Explorer's column chooser: 유형
   * leaves the heading and every row together, and is written down so it
   * stays off. 이름 is the one column that cannot go.
   */
  const openColumnMenu = async () => {
    await files
      .locator(".file-list-header")
      .click({ button: "right", position: { x: 300, y: 12 } });
    const menu = page.locator(".file-column-menu");
    await menu.waitFor({ state: "visible" });
    return menu;
  };
  const headingLabels = () => files.locator(".file-column-head > button").allInnerTexts();
  let columnMenu = await openColumnMenu();
  assert(
    await columnMenu.getByRole("menuitemcheckbox", { name: "이름" }).isDisabled(),
    "이름 could be taken off the heading",
  );
  await columnMenu.getByRole("menuitemcheckbox", { name: "유형" }).click();
  await settle(page);
  assert(!(await columnMenu.isVisible()), "The column menu stayed open after a pick");
  assert(
    !(await headingLabels()).some((label) => label.includes("유형")),
    `유형 is still on the heading: ${(await headingLabels()).join(" | ")}`,
  );
  const cellsWithoutType = await explorerRows.first().locator("small").count();
  assert(cellsWithoutType === 2, `A row still has ${cellsWithoutType} detail cells`);
  assert(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("pocket-desk-file-hidden-columns-v1")),
    ).includes("type"),
    "The hidden column was not written down",
  );

  /*
   * 항목 확인란. A box at the head of every row selects without a modifier —
   * the way to multi-select with a pointer alone — and the heading's
   * 모두 선택 box shows a part selection as a dash.
   */
  const toggleItemCheckboxes = async () => {
    await files.getByRole("button", { name: "보기 옵션" }).click();
    await files
      .locator(".file-options-menu")
      .getByRole("menuitemcheckbox", { name: "항목 확인란" })
      .click();
    await settle(page);
  };
  await toggleItemCheckboxes();
  const selectedRows = files.locator('[role="option"][aria-selected="true"]');
  await explorerRows.nth(0).locator(".file-row-check").click();
  await explorerRows.nth(2).locator(".file-row-check").click();
  await settle(page);
  assert(
    (await selectedRows.count()) === 2,
    `Two box clicks left ${await selectedRows.count()} rows selected`,
  );
  const selectAll = files.getByLabel("모두 선택");
  assert(
    await selectAll.evaluate((input) => input.indeterminate),
    "모두 선택 did not show the part selection",
  );
  const boxEdges = await page.evaluate(() => {
    const left = (el) => Math.round(el.getBoundingClientRect().left);
    const heads = document.querySelectorAll(".file-list-header .file-column-head");
    const row = document.querySelector('.file-list [role="option"]');
    return {
      all: left(document.querySelector(".file-select-all")),
      box: left(row.querySelector(".file-row-check")),
      head: left(heads[1]),
      cell: left(row.querySelector("small")),
    };
  });
  assert(
    Math.abs(boxEdges.all - boxEdges.box) <= 1 && Math.abs(boxEdges.head - boxEdges.cell) <= 2,
    `The boxes or the headings sit off their column: ${JSON.stringify(boxEdges)}`,
  );
  await selectAll.check();
  await settle(page);
  assert(
    (await selectedRows.count()) === (await explorerRows.count()),
    `모두 선택 selected ${await selectedRows.count()} of ${await explorerRows.count()}`,
  );
  await selectAll.uncheck();
  await settle(page);
  assert((await selectedRows.count()) === 0, "Clearing 모두 선택 left rows selected");
  await toggleItemCheckboxes();
  assert(
    (await files.locator(".file-row-check").count()) === 0,
    "The boxes stayed after 항목 확인란 was turned off",
  );
  columnMenu = await openColumnMenu();
  await columnMenu.getByRole("menuitemcheckbox", { name: "유형" }).click();
  await assertEventually(
    async () => (await headingLabels()).some((label) => label.includes("유형")),
    async () => "유형 did not come back",
  );

  /*
   * Ctrl+드래그 = 복사. Every drop used to move whatever was held. The
   * modifier is read at the moment of the drop, so it can be pressed after
   * the drag has started, and the cursor's badge follows it.
   *
   * Driven with the platform's own copy modifier: on macOS a Ctrl+left
   * press is a secondary click, so Ctrl never reaches the drag there. Both
   * keys land on the same boolean, which the unit tests pin either way.
   */
  const dragFileOnto = async (source, target, modifier) => {
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2 + 8, {
      steps: 4,
    });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2, { steps: 2 });
    await page.mouse.up();
    if (modifier) await page.keyboard.up(modifier);
    await settle(page);
  };

  const copyDragSource = explorerRows.filter({ hasText: "web-surf.url" }).first();
  await copyDragSource.waitFor();
  await dragFileOnto(copyDragSource, explorerRows.filter({ hasText: "사진" }).first(), null);
  await copyDragSource.waitFor({ state: "detached" });
  await explorerSidebar.getByRole("treeitem", { name: "사진", exact: true }).click();
  await settle(page);
  const movedShortcut = explorerRows.filter({ hasText: "web-surf.url" }).first();
  await movedShortcut.waitFor();
  // Now copy it back to 바탕 화면 with the modifier held: it stays here too.
  await dragFileOnto(
    movedShortcut,
    explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }),
    multiSelectModifier,
  );
  assert(
    (await explorerRows.filter({ hasText: "web-surf.url" }).count()) === 1,
    "A copy drag took the original with it",
  );
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
  await assertEventually(
    async () => (await explorerRows.filter({ hasText: "web-surf.url" }).count()) === 1,
    async () => "The copy never arrived on 바탕 화면",
  );
  // Put it back where the later steps expect it: one copy, on 바탕 화면.
  await explorerSidebar.getByRole("treeitem", { name: "사진", exact: true }).click();
  await settle(page);
  await explorerRows.filter({ hasText: "web-surf.url" }).first().click();
  await page.keyboard.press("Delete");
  await explorerRows.filter({ hasText: "web-surf.url" }).first().waitFor({ state: "detached" });
  await explorerSidebar.getByRole("treeitem", { name: "바탕 화면", exact: true }).click();
  await settle(page);

  // Windows' own chords: Ctrl+Shift+N makes a folder, Alt+Enter opens 속성.
  const rowsBeforeChord = await explorerRows.count();
  await files.locator(".file-list").click({ position: { x: 320, y: 320 } });
  await page.keyboard.press("Control+Shift+KeyN");
  await settle(page);
  await page.keyboard.press("Escape");
  await assertEventually(
    async () => (await explorerRows.count()) === rowsBeforeChord + 1,
    async () =>
      `Ctrl+Shift+N did not make a folder (${rowsBeforeChord} -> ${await explorerRows.count()})`,
  );
  await explorerRows.filter({ hasText: "새 폴더" }).first().click();
  await page.keyboard.press("Alt+Enter");
  const chordProperties = files.locator(".file-properties-dialog");
  await chordProperties.waitFor({ state: "visible" });
  assert(
    (await chordProperties.innerText()).includes("새 폴더"),
    "Alt+Enter opened the properties of something else",
  );
  await page.keyboard.press("Escape");
  await chordProperties.waitFor({ state: "detached" });
  await explorerRows.filter({ hasText: "새 폴더" }).first().click();
  await page.keyboard.press("Delete");
  await explorerRows.filter({ hasText: "새 폴더" }).first().waitFor({ state: "detached" });

  /*
   * A rename onto a name the folder already has is refused, as Windows
   * refuses it. This quietly invented "web-surf 2.url" for a file renamed
   * to "web-surf.url" — a name nobody asked for, and nothing said so.
   */
  await files.getByRole("button", { name: "새로 만들기" }).first().click();
  await files.getByRole("menuitem", { name: "텍스트 문서", exact: true }).click();
  const clashRow = explorerRows.filter({ hasText: "새 텍스트 문서" }).first();
  await clashRow.waitFor();
  const clashBox = files.locator(".file-inline-rename input");
  await clashBox.waitFor({ state: "visible" });
  await clashBox.fill("web-surf.url");
  await clashBox.press("Enter");
  await settle(page);
  assert(
    (await explorerRows.filter({ hasText: "web-surf 2" }).count()) === 0,
    "The rename invented a name of its own",
  );
  assert(
    (await clashBox.count()) === 1 && (await clashBox.inputValue()) === "web-surf.url",
    "The refused rename closed its own box and threw the text away",
  );
  assert(
    (await page.locator(".toast", { hasText: "같은 이름의 항목이 이미 있습니다" }).count()) > 0,
    "Nothing said why the rename was refused",
  );
  // A free name still goes through, from the same box.
  await clashBox.fill("이름 충돌 검사.txt");
  await clashBox.press("Enter");
  await explorerRows.filter({ hasText: "이름 충돌 검사.txt" }).first().waitFor();
  await explorerRows.filter({ hasText: "이름 충돌 검사.txt" }).first().click();
  await page.keyboard.press("Delete");
  await explorerRows
    .filter({ hasText: "이름 충돌 검사.txt" })
    .first()
    .waitFor({ state: "detached" });

  /*
   * 여러 항목 이름 바꾸기. F2 on a selection did nothing at all — the box
   * only ever opened for one row. One name typed now numbers the whole set,
   * the way Windows does, and one Ctrl+Z puts all of them back.
   */
  const bulkNames = ["묶음 하나.txt", "묶음 둘.txt"];
  for (const bulkName of bulkNames) {
    await files.getByRole("button", { name: "새로 만들기" }).first().click();
    await files.getByRole("menuitem", { name: "텍스트 문서", exact: true }).click();
    const newBox = files.locator(".file-inline-rename input");
    await newBox.waitFor({ state: "visible" });
    await newBox.fill(bulkName);
    await newBox.press("Enter");
    await explorerRows.filter({ hasText: bulkName }).first().waitFor();
  }
  await explorerRows.filter({ hasText: bulkNames[0] }).first().click();
  await explorerRows
    .filter({ hasText: bulkNames[1] })
    .first()
    .click({ modifiers: [multiSelectModifier] });
  await page.keyboard.press("F2");
  const bulkBox = files.locator(".file-inline-rename input");
  await bulkBox.waitFor({ state: "visible" });
  await bulkBox.fill("묶음 이름");
  await bulkBox.press("Enter");
  await explorerRows.filter({ hasText: "묶음 이름 (2).txt" }).first().waitFor();
  assert(
    (await explorerRows.filter({ hasText: "묶음 이름 (1).txt" }).count()) === 1,
    "The numbered run did not start at (1)",
  );
  // One write, so one undo: renaming them one at a time would leave a stack
  // of steps for what was done once.
  await explorerRows.first().click();
  await page.keyboard.press("Control+z");
  await explorerRows.filter({ hasText: bulkNames[0] }).first().waitFor();
  assert(
    (await explorerRows.filter({ hasText: bulkNames[1] }).count()) === 1,
    "One undo took back only part of the bulk rename",
  );
  for (const bulkName of bulkNames) {
    await explorerRows.filter({ hasText: bulkName }).first().click();
    await page.keyboard.press("Delete");
    await explorerRows.filter({ hasText: bulkName }).first().waitFor({ state: "detached" });
  }

  /*
   * Explorer's hand habits: Ctrl+wheel walks the view sizes, a middle click
   * opens a folder in a new tab, and Shift+Delete skips the 휴지통 after the
   * shell has asked.
   */
  const habitList = files.locator(".file-list");
  const habitViewClass = () => habitList.getAttribute("class");
  await habitList.hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -240);
  await settle(page);
  assert(
    (await habitViewClass()).includes("file-view-list"),
    `Ctrl+wheel up gave ${await habitViewClass()}`,
  );
  await page.mouse.wheel(0, -240);
  await settle(page);
  assert(
    (await habitViewClass()).includes("file-view-icons"),
    `A second notch gave ${await habitViewClass()}`,
  );
  await page.mouse.wheel(0, -240);
  await settle(page);
  assert(
    (await habitViewClass()).includes("file-view-icons"),
    "Ctrl+wheel wrapped round instead of holding at the largest size",
  );
  await page.mouse.wheel(0, 240);
  await page.mouse.wheel(0, 240);
  await page.keyboard.up("Control");
  await assertEventually(
    async () => (await habitViewClass()).includes("file-view-details"),
    async () => `Ctrl+wheel down did not come back to 자세히: ${await habitViewClass()}`,
  );

  const habitTabs = files.locator('[role="tab"]');
  const tabsBeforeMiddleClick = await habitTabs.count();
  await explorerRows.filter({ hasText: "문서" }).first().click({ button: "middle" });
  await assertEventually(
    async () => (await habitTabs.count()) === tabsBeforeMiddleClick + 1,
    async () => "A middle click on a folder did not open a tab",
  );
  // On a file it does nothing, as in Explorer.
  await habitTabs.first().click();
  await settle(page);
  await explorerRows.filter({ hasText: "web-surf.url" }).first().click({ button: "middle" });
  await settle(page);
  assert(
    (await habitTabs.count()) === tabsBeforeMiddleClick + 1,
    "A middle click on a file opened a tab",
  );
  await habitTabs.last().click();
  await settle(page);
  await page.keyboard.press("Control+w");
  await settle(page);
  assert(
    (await habitTabs.count()) === tabsBeforeMiddleClick,
    "The tab the middle click opened did not close again",
  );

  /*
   * Shift+Delete asks first, and what it takes does not reach the 휴지통.
   * On its own scratch folder, because this one does not come back.
   */
  await habitList.click({ position: { x: 320, y: 320 } });
  await page.keyboard.press("Control+Shift+KeyN");
  await explorerRows.filter({ hasText: "새 폴더" }).first().waitFor();
  // The new folder opens its rename box a frame later; pressing Escape
  // before it mounts leaves the box up and swallows the next chord.
  const habitRename = files.locator(".file-inline-rename input");
  await habitRename.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await habitRename.waitFor({ state: "detached" });
  const binIcon = page.locator(".desktop-icon", { hasText: "휴지통" }).first();
  const binBefore = await binIcon.getAttribute("aria-label");
  // By id, not by name: an earlier step deleted a folder of the same name
  // into the 휴지통, and undoing *that* is correct.
  const doomedId = await explorerRows
    .filter({ hasText: "새 폴더" })
    .first()
    .getAttribute("data-file-id");
  await explorerRows.filter({ hasText: "새 폴더" }).first().click();
  await page.keyboard.press("Shift+Delete");
  const permanentDialog = page.locator('[aria-labelledby="permanent-delete-title"]');
  await permanentDialog.waitFor({ state: "visible" });
  assert(
    (await permanentDialog.innerText()).includes("새 폴더"),
    "The permanent-delete question did not name what it would take",
  );
  // 취소 holds the focus: the other answer cannot be undone. Waited for
  // rather than sampled — the dialog claims focus on the next frame.
  await page
    .waitForFunction(() => document.activeElement?.textContent?.trim() === "취소", null, {
      timeout: 4000,
    })
    .catch(() => {
      throw new Error(
        `The permanent-delete dialog left focus on ${JSON.stringify(
          document.title,
        )} instead of 취소`,
      );
    });
  await page.keyboard.press("Escape");
  await permanentDialog.waitFor({ state: "detached" });
  await explorerRows.filter({ hasText: "새 폴더" }).first().waitFor();

  // Ask again from the list, not from wherever the dialog left focus.
  await explorerRows.filter({ hasText: "새 폴더" }).first().click();
  await page.keyboard.press("Shift+Delete");
  await permanentDialog.waitFor({ state: "visible" });
  await permanentDialog.getByRole("button", { name: "완전히 삭제" }).click();
  await explorerRows.filter({ hasText: "새 폴더" }).first().waitFor({ state: "detached" });
  assert(
    (await binIcon.getAttribute("aria-label")) === binBefore,
    `Shift+Delete still went through the 휴지통: ${binBefore} -> ${await binIcon.getAttribute("aria-label")}`,
  );
  // And nothing on the undo stack claims it can bring that back.
  await explorerRows.first().click();
  await page.keyboard.press("Control+z");
  await settle(page);
  assert(
    (await files.locator(`[data-file-id="${doomedId}"]`).count()) === 0,
    "실행 취소 resurrected a permanently deleted folder",
  );
  // That Ctrl+Z took back the step under it — a real one, from earlier —
  // so put it back before the next step counts these rows.
  await page.keyboard.press("Control+y");
  await settle(page);

  // Put the note back on show for the steps that follow.
  await readProperties("작업 메모.txt");
  await propertiesDialog.getByLabel("숨김").uncheck();
  await propertiesDialog.getByRole("button", { name: "확인" }).click();
  await settle(page);
  await files.getByRole("button", { name: "보기 옵션" }).click();
  await files.getByRole("menuitemcheckbox", { name: "숨긴 항목" }).click();
  await page.keyboard.press("Escape");
  await assertEventually(
    async () => (await explorerRows.count()) === rowsBeforeHide,
    async () => "The note did not come back once it was unhidden",
  );

  await workNote.click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const copiedWorkNote = files.locator(".file-list button", {
    hasText: "작업 메모 - 복사본.txt",
  });
  await copiedWorkNote.waitFor({ state: "visible" });
  assert(
    (await copiedWorkNote.count()) === 1,
    "Explorer copy/paste did not create one persisted copy",
  );
  await settle(page);
  const copiedFilePersisted = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("pocket-desk-vfs");
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("entries", "readonly");
          const allEntries = transaction.objectStore("entries").getAll();
          allEntries.onerror = () => resolve(false);
          allEntries.onsuccess = () => {
            resolve(allEntries.result.some((entry) => entry.name === "작업 메모 - 복사본.txt"));
            database.close();
          };
        };
      }),
  );
  assert(copiedFilePersisted, "Explorer copy was not persisted to IndexedDB");

  const vfsMetadata = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("pocket-desk-vfs");
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("meta")) {
            database.close();
            resolve(null);
            return;
          }
          const transaction = database.transaction(["entries", "meta"], "readonly");
          const entriesRequest = transaction.objectStore("entries").count();
          const metaRequest = transaction.objectStore("meta").get("snapshot");
          transaction.oncomplete = () => {
            resolve({
              databaseVersion: database.version,
              entryCount: entriesRequest.result,
              metadata: metaRequest.result,
            });
            database.close();
          };
          transaction.onerror = () => {
            database.close();
            resolve(null);
          };
        };
      }),
  );
  assert(
    vfsMetadata?.databaseVersion === 2,
    "VFS database did not migrate to schema version 2",
  );
  assert(vfsMetadata?.metadata?.schemaVersion === 2, "VFS snapshot metadata is missing");
  assert(
    vfsMetadata?.metadata?.entryCount === vfsMetadata?.entryCount,
    "VFS snapshot metadata count does not match persisted entries",
  );

  const explorerFileCountBeforeInvalidImport = await files.locator(".file-list button").count();
  await files.locator('input[type="file"][accept*=".zip"]').setInputFiles({
    buffer: Buffer.from("not-a-pocketdesk-zip"),
    mimeType: "application/zip",
    name: "damaged-backup.zip",
  });
  await page.getByText("ZIP 가져오기 실패", { exact: true }).waitFor({ state: "visible" });
  assert(
    (await files.locator(".file-list button").count()) === explorerFileCountBeforeInvalidImport,
    "Invalid ZIP import replaced the current VFS state",
  );

  await page.keyboard.press("Control+Alt+R");
  const runDialog = page.locator(".run-dialog");
  await runDialog.waitFor({ state: "visible" });
  await runDialog.getByLabel("열기").fill("calc");
  await runDialog.getByRole("button", { name: "확인" }).click();
  const calculator = page.locator('article[data-app-id="calculator"]');
  await calculator.waitFor({ state: "visible" });
  for (const key of ["7", "+", "5", "="]) {
    await calculator.getByRole("button", { name: key, exact: true }).click();
  }
  assert(
    (await calculator.getByLabel("계산기 표시창").innerText()) === "12",
    "Calculator result is wrong",
  );
  await calculator.getByRole("button", { name: "M+", exact: true }).click();
  await calculator.getByRole("button", { name: "C", exact: true }).click();
  await calculator.getByRole("button", { name: "MR", exact: true }).click();
  assert(
    (await calculator.getByLabel("계산기 표시창").innerText()) === "12",
    "Calculator memory recall failed",
  );
  await calculator.getByRole("button", { name: "기록", exact: true }).click();
  assert(
    (await calculator.locator(".calc-history-panel").innerText()).includes("7+5"),
    "Calculator history is empty",
  );
  Object.assign(state, {
    binBefore,
    binIcon,
    boxEdges,
    bulkBox,
    bulkNames,
    calculator,
    cellsWithoutType,
    chordProperties,
    clashBox,
    clashRow,
    columnEdges,
    columnMenu,
    copiedFilePersisted,
    copiedWorkNote,
    copyDragSource,
    crumbBar,
    crumbMenu,
    crumbNames,
    documentsRow,
    doomedId,
    dragFileOnto,
    edgesAfter,
    edgesBefore,
    explorerFileCountBeforeInvalidImport,
    folderTree,
    gripBox,
    habitList,
    habitRename,
    habitTabs,
    habitViewClass,
    headingLabels,
    menuBox,
    movedShortcut,
    openColumnMenu,
    permanentDialog,
    projectRow,
    readTree,
    rowsBeforeChord,
    runDialog,
    selectAll,
    selectedRows,
    tabsBeforeMiddleClick,
    toggleItemCheckboxes,
    tree,
    treeRows,
    typeAfter,
    typeBefore,
    typeCellWidth,
    typeGrip,
    vfsMetadata,
    windowBox,
  });
}
