import type { DesktopItem } from "../types";

/**
 * 실행 취소 for file operations, recorded the way Windows Explorer does it:
 * one shell-wide stack shared by the desktop and every 파일 탐색기 window, so
 * Ctrl+Z takes back the last thing that happened to the files no matter which
 * surface did it.
 *
 * The stack holds *snapshots of the rows an operation touched*, not inverse
 * commands. A move knows how to undo itself only because it remembers the
 * parentId each row had; recording the before and after state of the touched
 * rows says the same thing for every operation at once, so a new file
 * operation gets 실행 취소 by going through the recorder rather than by
 * writing its own inverse.
 */

/** Rows are shallow-copied, so the `content` string is shared, not duplicated. */
export type FileUndoRow = {
  /** Where the row sat in the list, so 다시 실행 puts it back in place. */
  index: number;
  item: DesktopItem;
};

export type FileUndoStep = {
  /** State of the touched rows after the operation. Missing id = row was removed. */
  after: FileUndoRow[];
  /** State of the touched rows before it. Missing id = row did not exist yet. */
  before: FileUndoRow[];
  id: string;
  /** Every id the step touches, from either side. */
  ids: string[];
  /** What the menu says after 실행 취소 — "이름 바꾸기", "이동", … */
  label: string;
};

export type FileUndoState = {
  redo: FileUndoStep[];
  undo: FileUndoStep[];
};

export const FILE_UNDO_LIMIT = 24;

export const EMPTY_FILE_UNDO_STATE: FileUndoState = { redo: [], undo: [] };

/**
 * Compares two rows field by field. `undefined` and a missing key mean the same
 * thing here — a row read back from storage carries only the keys it was saved
 * with, and treating that as a change would record a step for a reload.
 */
function isSameRow(left: DesktopItem, right: DesktopItem) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]) as Set<keyof DesktopItem>;
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function indexRows(items: DesktopItem[]) {
  const rows = new Map<string, FileUndoRow>();
  items.forEach((item, index) => rows.set(item.id, { index, item }));
  return rows;
}

/**
 * Diffs two item lists and keeps only the rows that actually changed. Returns
 * null when nothing did, so an operation that decided to do nothing does not
 * leave an empty step for Ctrl+Z to "undo".
 */
export function createFileUndoStep(
  label: string,
  before: DesktopItem[],
  after: DesktopItem[],
  id = `undo-${Math.random().toString(36).slice(2)}`,
): FileUndoStep | null {
  const beforeRows = indexRows(before);
  const afterRows = indexRows(after);
  const ids: string[] = [];
  const beforeSide: FileUndoRow[] = [];
  const afterSide: FileUndoRow[] = [];

  for (const key of new Set([...beforeRows.keys(), ...afterRows.keys()])) {
    const previous = beforeRows.get(key);
    const next = afterRows.get(key);
    if (previous && next && isSameRow(previous.item, next.item)) continue;
    ids.push(key);
    if (previous) beforeSide.push({ index: previous.index, item: { ...previous.item } });
    if (next) afterSide.push({ index: next.index, item: { ...next.item } });
  }

  if (ids.length === 0) return null;
  return { after: afterSide, before: beforeSide, id, ids, label };
}

/**
 * Puts one side of a step back on the live list: rows the side knows about are
 * restored at their recorded position, rows it does not are removed.
 * Idempotent, so React's development double-invoke cannot apply it twice.
 */
export function applyFileUndoSide(
  items: DesktopItem[],
  step: FileUndoStep,
  side: "after" | "before",
) {
  const touched = new Set(step.ids);
  const next = items.filter((item) => !touched.has(item.id));
  const rows = [...(side === "before" ? step.before : step.after)].sort(
    (left, right) => left.index - right.index,
  );
  rows.forEach((row) => {
    const at = Math.min(Math.max(row.index, 0), next.length);
    next.splice(at, 0, { ...row.item });
  });
  return next;
}

/** Pushing a new step drops the redo branch, as every undo stack does. */
export function pushFileUndoStep(
  state: FileUndoState,
  step: FileUndoStep | null,
  limit = FILE_UNDO_LIMIT,
): FileUndoState {
  if (!step) return state;
  return { redo: [], undo: [...state.undo, step].slice(-limit) };
}

/**
 * Drops every step that touches a permanently deleted row. There is nothing
 * left to restore, and putting the row back would resurrect a file the user
 * destroyed on purpose — Windows does not undo Shift+Delete either.
 */
export function dropFileUndoSteps(state: FileUndoState, removedIds: Iterable<string>) {
  const removed = new Set(removedIds);
  if (removed.size === 0) return state;
  const keep = (step: FileUndoStep) => !step.ids.some((id) => removed.has(id));
  const undo = state.undo.filter(keep);
  const redo = state.redo.filter(keep);
  if (undo.length === state.undo.length && redo.length === state.redo.length) return state;
  return { redo, undo };
}

export function getFileUndoLabel(state: FileUndoState) {
  return state.undo[state.undo.length - 1]?.label ?? null;
}

export function getFileRedoLabel(state: FileUndoState) {
  return state.redo[state.redo.length - 1]?.label ?? null;
}

/** Moves the top step from one stack to the other and reports which it was. */
export function stepFileUndo(state: FileUndoState, direction: "redo" | "undo") {
  if (direction === "undo") {
    const step = state.undo[state.undo.length - 1];
    if (!step) return null;
    return { state: { redo: [...state.redo, step], undo: state.undo.slice(0, -1) }, step };
  }
  const step = state.redo[state.redo.length - 1];
  if (!step) return null;
  return { state: { redo: state.redo.slice(0, -1), undo: [...state.undo, step] }, step };
}
