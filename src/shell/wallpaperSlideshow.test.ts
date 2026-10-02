import { describe, expect, it } from "vitest";
import type { WallpaperName } from "../types";
import {
  DEFAULT_WALLPAPER_SLIDESHOW,
  GALLERY_ALBUM,
  getAlbumSlides,
  getCurrentSlide,
  getOpeningSlide,
  getSlideDelay,
  getSlideshowAlbums,
  normalizeWallpaperSlideshow,
  pickNextSlide,
  type WallpaperSlide,
} from "./wallpaperSlideshow";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const presets: WallpaperName[] = ["meadow", "ribbon", "aurora"];

const entry = (
  id: string,
  parentId: string,
  kind: "canvas" | "folder" | "note" = "canvas",
  extra: { content?: string; name?: string; trashed?: boolean } = {},
) => ({
  content: kind === "canvas" ? PNG : undefined,
  id,
  kind,
  name: id,
  parentId,
  ...extra,
});

const items = [
  entry("shots", "pictures", "folder", { name: "스크린샷" }),
  entry("trip", "pictures", "folder", { name: "여행" }),
  entry("shot-10", "shots", "canvas", { name: "스크린샷 10.png" }),
  entry("shot-2", "shots", "canvas", { name: "스크린샷 2.png" }),
  entry("blank", "shots", "canvas", { content: "" }),
  entry("gone", "shots", "canvas", { trashed: true }),
  entry("readme", "shots", "note"),
  entry("beach", "trip"),
];

describe("getAlbumSlides", () => {
  it("is the presets for the gallery", () => {
    expect(getAlbumSlides(GALLERY_ALBUM, items, presets)).toEqual([
      { id: "meadow", kind: "preset" },
      { id: "ribbon", kind: "preset" },
      { id: "aurora", kind: "preset" },
    ]);
  });

  it("is the folder's own pictures in name order, skipping blanks, the bin and notes", () => {
    expect(getAlbumSlides("shots", items, presets)).toEqual([
      { itemId: "shot-2", kind: "picture" },
      { itemId: "shot-10", kind: "picture" },
    ]);
  });

  it("is nothing for a folder that is gone or in the bin", () => {
    expect(getAlbumSlides("missing", items, presets)).toEqual([]);
    const binned = items.map((item) =>
      item.id === "trip" ? { ...item, trashed: true } : item,
    );
    expect(getAlbumSlides("trip", binned, presets)).toEqual([]);
  });
});

describe("getSlideshowAlbums", () => {
  it("lists the folders holding a picture, with how many", () => {
    expect(getSlideshowAlbums(items)).toEqual([
      { count: 2, id: "shots", name: "스크린샷" },
      { count: 1, id: "trip", name: "여행" },
    ]);
  });
});

describe("pickNextSlide", () => {
  const slides: WallpaperSlide[] = presets.map((id) => ({ id, kind: "preset" }));

  it("walks the album in order and wraps", () => {
    expect(pickNextSlide(slides, { id: "meadow", kind: "preset" }, false)).toEqual(slides[1]);
    expect(pickNextSlide(slides, { id: "aurora", kind: "preset" }, false)).toEqual(slides[0]);
  });

  it("starts from the first when the wallpaper is not from the album", () => {
    expect(pickNextSlide(slides, { itemId: "beach", kind: "picture" }, false)).toEqual(
      slides[0],
    );
  });

  it("never shuffles onto the slide already showing", () => {
    const current = slides[1];
    for (const roll of [0, 0.49, 0.5, 0.999]) {
      const next = pickNextSlide(slides, current, true, () => roll);
      expect(next).not.toEqual(current);
    }
  });

  it("has nothing to show for an empty album", () => {
    expect(pickNextSlide([], null, false)).toBeNull();
  });
});

describe("getOpeningSlide", () => {
  const slides: WallpaperSlide[] = presets.map((id) => ({ id, kind: "preset" }));

  it("keeps a wallpaper that is already in the album", () => {
    expect(getOpeningSlide(slides, getCurrentSlide("ribbon", null), false)).toBeNull();
  });

  it("puts the album's first picture up over anything else", () => {
    expect(getOpeningSlide(slides, getCurrentSlide("ribbon", "beach"), false)).toEqual(
      slides[0],
    );
  });
});

describe("getSlideDelay", () => {
  it("counts down from the last change", () => {
    expect(getSlideDelay(1000, 60_000, 31_000)).toBe(30_000);
  });

  it("is due now once the interval has passed", () => {
    expect(getSlideDelay(0, 60_000, 500_000)).toBe(0);
  });

  it("never waits longer than one interval", () => {
    expect(getSlideDelay(10_000_000, 60_000, 0)).toBe(60_000);
  });
});

describe("normalizeWallpaperSlideshow", () => {
  it("keeps what was stored", () => {
    const stored = {
      album: "shots",
      changedAt: 42,
      enabled: true,
      intervalMs: 60_000,
      shuffle: true,
    };
    expect(normalizeWallpaperSlideshow(stored)).toEqual(stored);
  });

  it("falls back to the defaults for anything else", () => {
    expect(normalizeWallpaperSlideshow(null)).toEqual(DEFAULT_WALLPAPER_SLIDESHOW);
    expect(
      normalizeWallpaperSlideshow({ album: 7, enabled: "yes", intervalMs: 5, changedAt: NaN }),
    ).toEqual(DEFAULT_WALLPAPER_SLIDESHOW);
  });
});
