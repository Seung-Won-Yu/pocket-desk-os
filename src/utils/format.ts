import type { DesktopItem } from "../types";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function formatStorageSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

/** Bytes an entry occupies, for sorting by size as well as showing it. */
export function getVfsEntrySize(item: DesktopItem) {
  if (item.kind === "folder") return 0;
  return new Blob([item.content ?? ""]).size;
}

export function formatVfsEntrySize(item: DesktopItem) {
  return formatStorageSize(getVfsEntrySize(item));
}

export function formatVfsPropertyDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
