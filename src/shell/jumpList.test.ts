// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  JUMP_LIST_LIMIT,
  RECENT_OPENS_LIMIT,
  buildRecentDocumentsByApp,
  loadRecentOpens,
  persistRecentOpens,
  recordRecentOpen,
  type RecentOpensMap,
} from "./jumpList";
import { RECENT_OPENS_KEY } from "./constants";
import type { DesktopItem } from "../types";

beforeEach(() => {
  localStorage.clear();
});

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

describe("recent opens", () => {
  it("an explicit open outranks a fresher modification stamp", () => {
    const edited = makeItem({ id: "edited", name: "edited.txt", updatedAt: 100 });
    const opened = makeItem({ id: "opened", name: "opened.txt", updatedAt: 10 });

    // Modification order without any opens…
    expect(
      buildRecentDocumentsByApp([edited, opened], {})
        .get("notepad")
        ?.map((item) => item.id),
    ).toEqual(["edited", "opened"]);

    // …and use order once the older file was actually opened.
    expect(
      buildRecentDocumentsByApp([edited, opened], {}, { opened: 200 })
        .get("notepad")
        ?.map((item) => item.id),
    ).toEqual(["opened", "edited"]);
  });

  it("stamps opens and drops the oldest stamp past the cap", () => {
    let opens: RecentOpensMap = {};
    for (let index = 0; index < RECENT_OPENS_LIMIT; index += 1) {
      opens = recordRecentOpen(opens, `item-${index}`, index);
    }
    opens = recordRecentOpen(opens, "newest", 999);
    expect(Object.keys(opens)).toHaveLength(RECENT_OPENS_LIMIT);
    expect(opens["item-0"]).toBeUndefined();
    expect(opens.newest).toBe(999);

    // Re-stamping an existing id refreshes without growing.
    opens = recordRecentOpen(opens, "newest", 1000);
    expect(Object.keys(opens)).toHaveLength(RECENT_OPENS_LIMIT);
    expect(opens.newest).toBe(1000);
  });

  it("round-trips the store and drops garbage entries", () => {
    persistRecentOpens({ a: 1 });
    expect(loadRecentOpens()).toEqual({ a: 1 });

    localStorage.setItem(RECENT_OPENS_KEY, JSON.stringify({ a: "x", b: 2, c: null }));
    expect(loadRecentOpens()).toEqual({ b: 2 });

    localStorage.setItem(RECENT_OPENS_KEY, "{not json");
    expect(loadRecentOpens()).toEqual({});
  });
});
