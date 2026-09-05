import { describe, expect, it } from "vitest";
import { formatVfsPathText, resolveVfsPathText } from "./pathInput";
import { VFS_DOCUMENTS_ID, VFS_ROOT_ID, createVfsSystemFolders } from "./model";
import type { DesktopItem } from "../types";

const items: DesktopItem[] = [
  ...createVfsSystemFolders(0),
  {
    createdAt: 0,
    id: "folder-reports",
    kind: "folder",
    name: "보고서",
    parentId: VFS_DOCUMENTS_ID,
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
  },
  {
    createdAt: 0,
    id: "folder-binned",
    kind: "folder",
    name: "버린 폴더",
    parentId: VFS_ROOT_ID,
    showOnDesktop: false,
    trashed: true,
    updatedAt: 0,
    x: 0,
    y: 0,
  },
];

describe("formatVfsPathText", () => {
  it("writes the chain the breadcrumbs show", () => {
    expect(formatVfsPathText(items, VFS_ROOT_ID)).toBe("바탕 화면");
    expect(formatVfsPathText(items, "folder-reports")).toBe("바탕 화면\\문서\\보고서");
  });
});

describe("resolveVfsPathText", () => {
  it("walks an absolute path, either separator, any case, extra spaces", () => {
    expect(resolveVfsPathText(items, "바탕 화면\\문서\\보고서")).toBe("folder-reports");
    expect(resolveVfsPathText(items, "바탕 화면/문서/보고서")).toBe("folder-reports");
    expect(resolveVfsPathText(items, "  바탕 화면 \\ 문서 ")).toBe(VFS_DOCUMENTS_ID);
  });

  it("reads a path with no root prefix from the folder on screen", () => {
    expect(resolveVfsPathText(items, "보고서", VFS_DOCUMENTS_ID)).toBe("folder-reports");
    expect(resolveVfsPathText(items, "..", "folder-reports")).toBe(VFS_DOCUMENTS_ID);
    expect(resolveVfsPathText(items, ".\\보고서", VFS_DOCUMENTS_ID)).toBe("folder-reports");
  });

  it("empty text and bare separators mean the desktop", () => {
    expect(resolveVfsPathText(items, "")).toBe(VFS_ROOT_ID);
    expect(resolveVfsPathText(items, "\\\\")).toBe(VFS_ROOT_ID);
    expect(resolveVfsPathText(items, "..", VFS_ROOT_ID)).toBe(VFS_ROOT_ID);
  });

  it("returns null for a folder that is not there, and for one in the bin", () => {
    expect(resolveVfsPathText(items, "바탕 화면\\없는 폴더")).toBeNull();
    expect(resolveVfsPathText(items, "바탕 화면\\버린 폴더")).toBeNull();
    // A file is not a folder.
    expect(resolveVfsPathText(items, "바탕 화면\\문서\\보고서\\더", VFS_ROOT_ID)).toBeNull();
  });
});
