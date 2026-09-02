import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import {
  STICKY_NOTE_COLORS,
  bindStickyNoteWindow,
  deleteStickyNote,
  getStickyNoteTitle,
  updateStickyNote,
  type StickyNoteColor,
  type StickyNoteStore,
} from "../shell/stickyNotes";
import { type OpenWindowInfo, type SoundEffectName } from "../types";

const COLOR_LABELS: Record<StickyNoteColor, string> = {
  blue: "파랑",
  green: "초록",
  pink: "분홍",
  purple: "보라",
  yellow: "노랑",
};

type StickyNotesAppProps = {
  closeWindow: (windowId: string) => void;
  openNewAppWindow: (appId: "stickynotes") => string;
  openWindows: OpenWindowInfo[];
  playSound: (effect: SoundEffectName) => void;
  reportDocument: (windowId: string, ref: { title?: string } | undefined) => void;
  stickyNotes: StickyNoteStore;
  updateStickyNotes: (store: StickyNoteStore) => void;
  windowId: string;
};

/**
 * One note per window, like the Windows app. The window is bound to its note
 * through the shell store (see src/shell/stickyNotes.ts), so a reload — which
 * restores windows with their ids — reopens every note exactly where it was.
 */
export default function StickyNotesApp({
  closeWindow,
  openNewAppWindow,
  openWindows,
  playSound,
  reportDocument,
  stickyNotes,
  updateStickyNotes,
  windowId,
}: StickyNotesAppProps) {
  const openStickyWindowIds = openWindows
    .filter((item) => item.appId === "stickynotes")
    .map((item) => item.id);
  const noteId = stickyNotes.bindings[windowId];
  const note = stickyNotes.notes.find((item) => item.id === noteId);

  // Bind on mount (and re-bind if the note this window showed was deleted).
  useEffect(() => {
    const bound = bindStickyNoteWindow(stickyNotes, windowId, openStickyWindowIds, Date.now());
    if (bound !== stickyNotes) updateStickyNotes(bound);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- binding depends on the store identity and this window only
  }, [stickyNotes, windowId]);

  useEffect(() => {
    reportDocument(windowId, { title: getStickyNoteTitle(note) });
  }, [note, reportDocument, windowId]);

  if (!note) {
    return <div className="sticky-note is-yellow" aria-busy="true" />;
  }

  return (
    <div className={`sticky-note is-${note.color}`}>
      <div className="sticky-note-toolbar">
        <button
          aria-label="새 메모"
          onClick={() => {
            playSound("open");
            openNewAppWindow("stickynotes");
          }}
          title="새 메모"
          type="button"
        >
          <Plus aria-hidden size={16} />
        </button>
        <div aria-label="메모 색" className="sticky-note-colors" role="group">
          {STICKY_NOTE_COLORS.map((color) => (
            <button
              aria-label={`${COLOR_LABELS[color]} 메모`}
              aria-pressed={note.color === color}
              className={`sticky-swatch is-${color}`}
              key={color}
              onClick={() =>
                updateStickyNotes(updateStickyNote(stickyNotes, note.id, { color }, Date.now()))
              }
              type="button"
            />
          ))}
        </div>
        <button
          aria-label="메모 삭제"
          onClick={() => {
            playSound("close");
            updateStickyNotes(deleteStickyNote(stickyNotes, note.id));
            closeWindow(windowId);
          }}
          title="메모 삭제"
          type="button"
        >
          <Trash2 aria-hidden size={16} />
        </button>
      </div>
      <textarea
        aria-label="스티커 메모 내용"
        className="sticky-note-text"
        onChange={(event) =>
          updateStickyNotes(
            updateStickyNote(stickyNotes, note.id, { text: event.target.value }, Date.now()),
          )
        }
        placeholder="메모를 입력하세요"
        spellCheck={false}
        value={note.text}
      />
    </div>
  );
}
