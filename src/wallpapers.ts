import type React from "react";
import type { DesktopItem, WallpaperName } from "./types";

export const wallpaperGallery: Array<{ id: WallpaperName; label: string; detail: string }> = [
  { id: "meadow", label: "Green Vista", detail: "초록 언덕과 푸른 하늘" },
  { id: "ribbon", label: "Blue Ribbon", detail: "푸른 유리 리본" },
  { id: "aurora", label: "Aurora Lake", detail: "오로라와 밤 호수" },
  { id: "dawn", label: "Dawn Lake", detail: "새벽 호수와 따뜻한 빛" },
  { id: "sunny", label: "Sunny Field", detail: "맑은 초원과 구름" },
  { id: "glass", label: "Glass Wave", detail: "푸른 유리 빛줄기" },
  { id: "mist", label: "Misty Peak", detail: "안개 낀 산과 호수" },
  { id: "coast", label: "Moon Coast", detail: "달빛 해안과 바다" },
];

const wallpaperFiles: Record<WallpaperName, string> = {
  aurora: "wallpapers/aurora-lake.jpg",
  coast: "wallpapers/moon-coast.jpg",
  dawn: "wallpapers/dawn-lake.jpg",
  glass: "wallpapers/glass-wave.jpg",
  meadow: "wallpapers/green-vista.jpg",
  mist: "wallpapers/misty-peak.jpg",
  ribbon: "wallpapers/blue-ribbon.jpg",
  sunny: "wallpapers/sunny-field.jpg",
};

export type WallpaperCssVars = React.CSSProperties & {
  "--wallpaper-image": string;
};

export function getAssetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

/**
 * The desktop's wallpaper variable: a picture the user chose from their own
 * files when there is one (its data URL), else the preset.
 */
export function getWallpaperStyle(
  wallpaper: WallpaperName,
  customImage: string | null = null,
): WallpaperCssVars {
  return {
    "--wallpaper-image": `url("${customImage ?? getAssetUrl(wallpaperFiles[wallpaper])}")`,
  };
}

/**
 * The picture behind "바탕 화면 배경으로 설정", if it still exists: a picture file
 * that has pixels and is not in the recycle bin. Anything else means the
 * preset shows again — deleting the file is how you undo it, as in Windows.
 */
export function resolveCustomWallpaper(
  items: ReadonlyArray<Pick<DesktopItem, "content" | "id" | "kind" | "trashed">>,
  itemId: string | null,
): string | null {
  if (!itemId) return null;
  const item = items.find((entry) => entry.id === itemId);
  if (!item || item.kind !== "canvas" || item.trashed || !item.content) return null;
  return item.content;
}

export function getWallpaperPreviewStyle(wallpaper: WallpaperName): React.CSSProperties {
  return {
    backgroundImage: `url("${getAssetUrl(wallpaperFiles[wallpaper])}")`,
  };
}
