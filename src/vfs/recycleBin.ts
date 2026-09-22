import type { DesktopItem } from "../types";
import { formatStorageSize, getVfsEntrySize } from "../utils/format";

/**
 * 휴지통 as the desktop icon describes it. The bin's own window lists what is
 * in it; the icon's menu has to say how much it is about to destroy before it
 * destroys it, and the count is of the roots that were thrown away — a folder
 * in the bin is one item, not one plus everything under it.
 */
export type RecycleBinSummary = {
  bytes: number;
  count: number;
  /** The size of everything in the bin, folders counted through their files. */
  sizeLabel: string;
};

export function summarizeRecycleBin(items: DesktopItem[]): RecycleBinSummary {
  const trashed = items.filter((item) => item.trashed);
  const roots = trashed.filter((item) => !item.trashedRootId || item.trashedRootId === item.id);
  const bytes = trashed.reduce((total, item) => total + getVfsEntrySize(item), 0);
  return { bytes, count: roots.length, sizeLabel: formatStorageSize(bytes) };
}

/**
 * What the confirmation asks. Windows names one item and counts the rest, and
 * says 영구적으로 because the bin is where "삭제" already put them.
 */
export function describeEmptyRecycleBinPrompt(summary: RecycleBinSummary) {
  if (summary.count === 0) return "휴지통이 비어 있습니다.";
  // Empty notes weigh nothing, and "(0 B)" reads like a mistake.
  if (summary.bytes === 0) return `${summary.count}개 항목을 영구적으로 삭제하시겠습니까?`;
  return `${summary.count}개 항목(${summary.sizeLabel})을 영구적으로 삭제하시겠습니까?`;
}

/** The menu's own label, so a full bin says how full before it is opened. */
export function describeEmptyRecycleBinCommand(summary: RecycleBinSummary) {
  return summary.count === 0 ? "휴지통 비우기" : `휴지통 비우기 (${summary.count}개 항목)`;
}

/**
 * What a drop onto the bin actually throws away: the rows that are still on
 * the desktop, never a system folder and never something already in the bin.
 */
export function getRecycleBinDropIds(items: DesktopItem[], draggedIds: string[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return draggedIds.filter((id) => {
    const item = byId.get(id);
    return Boolean(item && !item.trashed);
  });
}
