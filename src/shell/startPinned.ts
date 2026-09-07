import { type AppId } from "../types";
import { reorderList } from "../utils/reorder";

/**
 * The Start menu's pinned area, which now holds folders as well as apps.
 *
 * Windows 11 groups two tiles into a folder when one is dropped on the middle
 * of another, and reorders when it is dropped near an edge. Both live here as
 * pure moves so the menu only has to say which happened.
 */

export type StartPinnedEntry =
  { appId: AppId; kind: "app" } | { appIds: AppId[]; id: string; kind: "folder"; name: string };

/** A tile's identity for dragging: an app id, or a folder id. */
export function getEntryKey(entry: StartPinnedEntry) {
  return entry.kind === "app" ? entry.appId : entry.id;
}

function indexOfKey(entries: StartPinnedEntry[], key: string) {
  return entries.findIndex((entry) => getEntryKey(entry) === key);
}

/** Every app in the pinned area, folders flattened, in view order. */
export function getPinnedAppIds(entries: StartPinnedEntry[]): AppId[] {
  return entries.flatMap((entry) => (entry.kind === "app" ? [entry.appId] : entry.appIds));
}

/** `폴더 1`, `폴더 2` … — the first number no folder is using. */
export function nextFolderName(entries: StartPinnedEntry[]) {
  const used = new Set(
    entries
      .filter(
        (entry): entry is Extract<StartPinnedEntry, { kind: "folder" }> =>
          entry.kind === "folder",
      )
      .map((entry) => entry.name),
  );
  for (let index = 1; ; index += 1) {
    const name = `폴더 ${index}`;
    if (!used.has(name)) return name;
  }
}

/**
 * Drop `movedKey` onto `targetKey`'s middle: the two become a folder, or the
 * moved tile joins the folder it was dropped on. Returns the same array when
 * the move is impossible (same tile, unknown key, a folder onto a folder).
 */
export function groupTiles(
  entries: StartPinnedEntry[],
  movedKey: string,
  targetKey: string,
  makeId: () => string = () => crypto.randomUUID(),
): StartPinnedEntry[] {
  if (movedKey === targetKey) return entries;
  const movedIndex = indexOfKey(entries, movedKey);
  const targetIndex = indexOfKey(entries, targetKey);
  if (movedIndex === -1 || targetIndex === -1) return entries;
  const moved = entries[movedIndex];
  const target = entries[targetIndex];
  // Folders do not nest, and only an app can be dropped into one.
  if (moved.kind === "folder") return entries;

  const grouped: StartPinnedEntry =
    target.kind === "folder"
      ? { ...target, appIds: [...target.appIds, moved.appId] }
      : {
          appIds: [target.appId, moved.appId],
          id: makeId(),
          kind: "folder",
          name: nextFolderName(entries),
        };
  return entries
    .map((entry, index) => (index === targetIndex ? grouped : entry))
    .filter((_, index) => index !== movedIndex);
}

/** Drop near an edge: the tile takes the target's slot, as before. */
export function reorderTiles(
  entries: StartPinnedEntry[],
  movedKey: string,
  targetKey: string,
): StartPinnedEntry[] {
  return reorderList(entries, indexOfKey(entries, movedKey), indexOfKey(entries, targetKey));
}

/** Spill a folder's apps back into the grid where the folder stood. */
export function ungroupFolder(
  entries: StartPinnedEntry[],
  folderId: string,
): StartPinnedEntry[] {
  const index = indexOfKey(entries, folderId);
  const folder = entries[index];
  if (!folder || folder.kind !== "folder") return entries;
  return [
    ...entries.slice(0, index),
    ...folder.appIds.map((appId): StartPinnedEntry => ({ appId, kind: "app" })),
    ...entries.slice(index + 1),
  ];
}

/** Take one app out of a folder; a folder left with one app becomes that app. */
export function removeFromFolder(
  entries: StartPinnedEntry[],
  folderId: string,
  appId: AppId,
): StartPinnedEntry[] {
  return entries.flatMap((entry) => {
    if (entry.kind !== "folder" || entry.id !== folderId) return [entry];
    const remaining = entry.appIds.filter((id) => id !== appId);
    if (remaining.length === 0) return [];
    if (remaining.length === 1)
      return [{ appId: remaining[0], kind: "app" } as StartPinnedEntry];
    return [{ ...entry, appIds: remaining }];
  });
}

/**
 * Whatever was stored, made safe: unknown shapes dropped, apps de-duplicated
 * across the whole area (a tile in two places would render twice), folders with
 * nothing left removed, and a one-app folder flattened.
 */
export function normalizeStartPinned(
  value: unknown,
  isKnownApp: (appId: string) => boolean,
): StartPinnedEntry[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const entries: StartPinnedEntry[] = [];
  for (const raw of value) {
    // v1 stored a plain list of app ids.
    if (typeof raw === "string") {
      if (!isKnownApp(raw) || seen.has(raw)) continue;
      seen.add(raw);
      entries.push({ appId: raw as AppId, kind: "app" });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (record.kind === "app" && typeof record.appId === "string") {
      if (!isKnownApp(record.appId) || seen.has(record.appId)) continue;
      seen.add(record.appId);
      entries.push({ appId: record.appId as AppId, kind: "app" });
      continue;
    }
    if (record.kind === "folder" && Array.isArray(record.appIds)) {
      const appIds: AppId[] = [];
      for (const appId of record.appIds) {
        if (typeof appId !== "string" || !isKnownApp(appId) || seen.has(appId)) continue;
        seen.add(appId);
        appIds.push(appId as AppId);
      }
      if (appIds.length === 0) continue;
      if (appIds.length === 1) {
        entries.push({ appId: appIds[0], kind: "app" });
        continue;
      }
      entries.push({
        appIds,
        id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
        kind: "folder",
        name: typeof record.name === "string" && record.name ? record.name : "폴더",
      });
    }
  }
  return entries;
}
