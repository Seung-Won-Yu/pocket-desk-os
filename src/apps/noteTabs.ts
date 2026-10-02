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

/** What a stored strip may hold: ids, each once. */
export function normalizeNoteTabs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id !== ""))];
}
