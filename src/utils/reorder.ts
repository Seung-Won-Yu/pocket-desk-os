/**
 * Moving one item of a list to another position — what a drag does to the
 * Start menu's tiles, the taskbar's pinned apps, and anything else Windows
 * lets you rearrange by hand.
 */

/**
 * `list` with the item at `fromIndex` moved to `toIndex`. Returns the original
 * array when the move would change nothing (either index out of range, or the
 * same slot), so a caller can skip the state write entirely.
 */
export function reorderList<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  const inRange = (index: number) => index >= 0 && index < list.length;
  if (!inRange(fromIndex) || !inRange(toIndex) || fromIndex === toIndex) return list as T[];
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** The same move addressed by value rather than position. */
export function reorderById<T>(list: readonly T[], fromId: T, toId: T): T[] {
  return reorderList(list, list.indexOf(fromId), list.indexOf(toId));
}
