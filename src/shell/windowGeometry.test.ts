import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDesktopWorkArea,
  getSnapPreviewStyle,
  getWindowSnapPatch,
  getWindowSnapZone,
} from "./windowGeometry";

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
  it("spans the viewport and reserves the app bar", () => {
    setViewport(1280, 800);
    expect(getDesktopWorkArea()).toEqual({ height: 752, width: 1280, x: 0, y: 0 });
  });

  it("floors the work area at the minimum window size on tiny viewports", () => {
    setViewport(200, 200);
    expect(getDesktopWorkArea()).toEqual({ height: 240, width: 320, x: 0, y: 0 });
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
      height: 752,
      maximized: false,
      minimized: false,
      width: 640,
      x: 0,
      y: 0,
    });
    expect(getWindowSnapPatch("right")).toEqual({
      height: 752,
      maximized: false,
      minimized: false,
      width: 640,
      x: 640,
      y: 0,
    });
  });

  it("fills a quarter for each corner zone", () => {
    setViewport(1280, 800);
    expect(getWindowSnapPatch("top-left")).toEqual({
      height: 376,
      maximized: false,
      minimized: false,
      width: 640,
      x: 0,
      y: 0,
    });
    expect(getWindowSnapPatch("top-right")).toEqual({
      height: 376,
      maximized: false,
      minimized: false,
      width: 640,
      x: 640,
      y: 0,
    });
    expect(getWindowSnapPatch("bottom-left")).toEqual({
      height: 376,
      maximized: false,
      minimized: false,
      width: 640,
      x: 0,
      y: 376,
    });
    expect(getWindowSnapPatch("bottom-right")).toEqual({
      height: 376,
      maximized: false,
      minimized: false,
      width: 640,
      x: 640,
      y: 376,
    });
  });

  it("tiles the halves flush against each other and the viewport edges", () => {
    setViewport(1280, 800);
    const left = getWindowSnapPatch("left");
    const right = getWindowSnapPatch("right");

    // Windows leaves no seam: the two halves meet, and together they cover the
    // full width. A maximized window is flush, so a snapped one must be too.
    expect(left.x).toBe(0);
    expect((right.x ?? 0) - ((left.x ?? 0) + (left.width ?? 0))).toBe(0);
    expect(1280 - ((right.x ?? 0) + (right.width ?? 0))).toBe(0);
  });

  it("tiles the quarter rows flush against each other and the app bar", () => {
    setViewport(1280, 800);
    const top = getWindowSnapPatch("top-left");
    const bottom = getWindowSnapPatch("bottom-left");

    expect((bottom.y ?? 0) - ((top.y ?? 0) + (top.height ?? 0))).toBe(0);
    expect(800 - 48 - ((bottom.y ?? 0) + (bottom.height ?? 0))).toBe(0);
  });

  it("always clears the maximized and minimized flags for geometry zones", () => {
    setViewport(1280, 800);
    for (const zone of [
      "left",
      "right",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ] as const) {
      expect(getWindowSnapPatch(zone).maximized).toBe(false);
      expect(getWindowSnapPatch(zone).minimized).toBe(false);
    }
  });

  it("keeps halves and quarters side by side at the narrowest snap-enabled viewport", () => {
    setViewport(720, 420);
    expect(getWindowSnapPatch("left")).toEqual({
      height: 372,
      maximized: false,
      minimized: false,
      width: 360,
      x: 0,
      y: 0,
    });
    expect(getWindowSnapPatch("right")).toEqual({
      height: 372,
      maximized: false,
      minimized: false,
      width: 360,
      x: 360,
      y: 0,
    });
    // The 220px minimum quarter height wins over half of the 372px work area,
    // so the bottom row is pushed up to keep its full height on screen.
    expect(getWindowSnapPatch("bottom-right")).toEqual({
      height: 220,
      maximized: false,
      minimized: false,
      width: 360,
      x: 360,
      y: 152,
    });
  });

  it("honours the minimum window width instead of halving a tiny viewport", () => {
    setViewport(200, 200);
    const left = getWindowSnapPatch("left");
    const right = getWindowSnapPatch("right");
    expect(left.width).toBe(320);
    expect(right.width).toBe(320);
    // The floored width fills the whole work area, so both halves share one origin.
    expect(left.x).toBe(0);
    expect(right.x).toBe(0);
  });
});

describe("getSnapPreviewStyle", () => {
  it("previews the whole work area for the top zone", () => {
    setViewport(1280, 800);
    expect(getSnapPreviewStyle("top")).toEqual({ height: 752, left: 0, top: 0, width: 1280 });
  });

  it("mirrors the half and quarter patches", () => {
    setViewport(1280, 800);
    expect(getSnapPreviewStyle("left")).toEqual({ height: 752, left: 0, top: 0, width: 640 });
    expect(getSnapPreviewStyle("right")).toEqual({
      height: 752,
      left: 640,
      top: 0,
      width: 640,
    });
    expect(getSnapPreviewStyle("bottom-right")).toEqual({
      height: 376,
      left: 640,
      top: 376,
      width: 640,
    });
  });

  it("stays in sync with the patch geometry for every non-top zone", () => {
    setViewport(1024, 768);
    for (const zone of [
      "left",
      "right",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ] as const) {
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
