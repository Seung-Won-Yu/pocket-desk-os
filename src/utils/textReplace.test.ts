import { describe, expect, it } from "vitest";
import { getSelectedMatchIndex, replaceAllTextMatches, replaceTextMatch } from "./textReplace";

describe("replaceTextMatch", () => {
  it("swaps one occurrence and puts the caret after it", () => {
    expect(replaceTextMatch("회의 준비", { end: 2, start: 0 }, "발표")).toEqual({
      caret: 2,
      text: "발표 준비",
    });
  });

  it("handles a replacement of a different length", () => {
    expect(replaceTextMatch("abc", { end: 2, start: 1 }, "XYZ")).toEqual({
      caret: 4,
      text: "aXYZc",
    });
  });

  it("deletes the match when the replacement is empty", () => {
    expect(replaceTextMatch("abc", { end: 2, start: 1 }, "").text).toBe("ac");
  });

  it("clamps a match that runs past the end", () => {
    expect(replaceTextMatch("ab", { end: 99, start: 1 }, "Z").text).toBe("aZ");
  });
});

describe("replaceAllTextMatches", () => {
  const matchesOf = (text: string, needle: string) => {
    const found = [];
    for (
      let at = text.indexOf(needle);
      at !== -1;
      at = text.indexOf(needle, at + needle.length)
    ) {
      found.push({ end: at + needle.length, start: at });
    }
    return found;
  };

  it("replaces every occurrence and counts them", () => {
    const text = "가 나 가 다 가";
    const result = replaceAllTextMatches(text, matchesOf(text, "가"), "라");
    expect(result).toEqual({ count: 3, text: "라 나 라 다 라" });
  });

  it("keeps later offsets valid when the replacement is longer", () => {
    const text = "a-a-a";
    expect(replaceAllTextMatches(text, matchesOf(text, "a"), "LONG").text).toBe(
      "LONG-LONG-LONG",
    );
  });

  it("keeps later offsets valid when the replacement is shorter", () => {
    const text = "aaa-aaa-aaa";
    expect(replaceAllTextMatches(text, matchesOf(text, "aaa"), "b").text).toBe("b-b-b");
  });

  it("changes nothing when there is nothing to change", () => {
    expect(replaceAllTextMatches("abc", [], "z")).toEqual({ count: 0, text: "abc" });
  });

  it("skips a match that does not fit the text", () => {
    expect(replaceAllTextMatches("ab", [{ end: 99, start: 50 }], "z")).toEqual({
      count: 0,
      text: "ab",
    });
  });
});

describe("getSelectedMatchIndex", () => {
  const matches = [
    { end: 2, start: 0 },
    { end: 8, start: 6 },
  ];

  it("finds the match the selection sits exactly on", () => {
    expect(getSelectedMatchIndex(matches, 6, 8)).toBe(1);
  });

  it("reports nothing for a selection that is not a match", () => {
    expect(getSelectedMatchIndex(matches, 1, 4)).toBeNull();
    expect(getSelectedMatchIndex(matches, 0, 0)).toBeNull();
  });
});
