import { describe, expect, it } from "vitest";
import { reorderById, reorderList } from "./reorder";

describe("reorderList", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item forward and backward", () => {
    expect(reorderList(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorderList(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(reorderList(list, 1, 3)).toEqual(["a", "c", "d", "b"]);
  });

  it("returns the very same array when the move changes nothing", () => {
    // Identity, not just equality: the caller skips the state write on this.
    expect(reorderList(list, 2, 2)).toBe(list);
    expect(reorderList(list, -1, 2)).toBe(list);
    expect(reorderList(list, 0, 9)).toBe(list);
    expect(reorderList([], 0, 0)).toEqual([]);
  });

  it("leaves the source list untouched", () => {
    reorderList(list, 0, 3);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
});

describe("reorderById", () => {
  it("moves the named item onto the named slot", () => {
    expect(reorderById(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("ignores names the list does not hold", () => {
    const list = ["a", "b"];
    expect(reorderById(list, "z", "a")).toBe(list);
    expect(reorderById(list, "a", "z")).toBe(list);
  });
});
