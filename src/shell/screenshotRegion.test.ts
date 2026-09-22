import { describe, expect, it } from "vitest";
import {
  getRegionCropRect,
  getRegionSelectionBounds,
  isRegionSelectionUsable,
  REGION_MIN_SIZE,
} from "./screenshotRegion";

describe("getRegionSelectionBounds", () => {
  it("normalises a drag that runs up and to the left", () => {
    expect(getRegionSelectionBounds({ x: 300, y: 200 }, { x: 100, y: 50 })).toEqual({
      height: 150,
      left: 100,
      top: 50,
      width: 200,
    });
  });

  it("reports nothing for a press that never moved", () => {
    expect(getRegionSelectionBounds({ x: 10, y: 10 }, { x: 10, y: 10 })).toMatchObject({
      height: 0,
      width: 0,
    });
  });
});

describe("isRegionSelectionUsable", () => {
  it("refuses a band under the minimum on either axis", () => {
    expect(
      isRegionSelectionUsable({ height: 40, left: 0, top: 0, width: REGION_MIN_SIZE - 1 }),
    ).toBe(false);
    expect(
      isRegionSelectionUsable({ height: REGION_MIN_SIZE - 1, left: 0, top: 0, width: 40 }),
    ).toBe(false);
  });

  it("takes a band at the minimum", () => {
    expect(
      isRegionSelectionUsable({
        height: REGION_MIN_SIZE,
        left: 0,
        top: 0,
        width: REGION_MIN_SIZE,
      }),
    ).toBe(true);
  });
});

describe("getRegionCropRect", () => {
  const capture = { height: 1600, width: 2560 };
  const viewport = { height: 800, width: 1280 };

  it("scales the band into the picture's own pixels", () => {
    expect(
      getRegionCropRect({ height: 100, left: 40, top: 60, width: 200 }, capture, viewport),
    ).toEqual({ height: 200, left: 80, top: 120, width: 400 });
  });

  it("keeps a one-to-one picture where it was", () => {
    expect(
      getRegionCropRect(
        { height: 30, left: 10, top: 20, width: 40 },
        { height: 800, width: 1280 },
        viewport,
      ),
    ).toEqual({ height: 30, left: 10, top: 20, width: 40 });
  });

  it("clamps a band that ran off the edge", () => {
    const rect = getRegionCropRect(
      { height: 400, left: 1200, top: 700, width: 400 },
      { height: 800, width: 1280 },
      viewport,
    );
    expect(rect.left + rect.width).toBeLessThanOrEqual(1280);
    expect(rect.top + rect.height).toBeLessThanOrEqual(800);
  });

  it("never asks for an empty crop", () => {
    const rect = getRegionCropRect({ height: 0, left: 0, top: 0, width: 0 }, capture, viewport);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });
});
