import { describe, expect, it } from "vitest";
import {
  CASCADE_STEP,
  arrangeWindows,
  distributeTileSizes,
  getTileGrid,
} from "./windowArrangement";
import { type WindowInstance } from "./types";

const area = { height: 772, width: 1280, x: 0, y: 0 };

function win(id: string, z: number, overrides: Partial<WindowInstance> = {}): WindowInstance {
  return {
    appId: "notepad",
    desktopIndex: 0,
    height: 300,
    id,
    maximized: false,
    minimized: false,
    width: 400,
    x: 100,
    y: 100,
    z,
    ...overrides,
  };
}

function overlaps(first: WindowInstance, second: WindowInstance) {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

describe("arrangeWindows", () => {
  const windows = [
    win("back", 2),
    win("front", 5, { maximized: true }),
    win("hidden", 3, { minimized: true }),
    win("elsewhere", 4, { desktopIndex: 1 }),
  ];

  it("cascades the visible windows of the desktop one title bar apart, front window last", () => {
    const result = arrangeWindows(windows, 0, area, "cascade");
    const back = result.find((item) => item.id === "back")!;
    const front = result.find((item) => item.id === "front")!;
    expect(back).toMatchObject({ height: 510, maximized: false, width: 794, x: 0, y: 0 });
    expect(front).toMatchObject({
      height: 510,
      maximized: false,
      width: 794,
      x: CASCADE_STEP,
      y: CASCADE_STEP,
    });
    expect(front.z).toBeGreaterThan(back.z);
    expect(back.z).toBeGreaterThan(5);
  });

  it("leaves minimized windows and other desktops untouched", () => {
    const result = arrangeWindows(windows, 0, area, "side-by-side");
    expect(result.find((item) => item.id === "hidden")).toEqual(windows[2]);
    expect(result.find((item) => item.id === "elsewhere")).toEqual(windows[3]);
    expect(arrangeWindows(windows, 2, area, "stack")).toBe(windows);
  });

  it("side by side splits the width; stacked splits the height", () => {
    const side = arrangeWindows(windows, 0, area, "side-by-side").filter(
      (item) => item.id === "back" || item.id === "front",
    );
    expect(side.map((item) => [item.x, item.width, item.height])).toEqual([
      [0, 640, 772],
      [640, 640, 772],
    ]);
    const stack = arrangeWindows(windows, 0, area, "stack").filter(
      (item) => item.id === "back" || item.id === "front",
    );
    expect(stack.map((item) => [item.y, item.height, item.width])).toEqual([
      [0, 386, 1280],
      [386, 386, 1280],
    ]);
  });

  it("tiles five windows as a grid that covers the area without overlaps", () => {
    const five = Array.from({ length: 5 }, (_, index) => win(`w${index}`, index + 1));
    expect(getTileGrid(5, "side-by-side")).toEqual({ columns: 3, rows: 2 });
    expect(getTileGrid(5, "stack")).toEqual({ columns: 2, rows: 3 });
    const tiled = arrangeWindows(five, 0, area, "side-by-side");
    for (const first of tiled) {
      expect(first.x + first.width).toBeLessThanOrEqual(area.width);
      expect(first.y + first.height).toBeLessThanOrEqual(area.height);
      for (const second of tiled) {
        if (first !== second) expect(overlaps(first, second)).toBe(false);
      }
    }
    // The last column reaches the right edge even though 1280 / 3 does not divide.
    expect(Math.max(...tiled.map((item) => item.x + item.width))).toBe(area.width);
  });

  it("gives a column at least its widest minimum and shares the rest, so tiles never overlap", () => {
    // 1280 wide, three windows: 480 + 320 + 320 = 1120 fits, 160 left to share.
    const three = [win("wide", 1), win("b", 2), win("c", 3)];
    const minSize = (item: WindowInstance) =>
      item.id === "wide" ? { height: 240, width: 480 } : undefined;
    const tiled = arrangeWindows(three, 0, area, "side-by-side", minSize);
    expect(tiled.map((item) => [item.x, item.width])).toEqual([
      [0, 533],
      [533, 373],
      [906, 374],
    ]);
    for (const first of tiled) {
      for (const second of tiled) {
        if (first !== second) expect(overlaps(first, second)).toBe(false);
      }
    }

    // A tall minimum in the second row: that row grows, the first shrinks to fit.
    const four = Array.from({ length: 4 }, (_, index) => win(`w${index}`, index + 1));
    const tallMin = (item: WindowInstance) =>
      item.id === "w2" ? { height: 440, width: 520 } : undefined;
    const grid = arrangeWindows(four, 0, area, "side-by-side", tallMin);
    const tall = grid.find((item) => item.id === "w2")!;
    expect(tall.height).toBeGreaterThanOrEqual(440);
    expect(tall.width).toBeGreaterThanOrEqual(520);
    expect(tall.y + tall.height).toBe(area.height);
    for (const first of grid) {
      for (const second of grid) {
        if (first !== second) expect(overlaps(first, second)).toBe(false);
      }
    }
  });

  it("when the minimums alone exceed the area the tiles keep them and are pulled back inside", () => {
    expect(distributeTileSizes(1000, [600, 600])).toEqual([600, 600]);
    const two = [win("a", 1), win("b", 2)];
    const tiled = arrangeWindows(two, 0, area, "side-by-side", () => ({
      height: 240,
      width: 800,
    }));
    expect(tiled.map((item) => [item.x, item.width])).toEqual([
      [0, 800],
      [480, 800],
    ]);
  });

  it("starts a new cascade run when the stairs would leave the work area", () => {
    const many = Array.from({ length: 24 }, (_, index) => win(`w${index}`, index + 1));
    const result = arrangeWindows(many, 0, area, "cascade");
    for (const item of result) {
      expect(item.x + item.width).toBeLessThanOrEqual(area.width);
      expect(item.y + item.height).toBeLessThanOrEqual(area.height);
    }
    expect(new Set(result.map((item) => `${item.x},${item.y}`)).size).toBeGreaterThan(10);
  });
});
