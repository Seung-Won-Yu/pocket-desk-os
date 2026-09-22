import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import {
  describeEmptyRecycleBinCommand,
  describeEmptyRecycleBinPrompt,
  getRecycleBinDropIds,
  summarizeRecycleBin,
} from "./recycleBin";

const createItem = (id: string, extra: Partial<DesktopItem> = {}): DesktopItem =>
  ({
    createdAt: 0,
    icon: undefined,
    id,
    kind: "note",
    name: id,
    content: "",
    parentId: null,
    showOnDesktop: true,
    updatedAt: 0,
    ...extra,
  }) as DesktopItem;

describe("summarizeRecycleBin", () => {
  it("counts nothing in an empty bin", () => {
    expect(summarizeRecycleBin([createItem("a")])).toMatchObject({ bytes: 0, count: 0 });
  });

  it("counts a thrown-away folder once, not its children too", () => {
    const items = [
      createItem("folder", { kind: "folder", trashed: true, trashedRootId: "folder" }),
      createItem("child", {
        content: "1234",
        parentId: "folder",
        trashed: true,
        trashedRootId: "folder",
      }),
      createItem("loose", { content: "12", trashed: true }),
    ];
    const summary = summarizeRecycleBin(items);
    expect(summary.count).toBe(2);
    expect(summary.bytes).toBe(6);
  });

  it("leaves what is still on the desktop out of the total", () => {
    const items = [
      createItem("kept", { content: "12345678" }),
      createItem("gone", { content: "12", trashed: true }),
    ];
    expect(summarizeRecycleBin(items)).toMatchObject({ bytes: 2, count: 1 });
  });
});

describe("describeEmptyRecycleBinCommand", () => {
  it("says how many the bin holds", () => {
    expect(describeEmptyRecycleBinCommand({ bytes: 4, count: 3, sizeLabel: "4 B" })).toBe(
      "휴지통 비우기 (3개 항목)",
    );
  });

  it("drops the count when there is nothing to empty", () => {
    expect(describeEmptyRecycleBinCommand({ bytes: 0, count: 0, sizeLabel: "0 B" })).toBe(
      "휴지통 비우기",
    );
  });
});

describe("describeEmptyRecycleBinPrompt", () => {
  it("names the count and the size it is about to destroy", () => {
    expect(describeEmptyRecycleBinPrompt({ bytes: 2048, count: 2, sizeLabel: "2 KB" })).toBe(
      "2개 항목(2 KB)을 영구적으로 삭제하시겠습니까?",
    );
  });

  it("leaves the size out when the items weigh nothing", () => {
    expect(describeEmptyRecycleBinPrompt({ bytes: 0, count: 1, sizeLabel: "0 B" })).toBe(
      "1개 항목을 영구적으로 삭제하시겠습니까?",
    );
  });

  it("has nothing to ask about an empty bin", () => {
    expect(describeEmptyRecycleBinPrompt({ bytes: 0, count: 0, sizeLabel: "0 B" })).toBe(
      "휴지통이 비어 있습니다.",
    );
  });
});

describe("getRecycleBinDropIds", () => {
  const items = [createItem("note"), createItem("already", { trashed: true })];

  it("takes what is still on the desktop", () => {
    expect(getRecycleBinDropIds(items, ["note"])).toEqual(["note"]);
  });

  it("ignores what is already in the bin", () => {
    expect(getRecycleBinDropIds(items, ["already", "note"])).toEqual(["note"]);
  });

  it("ignores an id the desktop does not have", () => {
    expect(getRecycleBinDropIds(items, ["ghost"])).toEqual([]);
  });
});
