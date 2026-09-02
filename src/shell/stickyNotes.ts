import { STICKY_NOTES_KEY } from "./constants";

/**
 * 스티커 메모 — Windows' Sticky Notes, where every note is its own small
 * window. The notes live in the shell (so they survive the window that shows
 * them and a reload), and each open note window is bound to one note by its
 * window id; window ids are persisted with the window state, so the binding
 * survives a reload too. A note outlives its window: closing the window keeps
 * the note, and opening the app again shows the notes no other window holds.
 */
export const STICKY_NOTE_COLORS = ["yellow", "green", "pink", "purple", "blue"] as const;
export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export type StickyNote = {
  color: StickyNoteColor;
  id: string;
  text: string;
  updatedAt: number;
};

export type StickyNoteStore = {
  /** Which note each open (or once-open) note window shows, by window id. */
  bindings: Record<string, string>;
  notes: StickyNote[];
};

export const STICKY_NOTE_LIMIT = 50;
export const EMPTY_STICKY_STORE: StickyNoteStore = { bindings: {}, notes: [] };

export function isStickyNoteColor(value: unknown): value is StickyNoteColor {
  return typeof value === "string" && (STICKY_NOTE_COLORS as readonly string[]).includes(value);
}

export function createStickyNote(now: number, color: StickyNoteColor = "yellow"): StickyNote {
  return { color, id: `sticky-${crypto.randomUUID()}`, text: "", updatedAt: now };
}

/** The note's first non-empty line, the way the Windows app titles a note. */
export function getStickyNoteTitle(note: StickyNote | undefined) {
  const firstLine = note?.text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 40) : "새 메모";
}

/**
 * Decides which note the window `windowId` shows. An existing binding to a
 * live note wins; otherwise the oldest note no OTHER open note window is
 * showing is adopted; otherwise a new note is created (capped). Returns the
 * store unchanged (same reference) when nothing had to change, so a caller
 * can skip a state update.
 */
export function bindStickyNoteWindow(
  store: StickyNoteStore,
  windowId: string,
  openStickyWindowIds: string[],
  now: number,
): StickyNoteStore {
  const bound = store.bindings[windowId];
  if (bound && store.notes.some((note) => note.id === bound)) return store;

  const takenByOthers = new Set(
    openStickyWindowIds
      .filter((id) => id !== windowId)
      .map((id) => store.bindings[id])
      .filter((id): id is string => Boolean(id)),
  );
  const free = [...store.notes]
    .filter((note) => !takenByOthers.has(note.id))
    .sort((a, b) => a.updatedAt - b.updatedAt)[0];
  if (free) {
    return { ...store, bindings: { ...store.bindings, [windowId]: free.id } };
  }
  if (store.notes.length >= STICKY_NOTE_LIMIT) {
    // Every note is on screen and the cap is reached: point this window at
    // the newest note rather than refusing to show anything.
    const newest = [...store.notes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { ...store, bindings: { ...store.bindings, [windowId]: newest.id } };
  }
  const note = createStickyNote(now);
  return {
    bindings: { ...store.bindings, [windowId]: note.id },
    notes: [...store.notes, note],
  };
}

export function updateStickyNote(
  store: StickyNoteStore,
  noteId: string,
  patch: Partial<Pick<StickyNote, "color" | "text">>,
  now: number,
): StickyNoteStore {
  return {
    ...store,
    notes: store.notes.map((note) =>
      note.id === noteId ? { ...note, ...patch, updatedAt: now } : note,
    ),
  };
}

/** Removes a note and every binding that pointed at it. */
export function deleteStickyNote(store: StickyNoteStore, noteId: string): StickyNoteStore {
  const bindings = Object.fromEntries(
    Object.entries(store.bindings).filter(([, id]) => id !== noteId),
  );
  return { bindings, notes: store.notes.filter((note) => note.id !== noteId) };
}

export function loadStickyNotes(): StickyNoteStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return EMPTY_STICKY_STORE;
    const raw = parsed as Partial<StickyNoteStore>;
    const notes = (Array.isArray(raw.notes) ? raw.notes : [])
      .filter(
        (note): note is StickyNote =>
          typeof note === "object" &&
          note !== null &&
          typeof (note as StickyNote).id === "string" &&
          typeof (note as StickyNote).text === "string" &&
          Number.isFinite((note as StickyNote).updatedAt) &&
          isStickyNoteColor((note as StickyNote).color),
      )
      .slice(0, STICKY_NOTE_LIMIT);
    const noteIds = new Set(notes.map((note) => note.id));
    const bindings =
      typeof raw.bindings === "object" && raw.bindings !== null
        ? Object.fromEntries(
            Object.entries(raw.bindings).filter(
              ([, id]) => typeof id === "string" && noteIds.has(id),
            ),
          )
        : {};
    return { bindings, notes };
  } catch {
    return EMPTY_STICKY_STORE;
  }
}

export function persistStickyNotes(store: StickyNoteStore) {
  try {
    localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(store));
  } catch {
    // Losing the write must not lose the session.
  }
}
