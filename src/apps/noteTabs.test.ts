import { describe, expect, it } from "vitest";
import {
  closeNoteTabs,
  getNoteTabs,
  getNoteTabsToClose,
  normalizeNoteTabs,
  withNoteTab,
} from "./noteTabs";

const notes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("getNoteTabs", () => {
  it("lists the open documents in tab order and drops the ones that are gone", () => {
    expect(getNoteTabs(["c", "gone", "a"], notes)).toEqual([{ id: "c" }, { id: "a" }]);
  });
});

describe("withNoteTab", () => {
  it("adds a document at the end, once", () => {
    expect(withNoteTab(["a"], "b")).toEqual(["a", "b"]);
    expect(withNoteTab(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(withNoteTab(["a"], "")).toEqual(["a"]);
  });
});

describe("getNoteTabsToClose", () => {
  const open = ["a", "b", "c", "d"];

  it("takes the one tab, every other tab, or the tabs to its right", () => {
    expect(getNoteTabsToClose(open, "b", "this")).toEqual(["b"]);
    expect(getNoteTabsToClose(open, "b", "others")).toEqual(["a", "c", "d"]);
    expect(getNoteTabsToClose(open, "b", "right")).toEqual(["c", "d"]);
  });

  it("has nothing to the right of the last tab, and nothing for a stranger", () => {
    expect(getNoteTabsToClose(open, "d", "right")).toEqual([]);
    expect(getNoteTabsToClose(open, "x", "this")).toEqual([]);
  });
});

describe("closeNoteTabs", () => {
  const open = ["a", "b", "c", "d"];

  it("keeps the document on screen when another tab closes", () => {
    expect(closeNoteTabs(open, ["a"], "c")).toEqual({
      nextActiveId: "c",
      openIds: ["b", "c", "d"],
    });
  });

  it("moves right from a closed tab, or left from the last one", () => {
    expect(closeNoteTabs(open, ["b"], "b").nextActiveId).toBe("c");
    expect(closeNoteTabs(open, ["d"], "d").nextActiveId).toBe("c");
    expect(closeNoteTabs(open, ["b", "c"], "b").nextActiveId).toBe("d");
    expect(closeNoteTabs(open, ["c", "d"], "c").nextActiveId).toBe("b");
  });

  it("leaves nothing to show once every tab is closed", () => {
    expect(closeNoteTabs(open, open, "a")).toEqual({ nextActiveId: null, openIds: [] });
  });
});

describe("normalizeNoteTabs", () => {
  it("keeps ids once and nothing else", () => {
    expect(normalizeNoteTabs(["a", "a", 3, "", "b"])).toEqual(["a", "b"]);
    expect(normalizeNoteTabs("a")).toEqual([]);
  });
});
