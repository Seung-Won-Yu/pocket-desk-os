import type { DesktopItem } from "../types";
import { getVfsNameParts, MAX_VFS_NAME_LENGTH, truncateVfsName } from "./model";

/**
 * 여러 항목 이름 바꾸기. F2 on a selection did nothing at all — the rename box
 * only ever opened for one row.
 *
 * Windows numbers the whole set from the one name you type: three files
 * renamed to `사진` become `사진 (1)`, `사진 (2)`, `사진 (3)`, each keeping
 * its own extension, and a number already taken in that folder is stepped
 * over rather than collided with.
 */
export type VfsBulkRename = { id: string; name: string };

function buildNumberedName(base: string, index: number, extension: string) {
  const suffix = ` (${index})`;
  const budget = MAX_VFS_NAME_LENGTH - suffix.length - extension.length;
  const trimmed = budget > 0 ? truncateVfsName(base, budget) : "";
  return `${trimmed}${suffix}${extension}`;
}

export function buildBulkRenames(
  items: DesktopItem[],
  itemIds: string[],
  requestedName: string,
): VfsBulkRename[] {
  const targets = itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is DesktopItem => Boolean(item) && !item?.trashed);
  if (targets.length === 0) return [];

  const base = getVfsNameParts(requestedName.trim()).base.trim();
  if (!base) return [];

  const renamed = new Set(targets.map((item) => item.id));
  // Names the folder already has, minus the ones being renamed: those are
  // about to be something else, so they cannot collide with the new run.
  const taken = new Set(
    items
      .filter(
        (item) =>
          !item.trashed && !renamed.has(item.id) && item.parentId === targets[0].parentId,
      )
      .map((item) => item.name),
  );

  const renames: VfsBulkRename[] = [];
  let counter = 1;
  for (const item of targets) {
    // A folder has no extension to keep; a file keeps its own, not the one
    // that happened to be typed.
    const extension = item.kind === "folder" ? "" : getVfsNameParts(item.name).extension;
    let name = buildNumberedName(base, counter, extension);
    while (taken.has(name) && counter < 1000) {
      counter += 1;
      name = buildNumberedName(base, counter, extension);
    }
    taken.add(name);
    counter += 1;
    renames.push({ id: item.id, name });
  }
  return renames;
}
