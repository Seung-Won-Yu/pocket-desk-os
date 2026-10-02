import { describe, expect, it } from "vitest";
import {
  closeNoteTabs,
  getNoteTabs,
  getNoteTabDropSide,
  getNoteTabsToClose,
  moveNoteTab,
  normalizeNoteTabs,
  stepNoteTab,
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

describe("getNoteTabDropSide", () => {
  it("lands before a tab on its left half and after it on its right half", () => {
    expect(getNoteTabDropSide(100, 100, 80)).toBe("before");
    expect(getNoteTabDropSide(139, 100, 80)).toBe("before");
    expect(getNoteTabDropSide(140, 100, 80)).toBe("after");
    expect(getNoteTabDropSide(179, 100, 80)).toBe("after");
  });
});

describe("moveNoteTab", () => {
  const open = ["a", "b", "c", "d"];

  it("drops a tab into the gap beside another, either way along the strip", () => {
    expect(moveNoteTab(open, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
    expect(moveNoteTab(open, "a", "c", "before")).toEqual(["b", "a", "c", "d"]);
    expect(moveNoteTab(open, "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
    expect(moveNoteTab(open, "d", "b", "after")).toEqual(["a", "b", "d", "c"]);
    expect(moveNoteTab(open, "a", "d", "after")).toEqual(["b", "c", "d", "a"]);
    expect(moveNoteTab(open, "d", "a", "before")).toEqual(["d", "a", "b", "c"]);
  });

  it("hands the strip back untouched when the tab would stay where it is", () => {
    expect(moveNoteTab(open, "b", "b", "after")).toBe(open);
    expect(moveNoteTab(open, "b", "a", "after")).toBe(open);
    expect(moveNoteTab(open, "b", "c", "before")).toBe(open);
    expect(moveNoteTab(open, "x", "c", "before")).toBe(open);
    expect(moveNoteTab(open, "b", "x", "before")).toBe(open);
  });
});

describe("stepNoteTab", () => {
  const open = ["a", "b", "c"];

  it("moves a tab one place left or right", () => {
    expect(stepNoteTab(open, "b", -1)).toEqual(["b", "a", "c"]);
    expect(stepNoteTab(open, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("stops at either end, and leaves a stranger alone", () => {
    expect(stepNoteTab(open, "a", -1)).toBe(open);
    expect(stepNoteTab(open, "c", 1)).toBe(open);
    expect(stepNoteTab(open, "x", 1)).toBe(open);
  });
});
