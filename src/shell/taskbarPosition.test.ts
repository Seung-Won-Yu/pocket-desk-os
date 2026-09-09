// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TASKBAR_POSITION,
  type TaskbarLayout,
  TASKBAR_POSITIONS,
  applyTaskbarLayout,
  getTaskbarLayout,
  getTaskbarPosition,
  getTaskbarThickness,
  getWorkArea,
  getWorkAreaInsets,
  loadAutoHideTaskbar,
  loadSmallTaskbarButtons,
  loadTaskbarLayout,
  persistAutoHideTaskbar,
  persistSmallTaskbarButtons,
  isTaskbarPosition,
  isVerticalTaskbar,
  loadTaskbarPosition,
  persistTaskbarPosition,
} from "./taskbarPosition";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.taskbar;
  delete document.documentElement.dataset.taskbarAutohide;
  delete document.documentElement.dataset.taskbarSmall;
});

/** A layout with only the parts a test cares about spelled out. */
function layout(overrides: Partial<TaskbarLayout> = {}): TaskbarLayout {
  return { autoHide: false, position: "bottom", smallButtons: false, ...overrides };
}

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
    expect(getTaskbarThickness(layout({ position: "bottom" }))).toBe(48);
    expect(getTaskbarThickness(layout({ position: "top" }))).toBe(48);
    expect(getTaskbarThickness(layout({ position: "left" }))).toBe(68);
    expect(getTaskbarThickness(layout({ position: "right" }))).toBe(68);
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
    expect(getWorkAreaInsets(layout({ position: "bottom" }))).toEqual({
      bottom: 48,
      left: 0,
      right: 0,
      top: 0,
    });
    expect(getWorkAreaInsets(layout({ position: "top" }))).toEqual({
      bottom: 0,
      left: 0,
      right: 0,
      top: 48,
    });
    expect(getWorkAreaInsets(layout({ position: "left" }))).toEqual({
      bottom: 0,
      left: 68,
      right: 0,
      top: 0,
    });
    expect(getWorkAreaInsets(layout({ position: "right" }))).toEqual({
      bottom: 0,
      left: 0,
      right: 68,
      top: 0,
    });
  });
});

describe("getWorkArea", () => {
  const viewport = { height: 900, width: 1440 };

  it("moves the area's origin when the bar takes a leading edge", () => {
    expect(getWorkArea(viewport, layout({ position: "bottom" }))).toEqual({
      height: 852,
      width: 1440,
      x: 0,
      y: 0,
    });
    expect(getWorkArea(viewport, layout({ position: "top" }))).toEqual({
      height: 852,
      width: 1440,
      x: 0,
      y: 48,
    });
    expect(getWorkArea(viewport, layout({ position: "left" }))).toEqual({
      height: 900,
      width: 1372,
      x: 68,
      y: 0,
    });
    expect(getWorkArea(viewport, layout({ position: "right" }))).toEqual({
      height: 900,
      width: 1372,
      x: 0,
      y: 0,
    });
  });

  it("reports the space that is really left, with no minimum of its own", () => {
    // Floored here, the area came out larger than the screen and pushed desktop
    // icons off the bottom right of a small viewport.
    expect(getWorkArea({ height: 200, width: 200 }, layout())).toEqual({
      height: 152,
      width: 200,
      x: 0,
      y: 0,
    });
  });
});

describe("getTaskbarPosition", () => {
  it("reads the same attribute the stylesheet keys off", () => {
    applyTaskbarLayout(layout({ position: "right" }));
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

describe("자동 숨기기와 작은 단추", () => {
  it("gives the whole screen to the windows while the bar is hidden", () => {
    // The bar is not on top of anything: it is off screen until it is asked for.
    expect(getWorkAreaInsets(layout({ autoHide: true }))).toEqual({
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    });
    expect(getWorkArea({ height: 900, width: 1440 }, layout({ autoHide: true }))).toEqual({
      height: 900,
      width: 1440,
      x: 0,
      y: 0,
    });
    // Even on a side edge, and even with the buttons already small.
    expect(
      getWorkAreaInsets(layout({ autoHide: true, position: "left", smallButtons: true })),
    ).toEqual({ bottom: 0, left: 0, right: 0, top: 0 });
  });

  it("thins the bar for small buttons, and a side bar less than a horizontal one", () => {
    expect(getTaskbarThickness(layout({ smallButtons: true }))).toBe(32);
    expect(getTaskbarThickness(layout({ position: "top", smallButtons: true }))).toBe(32);
    // The stacked clock still needs width.
    expect(getTaskbarThickness(layout({ position: "left", smallButtons: true }))).toBe(48);
    expect(getTaskbarThickness(layout({ position: "right", smallButtons: true }))).toBe(48);
  });

  it("takes the smaller bar out of the work area, not the full one", () => {
    expect(getWorkArea({ height: 900, width: 1440 }, layout({ smallButtons: true }))).toEqual({
      height: 868,
      width: 1440,
      x: 0,
      y: 0,
    });
  });

  it("reads all three settings off the elements the stylesheet keys on", () => {
    applyTaskbarLayout({ autoHide: true, position: "top", smallButtons: true });
    expect(document.documentElement.dataset.taskbarAutohide).toBe("on");
    expect(document.documentElement.dataset.taskbarSmall).toBe("on");
    expect(getTaskbarLayout()).toEqual({
      autoHide: true,
      position: "top",
      smallButtons: true,
    });

    applyTaskbarLayout(layout());
    expect(getTaskbarLayout()).toEqual({
      autoHide: false,
      position: "bottom",
      smallButtons: false,
    });
  });

  it("round-trips both switches, and starts with both off", () => {
    expect(loadAutoHideTaskbar()).toBe(false);
    expect(loadSmallTaskbarButtons()).toBe(false);
    persistAutoHideTaskbar(true);
    persistSmallTaskbarButtons(true);
    expect(loadTaskbarLayout()).toEqual({
      autoHide: true,
      position: "bottom",
      smallButtons: true,
    });
  });
});
