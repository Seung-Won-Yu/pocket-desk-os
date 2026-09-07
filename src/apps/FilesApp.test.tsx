import { describe, expect, it } from "vitest";
import { TEXT_PREVIEW_LINES, closeFileTab, createFileTab, getTextPreview } from "./FilesApp";

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
