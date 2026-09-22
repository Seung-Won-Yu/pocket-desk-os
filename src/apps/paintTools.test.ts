import { describe, expect, it } from "vitest";
import {
  getResizedDimensions,
  PAINT_MAX_DIMENSION,
  PAINT_MIN_DIMENSION,
  toHexColor,
} from "./paintTools";

describe("toHexColor", () => {
  it("writes the channels as two hex digits each", () => {
    expect(toHexColor(255, 0, 0)).toBe("#ff0000");
    expect(toHexColor(15, 16, 17)).toBe("#0f1011");
  });

  it("reads an untouched pixel as the paper, not as black", () => {
    expect(toHexColor(0, 0, 0, 0)).toBe("#ffffff");
  });

  it("keeps a black pixel that was actually painted", () => {
    expect(toHexColor(0, 0, 0, 255)).toBe("#000000");
  });

  it("clamps a channel that is out of range", () => {
    expect(toHexColor(-20, 300, 128)).toBe("#00ff80");
  });
});

describe("getResizedDimensions", () => {
  const original = { height: 720, width: 1120 };

  it("takes both sides as typed with 비율 유지 off", () => {
    expect(getResizedDimensions(original, { height: 100, width: 300 }, false, "width")).toEqual(
      {
        height: 100,
        width: 300,
      },
    );
  });

  it("follows the edited side with 비율 유지 on", () => {
    expect(getResizedDimensions(original, { height: 720, width: 560 }, true, "width")).toEqual({
      height: 360,
      width: 560,
    });
    expect(
      getResizedDimensions(original, { height: 360, width: 1120 }, true, "height"),
    ).toEqual({
      height: 360,
      width: 560,
    });
  });

  it("keeps the aspect of the image, not of whatever the boxes hold", () => {
    expect(
      getResizedDimensions(original, { height: 9999, width: 224 }, true, "width").height,
    ).toBe(144);
  });

  it("clamps to something a canvas can be", () => {
    expect(getResizedDimensions(original, { height: 0, width: 0 }, false, "width")).toEqual({
      height: PAINT_MIN_DIMENSION,
      width: PAINT_MIN_DIMENSION,
    });
    expect(
      getResizedDimensions(original, { height: 99999, width: 99999 }, false, "width").width,
    ).toBe(PAINT_MAX_DIMENSION);
  });

  it("survives a box holding something that is not a number", () => {
    expect(
      getResizedDimensions(original, { height: Number.NaN, width: Number.NaN }, false, "width"),
    ).toEqual({ height: PAINT_MIN_DIMENSION, width: PAINT_MIN_DIMENSION });
  });

  it("does not divide by an empty original", () => {
    expect(
      getResizedDimensions({ height: 0, width: 0 }, { height: 50, width: 80 }, true, "width"),
    ).toEqual({ height: 50, width: 80 });
  });
});
