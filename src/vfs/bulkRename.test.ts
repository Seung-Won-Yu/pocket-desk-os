import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { buildBulkRenames } from "./bulkRename";

function make(id: string, name: string, kind: DesktopItem["kind"] = "note"): DesktopItem {
  return {
    createdAt: 0,
    id,
    kind,
    name,
    parentId: "folder",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
  };
}

describe("buildBulkRenames", () => {
  const items = [make("a", "하나.txt"), make("b", "둘.txt"), make("c", "셋.png")];

  it("numbers the whole set from the one name that was typed", () => {
    expect(buildBulkRenames(items, ["a", "b"], "사진")).toEqual([
      { id: "a", name: "사진 (1).txt" },
      { id: "b", name: "사진 (2).txt" },
    ]);
  });

  it("keeps each file's own extension, not the one that was typed", () => {
    expect(buildBulkRenames(items, ["a", "c"], "사진.zip").map((entry) => entry.name)).toEqual([
      "사진 (1).txt",
      "사진 (2).png",
    ]);
  });

  it("leaves a folder without an extension", () => {
    const withFolder = [...items, make("d", "묶음", "folder")];
    expect(buildBulkRenames(withFolder, ["d", "a"], "보관").map((entry) => entry.name)).toEqual(
      ["보관 (1)", "보관 (2).txt"],
    );
  });

  it("steps over a number the folder already has", () => {
    const crowded = [...items, make("taken", "사진 (1).txt")];
    expect(buildBulkRenames(crowded, ["a", "b"], "사진").map((entry) => entry.name)).toEqual([
      "사진 (2).txt",
      "사진 (3).txt",
    ]);
  });

  it("may reuse a name held by one of the entries being renamed", () => {
    const pair = [make("a", "사진 (1).txt"), make("b", "다른.txt")];
    expect(buildBulkRenames(pair, ["a", "b"], "사진").map((entry) => entry.name)).toEqual([
      "사진 (1).txt",
      "사진 (2).txt",
    ]);
  });

  it("refuses a name with nothing to it", () => {
    expect(buildBulkRenames(items, ["a"], "   ")).toEqual([]);
    expect(buildBulkRenames(items, ["a"], "")).toEqual([]);
  });

  it("takes a leading dot as part of the name, not as an extension", () => {
    expect(buildBulkRenames(items, ["a"], ".메모").map((entry) => entry.name)).toEqual([
      ".메모 (1).txt",
    ]);
  });

  it("leaves out an id that names nothing and a trashed row", () => {
    const withTrash = [...items, { ...make("gone", "버림.txt"), trashed: true }];
    expect(buildBulkRenames(withTrash, ["nope", "gone"], "사진")).toEqual([]);
  });

  it("keeps the name inside the cap, suffix and extension included", () => {
    const long = [make("a", `${"가".repeat(60)}.txt`)];
    const [rename] = buildBulkRenames(long, ["a"], "나".repeat(60));
    expect(rename.name.length).toBeLessThanOrEqual(48);
    expect(rename.name.endsWith(" (1).txt")).toBe(true);
  });
});
