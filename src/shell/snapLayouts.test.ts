import { describe, expect, it } from "vitest";
import {
  SNAP_LAYOUTS,
  SNAP_LAYOUT_COLUMNS,
  SNAP_LAYOUT_ROWS,
  getSnapLayoutCells,
  getSnapZoneComplement,
} from "./snapLayouts";

describe("SNAP_LAYOUTS", () => {
  it("every layout covers the whole board exactly once", () => {
    for (const layout of SNAP_LAYOUTS) {
      const board = new Map<string, number>();
      for (const cell of layout.cells) {
        for (
          let column = cell.columnStart;
          column < cell.columnStart + cell.columnSpan;
          column += 1
        ) {
          for (let row = cell.rowStart; row < cell.rowStart + cell.rowSpan; row += 1) {
            const key = `${column}:${row}`;
            board.set(key, (board.get(key) ?? 0) + 1);
          }
        }
      }
      // A layout with a gap or an overlap is not an arrangement of the screen.
      expect(board.size, layout.id).toBe(SNAP_LAYOUT_COLUMNS * SNAP_LAYOUT_ROWS);
      expect(
        [...board.values()].every((count) => count === 1),
        layout.id,
      ).toBe(true);
    }
  });

  it("stays inside the board, and names every cell", () => {
    for (const cell of getSnapLayoutCells()) {
      expect(cell.columnStart).toBeGreaterThanOrEqual(1);
      expect(cell.columnStart + cell.columnSpan - 1).toBeLessThanOrEqual(SNAP_LAYOUT_COLUMNS);
      expect(cell.rowStart).toBeGreaterThanOrEqual(1);
      expect(cell.rowStart + cell.rowSpan - 1).toBeLessThanOrEqual(SNAP_LAYOUT_ROWS);
      expect(cell.label.trim()).not.toBe("");
    }
  });

  it("offers the four arrangements Windows 11 does, each named", () => {
    expect(SNAP_LAYOUTS.map((layout) => layout.id)).toEqual([
      "halves",
      "thirds",
      "wide-left",
      "quarters",
    ]);
    expect(SNAP_LAYOUTS.every((layout) => layout.label.trim() !== "")).toBe(true);
  });
});

describe("getSnapZoneComplement", () => {
  it("names the one place left over, and nothing when there are two", () => {
    expect(getSnapZoneComplement("left")).toBe("right");
    expect(getSnapZoneComplement("right")).toBe("left");
    expect(getSnapZoneComplement("left-two-thirds")).toBe("right-third");
    expect(getSnapZoneComplement("right-third")).toBe("left-two-thirds");
    // After a quarter or a middle third, two places are open; Windows does not
    // guess which one the next window wants.
    expect(getSnapZoneComplement("top-left")).toBeNull();
    expect(getSnapZoneComplement("center-third")).toBeNull();
    expect(getSnapZoneComplement("top")).toBeNull();
  });
});
