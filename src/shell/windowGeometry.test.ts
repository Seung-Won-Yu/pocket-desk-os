import { afterEach, describe, expect, it, vi } from "vitest";
import { getDesktopWorkArea, getSnapPreviewStyle, getWindowSnapPatch, getWindowSnapZone } from "./windowGeometry";

// These helpers read `window.innerWidth` / `window.innerHeight` directly and the vitest
// environment is `node`, so every test installs a minimal viewport stub of its own.
function setViewport(width: number, height: number) {
  vi.stubGlobal("window", { innerHeight: height, innerWidth: width });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWindowSnapZone", () => {
  it("detects the top edge band away from the corners", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(640, 0)).toBe("top");
    expect(getWindowSnapZone(640, 24)).toBe("top");
  });

  it("stops detecting the top edge one pixel past the edge band", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(640, 25)).toBeNull();
  });

  it("detects the left edge band away from the corners", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(0, 400)).toBe("left");
    expect(getWindowSnapZone(24, 400)).toBe("left");
    expect(getWindowSnapZone(25, 400)).toBeNull();
  });

  it("detects the right edge band relative to the viewport width", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(1256, 400)).toBe("right");
    expect(getWindowSnapZone(1279, 400)).toBe("right");
    expect(getWindowSnapZone(1255, 400)).toBeNull();
  });

  it("returns null in the middle of the desktop", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(640, 400)).toBeNull();
  });

  it("has no plain bottom zone", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(640, 680)).toBeNull();
    expect(getWindowSnapZone(640, 799)).toBeNull();
  });

  it("prefers corners over edges", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(0, 0)).toBe("top-left");
    expect(getWindowSnapZone(1280, 0)).toBe("top-right");
    expect(getWindowSnapZone(0, 799)).toBe("bottom-left");
    expect(getWindowSnapZone(1280, 799)).toBe("bottom-right");
  });

  it("uses the wider corner band, inclusive of its boundary", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(72, 72)).toBe("top-left");
    expect(getWindowSnapZone(1208, 72)).toBe("top-right");
    expect(getWindowSnapZone(72, 680)).toBe("bottom-left");
    expect(getWindowSnapZone(1208, 680)).toBe("bottom-right");
  });

  it("falls into the dead zone just inside the corner band", () => {
    setViewport(1280, 800);
    // Past the corner band on both axes, but not inside the narrower edge bands.
    expect(getWindowSnapZone(73, 73)).toBeNull();
    expect(getWindowSnapZone(1207, 679)).toBeNull();
  });

  it("measures the bottom corner band above the app bar", () => {
    setViewport(1280, 800);
    // 800 - 48 (app bar) - 72 (corner band) = 680
    expect(getWindowSnapZone(10, 679)).toBe("left");
    expect(getWindowSnapZone(10, 680)).toBe("bottom-left");
  });

  it("disables snapping on narrow viewports", () => {
    setViewport(719, 800);
    expect(getWindowSnapZone(0, 0)).toBeNull();
    expect(getWindowSnapZone(5, 400)).toBeNull();
  });

  it("disables snapping on short viewports", () => {
    setViewport(1280, 419);
    expect(getWindowSnapZone(0, 0)).toBeNull();
    expect(getWindowSnapZone(640, 5)).toBeNull();
  });

  it("enables snapping exactly at the minimum supported viewport", () => {
    setViewport(720, 420);
    expect(getWindowSnapZone(360, 0)).toBe("top");
    expect(getWindowSnapZone(0, 200)).toBe("left");
    expect(getWindowSnapZone(696, 200)).toBe("right");
    expect(getWindowSnapZone(0, 0)).toBe("top-left");
    expect(getWindowSnapZone(720, 300)).toBe("bottom-right");
  });

  it("treats pointer coordinates outside the viewport as edge hits", () => {
    setViewport(1280, 800);
    expect(getWindowSnapZone(-50, 400)).toBe("left");
    expect(getWindowSnapZone(640, -10)).toBe("top");
    expect(getWindowSnapZone(5000, 400)).toBe("right");
    expect(getWindowSnapZone(-50, -10)).toBe("top-left");
  });
});

describe("getDesktopWorkArea", () => {
  it("insets the viewport by the gutter and reserves the app bar", () => {
    setViewport(1280, 800);
    expect(getDesktopWorkArea()).toEqual({ height: 732, width: 1260, x: 10, y: 10 });
  });

  it("floors the work area at the minimum window size on tiny viewports", () => {
    setViewport(200, 200);
    expect(getDesktopWorkArea()).toEqual({ height: 240, width: 320, x: 10, y: 10 });
  });
});

describe("getWindowSnapPatch", () => {
  it("maximizes for the top zone without touching geometry", () => {
    setViewport(1280, 800);
    expect(getWindowSnapPatch("top")).toEqual({ maximized: true, minimized: false });
  });

  it("fills a full-height half for the left and right zones", () => {
    setViewport(1280, 800);
    expect(getWindowSnapPatch("left")).toEqual({
      height: 732,
      maximized: false,
      minimized: false,
      width: 625,
      x: 10,
      y: 10,
    });
    expect(getWindowSnapPatch("right")).toEqual({
      height: 732,
      maximized: false,
      minimized: false,
      width: 625,
      x: 645,
      y: 10,
    });
  });

  it("fills a quarter for each corner zone", () => {
    setViewport(1280, 800);
    expect(getWindowSnapPatch("top-left")).toEqual({
      height: 361,
      maximized: false,
      minimized: false,
      width: 625,
      x: 10,
      y: 10,
    });
    expect(getWindowSnapPatch("top-right")).toEqual({
      height: 361,
      maximized: false,
      minimized: false,
      width: 625,
      x: 645,
      y: 10,
    });
    expect(getWindowSnapPatch("bottom-left")).toEqual({
      height: 361,
      maximized: false,
      minimized: false,
      width: 625,
      x: 10,
      y: 381,
    });
    expect(getWindowSnapPatch("bottom-right")).toEqual({
      height: 361,
      maximized: false,
      minimized: false,
      width: 625,
      x: 645,
      y: 381,
    });
  });

  it("leaves exactly one gutter between the halves and the viewport edges", () => {
    setViewport(1280, 800);
    const left = getWindowSnapPatch("left");
    const right = getWindowSnapPatch("right");

    expect(left.x).toBe(10);
    expect((right.x ?? 0) - ((left.x ?? 0) + (left.width ?? 0))).toBe(10);
    expect(1280 - ((right.x ?? 0) + (right.width ?? 0))).toBe(10);
  });

  it("leaves exactly one gutter between the quarter rows and above the app bar", () => {
    setViewport(1280, 800);
    const top = getWindowSnapPatch("top-left");
    const bottom = getWindowSnapPatch("bottom-left");

    expect((bottom.y ?? 0) - ((top.y ?? 0) + (top.height ?? 0))).toBe(10);
    expect(800 - 48 - ((bottom.y ?? 0) + (bottom.height ?? 0))).toBe(10);
  });

  it("always clears the maximized and minimized flags for geometry zones", () => {
    setViewport(1280, 800);
    for (const zone of ["left", "right", "top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      expect(getWindowSnapPatch(zone).maximized).toBe(false);
      expect(getWindowSnapPatch(zone).minimized).toBe(false);
    }
  });

  it("keeps halves and quarters side by side at the narrowest snap-enabled viewport", () => {
    setViewport(720, 420);
    expect(getWindowSnapPatch("left")).toEqual({
      height: 352,
      maximized: false,
      minimized: false,
      width: 345,
      x: 10,
      y: 10,
    });
    expect(getWindowSnapPatch("right")).toEqual({
      height: 352,
      maximized: false,
      minimized: false,
      width: 345,
      x: 365,
      y: 10,
    });
    // The 220px minimum quarter height wins over half of the 352px work area.
    expect(getWindowSnapPatch("bottom-right")).toEqual({
      height: 220,
      maximized: false,
      minimized: false,
      width: 345,
      x: 365,
      y: 142,
    });
  });

  it("honours the minimum window width instead of halving a tiny viewport", () => {
    setViewport(200, 200);
    const left = getWindowSnapPatch("left");
    const right = getWindowSnapPatch("right");
    expect(left.width).toBe(320);
    expect(right.width).toBe(320);
    // The floored width fills the whole work area, so both halves share one origin.
    expect(left.x).toBe(10);
    expect(right.x).toBe(10);
  });
});

describe("getSnapPreviewStyle", () => {
  it("previews the whole work area for the top zone", () => {
    setViewport(1280, 800);
    expect(getSnapPreviewStyle("top")).toEqual({ height: 732, left: 10, top: 10, width: 1260 });
  });

  it("mirrors the half and quarter patches", () => {
    setViewport(1280, 800);
    expect(getSnapPreviewStyle("left")).toEqual({ height: 732, left: 10, top: 10, width: 625 });
    expect(getSnapPreviewStyle("right")).toEqual({ height: 732, left: 645, top: 10, width: 625 });
    expect(getSnapPreviewStyle("bottom-right")).toEqual({
      height: 361,
      left: 645,
      top: 381,
      width: 625,
    });
  });

  it("stays in sync with the patch geometry for every non-top zone", () => {
    setViewport(1024, 768);
    for (const zone of ["left", "right", "top-left", "top-right", "bottom-left", "bottom-right"] as const) {
      const patch = getWindowSnapPatch(zone);
      expect(getSnapPreviewStyle(zone)).toEqual({
        height: patch.height,
        left: patch.x,
        top: patch.y,
        width: patch.width,
      });
    }
  });
});
