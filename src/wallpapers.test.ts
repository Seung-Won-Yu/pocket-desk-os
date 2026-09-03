import { describe, expect, it } from "vitest";
import { getWallpaperStyle, resolveCustomWallpaper } from "./wallpapers";

const PIXELS = "data:image/png;base64,iVBORw0KGgo=";

describe("resolveCustomWallpaper", () => {
  const items = [
    { content: PIXELS, id: "pic", kind: "canvas" as const, trashed: false },
    { content: "", id: "blank", kind: "canvas" as const, trashed: false },
    { content: PIXELS, id: "binned", kind: "canvas" as const, trashed: true },
    { content: "hello", id: "note", kind: "note" as const, trashed: false },
  ];

  it("returns the picture's pixels for a live picture file", () => {
    expect(resolveCustomWallpaper(items, "pic")).toBe(PIXELS);
  });

  it("falls back to nothing for no choice, a blank picture, a binned one, a text file, or a missing id", () => {
    expect(resolveCustomWallpaper(items, null)).toBeNull();
    expect(resolveCustomWallpaper(items, "blank")).toBeNull();
    expect(resolveCustomWallpaper(items, "binned")).toBeNull();
    expect(resolveCustomWallpaper(items, "note")).toBeNull();
    expect(resolveCustomWallpaper(items, "gone")).toBeNull();
  });
});

describe("getWallpaperStyle", () => {
  it("prefers the custom picture over the preset", () => {
    expect(getWallpaperStyle("ribbon", PIXELS)["--wallpaper-image"]).toBe(`url("${PIXELS}")`);
    expect(getWallpaperStyle("ribbon")["--wallpaper-image"]).toContain(
      "wallpapers/blue-ribbon.jpg",
    );
  });
});
