import { describe, expect, it } from "vitest";
import {
  type StartPinnedEntry,
  getPinnedAppIds,
  groupTiles,
  nextFolderName,
  normalizeStartPinned,
  removeFromFolder,
  reorderTiles,
  ungroupFolder,
} from "./startPinned";

const app = (appId: string): StartPinnedEntry => ({ appId: appId as never, kind: "app" });
const known = (appId: string) =>
  ["files", "notepad", "paint", "photos", "browser"].includes(appId);
let counter = 0;
const makeId = () => `folder-${(counter += 1)}`;

describe("groupTiles", () => {
  it("two apps dropped together become a folder in the target's slot", () => {
    counter = 0;
    const entries = [app("files"), app("notepad"), app("paint")];
    const grouped = groupTiles(entries, "paint", "notepad", makeId);
    expect(grouped).toEqual([
      app("files"),
      { appIds: ["notepad", "paint"], id: "folder-1", kind: "folder", name: "폴더 1" },
    ]);
  });

  it("an app dropped on a folder joins it", () => {
    const entries: StartPinnedEntry[] = [
      { appIds: ["notepad", "paint"], id: "f1", kind: "folder", name: "폴더 1" },
      app("files"),
    ];
    expect(groupTiles(entries, "files", "f1", makeId)).toEqual([
      { appIds: ["notepad", "paint", "files"], id: "f1", kind: "folder", name: "폴더 1" },
    ]);
  });

  it("refuses to nest folders, or to group a tile with itself or a stranger", () => {
    const entries: StartPinnedEntry[] = [
      { appIds: ["notepad", "paint"], id: "f1", kind: "folder", name: "폴더 1" },
      { appIds: ["files", "photos"], id: "f2", kind: "folder", name: "폴더 2" },
    ];
    expect(groupTiles(entries, "f1", "f2", makeId)).toBe(entries);
    expect(groupTiles(entries, "f1", "f1", makeId)).toBe(entries);
    expect(groupTiles(entries, "gone", "f2", makeId)).toBe(entries);
  });

  it("names each new folder after the first number no folder uses", () => {
    expect(nextFolderName([])).toBe("폴더 1");
    expect(
      nextFolderName([{ appIds: ["files", "paint"], id: "f", kind: "folder", name: "폴더 1" }]),
    ).toBe("폴더 2");
  });
});

describe("reorderTiles", () => {
  it("moves a tile onto another's slot", () => {
    const entries = [app("files"), app("notepad"), app("paint")];
    expect(getPinnedAppIds(reorderTiles(entries, "paint", "files"))).toEqual([
      "paint",
      "files",
      "notepad",
    ]);
  });
});

describe("ungroupFolder and removeFromFolder", () => {
  const entries: StartPinnedEntry[] = [
    app("files"),
    { appIds: ["notepad", "paint", "photos"], id: "f1", kind: "folder", name: "폴더 1" },
  ];

  it("spills a folder back where it stood", () => {
    expect(getPinnedAppIds(ungroupFolder(entries, "f1"))).toEqual([
      "files",
      "notepad",
      "paint",
      "photos",
    ]);
    expect(ungroupFolder(entries, "nope")).toBe(entries);
  });

  it("takes one app out, and flattens a folder down to its last app", () => {
    const smaller = removeFromFolder(entries, "f1", "photos");
    expect(getPinnedAppIds(smaller)).toEqual(["files", "notepad", "paint"]);
    const flattened = removeFromFolder(
      removeFromFolder(smaller, "f1", "paint"),
      "f1",
      "notepad",
    );
    expect(flattened).toEqual([app("files"), app("notepad")]);
  });
});

describe("normalizeStartPinned", () => {
  it("reads the old plain list of app ids", () => {
    expect(normalizeStartPinned(["files", "notepad"], known)).toEqual([
      app("files"),
      app("notepad"),
    ]);
  });

  it("drops unknown apps, duplicates across the whole area, and empty folders", () => {
    const value = [
      "files",
      "files",
      "nosuchapp",
      { appIds: ["notepad", "files"], id: "f1", kind: "folder", name: "폴더 1" },
      { appIds: ["nosuchapp"], id: "f2", kind: "folder", name: "폴더 2" },
      { kind: "folder", name: "no ids" },
      42,
      null,
    ];
    // "files" is already pinned, so the folder keeps only 메모장 — and a folder
    // of one is not a folder.
    expect(normalizeStartPinned(value, known)).toEqual([app("files"), app("notepad")]);
  });

  it("returns null for anything that is not a list", () => {
    expect(normalizeStartPinned("nope", known)).toBeNull();
    expect(normalizeStartPinned(null, known)).toBeNull();
  });
});
