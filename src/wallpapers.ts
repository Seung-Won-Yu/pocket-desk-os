import type React from "react";
import type { WallpaperName } from "./types";

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

export function getWallpaperStyle(wallpaper: WallpaperName): WallpaperCssVars {
  return {
    "--wallpaper-image": `url("${getAssetUrl(wallpaperFiles[wallpaper])}")`,
  };
}

export function getWallpaperPreviewStyle(wallpaper: WallpaperName): React.CSSProperties {
  return {
    backgroundImage: `url("${getAssetUrl(wallpaperFiles[wallpaper])}")`,
  };
}
