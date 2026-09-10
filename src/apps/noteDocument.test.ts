import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { hasUnsavedNoteChanges } from "./noteDocument";

const note = (id: string, content: string): DesktopItem => ({
  content,
  createdAt: 0,
  id,
  kind: "note",
  name: `${id}.txt`,
  parentId: "desktop",
  showOnDesktop: false,
  updatedAt: 0,
  x: 0,
  y: 0,
});

describe("hasUnsavedNoteChanges", () => {
  it("is false with no document open", () => {
    expect(hasUnsavedNoteChanges(undefined, "", "typed")).toBe(false);
  });

  it("is false while the text matches the file", () => {
    expect(hasUnsavedNoteChanges(note("a", "hello"), "a", "hello")).toBe(false);
  });

  it("is true once the text differs from the file", () => {
    expect(hasUnsavedNoteChanges(note("a", "hello"), "a", "hello!")).toBe(true);
  });

  it("treats a file with no content as empty", () => {
    expect(hasUnsavedNoteChanges({ ...note("a", ""), content: undefined }, "a", "")).toBe(
      false,
    );
  });

  it("says nothing while the editor still holds the previous document", () => {
    // The gap: the active note is already 'b', the editor still shows 'a'.
    expect(hasUnsavedNoteChanges(note("b", "second"), "a", "first")).toBe(false);
  });

  it("reports again as soon as the editor has caught up", () => {
    expect(hasUnsavedNoteChanges(note("b", "second"), "b", "first")).toBe(true);
  });
});
