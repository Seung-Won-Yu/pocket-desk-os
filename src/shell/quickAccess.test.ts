// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  QUICK_ACCESS_LIMIT,
  loadQuickAccess,
  normalizeQuickAccess,
  persistQuickAccess,
  toggleQuickAccess,
} from "./quickAccess";

const folders = new Set(["docs", "photos", "work"]);
const isFolder = (id: string) => folders.has(id);

afterEach(() => {
  localStorage.clear();
});

describe("normalizeQuickAccess", () => {
  it("keeps the ids that still name a folder, in order", () => {
    expect(normalizeQuickAccess(["work", "docs"], isFolder)).toEqual(["work", "docs"]);
  });

  it("drops what is not a folder any more, duplicates and rubbish", () => {
    // A pin whose folder went to the bin must not come back as a sidebar row.
    expect(normalizeQuickAccess(["docs", "deleted", "docs", 7, null], isFolder)).toEqual([
      "docs",
    ]);
    expect(normalizeQuickAccess("문서", isFolder)).toEqual([]);
    expect(normalizeQuickAccess(null, isFolder)).toEqual([]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: QUICK_ACCESS_LIMIT + 5 }, (_, index) => `f${index}`);
    expect(normalizeQuickAccess(many, () => true)).toHaveLength(QUICK_ACCESS_LIMIT);
  });
});

describe("toggleQuickAccess", () => {
  it("pins onto the end and unpins in place", () => {
    expect(toggleQuickAccess(["docs"], "work")).toEqual(["docs", "work"]);
    expect(toggleQuickAccess(["docs", "work"], "docs")).toEqual(["work"]);
  });

  it("returns the same array when the cap is reached, so the caller can say so", () => {
    const full = Array.from({ length: QUICK_ACCESS_LIMIT }, (_, index) => `f${index}`);
    expect(toggleQuickAccess(full, "one-more")).toBe(full);
    // Unpinning still works at the cap.
    expect(toggleQuickAccess(full, "f0")).toHaveLength(QUICK_ACCESS_LIMIT - 1);
  });
});

describe("quick access persistence", () => {
  it("round-trips through storage", () => {
    expect(persistQuickAccess(["work", "docs"])).toBe(true);
    expect(loadQuickAccess(isFolder)).toEqual(["work", "docs"]);
  });

  it("reads nothing out of a broken value", () => {
    localStorage.setItem("pocket-desk-quick-access-v1", "{broken");
    expect(loadQuickAccess(isFolder)).toEqual([]);
  });
});
