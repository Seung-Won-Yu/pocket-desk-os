// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  getFileGridTemplate,
  loadHiddenFileColumns,
  persistHiddenFileColumns,
  toggleFileColumn,
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

describe("toggleFileColumn", () => {
  it("hides a shown column and shows a hidden one, in column order", () => {
    expect(toggleFileColumn([], "size")).toEqual(["size"]);
    expect(toggleFileColumn(["size"], "modified")).toEqual(["modified", "size"]);
    expect(toggleFileColumn(["modified", "size"], "size")).toEqual(["modified"]);
  });
});

describe("getFileGridTemplate", () => {
  const widths = { modified: 116, name: 240, size: 72, type: 106 };

  it("lays out every column when none is hidden", () => {
    expect(getFileGridTemplate(widths, [])).toBe(
      "26px minmax(96px, 1fr) minmax(0, 116px) minmax(0, 106px) minmax(0, 72px)",
    );
  });

  it("drops a hidden column's track instead of leaving it empty", () => {
    expect(getFileGridTemplate(widths, ["type"])).toBe(
      "26px minmax(96px, 1fr) minmax(0, 116px) minmax(0, 72px)",
    );
  });

  it("keeps 이름 when everything else is hidden", () => {
    expect(getFileGridTemplate(widths, ["modified", "type", "size"])).toBe(
      "26px minmax(96px, 1fr)",
    );
  });
});

describe("hidden columns storage", () => {
  it("round-trips and ignores what is not a column", () => {
    persistHiddenFileColumns(["size"]);
    expect(loadHiddenFileColumns()).toEqual(["size"]);
    localStorage.setItem(
      "pocket-desk-file-hidden-columns-v1",
      JSON.stringify(["name", "type", 3]),
    );
    expect(loadHiddenFileColumns()).toEqual(["type"]);
    localStorage.setItem("pocket-desk-file-hidden-columns-v1", "{not json");
    expect(loadHiddenFileColumns()).toEqual([]);
  });
});
