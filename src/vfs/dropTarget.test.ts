import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { findEntryForAppDrop, readVfsDragPayload } from "./dropTarget";

function make(id: string, kind: DesktopItem["kind"], name: string): DesktopItem {
  return {
    createdAt: 0,
    id,
    kind,
    name,
    parentId: "desktop",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
  };
}

const items = [
  make("note", "note", "메모.txt"),
  make("draw", "canvas", "그림.canvas"),
  make("folder", "folder", "폴더"),
];

describe("findEntryForAppDrop", () => {
  it("gives 메모장 the text file", () => {
    expect(findEntryForAppDrop(items, ["note"], "notepad")?.id).toBe("note");
  });

  it("refuses a drawing to 메모장", () => {
    expect(findEntryForAppDrop(items, ["draw"], "notepad")).toBeNull();
  });

  it("gives 그림판 the drawing", () => {
    expect(findEntryForAppDrop(items, ["draw"], "paint")?.id).toBe("draw");
  });

  it("never hands over a folder", () => {
    expect(findEntryForAppDrop(items, ["folder"], "files")).toBeNull();
  });

  it("takes the first of several that the app can open", () => {
    expect(findEntryForAppDrop(items, ["draw", "note"], "notepad")?.id).toBe("note");
  });

  it("refuses a trashed entry", () => {
    const trashed = items.map((item) =>
      item.id === "note" ? { ...item, trashed: true } : item,
    );
    expect(findEntryForAppDrop(trashed, ["note"], "notepad")).toBeNull();
  });

  it("refuses when the window has no app", () => {
    expect(findEntryForAppDrop(items, ["note"], undefined)).toBeNull();
  });

  it("refuses an id that names nothing", () => {
    expect(findEntryForAppDrop(items, ["gone"], "notepad")).toBeNull();
  });
});

describe("readVfsDragPayload", () => {
  it("reads the ids out", () => {
    expect(readVfsDragPayload(JSON.stringify(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("keeps only the strings", () => {
    expect(readVfsDragPayload(JSON.stringify(["a", 4, null]))).toEqual(["a"]);
  });

  it("says nothing for an empty, malformed or non-array payload", () => {
    expect(readVfsDragPayload("")).toEqual([]);
    expect(readVfsDragPayload("{{{")).toEqual([]);
    expect(readVfsDragPayload(JSON.stringify({ a: 1 }))).toEqual([]);
  });
});
