import { describe, expect, it } from "vitest";
import {
  TEXT_PREVIEW_LINES,
  closeFileTab,
  createFileTab,
  getFileGroupLabel,
  getTextPreview,
} from "./FilesApp";

describe("getTextPreview", () => {
  it("shows a short file whole", () => {
    expect(getTextPreview("장보기\n우유")).toBe("장보기\n우유");
  });

  it("cuts a long file at the preview length and marks the cut", () => {
    const lines = Array.from({ length: TEXT_PREVIEW_LINES + 5 }, (_, index) => `line ${index}`);
    const preview = getTextPreview(lines.join("\n"));
    expect(preview.split("\n")).toHaveLength(TEXT_PREVIEW_LINES + 1);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview).not.toContain(`line ${TEXT_PREVIEW_LINES}`);
  });
});

describe("Explorer tabs", () => {
  const tabs = ["a", "b", "c"].map((folderId) => ({
    ...createFileTab(folderId),
    id: folderId,
  }));

  it("gives each tab its own history and search", () => {
    const tab = createFileTab("folder-1");
    expect(tab.history).toEqual(["folder-1"]);
    expect(tab.index).toBe(0);
    expect(tab.query).toBe("");
    expect(createFileTab("folder-1").id).not.toBe(tab.id);
  });

  it("hands the window to the tab that slid into the closed one's place", () => {
    expect(closeFileTab(tabs, "b", "b")).toEqual({
      activeTabId: "c",
      tabs: [tabs[0], tabs[2]],
    });
  });

  it("falls back to the new last tab when the one on the end closes", () => {
    expect(closeFileTab(tabs, "c", "c")).toEqual({
      activeTabId: "b",
      tabs: [tabs[0], tabs[1]],
    });
  });

  it("leaves the active tab alone when another one closes", () => {
    expect(closeFileTab(tabs, "c", "a")).toEqual({
      activeTabId: "a",
      tabs: [tabs[0], tabs[1]],
    });
  });

  it("changes nothing for the last tab or an id that is not there", () => {
    // The window closes on the last tab, which is the shell's decision.
    expect(closeFileTab([tabs[0]], "a", "a")).toBeNull();
    expect(closeFileTab(tabs, "missing", "a")).toBeNull();
  });
});

describe("getFileGroupLabel", () => {
  /** 2026-09-09 14:00 local. */
  const now = new Date(2026, 8, 9, 14, 0, 0, 0).getTime();
  const at = (date: Date) => ({ type: "텍스트 문서", updatedAt: date.getTime() });

  it("groups nothing while 그룹화 is off", () => {
    expect(getFileGroupLabel(at(new Date(now)), "none", now)).toBeNull();
  });

  it("groups by the type column when asked", () => {
    expect(getFileGroupLabel({ type: "파일 폴더", updatedAt: now }, "type", now)).toBe(
      "파일 폴더",
    );
  });

  it("puts a date in the bucket Explorer would", () => {
    const day = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(2026, 8, 9).getTime();
    expect(getFileGroupLabel(at(new Date(now)), "modified", now)).toBe("오늘");
    // Midnight belongs to today, not to yesterday.
    expect(getFileGroupLabel(at(new Date(startOfToday)), "modified", now)).toBe("오늘");
    expect(getFileGroupLabel(at(new Date(startOfToday - 1)), "modified", now)).toBe("어제");
    expect(getFileGroupLabel(at(new Date(startOfToday - 3 * day)), "modified", now)).toBe(
      "이번 주 초",
    );
    expect(getFileGroupLabel(at(new Date(startOfToday - 10 * day)), "modified", now)).toBe(
      "이번 달 초",
    );
    expect(getFileGroupLabel(at(new Date(startOfToday - 400 * day)), "modified", now)).toBe(
      "오래 전",
    );
  });
});
