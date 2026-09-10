import type { DesktopItem } from "../types";

/**
 * Whether the editor is holding text the file does not have.
 *
 * `loadedNoteId` is what makes this honest: the editor's text catches up with
 * a newly opened document in an effect, one commit *after* the document
 * becomes the active one. Comparing the old text with the new file's content
 * in that gap says "unsaved changes" about a document nobody has typed into —
 * which registered the close guard, and 메모장 then refused to close and asked
 * to save a document that was never edited. Opening a file from the taskbar's
 * 점프 리스트 into an open window and closing it in the same instant is enough
 * to land in that gap on a slow machine.
 */
export function hasUnsavedNoteChanges(
  note: DesktopItem | undefined,
  loadedNoteId: string,
  text: string,
) {
  if (!note) return false;
  if (loadedNoteId !== note.id) return false;
  return text !== (note.content ?? "");
}
