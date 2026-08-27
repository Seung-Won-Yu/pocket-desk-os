// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MinesweeperApp from "./MinesweeperApp";

function renderMinesweeper() {
  const playSound = vi.fn();
  render(<MinesweeperApp playSound={playSound} />);
  return { playSound, user: userEvent.setup() };
}

function getCells() {
  return screen.getAllByRole("gridcell");
}

/** Index of the cell holding the board's single tab stop, or -1 if there is none. */
function getTabStopIndex(cells: HTMLElement[]) {
  return cells.findIndex((cell) => cell.getAttribute("tabindex") === "0");
}

/** Clicks cells until the game ends, which is the only way to open the dialog. */
async function playUntilResult(user: ReturnType<typeof userEvent.setup>) {
  for (const cell of getCells()) {
    if (screen.queryByRole("dialog") !== null) break;
    await user.click(cell);
  }
  return screen.getByRole("dialog");
}

beforeEach(() => {
  // Mines are seeded with Math.random on the first reveal. Pinning it the way
  // scripts/smoke-test.mjs does makes the board reproducible.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("MinesweeperApp 보드 구조", () => {
  it("칸을 행으로 묶고 그리드에 행·열 수를 적는다", () => {
    renderMinesweeper();

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", "9");
    expect(grid).toHaveAttribute("aria-colcount", "9");

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(9);
    rows.forEach((row) => {
      expect(within(row).getAllByRole("gridcell")).toHaveLength(9);
    });
    expect(getCells()).toHaveLength(81);
  });

  it("칸마다 1부터 세는 행·열 좌표를 붙인다", () => {
    renderMinesweeper();
    const cells = getCells();

    expect(cells[0]).toHaveAttribute("aria-rowindex", "1");
    expect(cells[0]).toHaveAttribute("aria-colindex", "1");
    expect(cells[8]).toHaveAttribute("aria-rowindex", "1");
    expect(cells[8]).toHaveAttribute("aria-colindex", "9");
    expect(cells[9]).toHaveAttribute("aria-rowindex", "2");
    expect(cells[9]).toHaveAttribute("aria-colindex", "1");
    expect(cells[40]).toHaveAttribute("aria-rowindex", "5");
    expect(cells[40]).toHaveAttribute("aria-colindex", "5");
    expect(cells[80]).toHaveAttribute("aria-rowindex", "9");
    expect(cells[80]).toHaveAttribute("aria-colindex", "9");
    expect(screen.getAllByRole("row")[3]).toHaveAttribute("aria-rowindex", "4");
  });
});

describe("MinesweeperApp 보드 키보드 이동", () => {
  it("보드 전체가 탭 정지 한 곳이다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    expect(cells.filter((cell) => cell.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(getTabStopIndex(cells)).toBe(0);

    screen.getByRole("button", { name: "깃발 모드" }).focus();
    await user.tab();
    expect(cells[0]).toHaveFocus();

    // One more Tab has to leave the board instead of walking the other 80 cells.
    await user.tab();
    expect(cells.some((cell) => cell === document.activeElement)).toBe(false);
  });

  it("방향키가 한 칸씩, 위아래로는 한 행씩 활성 칸을 옮긴다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    cells[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(cells[1]).toHaveFocus();
    expect(cells[1]).toHaveAttribute("tabindex", "0");
    expect(cells[0]).toHaveAttribute("tabindex", "-1");
    expect(getTabStopIndex(getCells())).toBe(1);

    await user.keyboard("{ArrowDown}");
    expect(cells[10]).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(cells[19]).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(cells[10]).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(cells[9]).toHaveFocus();
  });

  it("맨 윗행과 맨 아랫행에서 행 이동이 멈춘다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    cells[4].focus();
    await user.keyboard("{ArrowUp}");
    expect(cells[4]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(4);

    cells[76].focus();
    await user.keyboard("{ArrowDown}");
    expect(cells[76]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(76);
  });

  it("행 끝에서 좌우 방향키는 다음 행으로 이어진다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    cells[8].focus();
    await user.keyboard("{ArrowRight}");
    expect(cells[9]).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(cells[8]).toHaveFocus();
  });

  it("Home과 End가 보드의 처음과 끝으로 간다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    cells[40].focus();
    await user.keyboard("{Home}");
    expect(cells[0]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(0);

    await user.keyboard("{End}");
    expect(cells[80]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(80);
  });

  it("난이도를 바꾸면 행 이동 폭도 그 열 수를 따른다", async () => {
    const { user } = renderMinesweeper();

    await user.selectOptions(screen.getByRole("combobox", { name: "지뢰찾기 난이도" }), "hard");

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", "16");
    expect(grid).toHaveAttribute("aria-colcount", "30");
    expect(screen.getAllByRole("row")).toHaveLength(16);

    const cells = getCells();
    expect(cells).toHaveLength(480);
    expect(cells.filter((cell) => cell.getAttribute("tabindex") === "0")).toHaveLength(1);

    cells[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(cells[30]).toHaveFocus();
    expect(cells[30]).toHaveAttribute("aria-rowindex", "2");
    expect(cells[30]).toHaveAttribute("aria-colindex", "1");

    await user.keyboard("{End}");
    expect(cells[479]).toHaveFocus();
    expect(cells[479]).toHaveAttribute("aria-rowindex", "16");
    expect(cells[479]).toHaveAttribute("aria-colindex", "30");
  });
});

describe("MinesweeperApp 키보드 조작", () => {
  it("Enter로 칸을 열고 활성 칸을 그대로 둔다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    cells[0].focus();
    await user.keyboard("{Enter}");

    // The first reveal seeds mines away from the clicked cell and its
    // neighbours, so this one is always a safe zero.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cells[0]).toHaveClass("is-open");
    expect(cells[0]).toHaveAccessibleName("1번 칸, 0");
    expect(cells[0]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(0);
  });

  it("방향키로 옮긴 칸도 스페이스로 열린다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    cells[40].focus();
    await user.keyboard("{ArrowDown}{ArrowRight} ");

    expect(cells[50]).toHaveClass("is-open");
    expect(cells[50]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(50);
  });

  it("깃발 모드에서는 Enter가 깃발을 세우고 활성 칸을 지킨다", async () => {
    const { user } = renderMinesweeper();

    await user.click(screen.getByRole("button", { name: "깃발 모드" }));
    const cells = getCells();
    cells[12].focus();
    await user.keyboard("{Enter}");

    expect(cells[12]).toHaveClass("is-flagged");
    expect(cells[12]).toHaveAccessibleName("13번 칸, 깃발");
    expect(cells[12]).toHaveFocus();
    expect(getTabStopIndex(getCells())).toBe(12);
    expect(screen.getByText("깃발 1")).toBeVisible();
  });

  it("결과 대화상자가 열려 있으면 보드 방향키를 받지 않는다", async () => {
    const { user } = renderMinesweeper();
    const cells = getCells();

    const dialog = await playUntilResult(user);
    expect(dialog).toContainElement(document.activeElement as HTMLElement | null);
    const tabStopBefore = getTabStopIndex(getCells());

    fireEvent.keyDown(screen.getByRole("grid"), { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("grid"), { key: "End" });
    expect(getTabStopIndex(getCells())).toBe(tabStopBefore);
    expect(cells.some((cell) => cell === document.activeElement)).toBe(false);

    // The dialog's own Escape handling has to survive the board's new handler.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
