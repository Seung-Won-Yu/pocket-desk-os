import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import {
  findVfsContentMatch,
  getVfsSearchableText,
  VFS_CONTENT_SEARCH_LIMIT,
  vfsContentIncludes,
} from "./contentSearch";

function item(overrides: Partial<DesktopItem>): DesktopItem {
  return {
    createdAt: 0,
    id: "a",
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

describe("getVfsSearchableText", () => {
  it("reads a text file", () => {
    expect(getVfsSearchableText(item({ content: "안녕" }))).toBe("안녕");
  });

  it("reads where a shortcut points", () => {
    expect(
      getVfsSearchableText(item({ content: "https://example.com", kind: "shortcut" })),
    ).toBe("https://example.com");
  });

  it("refuses a drawing, whose content is a data URL", () => {
    expect(
      getVfsSearchableText(item({ content: "data:image/png;base64,AAA", kind: "canvas" })),
    ).toBeNull();
  });

  it("refuses a folder and a trashed entry", () => {
    expect(getVfsSearchableText(item({ kind: "folder" }))).toBeNull();
    expect(getVfsSearchableText(item({ content: "안녕", trashed: true }))).toBeNull();
  });
});

describe("findVfsContentMatch", () => {
  it("finds nothing for an empty query", () => {
    expect(findVfsContentMatch(item({ content: "회의 준비" }), "  ")).toBeNull();
  });

  it("returns the snippet with the match marked", () => {
    const match = findVfsContentMatch(item({ content: "오늘 회의 준비 완료" }), "회의");
    expect(match?.snippet).toBe("오늘 회의 준비 완료");
    expect(match?.snippet.slice(match.matchStart, match.matchStart + match.matchLength)).toBe(
      "회의",
    );
  });

  it("collapses whitespace so the snippet reads as one line", () => {
    const match = findVfsContentMatch(item({ content: "첫 줄\n\n  둘째 회의 줄" }), "회의");
    expect(match?.snippet).toBe("첫 줄 둘째 회의 줄");
  });

  it("marks the right characters after the collapse", () => {
    const match = findVfsContentMatch(item({ content: "  머리말\n\n\n본문 회의록" }), "회의");
    expect(match?.snippet.slice(match.matchStart, match.matchStart + match.matchLength)).toBe(
      "회의",
    );
  });

  it("puts an ellipsis where text was cut away", () => {
    const match = findVfsContentMatch(
      item({ content: `${"가".repeat(80)}회의${"나".repeat(80)}` }),
      "회의",
      5,
    );
    expect(match?.snippet.startsWith("…")).toBe(true);
    expect(match?.snippet.endsWith("…")).toBe(true);
    expect(match?.snippet.slice(match.matchStart, match.matchStart + match.matchLength)).toBe(
      "회의",
    );
  });

  it("leaves the ellipsis off at the ends of the file", () => {
    const match = findVfsContentMatch(item({ content: "회의" }), "회의", 5);
    expect(match?.snippet).toBe("회의");
  });

  it("ignores case", () => {
    expect(findVfsContentMatch(item({ content: "Weekly REPORT" }), "report")?.snippet).toBe(
      "Weekly REPORT",
    );
  });

  it("reads only the head of a very long file", () => {
    const content = `${"가".repeat(VFS_CONTENT_SEARCH_LIMIT)}끝말`;
    expect(findVfsContentMatch(item({ content }), "끝말")).toBeNull();
    expect(findVfsContentMatch(item({ content: `끝말${content}` }), "끝말")).not.toBeNull();
  });
});

describe("vfsContentIncludes", () => {
  it("answers without building a snippet", () => {
    expect(vfsContentIncludes(item({ content: "회의록" }), "회의")).toBe(true);
    expect(vfsContentIncludes(item({ content: "회의록" }), "보고")).toBe(false);
  });
});
