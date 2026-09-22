import { describe, expect, it } from "vitest";
import { DESKTOP_VIEW_ORDER, getNextDesktopViewMode } from "./desktopViewMode";

describe("getNextDesktopViewMode", () => {
  it("enlarges on a wheel up and shrinks on a wheel down", () => {
    expect(getNextDesktopViewMode("medium", -120)).toBe("large");
    expect(getNextDesktopViewMode("medium", 120)).toBe("small");
  });

  it("holds at the ends instead of wrapping", () => {
    expect(getNextDesktopViewMode("large", -120)).toBe("large");
    expect(getNextDesktopViewMode("small", 120)).toBe("small");
  });

  it("stays put for a wheel that reported no direction", () => {
    expect(getNextDesktopViewMode("medium", 0)).toBe("medium");
  });

  it("goes small to large one step at a time", () => {
    const sizes = DESKTOP_VIEW_ORDER.map((_, index) =>
      DESKTOP_VIEW_ORDER.slice(0, index + 1).reduce(
        (mode) => getNextDesktopViewMode(mode, -120),
        "small" as const,
      ),
    );
    expect(sizes[0]).toBe("medium");
    expect(sizes[2]).toBe("large");
  });
});
