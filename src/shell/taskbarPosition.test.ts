// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TASKBAR_POSITION,
  TASKBAR_POSITIONS,
  applyTaskbarPosition,
  getTaskbarPosition,
  getTaskbarThickness,
  getWorkArea,
  getWorkAreaInsets,
  isTaskbarPosition,
  isVerticalTaskbar,
  loadTaskbarPosition,
  persistTaskbarPosition,
} from "./taskbarPosition";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.taskbar;
});

describe("isTaskbarPosition", () => {
  it("accepts the four edges and nothing else", () => {
    for (const position of TASKBAR_POSITIONS) expect(isTaskbarPosition(position)).toBe(true);
    expect(isTaskbarPosition("centre")).toBe(false);
    expect(isTaskbarPosition("")).toBe(false);
    expect(isTaskbarPosition(null)).toBe(false);
    expect(isTaskbarPosition(0)).toBe(false);
  });
});

describe("getTaskbarThickness", () => {
  it("gives a side bar the extra width its stacked tray needs", () => {
    expect(getTaskbarThickness("bottom")).toBe(48);
    expect(getTaskbarThickness("top")).toBe(48);
    expect(getTaskbarThickness("left")).toBe(68);
    expect(getTaskbarThickness("right")).toBe(68);
  });

  it("calls exactly the side positions vertical", () => {
    expect(isVerticalTaskbar("left")).toBe(true);
    expect(isVerticalTaskbar("right")).toBe(true);
    expect(isVerticalTaskbar("top")).toBe(false);
    expect(isVerticalTaskbar("bottom")).toBe(false);
  });
});

describe("getWorkAreaInsets", () => {
  it("reserves one edge and leaves the other three alone", () => {
    expect(getWorkAreaInsets("bottom")).toEqual({ bottom: 48, left: 0, right: 0, top: 0 });
    expect(getWorkAreaInsets("top")).toEqual({ bottom: 0, left: 0, right: 0, top: 48 });
    expect(getWorkAreaInsets("left")).toEqual({ bottom: 0, left: 68, right: 0, top: 0 });
    expect(getWorkAreaInsets("right")).toEqual({ bottom: 0, left: 0, right: 68, top: 0 });
  });
});

describe("getWorkArea", () => {
  const viewport = { height: 900, width: 1440 };

  it("moves the area's origin when the bar takes a leading edge", () => {
    expect(getWorkArea(viewport, "bottom")).toEqual({ height: 852, width: 1440, x: 0, y: 0 });
    expect(getWorkArea(viewport, "top")).toEqual({ height: 852, width: 1440, x: 0, y: 48 });
    expect(getWorkArea(viewport, "left")).toEqual({ height: 900, width: 1372, x: 68, y: 0 });
    expect(getWorkArea(viewport, "right")).toEqual({ height: 900, width: 1372, x: 0, y: 0 });
  });

  it("reports the space that is really left, with no minimum of its own", () => {
    // Floored here, the area came out larger than the screen and pushed desktop
    // icons off the bottom right of a small viewport.
    expect(getWorkArea({ height: 200, width: 200 }, "bottom")).toEqual({
      height: 152,
      width: 200,
      x: 0,
      y: 0,
    });
  });
});

describe("getTaskbarPosition", () => {
  it("reads the same attribute the stylesheet keys off", () => {
    applyTaskbarPosition("right");
    expect(document.documentElement.dataset.taskbar).toBe("right");
    expect(getTaskbarPosition()).toBe("right");
  });

  it("falls back to the bottom for an unset or hand-edited attribute", () => {
    expect(getTaskbarPosition()).toBe(DEFAULT_TASKBAR_POSITION);
    document.documentElement.dataset.taskbar = "diagonal";
    expect(getTaskbarPosition()).toBe(DEFAULT_TASKBAR_POSITION);
  });
});

describe("loadTaskbarPosition", () => {
  it("round-trips through storage", () => {
    persistTaskbarPosition("top");
    expect(localStorage.getItem("pocket-desk-taskbar-position-v1")).toBe("top");
    expect(loadTaskbarPosition()).toBe("top");
  });

  it("ignores a stored value that is not one of the four edges", () => {
    localStorage.setItem("pocket-desk-taskbar-position-v1", "floating");
    expect(loadTaskbarPosition()).toBe(DEFAULT_TASKBAR_POSITION);
  });
});
