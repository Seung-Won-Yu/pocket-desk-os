import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { describeVfsNameConflicts, findVfsNameConflicts } from "./nameConflicts";

function makeItem(
  id: string,
  name: string,
  parentId: string,
  extra: Partial<DesktopItem> = {},
) {
  return {
    createdAt: 0,
    id,
    kind: "note",
    name,
    parentId,
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...extra,
  } as DesktopItem;
}

describe("findVfsNameConflicts", () => {
  const items = [
    makeItem("a", "notes.txt", "documents"),
    makeItem("b", "notes.txt", "pictures"),
    makeItem("c", "sketch.canvas", "pictures"),
  ];

  it("finds a name already taken in the target folder", () => {
    expect(findVfsNameConflicts(items, ["a"], "pictures")).toEqual([
      { existingId: "b", name: "notes.txt", sourceId: "a" },
    ]);
  });

  it("reports nothing when the target folder is free", () => {
    expect(findVfsNameConflicts(items, ["c"], "documents")).toEqual([]);
  });

  it("treats a copy into its own folder as a duplicate, not a conflict", () => {
    expect(findVfsNameConflicts(items, ["a"], "documents")).toEqual([]);
  });

  it("ignores a row that is itself being moved", () => {
    const both = [...items, makeItem("d", "sketch.canvas", "documents")];
    expect(findVfsNameConflicts(both, ["c", "d"], "documents")).toEqual([]);
  });

  it("ignores a trashed row sitting in the target folder", () => {
    const withTrash = [
      makeItem("a", "notes.txt", "documents"),
      makeItem("b", "notes.txt", "pictures", { trashed: true }),
    ];
    expect(findVfsNameConflicts(withTrash, ["a"], "pictures")).toEqual([]);
  });

  it("collects one conflict per colliding entry", () => {
    const many = [
      makeItem("a", "1.txt", "documents"),
      makeItem("b", "2.txt", "documents"),
      makeItem("c", "1.txt", "pictures"),
      makeItem("d", "2.txt", "pictures"),
    ];
    expect(findVfsNameConflicts(many, ["a", "b"], "pictures").map((c) => c.name)).toEqual([
      "1.txt",
      "2.txt",
    ]);
  });
});

describe("describeVfsNameConflicts", () => {
  const conflict = (name: string) => ({ existingId: "x", name, sourceId: "y" });

  it("names one file", () => {
    expect(describeVfsNameConflicts([conflict("notes.txt")])).toBe("notes.txt");
  });

  it("counts the rest", () => {
    expect(
      describeVfsNameConflicts([conflict("a.txt"), conflict("b.txt"), conflict("c.txt")]),
    ).toBe("a.txt 외 2개");
  });

  it("says nothing when there is no conflict", () => {
    expect(describeVfsNameConflicts([])).toBe("");
  });
});
