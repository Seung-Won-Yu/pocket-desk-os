import { describe, expect, it } from "vitest";
import { migrateVfsHierarchy } from "./vfsBootstrap";
import {
  VFS_DOCUMENTS_ID,
  VFS_DOWNLOADS_ID,
  VFS_GAMES_ID,
  VFS_PICTURES_ID,
  VFS_ROOT_ID,
} from "../vfs/model";
import type { DesktopItem } from "../types";

function makeEntry(overrides: Partial<DesktopItem>): DesktopItem {
  return {
    createdAt: 500_000,
    id: "entry",
    kind: "note",
    name: "메모.txt",
    parentId: VFS_ROOT_ID,
    showOnDesktop: false,
    updatedAt: 500_000,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function makeFolder(id: string, name: string, createdAt: number): DesktopItem {
  return makeEntry({ createdAt, id, kind: "folder", name, updatedAt: createdAt });
}

describe("migrateVfsHierarchy", () => {
  it("gives a trio-era profile the 다운로드 folder without re-homing anything", () => {
    const entries = [
      makeFolder(VFS_DOCUMENTS_ID, "문서", 100_000),
      makeFolder(VFS_PICTURES_ID, "사진", 101_000),
      makeFolder(VFS_GAMES_ID, "게임", 102_000),
      // A loose root note the pre-folder migration would have re-homed —
      // this profile already went through that era, so it must stay put.
      makeEntry({ id: "loose-note", name: "루트 메모.txt" }),
    ];

    const migrated = migrateVfsHierarchy(entries);
    const downloads = migrated.find((entry) => entry.id === VFS_DOWNLOADS_ID);
    expect(downloads?.kind).toBe("folder");
    expect(migrated.find((entry) => entry.id === "loose-note")?.parentId).toBe(VFS_ROOT_ID);
  });

  it("backdates an appended system folder to the profile's oldest entry", () => {
    const entries = [
      makeFolder(VFS_DOCUMENTS_ID, "문서", 100_000),
      makeFolder(VFS_PICTURES_ID, "사진", 101_000),
      makeFolder(VFS_GAMES_ID, "게임", 102_000),
    ];

    const downloads = migrateVfsHierarchy(entries).find(
      (entry) => entry.id === VFS_DOWNLOADS_ID,
    );
    // Not "today": a 만든 날짜 sort must not claim the folder is newer than
    // the desktop it belongs to.
    expect(downloads?.createdAt).toBe(100_000);
    expect(downloads?.updatedAt).toBe(100_000);
  });

  it("still re-homes loose root files for a profile from before the folder era", () => {
    const entries = [
      makeEntry({ id: "loose-note", name: "메모.txt" }),
      makeEntry({ id: "loose-canvas", kind: "canvas", name: "그림.canvas" }),
      makeEntry({ id: "shown", name: "보이는 메모.txt", showOnDesktop: true }),
    ];

    const migrated = migrateVfsHierarchy(entries);
    expect(migrated.find((entry) => entry.id === "loose-note")?.parentId).toBe(
      VFS_DOCUMENTS_ID,
    );
    expect(migrated.find((entry) => entry.id === "loose-canvas")?.parentId).toBe(
      VFS_PICTURES_ID,
    );
    // Anything the user placed on the desktop stays on the desktop.
    expect(migrated.find((entry) => entry.id === "shown")?.parentId).toBe(VFS_ROOT_ID);
    for (const folderId of [
      VFS_DOCUMENTS_ID,
      VFS_PICTURES_ID,
      VFS_GAMES_ID,
      VFS_DOWNLOADS_ID,
    ]) {
      expect(migrated.some((entry) => entry.id === folderId)).toBe(true);
    }
  });
});
