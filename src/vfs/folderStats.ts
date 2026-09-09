import type { DesktopItem } from "../types";
import { getVfsEntrySize } from "../utils/format";
import { getVfsDescendantIds } from "./model";

/**
 * What a folder holds, the way Windows' 속성 reports it: the bytes of
 * everything underneath, and how many files and folders that is.
 *
 * A folder's own size is zero — it is a name, not content — so asking a folder
 * how big it is only means anything with the tree in hand. The properties
 * dialog used to call the per-entry size helper and print "0 B" for every
 * folder, however much was inside it.
 */
export type VfsFolderStats = {
  bytes: number;
  files: number;
  folders: number;
};

export function getVfsFolderStats(items: DesktopItem[], folderId: string): VfsFolderStats {
  // Walks parent links, so a hand-edited store that made a folder its own
  // ancestor cannot spin here: the walk visits each id once.
  const descendants = getVfsDescendantIds(items, [folderId]);
  const stats: VfsFolderStats = { bytes: 0, files: 0, folders: 0 };

  for (const item of items) {
    if (item.id === folderId || !descendants.has(item.id)) continue;
    // A folder in the recycle bin is not in the folder any more, and neither is
    // anything under it.
    if (item.trashed) continue;
    if (item.kind === "folder") {
      stats.folders += 1;
      continue;
    }
    stats.files += 1;
    stats.bytes += getVfsEntrySize(item);
  }

  return stats;
}

/** "12.3 KB · 파일 4개, 폴더 2개" — the line 속성 shows for a folder. */
export function describeVfsFolderContents(stats: VfsFolderStats) {
  return `파일 ${stats.files}개, 폴더 ${stats.folders}개`;
}
