// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_STICKY_STORE,
  STICKY_NOTE_LIMIT,
  STICKY_NOTE_MAX_LENGTH,
  bindStickyNoteWindow,
  createStickyNote,
  deleteStickyNote,
  getStickyNoteTitle,
  loadStickyNotes,
  persistStickyNotes,
  updateStickyNote,
  type StickyNoteStore,
} from "./stickyNotes";
import { STICKY_NOTES_KEY } from "./constants";

const NOW = 1_000_000;

beforeEach(() => {
  localStorage.clear();
});

describe("bindStickyNoteWindow", () => {
  it("creates a note for a window that has none, and keeps that binding", () => {
    const bound = bindStickyNoteWindow(EMPTY_STICKY_STORE, "win-1", ["win-1"], NOW);
    expect(bound.notes).toHaveLength(1);
    expect(bound.bindings["win-1"]).toBe(bound.notes[0].id);
    // Already bound: nothing changes — same reference, so no state update.
    expect(bindStickyNoteWindow(bound, "win-1", ["win-1"], NOW + 1)).toBe(bound);
  });

  it("a new window adopts the oldest note no other open window is showing", () => {
    const older = { ...createStickyNote(NOW - 500), id: "older" };
    const newer = { ...createStickyNote(NOW), id: "newer" };
    const store: StickyNoteStore = {
      bindings: { "win-a": "newer" },
      notes: [newer, older],
    };
    const bound = bindStickyNoteWindow(store, "win-b", ["win-a", "win-b"], NOW);
    expect(bound.bindings["win-b"]).toBe("older");
    expect(bound.notes).toHaveLength(2);
  });

  it("creates a fresh note when every note is already on screen", () => {
    const only = { ...createStickyNote(NOW), id: "only" };
    const store: StickyNoteStore = { bindings: { "win-a": "only" }, notes: [only] };
    const bound = bindStickyNoteWindow(store, "win-b", ["win-a", "win-b"], NOW);
    expect(bound.notes).toHaveLength(2);
    expect(bound.bindings["win-b"]).not.toBe("only");
  });

  it("a stale binding to a deleted note is replaced", () => {
    const store: StickyNoteStore = { bindings: { "win-a": "gone" }, notes: [] };
    const bound = bindStickyNoteWindow(store, "win-a", ["win-a"], NOW);
    expect(bound.notes).toHaveLength(1);
    expect(bound.bindings["win-a"]).toBe(bound.notes[0].id);
  });

  it("at the cap, a window is pointed at the newest note instead of nothing", () => {
    const notes = Array.from({ length: STICKY_NOTE_LIMIT }, (_, index) => ({
      ...createStickyNote(NOW + index),
      id: `n${index}`,
    }));
    const bindings = Object.fromEntries(notes.map((note, index) => [`w${index}`, note.id]));
    const store: StickyNoteStore = { bindings, notes };
    const bound = bindStickyNoteWindow(
      store,
      "extra",
      [...Object.keys(bindings), "extra"],
      NOW + 999,
    );
    expect(bound.notes).toHaveLength(STICKY_NOTE_LIMIT);
    expect(bound.bindings.extra).toBe(`n${STICKY_NOTE_LIMIT - 1}`);
  });
});

describe("note edits", () => {
  it("updates text and colour with a fresh timestamp, and deletion drops bindings", () => {
    let store = bindStickyNoteWindow(EMPTY_STICKY_STORE, "win-1", ["win-1"], NOW);
    const id = store.notes[0].id;
    store = updateStickyNote(store, id, { text: "장보기\n우유", color: "pink" }, NOW + 5);
    expect(store.notes[0]).toMatchObject({
      color: "pink",
      text: "장보기\n우유",
      updatedAt: NOW + 5,
    });
    expect(getStickyNoteTitle(store.notes[0])).toBe("장보기");
    expect(getStickyNoteTitle(undefined)).toBe("새 메모");

    store = deleteStickyNote(store, id);
    expect(store.notes).toEqual([]);
    expect(store.bindings).toEqual({});
  });
});

describe("persistence", () => {
  it("round-trips and drops malformed notes plus bindings to missing notes", () => {
    const store = bindStickyNoteWindow(EMPTY_STICKY_STORE, "win-1", ["win-1"], NOW);
    persistStickyNotes(store);
    expect(loadStickyNotes()).toEqual(store);

    localStorage.setItem(
      STICKY_NOTES_KEY,
      JSON.stringify({
        bindings: { "win-1": "good", "win-2": "missing", "win-3": 7 },
        notes: [
          { color: "green", id: "good", text: "ok", updatedAt: 1 },
          { color: "plaid", id: "bad-color", text: "x", updatedAt: 1 },
          { color: "blue", id: 3, text: "x", updatedAt: 1 },
          "garbage",
        ],
      }),
    );
    expect(loadStickyNotes()).toEqual({
      bindings: { "win-1": "good" },
      notes: [{ color: "green", id: "good", text: "ok", updatedAt: 1 }],
    });

    localStorage.setItem(STICKY_NOTES_KEY, "{not json");
    expect(loadStickyNotes()).toEqual(EMPTY_STICKY_STORE);
  });
});

describe("a note's length", () => {
  it("caps what is typed or pasted into a note", () => {
    const note = createStickyNote(1);
    const store = { bindings: {}, notes: [note] };
    const long = "가".repeat(STICKY_NOTE_MAX_LENGTH + 500);
    const updated = updateStickyNote(store, note.id, { text: long }, 2);
    expect(updated.notes[0].text).toHaveLength(STICKY_NOTE_MAX_LENGTH);
    // A colour change must not touch the text.
    expect(updateStickyNote(updated, note.id, { color: "pink" }, 3).notes[0].text).toHaveLength(
      STICKY_NOTE_MAX_LENGTH,
    );
  });

  it("caps text that comes back from storage, not just text that is typed", () => {
    // The cap is the model's: restored or imported notes go through it too.
    localStorage.setItem(
      "pocket-desk-sticky-notes-v1",
      JSON.stringify({
        bindings: {},
        notes: [
          {
            color: "yellow",
            id: "sticky-1",
            text: "나".repeat(STICKY_NOTE_MAX_LENGTH * 2),
            updatedAt: 1,
          },
        ],
      }),
    );
    expect(loadStickyNotes().notes[0].text).toHaveLength(STICKY_NOTE_MAX_LENGTH);
  });
});

describe("persistStickyNotes", () => {
  it("says whether the write happened, so a refused write is not a secret", () => {
    expect(persistStickyNotes(EMPTY_STICKY_STORE)).toBe(true);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    /*
     * The per-note cap bounds one paste, not the whole origin's quota. A
     * refused write used to be swallowed: the user kept typing and the note
     * was back to its last saved state after a reload.
     */
    expect(persistStickyNotes(EMPTY_STICKY_STORE)).toBe(false);
    setItem.mockRestore();
  });
});
