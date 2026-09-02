import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_VIRTUAL_DESKTOPS, VIRTUAL_DESKTOPS_KEY, WINDOW_STATE_KEY } from "./constants";
import { type PersistedWindow, type WindowInstance } from "./types";
import {
  isGeometryOnlyVfsChange,
  createDefaultWindows,
  fitWindowToViewport,
  getVirtualDesktopCount,
  isSnapZone,
  loadVirtualDesktopCount,
  loadWindowState,
  makeWindow,
  normalizePersistedWindow,
  persistWindowState,
  resolveActiveWindowId,
} from "./windowState";

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

function createWindow(overrides: Partial<WindowInstance> = {}): WindowInstance {
  return {
    appId: "notepad",
    desktopIndex: 0,
    height: 400,
    id: "notepad-fixture",
    maximized: false,
    minimized: false,
    width: 600,
    x: 100,
    y: 100,
    z: 12,
    ...overrides,
  };
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

describe("createDefaultWindows", () => {
  it("starts with an empty desktop", () => {
    expect(createDefaultWindows()).toEqual([]);
  });
});

describe("fitWindowToViewport", () => {
  it("returns the same object when the window already fits", () => {
    const item = createWindow();
    expect(fitWindowToViewport(item)).toBe(item);
  });

  it("leaves maximized windows untouched even when the geometry is impossible", () => {
    const item = createWindow({ height: 9999, maximized: true, width: 9999, x: -500, y: -500 });
    expect(fitWindowToViewport(item)).toBe(item);
  });

  it("shrinks oversized windows to the viewport and pulls them back to the origin", () => {
    const item = createWindow({ height: 5000, width: 5000, x: 0, y: 0 });
    expect(fitWindowToViewport(item)).toEqual({
      ...item,
      height: 736,
      width: 1264,
      x: 8,
      y: 8,
    });
  });

  it("grows undersized windows to the minimum window size", () => {
    const fitted = fitWindowToViewport(createWindow({ height: 100, width: 100 }));
    expect(fitted.width).toBe(320);
    expect(fitted.height).toBe(240);
  });

  it("pulls offscreen windows back so they stay reachable", () => {
    const fitted = fitWindowToViewport(
      createWindow({ height: 400, width: 600, x: 4000, y: 4000 }),
    );
    expect(fitted.x).toBe(672);
    expect(fitted.y).toBe(344);
  });

  it("reserves room for the app bar when clamping the vertical position", () => {
    const fitted = fitWindowToViewport(createWindow({ height: 400, y: 800 }));
    // 800 - 48 (app bar) - 400 (height) - 8 (margin)
    expect(fitted.y).toBe(344);
  });

  it("uses the narrower minimum width on small viewports", () => {
    setViewport(700, 600);
    const fitted = fitWindowToViewport(createWindow({ height: 100, width: 100 }));
    expect(fitted.width).toBe(288);
    expect(fitted.height).toBe(240);
  });

  it("keeps the minimum size on viewports too small to hold it", () => {
    setViewport(200, 200);
    expect(
      fitWindowToViewport(createWindow({ height: 400, width: 600, x: 100, y: 100 })),
    ).toEqual({
      ...createWindow(),
      height: 240,
      width: 288,
      x: 8,
      y: 8,
    });
  });

  it("preserves the unrelated window fields it does not manage", () => {
    const item = createWindow({
      desktopIndex: 2,
      minimized: true,
      snapZone: "left",
      width: 5000,
      z: 42,
    });
    const fitted = fitWindowToViewport(item);
    expect(fitted).not.toBe(item);
    expect(fitted.id).toBe(item.id);
    expect(fitted.appId).toBe(item.appId);
    expect(fitted.z).toBe(42);
    expect(fitted.minimized).toBe(true);
    expect(fitted.snapZone).toBe("left");
    expect(fitted.desktopIndex).toBe(2);
  });
});

describe("makeWindow", () => {
  it("uses the app default size on a roomy viewport", () => {
    const created = makeWindow("notepad", 200, 150, 20);
    expect(created).toMatchObject({
      appId: "notepad",
      height: 520,
      maximized: false,
      minimized: false,
      width: 600,
      x: 200,
      y: 150,
      z: 20,
    });
  });

  it("prefixes the generated id with the app id", () => {
    const created = makeWindow("files", 40, 40, 1);
    expect(created.id.startsWith("files-")).toBe(true);
    expect(created.id.length).toBeGreaterThan("files-".length);
  });

  it("generates a unique id per window", () => {
    const first = makeWindow("files", 40, 40, 1);
    const second = makeWindow("files", 40, 40, 2);
    expect(first.id).not.toBe(second.id);
  });

  it("clamps the requested position inside the viewport", () => {
    expect(makeWindow("notepad", 5000, 5000, 1)).toMatchObject({ x: 672, y: 224 });
    expect(makeWindow("notepad", -80, -80, 1)).toMatchObject({ x: 8, y: 8 });
  });

  it("shrinks the default size to fit a small viewport, down to the floor size", () => {
    setViewport(320, 300);
    expect(makeWindow("notepad", 100, 100, 1)).toMatchObject({
      height: 260,
      width: 320,
      x: 8,
      y: 8,
    });
  });

  it("never enlarges an app past its default size on a huge viewport", () => {
    setViewport(4000, 3000);
    expect(makeWindow("calculator", 10, 10, 1)).toMatchObject({ height: 570, width: 400 });
  });

  it("opens windows unsnapped, restored and visible", () => {
    const created = makeWindow("terminal", 30, 30, 3);
    expect(created.maximized).toBe(false);
    expect(created.minimized).toBe(false);
    expect(created.snapZone).toBeUndefined();
  });

  it("opens on the first virtual desktop by default", () => {
    expect(makeWindow("notepad", 30, 30, 3).desktopIndex).toBe(0);
  });

  it("opens on the requested virtual desktop", () => {
    expect(makeWindow("notepad", 30, 30, 3, 2).desktopIndex).toBe(2);
  });
});

describe("normalizePersistedWindow", () => {
  it("fills in app defaults for a bare entry and derives z from the index", () => {
    expect(normalizePersistedWindow({ appId: "notepad" }, 3)).toMatchObject({
      appId: "notepad",
      height: 520,
      maximized: false,
      minimized: false,
      width: 600,
      x: 8,
      y: 8,
      z: 15,
    });
  });

  it("rejects an entry with no app id", () => {
    expect(normalizePersistedWindow({}, 0)).toBeNull();
    expect(normalizePersistedWindow({ appId: undefined }, 0)).toBeNull();
  });

  it("keeps a persisted string id and generates one otherwise", () => {
    expect(normalizePersistedWindow({ appId: "notepad", id: "kept-id" }, 0)?.id).toBe(
      "kept-id",
    );
    const generated = normalizePersistedWindow({ appId: "notepad", id: 7 }, 0);
    expect(generated?.id.startsWith("notepad-")).toBe(true);
  });

  it("keeps an explicit z of zero instead of falling back to the index", () => {
    expect(normalizePersistedWindow({ appId: "notepad", z: 0 }, 5)?.z).toBe(0);
    expect(normalizePersistedWindow({ appId: "notepad", z: -4 }, 5)?.z).toBe(-4);
  });

  it("clamps oversized persisted geometry into the viewport", () => {
    expect(
      normalizePersistedWindow(
        { appId: "notepad", height: 99999, width: 99999, x: 99999, y: 99999 },
        0,
      ),
    ).toMatchObject({ height: 736, width: 1264, x: 8, y: 8 });
  });

  it("raises persisted sizes below the minimum window size", () => {
    expect(
      normalizePersistedWindow({ appId: "notepad", height: 10, width: 10 }, 0),
    ).toMatchObject({
      height: 240,
      width: 320,
    });
  });

  it("falls back to the app default size when the persisted size is unusable", () => {
    expect(normalizePersistedWindow({ appId: "files", height: 0, width: 0 }, 0)).toMatchObject({
      height: 600,
      width: 900,
    });
  });

  it("coerces the window flags to booleans", () => {
    expect(
      normalizePersistedWindow({ appId: "notepad", maximized: true, minimized: true }, 0),
    ).toMatchObject({ maximized: true, minimized: true });
  });

  it("restores a valid snap zone", () => {
    expect(
      normalizePersistedWindow({ appId: "notepad", snapZone: "bottom-left" }, 0)?.snapZone,
    ).toBe("bottom-left");
  });

  it("accepts every app in the catalog", () => {
    const entry: PersistedWindow = { appId: "taskmanager" };
    expect(normalizePersistedWindow(entry, 0)?.appId).toBe("taskmanager");
  });

  it("restores the virtual desktop the window lived on", () => {
    expect(
      normalizePersistedWindow({ appId: "notepad", desktopIndex: 3 }, 0)?.desktopIndex,
    ).toBe(3);
  });

  it("defaults to the first virtual desktop when the index is missing or fractional", () => {
    expect(normalizePersistedWindow({ appId: "notepad" }, 0)?.desktopIndex).toBe(0);
    expect(
      normalizePersistedWindow({ appId: "notepad", desktopIndex: 1.5 }, 0)?.desktopIndex,
    ).toBe(0);
  });

  it("clamps the virtual desktop index into the supported range", () => {
    expect(
      normalizePersistedWindow({ appId: "notepad", desktopIndex: 999 }, 0)?.desktopIndex,
    ).toBe(MAX_VIRTUAL_DESKTOPS - 1);
    expect(
      normalizePersistedWindow({ appId: "notepad", desktopIndex: -4 }, 0)?.desktopIndex,
    ).toBe(0);
  });
});

describe("getVirtualDesktopCount", () => {
  it("keeps at least one desktop", () => {
    expect(getVirtualDesktopCount([], 1)).toBe(1);
    expect(getVirtualDesktopCount([], 0)).toBe(1);
    expect(getVirtualDesktopCount([], -5)).toBe(1);
  });

  it("keeps the stored count when no window needs more", () => {
    expect(getVirtualDesktopCount([createWindow({ desktopIndex: 0 })], 3)).toBe(3);
  });

  it("grows to cover the highest desktop still holding a window", () => {
    expect(getVirtualDesktopCount([createWindow({ desktopIndex: 2 })], 1)).toBe(3);
    expect(
      getVirtualDesktopCount(
        [createWindow({ desktopIndex: 1 }), createWindow({ desktopIndex: 3 })],
        2,
      ),
    ).toBe(4);
  });

  it("never exceeds the supported desktop count", () => {
    expect(getVirtualDesktopCount([createWindow({ desktopIndex: 99 })], 1)).toBe(
      MAX_VIRTUAL_DESKTOPS,
    );
    expect(getVirtualDesktopCount([], 99)).toBe(MAX_VIRTUAL_DESKTOPS);
  });
});

describe("loadVirtualDesktopCount", () => {
  it("defaults to a single desktop when nothing is stored", () => {
    expect(loadVirtualDesktopCount()).toBe(1);
  });

  it("restores a stored count", () => {
    storage.setItem(VIRTUAL_DESKTOPS_KEY, "3");
    expect(loadVirtualDesktopCount()).toBe(3);
  });

  it("falls back to a single desktop for a non-integer value", () => {
    storage.setItem(VIRTUAL_DESKTOPS_KEY, "not a number");
    expect(loadVirtualDesktopCount()).toBe(1);
    storage.setItem(VIRTUAL_DESKTOPS_KEY, "2.5");
    expect(loadVirtualDesktopCount()).toBe(1);
  });

  it("clamps a stored count into the supported range", () => {
    storage.setItem(VIRTUAL_DESKTOPS_KEY, "0");
    expect(loadVirtualDesktopCount()).toBe(1);
    storage.setItem(VIRTUAL_DESKTOPS_KEY, "99");
    expect(loadVirtualDesktopCount()).toBe(MAX_VIRTUAL_DESKTOPS);
  });
});

describe("isSnapZone", () => {
  it("accepts every supported zone", () => {
    for (const zone of [
      "bottom-left",
      "bottom-right",
      "left",
      "right",
      "top",
      "top-left",
      "top-right",
    ]) {
      expect(isSnapZone(zone)).toBe(true);
    }
  });

  it("rejects unsupported strings and non-strings", () => {
    expect(isSnapZone("bottom")).toBe(false);
    expect(isSnapZone("TOP")).toBe(false);
    expect(isSnapZone("")).toBe(false);
    expect(isSnapZone(undefined)).toBe(false);
    expect(isSnapZone(null)).toBe(false);
    expect(isSnapZone(42)).toBe(false);
    expect(isSnapZone(["left"])).toBe(false);
  });
});

describe("loadWindowState", () => {
  it("returns an empty desktop when nothing is stored", () => {
    expect(loadWindowState()).toEqual([]);
  });

  it("returns an empty desktop for unparsable storage", () => {
    storage.setItem(WINDOW_STATE_KEY, "{not json");
    expect(loadWindowState()).toEqual([]);
  });

  it("returns an empty desktop when the stored value is not an array", () => {
    storage.setItem(WINDOW_STATE_KEY, JSON.stringify({ appId: "notepad" }));
    expect(loadWindowState()).toEqual([]);
    storage.setItem(WINDOW_STATE_KEY, "null");
    expect(loadWindowState()).toEqual([]);
    storage.setItem(WINDOW_STATE_KEY, '"notepad"');
    expect(loadWindowState()).toEqual([]);
  });

  it("stacks restored windows by their array position when z is missing", () => {
    storage.setItem(WINDOW_STATE_KEY, '[{"appId":"files"},{"appId":"notepad"}]');
    expect(loadWindowState().map((item) => [item.appId, item.z])).toEqual([
      ["files", 12],
      ["notepad", 13],
    ]);
  });

  it("keeps only the first window of a single-instance app", () => {
    storage.setItem(
      WINDOW_STATE_KEY,
      '[{"appId":"notepad","id":"first"},{"appId":"notepad","id":"second"}]',
    );
    const restored = loadWindowState();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe("first");
  });

  it("allows multiple file explorer windows", () => {
    storage.setItem(
      WINDOW_STATE_KEY,
      '[{"appId":"files","id":"f1"},{"appId":"files","id":"f2"},{"appId":"files","id":"f3"}]',
    );
    expect(loadWindowState().map((item) => item.id)).toEqual(["f1", "f2", "f3"]);
  });

  it("deduplicates non-explorer apps while interleaving explorer windows", () => {
    storage.setItem(
      WINDOW_STATE_KEY,
      '[{"appId":"files","id":"f1"},{"appId":"notepad","id":"n1"},{"appId":"files","id":"f2"},{"appId":"notepad","id":"n2"}]',
    );
    expect(loadWindowState().map((item) => item.id)).toEqual(["f1", "n1", "f2"]);
  });

  it("drops entries for unknown apps but keeps the rest", () => {
    storage.setItem(WINDOW_STATE_KEY, '[{"appId":"ghost"},{"appId":"notepad"}]');
    const restored = loadWindowState();
    expect(restored).toHaveLength(1);
    expect(restored[0].appId).toBe("notepad");
    // The dropped entry still consumed its index, so the z stack keeps its ordering.
    expect(restored[0].z).toBe(13);
  });

  it("drops entries that are not objects", () => {
    storage.setItem(WINDOW_STATE_KEY, '[5,"notepad",true,{"appId":"notepad"}]');
    expect(loadWindowState().map((item) => item.appId)).toEqual(["notepad"]);
  });

  it("ignores a stored snap zone that is not a real zone", () => {
    storage.setItem(WINDOW_STATE_KEY, '[{"appId":"notepad","snapZone":"bottom"}]');
    expect(loadWindowState()[0].snapZone).toBeUndefined();
  });

  it("restores a stored snap zone that is a real zone", () => {
    storage.setItem(WINDOW_STATE_KEY, '[{"appId":"notepad","snapZone":"top-right"}]');
    expect(loadWindowState()[0].snapZone).toBe("top-right");
  });

  it("re-fits stored geometry to the current viewport", () => {
    storage.setItem(
      WINDOW_STATE_KEY,
      '[{"appId":"notepad","x":2000,"y":2000,"width":1800,"height":1500}]',
    );
    setViewport(1024, 768);
    expect(loadWindowState()[0]).toMatchObject({ height: 704, width: 1008, x: 8, y: 8 });
  });
});

describe("persistWindowState", () => {
  it("writes only the serializable window fields", () => {
    persistWindowState([
      createWindow({ desktopIndex: 1, height: 300, id: "w1", width: 500, x: 40, y: 50, z: 30 }),
    ]);
    const raw = storage.getItem(WINDOW_STATE_KEY);
    expect(raw).not.toBeNull();
    const stored: unknown = JSON.parse(raw ?? "null");
    expect(stored).toEqual([
      {
        appId: "notepad",
        desktopIndex: 1,
        height: 300,
        id: "w1",
        maximized: false,
        minimized: false,
        width: 500,
        x: 40,
        y: 50,
        z: 30,
      },
    ]);
  });

  it("round-trips the snap zone and the virtual desktop", () => {
    persistWindowState([createWindow({ desktopIndex: 2, id: "w1", snapZone: "bottom-right" })]);
    expect(loadWindowState()[0]).toMatchObject({
      desktopIndex: 2,
      id: "w1",
      snapZone: "bottom-right",
    });
  });

  it("round-trips window identity, stacking and flags", () => {
    persistWindowState([
      createWindow({ height: 300, id: "w1", maximized: true, width: 500, x: 40, y: 50, z: 30 }),
      createWindow({
        appId: "files",
        height: 620,
        id: "w2",
        minimized: true,
        width: 800,
        x: 60,
        y: 70,
        z: 31,
      }),
    ]);

    expect(loadWindowState()).toEqual([
      expect.objectContaining({
        appId: "notepad",
        height: 300,
        id: "w1",
        maximized: true,
        minimized: false,
        width: 500,
        x: 40,
        y: 50,
        z: 30,
      }),
      expect.objectContaining({
        appId: "files",
        height: 620,
        id: "w2",
        maximized: false,
        minimized: true,
        width: 800,
        x: 60,
        y: 70,
        z: 31,
      }),
    ]);
  });

  it("round-trips an empty desktop", () => {
    persistWindowState([]);
    expect(storage.getItem(WINDOW_STATE_KEY)).toBe("[]");
    expect(loadWindowState()).toEqual([]);
  });

  it("overwrites the previously stored layout", () => {
    persistWindowState([createWindow({ id: "old" })]);
    persistWindowState([createWindow({ appId: "files", id: "new" })]);
    expect(loadWindowState().map((item) => item.id)).toEqual(["new"]);
  });
});

describe("isGeometryOnlyVfsChange", () => {
  const base = {
    createdAt: 0,
    id: "a",
    kind: "note" as const,
    name: "메모.txt",
    parentId: "desktop",
    showOnDesktop: true,
    updatedAt: 0,
    x: 0,
    y: 0,
  };

  it("treats a pure icon move as geometry", () => {
    expect(isGeometryOnlyVfsChange([base], [{ ...base, x: 40, y: 80 }])).toBe(true);
    expect(isGeometryOnlyVfsChange([base], [{ ...base, showOnDesktop: false }])).toBe(true);
  });

  it("fails closed: a field this rule has never heard of is structural", () => {
    const withUnknownField = { ...base, restoreParentId: "vfs-system-documents" };
    expect(isGeometryOnlyVfsChange([base], [withUnknownField])).toBe(false);
    const withFutureField = { ...base, someFutureFlag: true } as typeof base;
    expect(isGeometryOnlyVfsChange([base], [withFutureField])).toBe(false);
  });

  it("anything structural must write immediately", () => {
    expect(isGeometryOnlyVfsChange([base], [base, { ...base, id: "b" }])).toBe(false);
    expect(isGeometryOnlyVfsChange([base], [{ ...base, name: "다른.txt" }])).toBe(false);
    expect(isGeometryOnlyVfsChange([base], [{ ...base, content: "x" }])).toBe(false);
    expect(
      isGeometryOnlyVfsChange([base], [{ ...base, parentId: "vfs-system-documents" }]),
    ).toBe(false);
    expect(isGeometryOnlyVfsChange([base], [{ ...base, trashed: true }])).toBe(false);
    expect(isGeometryOnlyVfsChange([base], [{ ...base, updatedAt: 5 }])).toBe(false);
  });
});

describe("resolveActiveWindowId", () => {
  const win = (id: string, z: number, minimized = false) => ({ id, minimized, z });

  it("picks the topmost visible window when the desktop was never focused", () => {
    expect(resolveActiveWindowId([win("a", 1), win("b", 3, true), win("c", 2)], 0)).toBe("c");
    expect(resolveActiveWindowId([], 0)).toBeUndefined();
  });

  it("a desktop click above every window leaves no window active", () => {
    expect(resolveActiveWindowId([win("a", 1), win("c", 2)], 3)).toBeUndefined();
  });

  it("raising a window to the desktop's mark activates it again", () => {
    expect(resolveActiveWindowId([win("a", 1), win("c", 3)], 3)).toBe("c");
  });
});
