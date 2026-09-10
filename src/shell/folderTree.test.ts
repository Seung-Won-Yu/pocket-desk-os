import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { VFS_DOCUMENTS_ID, VFS_ROOT_ID } from "../vfs/model";
import {
  buildVfsFolderTree,
  getFolderTreeKeyAction,
  getVfsChildFolders,
  getVfsFolderAncestorIds,
  toggleFolderTreeExpansion,
} from "./folderTree";

function folder(id: string, name: string, parentId: string, extra: Partial<DesktopItem> = {}) {
  return {
    createdAt: 0,
    id,
    kind: "folder",
    name,
    parentId,
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...extra,
  } as DesktopItem;
}

function note(id: string, name: string, parentId: string) {
  return { ...folder(id, name, parentId), kind: "note" } as DesktopItem;
}

const items = [
  folder(VFS_DOCUMENTS_ID, "문서", VFS_ROOT_ID),
  folder("pictures", "사진", VFS_ROOT_ID),
  folder("work", "업무", VFS_DOCUMENTS_ID),
  folder("2024", "2024", "work"),
  folder("secret", "비밀", VFS_DOCUMENTS_ID, { hidden: true }),
  folder("gone", "버린 폴더", VFS_DOCUMENTS_ID, { trashed: true }),
  note("memo", "메모.txt", VFS_DOCUMENTS_ID),
];

describe("getVfsChildFolders", () => {
  it("lists only folders, sorted by name", () => {
    expect(getVfsChildFolders(items, VFS_ROOT_ID, false).map((item) => item.name)).toEqual([
      "문서",
      "사진",
    ]);
  });

  it("leaves out a file, a trashed folder and a hidden one", () => {
    expect(getVfsChildFolders(items, VFS_DOCUMENTS_ID, false).map((item) => item.name)).toEqual(
      ["업무"],
    );
  });

  it("shows the hidden folder once 숨긴 항목 is on", () => {
    expect(getVfsChildFolders(items, VFS_DOCUMENTS_ID, true).map((item) => item.name)).toEqual([
      "비밀",
      "업무",
    ]);
  });

  it("sorts numbers the way Windows does", () => {
    const numbered = [folder("a", "폴더10", VFS_ROOT_ID), folder("b", "폴더2", VFS_ROOT_ID)];
    expect(getVfsChildFolders(numbered, VFS_ROOT_ID, false).map((item) => item.name)).toEqual([
      "폴더2",
      "폴더10",
    ]);
  });
});

describe("buildVfsFolderTree", () => {
  it("shows the root alone while it is closed", () => {
    expect(buildVfsFolderTree(items, [], false)).toEqual([
      { depth: 0, expanded: false, hasChildren: true, id: VFS_ROOT_ID, name: "바탕 화면" },
    ]);
  });

  it("adds a level for each expanded branch", () => {
    const rows = buildVfsFolderTree(items, [VFS_ROOT_ID, VFS_DOCUMENTS_ID, "work"], false);
    expect(rows.map((row) => [row.name, row.depth])).toEqual([
      ["바탕 화면", 0],
      ["문서", 1],
      ["업무", 2],
      ["2024", 3],
      ["사진", 1],
    ]);
  });

  it("marks a leaf as having no children", () => {
    const rows = buildVfsFolderTree(items, [VFS_ROOT_ID], false);
    expect(rows.find((row) => row.name === "사진")?.hasChildren).toBe(false);
  });

  it("stops rather than looping when a folder is its own ancestor", () => {
    const cyclic = [
      folder("a", "A", VFS_ROOT_ID),
      folder("b", "B", "a"),
      folder("c", "C", "b"),
    ];
    // A parent chain that points back at itself: the walk must terminate.
    const looped = cyclic.map((item) => (item.id === "a" ? { ...item, parentId: "c" } : item));
    const rows = buildVfsFolderTree(looped, ["a", "b", "c", VFS_ROOT_ID], false);
    expect(rows.length).toBeLessThan(10);
  });
});

describe("getVfsFolderAncestorIds", () => {
  it("names every folder from the root down to the parent", () => {
    expect(getVfsFolderAncestorIds(items, "2024")).toEqual([
      VFS_ROOT_ID,
      VFS_DOCUMENTS_ID,
      "work",
    ]);
  });

  it("gives the root itself nothing above it", () => {
    expect(getVfsFolderAncestorIds(items, VFS_ROOT_ID)).toEqual([]);
  });

  it("stops on a parent chain that loops", () => {
    const looped = [folder("a", "A", "b"), folder("b", "B", "a")];
    expect(getVfsFolderAncestorIds(looped, "a").length).toBeLessThan(4);
  });
});

describe("toggleFolderTreeExpansion", () => {
  it("opens what is closed and closes what is open", () => {
    expect(toggleFolderTreeExpansion([], "a")).toEqual(["a"]);
    expect(toggleFolderTreeExpansion(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("getFolderTreeKeyAction", () => {
  const rows = buildVfsFolderTree(items, [VFS_ROOT_ID, VFS_DOCUMENTS_ID], false);

  it("opens a closed branch with Right", () => {
    expect(getFolderTreeKeyAction("ArrowRight", rows, "work")).toEqual({ kind: "expand" });
  });

  it("steps into an open branch with Right", () => {
    expect(getFolderTreeKeyAction("ArrowRight", rows, VFS_DOCUMENTS_ID)).toEqual({
      id: "work",
      kind: "focus",
    });
  });

  it("closes an open branch with Left", () => {
    expect(getFolderTreeKeyAction("ArrowLeft", rows, VFS_DOCUMENTS_ID)).toEqual({
      kind: "collapse",
    });
  });

  it("steps out to the parent with Left on a leaf", () => {
    expect(getFolderTreeKeyAction("ArrowLeft", rows, "work")).toEqual({
      id: VFS_DOCUMENTS_ID,
      kind: "focus",
    });
  });

  it("walks the rows on screen with Up and Down", () => {
    expect(getFolderTreeKeyAction("ArrowDown", rows, VFS_ROOT_ID)).toEqual({
      id: VFS_DOCUMENTS_ID,
      kind: "focus",
    });
    expect(getFolderTreeKeyAction("ArrowUp", rows, VFS_DOCUMENTS_ID)).toEqual({
      id: VFS_ROOT_ID,
      kind: "focus",
    });
  });

  it("jumps to the ends with Home and End", () => {
    expect(getFolderTreeKeyAction("Home", rows, "work")).toEqual({
      id: VFS_ROOT_ID,
      kind: "focus",
    });
    expect(getFolderTreeKeyAction("End", rows, VFS_ROOT_ID)).toEqual({
      id: rows[rows.length - 1].id,
      kind: "focus",
    });
  });

  it("does nothing at the edges or for a key it does not own", () => {
    expect(getFolderTreeKeyAction("ArrowUp", rows, VFS_ROOT_ID)).toBeNull();
    expect(getFolderTreeKeyAction("Enter", rows, VFS_ROOT_ID)).toBeNull();
    expect(getFolderTreeKeyAction("ArrowDown", rows, "nope")).toBeNull();
  });
});
