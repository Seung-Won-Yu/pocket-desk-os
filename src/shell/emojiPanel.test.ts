import { describe, expect, it } from "vitest";
import {
  EMOJI_GROUPS,
  EMOJI_RECENT_LIMIT,
  getEmojiKeywords,
  pushRecentEmoji,
  searchEmoji,
} from "./emojiPanel";

describe("EMOJI_GROUPS", () => {
  it("lists every emoji once across the groups", () => {
    const all = EMOJI_GROUPS.flatMap((group) => group.emoji.map((entry) => entry.char));
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every emoji something to search on", () => {
    const bare = EMOJI_GROUPS.flatMap((group) =>
      group.emoji.filter((entry) => entry.keywords.length === 0),
    );
    expect(bare).toEqual([]);
  });
});

describe("searchEmoji", () => {
  it("returns everything for an empty query", () => {
    const all = EMOJI_GROUPS.flatMap((group) => group.emoji);
    expect(searchEmoji("   ")).toHaveLength(all.length);
  });

  it("finds an emoji by a keyword", () => {
    expect(searchEmoji("휴지통")).toEqual(["🗑️"]);
  });

  it("finds a group by its own name", () => {
    expect(searchEmoji("음식")).toContain("🍕");
  });

  it("matches part of a keyword", () => {
    expect(searchEmoji("커피")).toEqual(["☕"]);
  });

  it("finds nothing for a word no emoji carries", () => {
    expect(searchEmoji("존재하지 않는 낱말")).toEqual([]);
  });
});

describe("getEmojiKeywords", () => {
  it("names what an emoji is for", () => {
    expect(getEmojiKeywords("👍")).toContain("좋아요");
  });

  it("has nothing to say about an emoji it does not carry", () => {
    expect(getEmojiKeywords("🦕")).toEqual([]);
  });
});

describe("pushRecentEmoji", () => {
  it("puts the newest first", () => {
    expect(pushRecentEmoji(["😀"], "👍")).toEqual(["👍", "😀"]);
  });

  it("moves a repeat to the front instead of listing it twice", () => {
    expect(pushRecentEmoji(["😀", "👍", "🔥"], "👍")).toEqual(["👍", "😀", "🔥"]);
  });

  it("keeps only the last sixteen", () => {
    const many = Array.from({ length: EMOJI_RECENT_LIMIT + 4 }, (_, index) => `e${index}`);
    expect(pushRecentEmoji(many, "새것")).toHaveLength(EMOJI_RECENT_LIMIT);
  });
});
