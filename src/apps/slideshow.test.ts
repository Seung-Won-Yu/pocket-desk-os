import { describe, expect, it } from "vitest";
import { canRunSlideshow, getNextSlideIndex, SLIDESHOW_INTERVAL_MS } from "./slideshow";

describe("getNextSlideIndex", () => {
  it("steps forward", () => {
    expect(getNextSlideIndex(0, 3)).toBe(1);
    expect(getNextSlideIndex(1, 3)).toBe(2);
  });

  it("wraps at the end, because a show loops", () => {
    expect(getNextSlideIndex(2, 3)).toBe(0);
  });

  it("stays put with nothing to show", () => {
    expect(getNextSlideIndex(0, 0)).toBe(0);
  });
});

describe("canRunSlideshow", () => {
  it("needs more than one picture", () => {
    expect(canRunSlideshow(0)).toBe(false);
    expect(canRunSlideshow(1)).toBe(false);
    expect(canRunSlideshow(2)).toBe(true);
  });
});

describe("SLIDESHOW_INTERVAL_MS", () => {
  it("is a readable pace rather than a flicker", () => {
    expect(SLIDESHOW_INTERVAL_MS).toBeGreaterThanOrEqual(2000);
    expect(SLIDESHOW_INTERVAL_MS).toBeLessThanOrEqual(6000);
  });
});
