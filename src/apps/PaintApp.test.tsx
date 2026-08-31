// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { floodFill } from "./PaintApp";

/**
 * jsdom has no real canvas, so the 2D context is stubbed with a plain pixel
 * buffer — exactly the surface floodFill touches.
 */
function makeContext(width: number, height: number, paint: (data: Uint8ClampedArray) => void) {
  const data = new Uint8ClampedArray(width * height * 4);
  // White paper, opaque.
  for (let index = 0; index < data.length; index += 4) {
    data[index] = data[index + 1] = data[index + 2] = 255;
    data[index + 3] = 255;
  }
  paint(data);
  const context = {
    canvas: { height, width },
    getImageData: () => ({ data, height, width }),
    putImageData: () => undefined,
  } as unknown as CanvasRenderingContext2D & { data: Uint8ClampedArray };
  return { context, data };
}

const RED = "#ff0000";

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (y * width + x) * 4;
  data[index] = 0;
  data[index + 1] = 0;
  data[index + 2] = 0;
  data[index + 3] = 255;
}

function countRed(data: Uint8ClampedArray) {
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] === 255 && data[index + 1] === 0 && data[index + 2] === 0) count += 1;
  }
  return count;
}

describe("floodFill", () => {
  it("stops at a boundary instead of leaking through it", () => {
    // A 10x10 canvas split by a vertical black wall at x=5.
    const { context, data } = makeContext(10, 10, (pixels) => {
      for (let y = 0; y < 10; y += 1) setPixel(pixels, 10, 5, y);
    });

    expect(floodFill(context, 2, 2, RED)).toBe(true);
    // Left of the wall: 5 columns × 10 rows; the wall and the right side stay.
    expect(countRed(data)).toBe(50);
  });

  it("reports a no-op fill so the caller does not dirty the document", () => {
    const { context } = makeContext(4, 4, () => undefined);

    expect(floodFill(context, 1, 1, "#ffffff")).toBe(false);
  });

  it("refuses a click outside the bitmap", () => {
    const { context } = makeContext(4, 4, () => undefined);

    expect(floodFill(context, -1, 2, RED)).toBe(false);
    expect(floodFill(context, 2, 99, RED)).toBe(false);
  });

  it("fills the whole connected region across span splits", () => {
    // A U shape: two arms joined at the bottom force the scanline to branch.
    const { context, data } = makeContext(7, 7, (pixels) => {
      for (let y = 0; y < 5; y += 1) setPixel(pixels, 7, 3, y);
    });

    expect(floodFill(context, 1, 1, RED)).toBe(true);
    // Everything except the 5-pixel wall is one region.
    expect(countRed(data)).toBe(7 * 7 - 5);
  });
});
