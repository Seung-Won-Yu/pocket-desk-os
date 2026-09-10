/**
 * Explorer's view sizes, from the largest to the densest. Ctrl+wheel walks
 * this line, the way Windows walks its own — up toward the pictures, down
 * toward the columns.
 */
export type FileViewMode = "details" | "list" | "icons";

export const FILE_VIEW_ORDER: FileViewMode[] = ["icons", "list", "details"];

/** `delta` is the wheel's own sign: negative is a push away from you. */
export function getNextFileViewMode(current: FileViewMode, delta: number): FileViewMode {
  if (delta === 0) return current;
  const index = FILE_VIEW_ORDER.indexOf(current);
  if (index === -1) return current;
  // Up the wheel enlarges, and the ends hold rather than wrapping: Windows
  // does not jump from 자세히 back to 큰 아이콘 on one more notch.
  const next = index + (delta < 0 ? -1 : 1);
  return FILE_VIEW_ORDER[Math.min(FILE_VIEW_ORDER.length - 1, Math.max(0, next))];
}
