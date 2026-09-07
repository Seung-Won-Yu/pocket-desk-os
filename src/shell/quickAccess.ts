import { QUICK_ACCESS_KEY } from "./constants";

/**
 * 빠른 액세스 — the folders pinned to Explorer's sidebar, the way Windows lets
 * you pin one. The list belongs to the shell rather than to a window, so every
 * Explorer window shows the same pins and a reload keeps them.
 *
 * Only ids are kept. A pinned folder that is deleted or moved to the bin stops
 * being a pin the next time the list is read, so a stale id can never point at
 * something that came back with the same id later.
 */

export const QUICK_ACCESS_LIMIT = 12;

/** Ids that still name a folder, deduplicated and capped. */
export function normalizeQuickAccess(
  value: unknown,
  isPinnableFolder: (folderId: string) => boolean,
): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || seen.has(entry)) continue;
    seen.add(entry);
    if (!isPinnableFolder(entry)) continue;
    pins.push(entry);
    if (pins.length >= QUICK_ACCESS_LIMIT) break;
  }
  return pins;
}

export function loadQuickAccess(isPinnableFolder: (folderId: string) => boolean): string[] {
  try {
    return normalizeQuickAccess(
      JSON.parse(localStorage.getItem(QUICK_ACCESS_KEY) ?? "null"),
      isPinnableFolder,
    );
  } catch {
    return [];
  }
}

export function persistQuickAccess(folderIds: string[]) {
  try {
    localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(folderIds));
    return true;
  } catch {
    return false;
  }
}

/**
 * The list with `folderId` pinned or unpinned. A new pin goes on the end, so
 * the sidebar keeps the order the user pinned things in. Returns the same
 * array when the cap is already reached, so the caller can say so.
 */
export function toggleQuickAccess(folderIds: string[], folderId: string): string[] {
  if (folderIds.includes(folderId)) {
    return folderIds.filter((entry) => entry !== folderId);
  }
  if (folderIds.length >= QUICK_ACCESS_LIMIT) return folderIds;
  return [...folderIds, folderId];
}
