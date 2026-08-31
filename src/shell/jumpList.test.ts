import { describe, expect, it } from "vitest";
import { JUMP_LIST_LIMIT, buildRecentDocumentsByApp } from "./jumpList";
import type { DesktopItem } from "../types";

function makeItem(overrides: Partial<DesktopItem>): DesktopItem {
  return {
    createdAt: 0,
    id: "item",
    kind: "note",
    name: "메모.txt",
    parentId: "desktop",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe("buildRecentDocumentsByApp", () => {
  it("groups by the app a double-click would open, newest first", () => {
    const items = [
      makeItem({ id: "old-note", name: "old.txt", updatedAt: 1 }),
      makeItem({ id: "new-note", name: "new.txt", updatedAt: 9 }),
      makeItem({ id: "sketch", kind: "canvas", name: "sketch.canvas", updatedAt: 5 }),
      makeItem({ id: "folder", kind: "folder", name: "문서", updatedAt: 7 }),
    ];
    const byApp = buildRecentDocumentsByApp(items, {});

    expect(byApp.get("notepad")?.map((item) => item.id)).toEqual(["new-note", "old-note"]);
    expect(byApp.get("paint")?.map((item) => item.id)).toEqual(["sketch"]);
    // Folders belong to Explorer's jump list, the way Windows lists 자주 사용하는 폴더.
    expect(byApp.get("files")?.map((item) => item.id)).toEqual(["folder"]);
  });

  it("follows the file-type default app override, not the built-in association", () => {
    const items = [makeItem({ id: "note", name: "메모.txt" })];
    const byApp = buildRecentDocumentsByApp(items, { txt: "browser" });
    expect(byApp.get("notepad")).toBeUndefined();
    expect(byApp.get("browser")?.map((item) => item.id)).toEqual(["note"]);
  });

  it("skips trashed entries and caps each list", () => {
    const items = [
      makeItem({ id: "trashed", name: "지운 파일.txt", trashed: true, updatedAt: 99 }),
      ...Array.from({ length: JUMP_LIST_LIMIT + 3 }, (_, index) =>
        makeItem({ id: `note-${index}`, name: `n${index}.txt`, updatedAt: index }),
      ),
    ];
    const notepad = buildRecentDocumentsByApp(items, {}).get("notepad");
    expect(notepad).toHaveLength(JUMP_LIST_LIMIT);
    expect(notepad?.[0].id).toBe(`note-${JUMP_LIST_LIMIT + 2}`);
    expect(notepad?.some((item) => item.id === "trashed")).toBe(false);
  });
});
