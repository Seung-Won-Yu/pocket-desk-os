// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  clampFileColumnWidth,
  DEFAULT_FILE_COLUMN_WIDTHS,
  FILE_COLUMN_WIDTH_KEY,
  getFileColumnTemplate,
  loadFileColumnWidths,
  MAX_FILE_COLUMN_WIDTH,
  MIN_FILE_COLUMN_WIDTH,
  persistFileColumnWidths,
  resizeFileColumn,
} from "./fileColumns";

afterEach(() => {
  localStorage.clear();
});

describe("clampFileColumnWidth", () => {
  it("keeps a width inside the floor and the ceiling", () => {
    expect(clampFileColumnWidth(10)).toBe(MIN_FILE_COLUMN_WIDTH);
    expect(clampFileColumnWidth(9999)).toBe(MAX_FILE_COLUMN_WIDTH);
    expect(clampFileColumnWidth(180.4)).toBe(180);
  });

  it("treats a non-number as the floor rather than as zero", () => {
    expect(clampFileColumnWidth(Number.NaN)).toBe(MIN_FILE_COLUMN_WIDTH);
  });
});

describe("resizeFileColumn", () => {
  it("changes one column and leaves the rest", () => {
    const next = resizeFileColumn(DEFAULT_FILE_COLUMN_WIDTHS, "name", 320);
    expect(next.name).toBe(320);
    expect(next.type).toBe(DEFAULT_FILE_COLUMN_WIDTHS.type);
  });

  it("returns the same object when nothing moved", () => {
    const next = resizeFileColumn(DEFAULT_FILE_COLUMN_WIDTHS, "name", 240);
    expect(next).toBe(DEFAULT_FILE_COLUMN_WIDTHS);
  });

  it("clamps rather than letting a column vanish", () => {
    expect(resizeFileColumn(DEFAULT_FILE_COLUMN_WIDTHS, "size", 0).size).toBe(
      MIN_FILE_COLUMN_WIDTH,
    );
  });
});

describe("getFileColumnTemplate", () => {
  it("writes one track per column, in the order the heading shows them", () => {
    expect(getFileColumnTemplate(DEFAULT_FILE_COLUMN_WIDTHS)).toBe("240px 116px 106px 72px");
  });
});

describe("loadFileColumnWidths", () => {
  it("starts at the defaults", () => {
    expect(loadFileColumnWidths()).toEqual(DEFAULT_FILE_COLUMN_WIDTHS);
  });

  it("reads back what was stored", () => {
    persistFileColumnWidths({ ...DEFAULT_FILE_COLUMN_WIDTHS, name: 300 });
    expect(loadFileColumnWidths().name).toBe(300);
  });

  it("keeps the default for a key that is missing", () => {
    localStorage.setItem(FILE_COLUMN_WIDTH_KEY, JSON.stringify({ name: 300 }));
    expect(loadFileColumnWidths()).toEqual({ ...DEFAULT_FILE_COLUMN_WIDTHS, name: 300 });
  });

  it("ignores a stored value that is not a number", () => {
    localStorage.setItem(FILE_COLUMN_WIDTH_KEY, JSON.stringify({ name: "wide", type: null }));
    expect(loadFileColumnWidths()).toEqual(DEFAULT_FILE_COLUMN_WIDTHS);
  });

  it("clamps a stored width that is out of range", () => {
    localStorage.setItem(FILE_COLUMN_WIDTH_KEY, JSON.stringify({ name: 5000, size: 1 }));
    const widths = loadFileColumnWidths();
    expect(widths.name).toBe(MAX_FILE_COLUMN_WIDTH);
    expect(widths.size).toBe(MIN_FILE_COLUMN_WIDTH);
  });

  it("survives a stored value that is not JSON", () => {
    localStorage.setItem(FILE_COLUMN_WIDTH_KEY, "{{{");
    expect(loadFileColumnWidths()).toEqual(DEFAULT_FILE_COLUMN_WIDTHS);
  });
});
