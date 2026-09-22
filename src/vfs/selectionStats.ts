import type { DesktopItem } from "../types";
import { getVfsFolderStats, type VfsFolderStats } from "./folderStats";
import { getVfsEntryAssociation, getVfsTopLevelIds } from "./model";
import { getVfsEntrySize } from "../utils/format";

/**
 * What a selection adds up to. 속성 opened on several rows described only the
 * first of them, and the status bar's size counted files at zero bytes for
 * every folder — the same "a folder's own size is zero" trap the folder
 * properties fell into.
 */
export type VfsSelectionSummary = VfsFolderStats & {
  /** How the 숨김 checkbox should read for the whole selection. */
  hidden: "all" | "none" | "some";
  /** The count of rows that were selected, not of everything underneath. */
  items: number;
  /** The one type they share, or null when they are of several. */
  typeLabel: string | null;
};

/**
 * Counted from the *top-level* rows: selecting a folder and a file inside it
 * would otherwise count that file twice, once on its own and once inside the
 * folder it lives in.
 */
export function summarizeVfsSelection(
  items: DesktopItem[],
  selectedIds: string[],
): VfsSelectionSummary {
  const roots = getVfsTopLevelIds(items, selectedIds)
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is DesktopItem => Boolean(item) && !item?.trashed);

  const summary: VfsSelectionSummary = {
    bytes: 0,
    files: 0,
    folders: 0,
    hidden: "none",
    items: roots.length,
    typeLabel: null,
  };
  if (roots.length === 0) return summary;

  const labels = new Set<string>();
  let hiddenCount = 0;
  for (const item of roots) {
    labels.add(getVfsEntryAssociation(item).typeLabel);
    if (item.hidden) hiddenCount += 1;
    if (item.kind === "folder") {
      const stats = getVfsFolderStats(items, item.id);
      summary.bytes += stats.bytes;
      summary.files += stats.files;
      summary.folders += stats.folders + 1;
      continue;
    }
    summary.bytes += getVfsEntrySize(item);
    summary.files += 1;
  }

  summary.hidden = hiddenCount === 0 ? "none" : hiddenCount === roots.length ? "all" : "some";
  summary.typeLabel = labels.size === 1 ? [...labels][0] : null;
  return summary;
}

/** "3개 항목" — what Windows puts where a single entry's name would go. */
export function describeVfsSelectionTitle(summary: VfsSelectionSummary) {
  return `${summary.items}개 항목`;
}
