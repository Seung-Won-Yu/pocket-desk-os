import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { describeVfsFolderContents, getVfsFolderStats } from "./folderStats";

function make(overrides: Partial<DesktopItem> & { id: string }): DesktopItem {
  return {
    createdAt: 0,
    kind: "note",
    name: overrides.id,
    parentId: "desktop",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe("getVfsFolderStats", () => {
  const items: DesktopItem[] = [
    make({ id: "folder", kind: "folder", name: "문서" }),
    make({ id: "a", content: "12345", parentId: "folder" }),
    make({ id: "nested", kind: "folder", name: "하위", parentId: "folder" }),
    make({ id: "b", content: "1234567890", parentId: "nested" }),
    make({ id: "outside", content: "무시", parentId: "desktop" }),
  ];

  it("adds up everything underneath, not just the top level", () => {
    // The folder's own size is zero; what 속성 reports is what it holds.
    expect(getVfsFolderStats(items, "folder")).toEqual({ bytes: 15, files: 2, folders: 1 });
  });

  it("reports an empty folder as empty rather than as unknown", () => {
    expect(getVfsFolderStats(items, "nested")).toEqual({ bytes: 10, files: 1, folders: 0 });
    expect(getVfsFolderStats([make({ id: "f", kind: "folder" })], "f")).toEqual({
      bytes: 0,
      files: 0,
      folders: 0,
    });
  });

  it("leaves out what has been thrown away", () => {
    const withTrash = [
      ...items,
      make({ id: "c", content: "버림", parentId: "folder", trashed: true }),
    ];
    expect(getVfsFolderStats(withTrash, "folder").files).toBe(2);
  });

  it("counts a byte, not a character, for text outside ASCII", () => {
    const korean = [
      make({ id: "f", kind: "folder" }),
      make({ id: "k", content: "한글", parentId: "f" }),
    ];
    // Three UTF-8 bytes per syllable.
    expect(getVfsFolderStats(korean, "f").bytes).toBe(6);
  });

  it("cannot spin on a store where a folder is its own ancestor", () => {
    const cycle = [
      make({ id: "a", kind: "folder", parentId: "b" }),
      make({ id: "b", kind: "folder", parentId: "a" }),
    ];
    expect(getVfsFolderStats(cycle, "a").folders).toBe(1);
  });
});

describe("describeVfsFolderContents", () => {
  it("says how many of each", () => {
    expect(describeVfsFolderContents({ bytes: 0, files: 4, folders: 2 })).toBe(
      "파일 4개, 폴더 2개",
    );
  });
});
