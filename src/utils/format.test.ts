import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import {
  clamp,
  formatStorageSize,
  formatVfsEntrySize,
  formatVfsPropertyDate,
  normalizeSearchText,
} from "./format";

function makeItem(overrides: Partial<DesktopItem> = {}): DesktopItem {
  return {
    createdAt: 0,
    id: "item-1",
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

describe("clamp", () => {
  it("returns the value untouched when it sits inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("clamps to the bounds", () => {
    expect(clamp(-4, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("supports negative ranges and fractional values", () => {
    expect(clamp(-50, -20, -10)).toBe(-20);
    expect(clamp(-5, -20, -10)).toBe(-10);
    expect(clamp(0.25, 0, 1)).toBe(0.25);
  });

  it("lets min win when the bounds are inverted", () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });

  it("propagates NaN rather than picking a bound", () => {
    expect(clamp(Number.NaN, 0, 10)).toBeNaN();
  });
});

describe("formatStorageSize", () => {
  it("collapses zero, negative and non-finite input to 0 B", () => {
    expect(formatStorageSize(0)).toBe("0 B");
    expect(formatStorageSize(-1)).toBe("0 B");
    expect(formatStorageSize(-1024)).toBe("0 B");
    expect(formatStorageSize(Number.NaN)).toBe("0 B");
    expect(formatStorageSize(Number.POSITIVE_INFINITY)).toBe("0 B");
    expect(formatStorageSize(Number.NEGATIVE_INFINITY)).toBe("0 B");
  });

  it("renders bytes without a decimal place", () => {
    expect(formatStorageSize(1)).toBe("1 B");
    expect(formatStorageSize(512)).toBe("512 B");
    expect(formatStorageSize(1023)).toBe("1023 B");
  });

  it("rounds fractional byte counts to whole bytes", () => {
    expect(formatStorageSize(5.4)).toBe("5 B");
    expect(formatStorageSize(9.5)).toBe("10 B");
  });

  it("switches to the next unit at the 1024 boundary", () => {
    expect(formatStorageSize(1024)).toBe("1.0 KB");
    expect(formatStorageSize(1536)).toBe("1.5 KB");
    expect(formatStorageSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatStorageSize(1024 ** 3)).toBe("1.0 GB");
    expect(formatStorageSize(1024 ** 4)).toBe("1.0 TB");
  });

  it("drops the decimal place once the value reaches 10", () => {
    expect(formatStorageSize(10 * 1024)).toBe("10 KB");
    expect(formatStorageSize(999 * 1024)).toBe("999 KB");
  });

  it("rounds up inside the current unit instead of promoting it", () => {
    // 1048575 B is one byte short of 1 MB, so the unit stays KB and the value rounds to 1024.
    expect(formatStorageSize(1024 * 1024 - 1)).toBe("1024 KB");
  });

  it("caps the unit at TB for absurdly large values", () => {
    expect(formatStorageSize(1024 ** 5)).toBe("1024 TB");
    expect(formatStorageSize(1024 ** 6)).toBe("1048576 TB");
  });
});

describe("formatVfsEntrySize", () => {
  it("reports folders as empty regardless of stored content", () => {
    expect(formatVfsEntrySize(makeItem({ kind: "folder", name: "문서" }))).toBe("0 B");
    expect(
      formatVfsEntrySize(makeItem({ content: "무시되는 내용", kind: "folder", name: "문서" })),
    ).toBe("0 B");
  });

  it("treats missing or empty content as 0 B", () => {
    expect(formatVfsEntrySize(makeItem())).toBe("0 B");
    expect(formatVfsEntrySize(makeItem({ content: "" }))).toBe("0 B");
  });

  it("measures content in UTF-8 bytes, not characters", () => {
    expect(formatVfsEntrySize(makeItem({ content: "abc" }))).toBe("3 B");
    // Each of the two Hangul syllables encodes to three bytes.
    expect(formatVfsEntrySize(makeItem({ content: "한글" }))).toBe("6 B");
    expect(formatVfsEntrySize(makeItem({ content: "\u{1F600}" }))).toBe("4 B");
  });

  it("formats larger content through the storage size scale", () => {
    expect(formatVfsEntrySize(makeItem({ content: "a".repeat(2048) }))).toBe("2.0 KB");
    expect(formatVfsEntrySize(makeItem({ content: "a".repeat(20 * 1024) }))).toBe("20 KB");
  });
});

describe("formatVfsPropertyDate", () => {
  it("renders a Korean medium date with a short 12-hour time", () => {
    // The meridiem word comes from the runtime's ICU data: browsers and a
    // full-icu Node render 오전/오후, while a small-icu build falls back to
    // AM/PM. Accept either so the assertion tests the format, not the build.
    expect(formatVfsPropertyDate(Date.UTC(2024, 0, 2, 3, 4, 5))).toMatch(
      /^\d{4}\. \d{1,2}\. \d{1,2}\. (오전|오후|AM|PM) \d{1,2}:\d{2}$/,
    );
  });

  it("keeps the calendar year of the timestamp", () => {
    const timestamp = Date.UTC(2031, 5, 15, 12, 0, 0);
    const year = String(new Date(timestamp).getFullYear());
    expect(formatVfsPropertyDate(timestamp)).toContain(year);
  });

  it("omits seconds so the time part only carries hours and minutes", () => {
    const withoutSeconds = formatVfsPropertyDate(Date.UTC(2024, 0, 2, 3, 4, 0));
    const withSeconds = formatVfsPropertyDate(Date.UTC(2024, 0, 2, 3, 4, 45));
    expect(withSeconds).toBe(withoutSeconds);
  });

  it("distinguishes timestamps a day apart", () => {
    const day = 24 * 60 * 60 * 1000;
    const base = Date.UTC(2024, 0, 2, 12, 0, 0);
    expect(formatVfsPropertyDate(base)).not.toBe(formatVfsPropertyDate(base + day));
  });

  it("reports unusable timestamps as an invalid date", () => {
    expect(formatVfsPropertyDate(Number.NaN)).toBe("Invalid Date");
    expect(formatVfsPropertyDate(Number.POSITIVE_INFINITY)).toBe("Invalid Date");
  });
});

describe("normalizeSearchText", () => {
  it("trims, lowercases and collapses internal whitespace", () => {
    expect(normalizeSearchText("  Hello   WORLD  ")).toBe("hello world");
  });

  it("collapses tabs and newlines into single spaces", () => {
    expect(normalizeSearchText("a\t\n  b")).toBe("a b");
  });

  it("leaves already normalized text alone", () => {
    expect(normalizeSearchText("readme.txt")).toBe("readme.txt");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   \t\n ")).toBe("");
  });

  it("keeps Hangul intact while still collapsing spacing", () => {
    expect(normalizeSearchText("  새   텍스트 문서.TXT ")).toBe("새 텍스트 문서.txt");
  });
});
