import { describe, expect, it } from "vitest";
import { getNextRovingIndex, getNextTabIndex } from "./keyboardNav";

describe("getNextRovingIndex", () => {
  it("returns null for a key that does not navigate", () => {
    expect(getNextRovingIndex("Enter", 0, 5)).toBeNull();
    expect(getNextRovingIndex("a", 0, 5)).toBeNull();
  });

  it("returns null when there is nothing to navigate", () => {
    expect(getNextRovingIndex("ArrowDown", 0, 0)).toBeNull();
    expect(getNextRovingIndex("Home", -1, 0)).toBeNull();
  });

  it("jumps to the ends", () => {
    expect(getNextRovingIndex("Home", 3, 5)).toBe(0);
    expect(getNextRovingIndex("End", 1, 5)).toBe(4);
  });

  it("steps one item in a single-column list", () => {
    expect(getNextRovingIndex("ArrowDown", 1, 5)).toBe(2);
    expect(getNextRovingIndex("ArrowUp", 1, 5)).toBe(0);
    expect(getNextRovingIndex("ArrowRight", 1, 5)).toBe(2);
    expect(getNextRovingIndex("ArrowLeft", 1, 5)).toBe(0);
  });

  it("wraps around the ends of a list", () => {
    expect(getNextRovingIndex("ArrowDown", 4, 5)).toBe(0);
    expect(getNextRovingIndex("ArrowUp", 0, 5)).toBe(4);
  });

  it("enters at the near end when nothing is focused yet", () => {
    expect(getNextRovingIndex("ArrowDown", -1, 5)).toBe(0);
    expect(getNextRovingIndex("ArrowUp", -1, 5)).toBe(4);
  });

  it("steps a whole row in a grid", () => {
    // A 4-wide grid: index 1 is row 0, so Down lands on index 5.
    expect(getNextRovingIndex("ArrowDown", 1, 12, 4)).toBe(5);
    expect(getNextRovingIndex("ArrowUp", 5, 12, 4)).toBe(1);
  });

  it("keeps horizontal movement to one cell in a grid", () => {
    expect(getNextRovingIndex("ArrowRight", 1, 12, 4)).toBe(2);
    expect(getNextRovingIndex("ArrowLeft", 1, 12, 4)).toBe(0);
  });

  it("clamps row steps instead of wrapping to the opposite corner", () => {
    // Down from the bottom row and Up from the top row both stay put.
    expect(getNextRovingIndex("ArrowDown", 10, 12, 4)).toBe(10);
    expect(getNextRovingIndex("ArrowUp", 2, 12, 4)).toBe(2);
  });

  it("still wraps horizontally in a grid, so a row edge continues", () => {
    expect(getNextRovingIndex("ArrowRight", 11, 12, 4)).toBe(0);
    expect(getNextRovingIndex("ArrowLeft", 0, 12, 4)).toBe(11);
  });

  it("handles a grid whose last row is short", () => {
    // 4 columns, 10 items: index 8 and 9 are the only ones on the last row.
    expect(getNextRovingIndex("ArrowDown", 6, 10, 4)).toBe(6);
    expect(getNextRovingIndex("ArrowDown", 5, 10, 4)).toBe(9);
    expect(getNextRovingIndex("ArrowUp", 9, 10, 4)).toBe(5);
  });
});

describe("getNextTabIndex", () => {
  it("walks a horizontal strip and wraps at both ends", () => {
    expect(getNextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(getNextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(getNextTabIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(getNextTabIndex("Home", 2, 3)).toBe(0);
    expect(getNextTabIndex("End", 0, 3)).toBe(2);
  });

  it("leaves the vertical arrows to whatever surrounds the strip", () => {
    // A tab strip that swallowed Up and Down stopped its own window scrolling.
    expect(getNextTabIndex("ArrowDown", 0, 3)).toBeNull();
    expect(getNextTabIndex("ArrowUp", 1, 3)).toBeNull();
  });

  it("navigates nothing when there is one tab or none", () => {
    expect(getNextTabIndex("ArrowRight", 0, 1)).toBe(0);
    expect(getNextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
