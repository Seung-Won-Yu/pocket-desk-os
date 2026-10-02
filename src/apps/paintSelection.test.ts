import { describe, expect, it } from "vitest";
import {
  applyPaintTransform,
  describePaintTransform,
  getSelectionRect,
  isPointInRect,
  isSelectionUsable,
  offsetRect,
  PAINT_TRANSFORMS,
} from "./paintSelection";

const canvas = { height: 100, width: 200 };

describe("getSelectionRect", () => {
  it("normalises a drag that runs up and to the left", () => {
    expect(getSelectionRect({ x: 150, y: 80 }, { x: 50, y: 20 }, canvas)).toEqual({
      height: 60,
      width: 100,
      x: 50,
      y: 20,
    });
  });

  it("takes whole pixels, rounding outward", () => {
    expect(getSelectionRect({ x: 10.6, y: 10.2 }, { x: 20.2, y: 30.7 }, canvas)).toEqual({
      height: 21,
      width: 11,
      x: 10,
      y: 10,
    });
  });

  it("keeps a drag that ran off the canvas on it", () => {
    expect(getSelectionRect({ x: 180, y: 90 }, { x: 260, y: 140 }, canvas)).toEqual({
      height: 10,
      width: 20,
      x: 180,
      y: 90,
    });
  });
});

describe("isSelectionUsable", () => {
  it("refuses a click that never became a drag", () => {
    expect(isSelectionUsable({ height: 1, width: 40, x: 0, y: 0 })).toBe(false);
    expect(isSelectionUsable(null)).toBe(false);
  });

  it("takes a selection two pixels on each side", () => {
    expect(isSelectionUsable({ height: 2, width: 2, x: 0, y: 0 })).toBe(true);
  });
});

describe("isPointInRect", () => {
  const rect = { height: 10, width: 10, x: 5, y: 5 };

  it("counts the top-left edge in and the bottom-right edge out", () => {
    expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(true);
    expect(isPointInRect({ x: 15, y: 10 }, rect)).toBe(false);
  });

  it("rejects a point beside the rectangle", () => {
    expect(isPointInRect({ x: 4, y: 10 }, rect)).toBe(false);
  });
});

describe("offsetRect", () => {
  it("moves without resizing and lets the rectangle leave the canvas", () => {
    expect(offsetRect({ height: 10, width: 20, x: 5, y: 5 }, -12.4, 3.6)).toEqual({
      height: 10,
      width: 20,
      x: -7,
      y: 9,
    });
  });
});

describe("describePaintTransform", () => {
  it("swaps the sides for a quarter turn and keeps them for the rest", () => {
    expect(describePaintTransform("rotateRight", 200, 100)).toMatchObject({
      height: 200,
      width: 100,
    });
    expect(describePaintTransform("rotateLeft", 200, 100)).toMatchObject({
      height: 200,
      width: 100,
    });
    expect(describePaintTransform("rotate180", 200, 100)).toMatchObject({
      height: 100,
      width: 200,
    });
    expect(describePaintTransform("flipVertical", 200, 100)).toMatchObject({
      height: 100,
      width: 200,
    });
  });

  it("turns the top-left corner to the top-right on a right turn", () => {
    const plan = describePaintTransform("rotateRight", 200, 100);
    expect(applyPaintTransform(plan, { x: 0, y: 0 })).toEqual({ x: 100, y: 0 });
    // The top-right corner ends at the bottom-right.
    expect(applyPaintTransform(plan, { x: 200, y: 0 })).toEqual({ x: 100, y: 200 });
  });

  it("turns the top-left corner to the bottom-left on a left turn", () => {
    const plan = describePaintTransform("rotateLeft", 200, 100);
    expect(applyPaintTransform(plan, { x: 0, y: 0 })).toEqual({ x: 0, y: 200 });
  });

  it("sends each corner to the opposite one on a half turn", () => {
    const plan = describePaintTransform("rotate180", 200, 100);
    expect(applyPaintTransform(plan, { x: 0, y: 0 })).toEqual({ x: 200, y: 100 });
  });

  it("mirrors left to right for 가로 대칭 and top to bottom for 세로 대칭", () => {
    const horizontal = describePaintTransform("flipHorizontal", 200, 100);
    expect(applyPaintTransform(horizontal, { x: 0, y: 30 })).toEqual({ x: 200, y: 30 });
    const vertical = describePaintTransform("flipVertical", 200, 100);
    expect(applyPaintTransform(vertical, { x: 40, y: 0 })).toEqual({ x: 40, y: 100 });
  });

  it("lands every corner inside the result", () => {
    for (const { id } of PAINT_TRANSFORMS) {
      const plan = describePaintTransform(id, 200, 100);
      for (const corner of [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 0, y: 100 },
        { x: 200, y: 100 },
      ]) {
        const landed = applyPaintTransform(plan, corner);
        expect(landed.x).toBeGreaterThanOrEqual(0);
        expect(landed.x).toBeLessThanOrEqual(plan.width);
        expect(landed.y).toBeGreaterThanOrEqual(0);
        expect(landed.y).toBeLessThanOrEqual(plan.height);
      }
    }
  });
});
