import type { AppId, DesktopItem } from "../types";
import { getVfsEntryAssociation } from "./model";

/**
 * Which of the dragged entries a window will take. Windows refuses a drop an
 * app cannot open rather than handing it to something else, so a window takes
 * only what it is the app for — and a folder never, because a folder is
 * browsed, not opened into a document window.
 */
export function findEntryForAppDrop(
  items: DesktopItem[],
  itemIds: string[],
  appId: AppId | string | undefined,
): DesktopItem | null {
  if (!appId) return null;
  for (const id of itemIds) {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.trashed || item.kind === "folder") continue;
    if (getVfsEntryAssociation(item).appId === appId) return item;
  }
  return null;
}

/** The ids inside a drag payload, or none when it is not one of ours. */
export function readVfsDragPayload(payload: string): string[] {
  if (!payload) return [];
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}
