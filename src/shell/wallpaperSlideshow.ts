import type { DesktopItem, WallpaperName } from "../types";
import { isImageDataUrl } from "../vfs/imageCodec";

/**
 * 바탕 화면 배경 슬라이드 쇼. Windows' 배경 list offers 사진 and 슬라이드 쇼; the
 * shell only had the first, so the desktop kept one picture until it was
 * changed by hand.
 */

/** The album that is not a folder: the shell's own wallpapers. */
export const GALLERY_ALBUM = "gallery";

export type WallpaperSlideshow = {
  /** GALLERY_ALBUM, or the id of a folder whose pictures take turns. */
  album: string;
  /**
   * When the wallpaper last changed. Kept so a reload does not start the wait
   * over — with 1일 picked, a page opened every few hours would otherwise never
   * see a change at all.
   */
  changedAt: number;
  enabled: boolean;
  intervalMs: number;
  shuffle: boolean;
};

export type WallpaperSlide =
  { kind: "preset"; id: WallpaperName } | { itemId: string; kind: "picture" };

/** 사진 변경 간격 — Windows' own steps. */
export const SLIDESHOW_INTERVALS: ReadonlyArray<{ label: string; ms: number }> = [
  { label: "1분", ms: 60_000 },
  { label: "10분", ms: 600_000 },
  { label: "30분", ms: 1_800_000 },
  { label: "1시간", ms: 3_600_000 },
  { label: "6시간", ms: 21_600_000 },
  { label: "1일", ms: 86_400_000 },
];

/** Off, over the shell's own pictures, every 30분 — Windows' defaults. */
export const DEFAULT_WALLPAPER_SLIDESHOW: WallpaperSlideshow = {
  album: GALLERY_ALBUM,
  changedAt: 0,
  enabled: false,
  intervalMs: 1_800_000,
  shuffle: false,
};

type AlbumEntry = Pick<
  DesktopItem,
  "content" | "id" | "kind" | "name" | "parentId" | "trashed"
>;

/** A picture with pixels that is not in the recycle bin. */
function isPicture(item: AlbumEntry) {
  return (
    item.kind === "canvas" &&
    !item.trashed &&
    Boolean(item.content) &&
    isImageDataUrl(item.content!)
  );
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "ko", { numeric: true });

/**
 * What an album shows, in name order: the presets for the gallery, else the
 * pictures directly inside the folder. A folder that is gone or in the recycle
 * bin shows nothing — the show then holds the wallpaper it last put up.
 */
export function getAlbumSlides(
  album: string,
  items: ReadonlyArray<AlbumEntry>,
  presets: ReadonlyArray<WallpaperName>,
): WallpaperSlide[] {
  if (album === GALLERY_ALBUM) return presets.map((id) => ({ id, kind: "preset" }));
  const folder = items.find((item) => item.id === album);
  if (!folder || folder.kind !== "folder" || folder.trashed) return [];
  return items
    .filter((item) => item.parentId === album && isPicture(item))
    .sort(byName)
    .map((item) => ({ itemId: item.id, kind: "picture" }));
}

/** The folders a show can run over: every one with a picture directly in it. */
export function getSlideshowAlbums(items: ReadonlyArray<AlbumEntry>) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (isPicture(item)) counts.set(item.parentId, (counts.get(item.parentId) ?? 0) + 1);
  }
  return items
    .filter((item) => item.kind === "folder" && !item.trashed && counts.has(item.id))
    .map((folder) => ({ count: counts.get(folder.id) ?? 0, id: folder.id, name: folder.name }))
    .sort(byName);
}

export function isSameSlide(a: WallpaperSlide, b: WallpaperSlide) {
  return a.kind === "preset"
    ? b.kind === "preset" && a.id === b.id
    : b.kind === "picture" && a.itemId === b.itemId;
}

/** The wallpaper on screen, as a slide. */
export function getCurrentSlide(
  wallpaper: WallpaperName,
  customWallpaperItemId: string | null,
): WallpaperSlide {
  return customWallpaperItemId
    ? { itemId: customWallpaperItemId, kind: "picture" }
    : { id: wallpaper, kind: "preset" };
}

/**
 * The slide after `current`: in order, the next one round the album, and the
 * first when the wallpaper on screen is not from this album. 순서 섞기 picks
 * any other slide but never the one showing — a change that changed nothing
 * would read as the show having stopped.
 */
export function pickNextSlide(
  slides: ReadonlyArray<WallpaperSlide>,
  current: WallpaperSlide | null,
  shuffle: boolean,
  random: () => number = Math.random,
): WallpaperSlide | null {
  if (slides.length === 0) return null;
  const index = current ? slides.findIndex((slide) => isSameSlide(slide, current)) : -1;
  if (!shuffle || slides.length === 1) return slides[(index + 1) % slides.length];
  const others = slides.filter((_, at) => at !== index);
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))];
}

/**
 * What to put up when a show starts or moves to another album. A wallpaper
 * already in the album stays, as Windows leaves it; anything else gives way to
 * the album's first picture (a random one when shuffling) — or null, nothing
 * to change.
 */
export function getOpeningSlide(
  slides: ReadonlyArray<WallpaperSlide>,
  current: WallpaperSlide,
  shuffle: boolean,
  random: () => number = Math.random,
): WallpaperSlide | null {
  if (slides.some((slide) => isSameSlide(slide, current))) return null;
  return pickNextSlide(slides, null, shuffle, random);
}

/**
 * How long until the next change. Never more than one interval: a `changedAt`
 * in the future (the clock was set back) must not stall the show.
 */
export function getSlideDelay(changedAt: number, intervalMs: number, now: number) {
  return Math.max(0, Math.min(intervalMs, changedAt + intervalMs - now));
}

/** What stored settings may hold; anything else falls back to the defaults. */
export function normalizeWallpaperSlideshow(value: unknown): WallpaperSlideshow {
  if (!value || typeof value !== "object") return { ...DEFAULT_WALLPAPER_SLIDESHOW };
  const stored = value as Record<string, unknown>;
  const intervalMs = SLIDESHOW_INTERVALS.some((step) => step.ms === stored.intervalMs)
    ? (stored.intervalMs as number)
    : DEFAULT_WALLPAPER_SLIDESHOW.intervalMs;
  return {
    album: typeof stored.album === "string" && stored.album ? stored.album : GALLERY_ALBUM,
    changedAt:
      typeof stored.changedAt === "number" && Number.isFinite(stored.changedAt)
        ? stored.changedAt
        : 0,
    enabled: stored.enabled === true,
    intervalMs,
    shuffle: stored.shuffle === true,
  };
}
