import type { DesktopItem } from "../types";

/**
 * 파일 바꾸기 또는 건너뛰기 — the question Windows asks before a copy or a move
 * writes over something already in the target folder.
 *
 * Only the entries being moved at top level can collide: a child keeps its
 * name inside its own new parent, which travels with it. And a copy landing in
 * the folder it came from is a duplicate, not a collision — Windows names that
 * one "- 복사본" without asking, because there is nothing to replace.
 */
export type VfsNameConflict = {
  /** The row already sitting in the target folder under this name. */
  existingId: string;
  name: string;
  sourceId: string;
};

/** 바꾸기 / 건너뛰기 / 둘 다 유지 — applied to every conflict in the batch. */
export type VfsConflictChoice = "keepBoth" | "replace" | "skip";

export function findVfsNameConflicts(
  items: DesktopItem[],
  sourceIds: string[],
  targetParentId: string,
): VfsNameConflict[] {
  const conflicts: VfsNameConflict[] = [];
  const sources = new Set(sourceIds);
  for (const sourceId of sourceIds) {
    const source = items.find((item) => item.id === sourceId);
    if (!source || source.trashed) continue;
    // Landing where it already lives is a duplicate, not a collision.
    if (source.parentId === targetParentId) continue;
    const existing = items.find(
      (item) =>
        !item.trashed &&
        item.parentId === targetParentId &&
        item.name === source.name &&
        item.id !== sourceId &&
        !sources.has(item.id),
    );
    if (existing) conflicts.push({ existingId: existing.id, name: source.name, sourceId });
  }
  return conflicts;
}

/** "notes.txt" for one, "notes.txt 외 2개" for a batch — what the dialog says. */
export function describeVfsNameConflicts(conflicts: VfsNameConflict[]) {
  if (conflicts.length === 0) return "";
  const [first] = conflicts;
  return conflicts.length === 1 ? first.name : `${first.name} 외 ${conflicts.length - 1}개`;
}
