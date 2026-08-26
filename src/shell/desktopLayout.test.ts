import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type DesktopItem } from "../types";
import { DESKTOP_ICON_LAYOUT_KEY, DESKTOP_ICON_SORT_KEY, DESKTOP_ICON_VIEW_KEY } from "./constants";
import {
  clampContextMenuPosition,
  clampIconPosition,
  clampWindowSystemMenuPosition,
  compareDesktopEntries,
  createDefaultIconLayout,
  createDesktopGridPositions,
  findAvailableDesktopPosition,
  getDesktopIconBounds,
  getDesktopIconMetrics,
  getDesktopSelectionBounds,
  getDesktopSelectionIds,
  getDesktopSelectionStyle,
  isDesktopSelectionVisible,
  loadDesktopIconLayout,
  loadDesktopSortKey,
  loadDesktopViewMode,
  persistDesktopIconLayout,
  rectsIntersect,
  snapDesktopIconPosition,
} from "./desktopLayout";
import { type DesktopSelectionState } from "./types";

type StorageStub = {
  clear: () => void;
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  readonly length: number;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

// The vitest environment is `node`, so the module's `window` / `localStorage` reads need stubs.
function createStorageStub(): StorageStub {
  const entries = new Map<string, string>();
  return {
    clear: () => {
      entries.clear();
    },
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
  };
}

function setViewport(width: number, height: number) {
  vi.stubGlobal("window", { innerHeight: height, innerWidth: width });
}

function createSelection(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): DesktopSelectionState {
  return { currentX, currentY, pointerId: 1, startX, startY };
}

function createDesktopItem(overrides: Partial<DesktopItem> = {}): DesktopItem {
  return {
    createdAt: 0,
    id: "item-1",
    kind: "note",
    name: "메모.txt",
    parentId: "desktop",
    showOnDesktop: true,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function createSortEntry(overrides: Partial<{ name: string; type: string; updatedAt: number }> = {}) {
  return { name: "entry", type: "txt", updatedAt: 0, ...overrides };
}

let storage: StorageStub;

beforeEach(() => {
  storage = createStorageStub();
  vi.stubGlobal("localStorage", storage);
  setViewport(1280, 800);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDesktopIconMetrics", () => {
  it("returns a distinct tile size per view mode", () => {
    expect(getDesktopIconMetrics("small")).toEqual({ height: 76, width: 76 });
    expect(getDesktopIconMetrics("medium")).toEqual({ height: 94, width: 86 });
    expect(getDesktopIconMetrics("large")).toEqual({ height: 116, width: 110 });
  });
});

describe("createDefaultIconLayout", () => {
  it("stacks the built-in desktop apps in a single column", () => {
    expect(createDefaultIconLayout()).toEqual({
      recycle: { x: 18, y: 128 },
      thispc: { x: 18, y: 18 },
    });
  });

  it("clamps the default stack into a short viewport", () => {
    setViewport(200, 200);
    // 200 - 48 (app bar) - 94 (tile) - 8 (margin) = 50 is the lowest usable row.
    expect(createDefaultIconLayout()).toEqual({
      recycle: { x: 18, y: 50 },
      thispc: { x: 18, y: 18 },
    });
  });
});

describe("clampIconPosition", () => {
  it("keeps positions that are already inside the desktop", () => {
    expect(clampIconPosition(400, 300)).toEqual({ x: 400, y: 300 });
  });

  it("clamps to the top-left margin", () => {
    expect(clampIconPosition(-500, -500)).toEqual({ x: 8, y: 8 });
    expect(clampIconPosition(0, 0)).toEqual({ x: 8, y: 8 });
  });

  it("clamps to the bottom-right, leaving room for the app bar", () => {
    // 1280 - 86 - 8 = 1186 and 800 - 48 - 94 - 8 = 650
    expect(clampIconPosition(9999, 9999)).toEqual({ x: 1186, y: 650 });
  });

  it("uses the view mode tile size when clamping", () => {
    expect(clampIconPosition(9999, 9999, "small")).toEqual({ x: 1196, y: 668 });
    expect(clampIconPosition(9999, 9999, "large")).toEqual({ x: 1162, y: 628 });
  });

  it("falls back to the default origin for non-finite coordinates", () => {
    expect(clampIconPosition(Number.NaN, Number.NaN)).toEqual({ x: 18, y: 18 });
    expect(clampIconPosition(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toEqual({
      x: 18,
      y: 18,
    });
  });

  it("collapses onto the margin when the tile cannot fit the viewport", () => {
    setViewport(100, 200);
    expect(clampIconPosition(500, 500)).toEqual({ x: 8, y: 50 });
    expect(clampIconPosition(0, 0)).toEqual({ x: 8, y: 8 });
  });
});

describe("createDesktopGridPositions", () => {
  it("returns nothing for an empty desktop", () => {
    expect(createDesktopGridPositions(0, "medium")).toEqual([]);
  });

  it("fills a column top to bottom before starting the next one", () => {
    const positions = createDesktopGridPositions(8, "medium");
    expect(positions[0]).toEqual({ x: 18, y: 18 });
    expect(positions[1]).toEqual({ x: 18, y: 122 });
    expect(positions[5]).toEqual({ x: 18, y: 538 });
    // 1280x800 fits six medium rows, so the seventh icon starts a new column.
    expect(positions[6]).toEqual({ x: 122, y: 18 });
    expect(positions[7]).toEqual({ x: 122, y: 122 });
  });

  it("fits more rows per column in the small view mode", () => {
    const positions = createDesktopGridPositions(9, "small");
    expect(positions[0]).toEqual({ x: 18, y: 18 });
    expect(positions[1]).toEqual({ x: 18, y: 104 });
    expect(positions[7]).toEqual({ x: 18, y: 620 });
    expect(positions[8]).toEqual({ x: 112, y: 18 });
  });

  it("fits fewer rows per column in the large view mode", () => {
    const positions = createDesktopGridPositions(6, "large");
    expect(positions[0]).toEqual({ x: 18, y: 18 });
    expect(positions[4]).toEqual({ x: 18, y: 522 });
    expect(positions[5]).toEqual({ x: 146, y: 18 });
  });

  it("keeps at least one row on a viewport shorter than a tile", () => {
    setViewport(200, 200);
    const positions = createDesktopGridPositions(4, "medium");
    expect(positions.every((position) => position.y === 18)).toBe(true);
  });

  it("clamps columns that run past the right edge", () => {
    setViewport(400, 300);
    const positions = createDesktopGridPositions(8, "medium");
    expect(positions[4]).toEqual({ x: 226, y: 18 });
    // 400 - 86 - 8 = 306 is the rightmost usable column.
    expect(positions[6]).toEqual({ x: 306, y: 18 });
    expect(positions.every((position) => position.x <= 306 && position.y <= 150)).toBe(true);
  });
});

describe("snapDesktopIconPosition", () => {
  it("snaps to the nearest grid cell", () => {
    expect(snapDesktopIconPosition({ x: 60, y: 60 }, "medium")).toEqual({ x: 18, y: 18 });
    expect(snapDesktopIconPosition({ x: 70, y: 70 }, "medium")).toEqual({ x: 122, y: 122 });
    expect(snapDesktopIconPosition({ x: 118, y: 200 }, "medium")).toEqual({ x: 122, y: 226 });
  });

  it("is idempotent for a position already on the grid", () => {
    const snapped = snapDesktopIconPosition({ x: 226, y: 330 }, "medium");
    expect(snapped).toEqual({ x: 226, y: 330 });
    expect(snapDesktopIconPosition(snapped, "medium")).toEqual(snapped);
  });

  it("uses the view mode grid pitch", () => {
    expect(snapDesktopIconPosition({ x: 100, y: 100 }, "small")).toEqual({ x: 112, y: 104 });
    expect(snapDesktopIconPosition({ x: 100, y: 100 }, "large")).toEqual({ x: 146, y: 144 });
  });

  it("clamps the snapped cell back inside the desktop", () => {
    expect(snapDesktopIconPosition({ x: -500, y: -500 }, "medium")).toEqual({ x: 8, y: 8 });
    expect(snapDesktopIconPosition({ x: 9999, y: 9999 }, "medium")).toEqual({ x: 1186, y: 650 });
  });
});

describe("clampContextMenuPosition", () => {
  it("keeps a position with room for the whole menu", () => {
    expect(clampContextMenuPosition(400, 300)).toEqual({ x: 400, y: 300 });
  });

  it("flips nothing but clamps so the menu stays fully visible", () => {
    // 1280 - 220 - 8 = 1052 and 800 - 48 - 260 - 8 = 484
    expect(clampContextMenuPosition(9999, 9999)).toEqual({ x: 1052, y: 484 });
    expect(clampContextMenuPosition(-40, -40)).toEqual({ x: 8, y: 8 });
  });

  it("falls back to the default origin for non-finite coordinates", () => {
    expect(clampContextMenuPosition(Number.NaN, Number.NaN)).toEqual({ x: 18, y: 18 });
  });

  it("pins to the margin when the menu is taller than the viewport", () => {
    setViewport(200, 200);
    expect(clampContextMenuPosition(100, 100)).toEqual({ x: 8, y: 8 });
  });
});

describe("clampWindowSystemMenuPosition", () => {
  it("keeps a position with room for the whole menu", () => {
    expect(clampWindowSystemMenuPosition(400, 300)).toEqual({ x: 400, y: 300 });
  });

  it("clamps so the menu stays fully visible above the app bar", () => {
    // 1280 - 214 - 8 = 1058 and 800 - 48 - 220 - 8 = 524
    expect(clampWindowSystemMenuPosition(9999, 9999)).toEqual({ x: 1058, y: 524 });
    expect(clampWindowSystemMenuPosition(-40, -40)).toEqual({ x: 8, y: 8 });
  });

  it("pins to the margin when the menu is taller than the viewport", () => {
    setViewport(200, 200);
    expect(clampWindowSystemMenuPosition(100, 100)).toEqual({ x: 8, y: 8 });
  });
});

describe("getDesktopSelectionBounds", () => {
  it("describes a drag to the bottom right", () => {
    expect(getDesktopSelectionBounds(createSelection(40, 20, 100, 80))).toEqual({
      bottom: 80,
      height: 60,
      left: 40,
      right: 100,
      top: 20,
      width: 60,
    });
  });

  it("normalizes a drag to the top left", () => {
    expect(getDesktopSelectionBounds(createSelection(100, 80, 40, 20))).toEqual({
      bottom: 80,
      height: 60,
      left: 40,
      right: 100,
      top: 20,
      width: 60,
    });
  });

  it("reports a zero-size rectangle for a click without movement", () => {
    expect(getDesktopSelectionBounds(createSelection(50, 50, 50, 50))).toEqual({
      bottom: 50,
      height: 0,
      left: 50,
      right: 50,
      top: 50,
      width: 0,
    });
  });
});

describe("getDesktopSelectionStyle", () => {
  it("exposes only the box geometry for the marquee element", () => {
    expect(getDesktopSelectionStyle(createSelection(100, 100, 40, 60))).toEqual({
      height: 40,
      left: 40,
      top: 60,
      width: 60,
    });
  });
});

describe("isDesktopSelectionVisible", () => {
  it("hides marquees smaller than the drag threshold on both axes", () => {
    expect(isDesktopSelectionVisible(createSelection(10, 10, 10, 10))).toBe(false);
    expect(isDesktopSelectionVisible(createSelection(10, 10, 15, 15))).toBe(false);
  });

  it("shows a marquee once either axis passes the threshold", () => {
    expect(isDesktopSelectionVisible(createSelection(10, 10, 16, 10))).toBe(true);
    expect(isDesktopSelectionVisible(createSelection(10, 10, 10, 16))).toBe(true);
  });

  it("ignores the drag direction", () => {
    expect(isDesktopSelectionVisible(createSelection(100, 100, 40, 40))).toBe(true);
  });
});

describe("getDesktopSelectionIds", () => {
  const layout = { recycle: { x: 18, y: 128 }, thispc: { x: 18, y: 18 } };
  const items = [
    createDesktopItem({ id: "near", name: "near.txt", x: 0, y: 0 }),
    createDesktopItem({ id: "far", name: "far.txt", x: 600, y: 400 }),
    createDesktopItem({ id: "hidden", name: "hidden.txt", showOnDesktop: false, x: 0, y: 0 }),
  ];

  it("returns nothing while the marquee is below the drag threshold", () => {
    expect(getDesktopSelectionIds(createSelection(0, 0, 4, 4), layout, items, "medium")).toEqual([]);
  });

  it("selects the icons the marquee touches, apps before files", () => {
    expect(getDesktopSelectionIds(createSelection(0, 0, 60, 60), layout, items, "medium")).toEqual([
      "app:thispc",
      "item:near",
    ]);
  });

  it("selects everything under a full-desktop marquee", () => {
    expect(getDesktopSelectionIds(createSelection(0, 0, 1200, 700), layout, items, "medium")).toEqual([
      "app:thispc",
      "app:recycle",
      "item:near",
      "item:far",
    ]);
  });

  it("ignores items that are not shown on the desktop", () => {
    const ids = getDesktopSelectionIds(createSelection(0, 0, 1200, 700), layout, items, "medium");
    expect(ids).not.toContain("item:hidden");
  });

  it("falls back to the default layout for apps with no stored position", () => {
    // The band below the default thispc tile only reaches the default recycle tile.
    expect(getDesktopSelectionIds(createSelection(0, 120, 200, 300), {}, [], "medium")).toEqual([
      "app:recycle",
    ]);
  });

  it("mixes stored and default positions", () => {
    const ids = getDesktopSelectionIds(
      createSelection(0, 120, 200, 300),
      { thispc: { x: 900, y: 600 } },
      [],
      "medium",
    );
    expect(ids).toEqual(["app:recycle"]);
  });

  it("uses the view mode tile size to decide what the marquee touches", () => {
    const selection = createSelection(100, 100, 110, 110);
    expect(getDesktopSelectionIds(selection, layout, [], "medium")).toEqual(["app:thispc"]);
    expect(getDesktopSelectionIds(selection, layout, [], "small")).toEqual([]);
  });
});

describe("getDesktopIconBounds", () => {
  it("expands a position into a tile rectangle per view mode", () => {
    expect(getDesktopIconBounds({ x: 10, y: 20 }, "medium")).toEqual({
      bottom: 114,
      left: 10,
      right: 96,
      top: 20,
    });
    expect(getDesktopIconBounds({ x: 10, y: 20 }, "small")).toEqual({
      bottom: 96,
      left: 10,
      right: 86,
      top: 20,
    });
    expect(getDesktopIconBounds({ x: 10, y: 20 }, "large")).toEqual({
      bottom: 136,
      left: 10,
      right: 120,
      top: 20,
    });
  });
});

describe("rectsIntersect", () => {
  const base = { bottom: 100, left: 0, right: 100, top: 0 };

  it("detects overlap and containment", () => {
    expect(rectsIntersect(base, { bottom: 150, left: 50, right: 150, top: 50 })).toBe(true);
    expect(rectsIntersect(base, { bottom: 60, left: 40, right: 60, top: 40 })).toBe(true);
    expect(rectsIntersect(base, base)).toBe(true);
  });

  it("treats touching edges as an intersection", () => {
    expect(rectsIntersect(base, { bottom: 100, left: 100, right: 200, top: 0 })).toBe(true);
    expect(rectsIntersect(base, { bottom: 200, left: 0, right: 100, top: 100 })).toBe(true);
  });

  it("returns false once a gap opens on either axis", () => {
    expect(rectsIntersect(base, { bottom: 100, left: 101, right: 200, top: 0 })).toBe(false);
    expect(rectsIntersect(base, { bottom: 200, left: 0, right: 100, top: 101 })).toBe(false);
  });
});

describe("findAvailableDesktopPosition", () => {
  it("keeps the preferred position when nothing is in the way", () => {
    expect(findAvailableDesktopPosition({ x: 600, y: 400 }, "medium", [{ x: 18, y: 18 }])).toEqual({
      x: 600,
      y: 400,
    });
  });

  it("clamps the preferred position before using it", () => {
    expect(findAvailableDesktopPosition({ x: 9999, y: 9999 }, "medium", [])).toEqual({
      x: 1186,
      y: 650,
    });
  });

  it("falls back to the next free grid cell when the preferred spot overlaps", () => {
    expect(findAvailableDesktopPosition({ x: 20, y: 20 }, "medium", [{ x: 18, y: 18 }])).toEqual({
      x: 18,
      y: 122,
    });
  });

  it("skips every occupied grid cell", () => {
    const occupied = [
      { x: 18, y: 18 },
      { x: 18, y: 122 },
      { x: 18, y: 226 },
    ];
    expect(findAvailableDesktopPosition({ x: 18, y: 18 }, "medium", occupied)).toEqual({
      x: 18,
      y: 330,
    });
  });

  it("returns the clamped preferred position when the whole grid is blocked", () => {
    setViewport(100, 200);
    // Every grid cell collapses onto (8, 18) on this viewport, so nothing is free.
    expect(findAvailableDesktopPosition({ x: 500, y: 500 }, "medium", [{ x: 8, y: 18 }])).toEqual({
      x: 8,
      y: 50,
    });
  });
});

describe("compareDesktopEntries", () => {
  it("sorts by name using Korean collation", () => {
    const entries = [createSortEntry({ name: "나무.txt" }), createSortEntry({ name: "가방.txt" })];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "name")).map((e) => e.name)).toEqual([
      "가방.txt",
      "나무.txt",
    ]);
  });

  it("sorts names with embedded numbers naturally", () => {
    const entries = [createSortEntry({ name: "파일 10" }), createSortEntry({ name: "파일 2" })];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "name")).map((e) => e.name)).toEqual([
      "파일 2",
      "파일 10",
    ]);
  });

  it("treats names differing only in case as equal", () => {
    expect(
      compareDesktopEntries(createSortEntry({ name: "abc" }), createSortEntry({ name: "ABC" }), "name"),
    ).toBe(0);
  });

  it("groups by type before name when sorting by type", () => {
    const entries = [
      createSortEntry({ name: "a", type: "txt" }),
      createSortEntry({ name: "z", type: "folder" }),
    ];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "type")).map((e) => e.name)).toEqual([
      "z",
      "a",
    ]);
  });

  it("falls back to the name within one type", () => {
    const entries = [
      createSortEntry({ name: "b", type: "txt" }),
      createSortEntry({ name: "a", type: "txt" }),
    ];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "type")).map((e) => e.name)).toEqual([
      "a",
      "b",
    ]);
  });

  it("puts the most recently modified entry first", () => {
    const entries = [
      createSortEntry({ name: "old", updatedAt: 100 }),
      createSortEntry({ name: "new", updatedAt: 900 }),
    ];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "modified")).map((e) => e.name)).toEqual(
      ["new", "old"],
    );
  });

  it("ignores the type when sorting equally recent entries by date", () => {
    const entries = [
      createSortEntry({ name: "z", type: "aaa", updatedAt: 500 }),
      createSortEntry({ name: "a", type: "zzz", updatedAt: 500 }),
    ];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "modified")).map((e) => e.name)).toEqual(
      ["a", "z"],
    );
  });

  it("ignores the modified date when sorting by name", () => {
    const entries = [
      createSortEntry({ name: "b", updatedAt: 900 }),
      createSortEntry({ name: "a", updatedAt: 100 }),
    ];
    expect(entries.sort((a, b) => compareDesktopEntries(a, b, "name")).map((e) => e.name)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("loadDesktopViewMode", () => {
  it("defaults to the medium view mode", () => {
    expect(loadDesktopViewMode()).toBe("medium");
  });

  it("restores the stored view mode", () => {
    storage.setItem(DESKTOP_ICON_VIEW_KEY, "small");
    expect(loadDesktopViewMode()).toBe("small");
    storage.setItem(DESKTOP_ICON_VIEW_KEY, "large");
    expect(loadDesktopViewMode()).toBe("large");
    storage.setItem(DESKTOP_ICON_VIEW_KEY, "medium");
    expect(loadDesktopViewMode()).toBe("medium");
  });

  it("falls back to medium for an unrecognized value", () => {
    storage.setItem(DESKTOP_ICON_VIEW_KEY, "huge");
    expect(loadDesktopViewMode()).toBe("medium");
    storage.setItem(DESKTOP_ICON_VIEW_KEY, "");
    expect(loadDesktopViewMode()).toBe("medium");
  });
});

describe("loadDesktopSortKey", () => {
  it("defaults to sorting by name", () => {
    expect(loadDesktopSortKey()).toBe("name");
  });

  it("restores the stored sort key", () => {
    storage.setItem(DESKTOP_ICON_SORT_KEY, "type");
    expect(loadDesktopSortKey()).toBe("type");
    storage.setItem(DESKTOP_ICON_SORT_KEY, "modified");
    expect(loadDesktopSortKey()).toBe("modified");
  });

  it("falls back to name for an unrecognized value", () => {
    storage.setItem(DESKTOP_ICON_SORT_KEY, "size");
    expect(loadDesktopSortKey()).toBe("name");
  });
});

describe("loadDesktopIconLayout", () => {
  it("returns the default layout when nothing is stored", () => {
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
  });

  it("returns the default layout for unparsable storage", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, "{not json");
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
  });

  it("returns the default layout when the stored value is not an object map", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, "null");
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, "[]");
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '"18,18"');
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
  });

  it("restores stored positions and defaults the rest", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '{"thispc":{"x":300,"y":200}}');
    expect(loadDesktopIconLayout()).toEqual({
      recycle: { x: 18, y: 128 },
      thispc: { x: 300, y: 200 },
    });
  });

  it("coerces numeric strings", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '{"thispc":{"x":"300","y":"200"}}');
    expect(loadDesktopIconLayout().thispc).toEqual({ x: 300, y: 200 });
  });

  it("repairs unusable coordinates one axis at a time", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '{"thispc":{"x":"abc","y":0}}');
    // x is not a number so it returns to the origin; y is a valid 0 and only gets clamped.
    expect(loadDesktopIconLayout().thispc).toEqual({ x: 18, y: 8 });
  });

  it("clamps stored positions into the current viewport", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '{"thispc":{"x":9999,"y":9999}}');
    expect(loadDesktopIconLayout().thispc).toEqual({ x: 1186, y: 650 });
  });

  it("defaults entries that are not position objects", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '{"thispc":5,"recycle":null}');
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
  });

  it("ignores stored entries for apps that have no desktop icon", () => {
    storage.setItem(DESKTOP_ICON_LAYOUT_KEY, '{"notepad":{"x":500,"y":500}}');
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
  });
});

describe("persistDesktopIconLayout", () => {
  it("round-trips a full layout", () => {
    persistDesktopIconLayout({ recycle: { x: 400, y: 500 }, thispc: { x: 200, y: 300 } });
    expect(loadDesktopIconLayout()).toEqual({
      recycle: { x: 400, y: 500 },
      thispc: { x: 200, y: 300 },
    });
  });

  it("writes only the desktop apps it knows about", () => {
    persistDesktopIconLayout({ notepad: { x: 1, y: 2 }, thispc: { x: 200, y: 300 } });
    const stored: unknown = JSON.parse(storage.getItem(DESKTOP_ICON_LAYOUT_KEY) ?? "null");
    expect(stored).toEqual({ thispc: { x: 200, y: 300 } });
  });

  it("skips apps with no position instead of writing a hole", () => {
    persistDesktopIconLayout({ thispc: { x: 200, y: 300 } });
    const stored: unknown = JSON.parse(storage.getItem(DESKTOP_ICON_LAYOUT_KEY) ?? "null");
    expect(stored).toEqual({ thispc: { x: 200, y: 300 } });
    expect(loadDesktopIconLayout().recycle).toEqual({ x: 18, y: 128 });
  });

  it("writes an empty map for an empty layout", () => {
    persistDesktopIconLayout({});
    expect(storage.getItem(DESKTOP_ICON_LAYOUT_KEY)).toBe("{}");
    expect(loadDesktopIconLayout()).toEqual(createDefaultIconLayout());
  });

  it("overwrites the previously stored layout", () => {
    persistDesktopIconLayout({ thispc: { x: 200, y: 300 } });
    persistDesktopIconLayout({ thispc: { x: 500, y: 600 } });
    expect(loadDesktopIconLayout().thispc).toEqual({ x: 500, y: 600 });
  });
});
