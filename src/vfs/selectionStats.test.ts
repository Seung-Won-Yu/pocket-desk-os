import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { describeVfsSelectionTitle, summarizeVfsSelection } from "./selectionStats";

function make(
  id: string,
  kind: DesktopItem["kind"],
  parentId: string,
  overrides: Partial<DesktopItem> = {},
): DesktopItem {
  return {
    createdAt: 0,
    id,
    kind,
    name: kind === "folder" ? id : `${id}.txt`,
    parentId,
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

const items = [
  make("folder", "folder", "desktop"),
  make("inside", "note", "folder", { content: "12345" }),
  make("loose", "note", "desktop", { content: "abc" }),
  make("hiddenNote", "note", "desktop", { content: "xy", hidden: true }),
];

describe("summarizeVfsSelection", () => {
  it("reports nothing for an empty selection", () => {
    expect(summarizeVfsSelection(items, [])).toEqual({
      bytes: 0,
      files: 0,
      folders: 0,
      hidden: "none",
      items: 0,
      typeLabel: null,
    });
  });

  it("counts a folder's contents into the total, not as zero bytes", () => {
    const summary = summarizeVfsSelection(items, ["folder"]);
    expect(summary.bytes).toBe(5);
    expect(summary.files).toBe(1);
    expect(summary.folders).toBe(1);
  });

  it("adds a file and a folder together", () => {
    const summary = summarizeVfsSelection(items, ["folder", "loose"]);
    expect(summary.bytes).toBe(8);
    expect(summary.items).toBe(2);
  });

  it("counts a file inside a selected folder once, not twice", () => {
    const summary = summarizeVfsSelection(items, ["folder", "inside"]);
    expect(summary.bytes).toBe(5);
    expect(summary.items).toBe(1);
  });

  it("names the one type they share and says nothing when they differ", () => {
    expect(summarizeVfsSelection(items, ["loose", "hiddenNote"]).typeLabel).toBe("텍스트 문서");
    expect(summarizeVfsSelection(items, ["folder", "loose"]).typeLabel).toBeNull();
  });

  it("reads the 숨김 attribute across the whole selection", () => {
    expect(summarizeVfsSelection(items, ["loose"]).hidden).toBe("none");
    expect(summarizeVfsSelection(items, ["hiddenNote"]).hidden).toBe("all");
    expect(summarizeVfsSelection(items, ["loose", "hiddenNote"]).hidden).toBe("some");
  });

  it("leaves out an id that names nothing and a trashed row", () => {
    const withTrash = [...items, make("gone", "note", "desktop", { trashed: true })];
    expect(summarizeVfsSelection(withTrash, ["nope", "gone"]).items).toBe(0);
  });
});

describe("describeVfsSelectionTitle", () => {
  it("counts the rows, not everything underneath them", () => {
    expect(describeVfsSelectionTitle(summarizeVfsSelection(items, ["folder", "loose"]))).toBe(
      "2개 항목",
    );
  });
});
