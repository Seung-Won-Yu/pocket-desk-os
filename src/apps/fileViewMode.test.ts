import { describe, expect, it } from "vitest";
import { FILE_VIEW_ORDER, getNextFileViewMode } from "./fileViewMode";

describe("getNextFileViewMode", () => {
  it("enlarges on a push away and shrinks on a pull back", () => {
    expect(getNextFileViewMode("details", -1)).toBe("list");
    expect(getNextFileViewMode("list", -1)).toBe("icons");
    expect(getNextFileViewMode("icons", 1)).toBe("list");
    expect(getNextFileViewMode("list", 1)).toBe("details");
  });

  it("holds at the ends rather than wrapping round", () => {
    expect(getNextFileViewMode("icons", -1)).toBe("icons");
    expect(getNextFileViewMode("details", 1)).toBe("details");
  });

  it("does nothing for a wheel that did not move", () => {
    expect(getNextFileViewMode("list", 0)).toBe("list");
  });

  it("reads any size of notch, not just one", () => {
    expect(getNextFileViewMode("details", -240)).toBe("list");
    expect(getNextFileViewMode("icons", 120)).toBe("list");
  });

  it("lists the sizes from the largest to the densest", () => {
    expect(FILE_VIEW_ORDER).toEqual(["icons", "list", "details"]);
  });
});
