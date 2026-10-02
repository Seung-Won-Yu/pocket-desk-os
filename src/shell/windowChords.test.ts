import { describe, expect, it } from "vitest";
import { type WindowInstance } from "./types";
import {
  getAltEscPlan,
  getAltEscPileOrder,
  getMinimizeOthersIds,
  getRestoreOthersIds,
  getVerticalStretchPatch,
  isVerticallyStretched,
} from "./windowChords";

const make = (id: string, z: number, extra: Partial<WindowInstance> = {}): WindowInstance => ({
  appId: "notepad",
  desktopIndex: 0,
  height: 400,
  id,
  maximized: false,
  minimized: false,
  width: 600,
  x: 100,
  y: 80,
  z,
  ...extra,
});

const area = { height: 852, width: 1440, x: 0, y: 0 };

describe("getMinimizeOthersIds", () => {
  it("puts away every window but the active one", () => {
    const windows = [make("a", 3), make("b", 2), make("c", 1)];
    expect(getMinimizeOthersIds(windows, "b", 0)).toEqual(["a", "c"]);
  });

  it("leaves other desktops and minimized windows alone", () => {
    const windows = [
      make("a", 3),
      make("b", 2, { desktopIndex: 1 }),
      make("c", 1, { minimized: true }),
    ];
    expect(getMinimizeOthersIds(windows, "a", 0)).toEqual([]);
  });

  it("does nothing without an active window", () => {
    expect(getMinimizeOthersIds([make("a", 1)], null, 0)).toEqual([]);
  });
});

describe("getRestoreOthersIds", () => {
  it("brings back only what is still minimized", () => {
    const windows = [
      make("a", 3, { minimized: true }),
      make("b", 2),
      make("c", 1, { minimized: true }),
    ];
    expect(getRestoreOthersIds(windows, ["a", "b", "gone"])).toEqual(["a"]);
  });
});

describe("vertical stretch", () => {
  it("spans the work area and keeps the window's width and place", () => {
    expect(getVerticalStretchPatch(make("a", 1), area)).toEqual({ height: 852, y: 0 });
  });

  it("knows a window that already spans the work area", () => {
    expect(isVerticallyStretched(make("a", 1, { height: 852, y: 0 }), area)).toBe(true);
    expect(isVerticallyStretched(make("a", 1), area)).toBe(false);
  });
});

describe("getAltEscPlan", () => {
  it("sends the front window back and brings the next one forward", () => {
    const windows = [make("a", 3), make("b", 2), make("c", 1)];
    expect(getAltEscPlan(windows, "a", 0)).toEqual({ activate: "b", sendBack: "a" });
  });

  it("cycles from the active window even when it is not on top", () => {
    const windows = [make("a", 3), make("b", 2), make("c", 1)];
    expect(getAltEscPlan(windows, "c", 0)).toEqual({ activate: "a", sendBack: "c" });
  });

  it("has nothing to cycle with one window, or none on this desktop", () => {
    expect(getAltEscPlan([make("a", 1)], "a", 0)).toBeNull();
    expect(
      getAltEscPlan(
        [make("a", 1, { desktopIndex: 1 }), make("b", 2, { desktopIndex: 1 })],
        null,
        0,
      ),
    ).toBeNull();
  });

  it("skips minimized windows", () => {
    const windows = [make("a", 3), make("b", 2, { minimized: true }), make("c", 1)];
    expect(getAltEscPlan(windows, "a", 0)).toEqual({ activate: "c", sendBack: "a" });
  });
});

describe("getAltEscPileOrder", () => {
  it("moves the active window to the back and keeps the rest in order", () => {
    const windows = [make("a", 3), make("b", 2), make("c", 1)];
    expect(getAltEscPileOrder(windows, "a", 0)).toEqual(["b", "c", "a"]);
  });

  it("cycles all the way round in as many presses as there are windows", () => {
    let windows = [make("a", 3), make("b", 2), make("c", 1)];
    let active = "a";
    const seen: string[] = [];
    for (let press = 0; press < 3; press += 1) {
      const order = getAltEscPileOrder(windows, active, 0)!;
      windows = windows.map((item) => ({
        ...item,
        z: 10 + order.length - order.indexOf(item.id),
      }));
      active = order[0];
      seen.push(active);
    }
    expect(seen).toEqual(["b", "c", "a"]);
  });

  it("has no order to give with nothing to cycle", () => {
    expect(getAltEscPileOrder([make("a", 1)], "a", 0)).toBeNull();
  });
});
