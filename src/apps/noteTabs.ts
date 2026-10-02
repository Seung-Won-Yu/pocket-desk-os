import { reorderList } from "../utils/reorder";

/**
 * 메모장 탭 — the documents open in the window. The strip used to list every
 * text file in the file system, so a tab could not be closed at all: closing
 * one would have meant deleting the file. Now a tab is a document that was
 * opened, and closing it only puts it away.
 */

/** What 탭 닫기, 다른 탭 닫기 and 오른쪽 탭 닫기 each take away. */
export type NoteTabCloseAction = "others" | "right" | "this";

/** The open documents that still exist, in tab order. */
export function getNoteTabs<T extends { id: string }>(
  openIds: ReadonlyArray<string>,
  notes: ReadonlyArray<T>,
): T[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  return openIds.flatMap((id) => {
    const note = byId.get(id);
    return note ? [note] : [];
  });
}

/** Opening a document gives it a tab at the end, once. */
export function withNoteTab(openIds: ReadonlyArray<string>, id: string) {
  if (!id || openIds.includes(id)) return [...openIds];
  return [...openIds, id];
}

/** The tabs one menu command closes, counted from the tab it was opened on. */
export function getNoteTabsToClose(
  openIds: ReadonlyArray<string>,
  targetId: string,
  action: NoteTabCloseAction,
) {
  const index = openIds.indexOf(targetId);
  if (index < 0) return [];
  if (action === "this") return [targetId];
  if (action === "others") return openIds.filter((id) => id !== targetId);
  return openIds.slice(index + 1);
}

/**
 * The strip after closing `closing`, and the document to show. Closing the
 * tab on screen moves to its right-hand neighbour, or the left when it was
 * last — as Notepad and every browser do. `nextActiveId` is null when nothing
 * is left, which closes the window.
 */
export function closeNoteTabs(
  openIds: ReadonlyArray<string>,
  closing: ReadonlyArray<string>,
  activeId: string,
) {
  const shut = new Set(closing);
  const remaining = openIds.filter((id) => !shut.has(id));
  if (remaining.length === 0) return { nextActiveId: null, openIds: remaining };
  if (!shut.has(activeId)) return { nextActiveId: activeId, openIds: remaining };
  const index = openIds.indexOf(activeId);
  const right = openIds.slice(index + 1).find((id) => !shut.has(id));
  const left = [...openIds.slice(0, Math.max(0, index))].reverse().find((id) => !shut.has(id));
  return { nextActiveId: right ?? left ?? remaining[0], openIds: remaining };
}

/** Which side of the tab under the pointer a dragged tab would land on. */
export type NoteTabDropSide = "after" | "before";

/**
 * A tab dropped on the left half of another goes before it, on the right
 * half after it — the gap the browser's strip opens is where it lands.
 */
export function getNoteTabDropSide(
  pointerX: number,
  left: number,
  width: number,
): NoteTabDropSide {
  return pointerX < left + width / 2 ? "before" : "after";
}

/**
 * The strip with `movedId` dropped beside `targetId`. Returns the strip
 * itself when nothing would move — dropped on itself, or into the gap it
 * already fills — so the caller can skip the write.
 */
export function moveNoteTab(
  openIds: ReadonlyArray<string>,
  movedId: string,
  targetId: string,
  side: NoteTabDropSide,
): string[] {
  const from = openIds.indexOf(movedId);
  const target = openIds.indexOf(targetId);
  if (from < 0 || target < 0 || movedId === targetId) return openIds as string[];
  // The slot counted once the moved tab is out of the strip.
  const gap = side === "before" ? target : target + 1;
  return reorderList(openIds, from, from < gap ? gap - 1 : gap);
}

/**
 * Ctrl+Shift+PageUp/PageDown: the tab one place left or right, stopping at
 * either end, as in Edge and Chrome.
 */
export function stepNoteTab(
  openIds: ReadonlyArray<string>,
  id: string,
  step: -1 | 1,
): string[] {
  const from = openIds.indexOf(id);
  return reorderList(openIds, from, from + step);
}

/** What a stored strip may hold: ids, each once. */
export function normalizeNoteTabs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id !== ""))];
}
