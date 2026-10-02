import { describe, expect, it } from "vitest";
import { getBrowserShortcut, getShortcutTabIndex } from "./browserShortcuts";

const key = (value: string, extra: Partial<Parameters<typeof getBrowserShortcut>[0]> = {}) => ({
  altKey: false,
  ctrlKey: false,
  key: value,
  metaKey: false,
  shiftKey: false,
  ...extra,
});

describe("getBrowserShortcut", () => {
  it("knows Edge's tab chords", () => {
    expect(getBrowserShortcut(key("t", { ctrlKey: true }))).toEqual({ kind: "newTab" });
    expect(getBrowserShortcut(key("w", { ctrlKey: true }))).toEqual({ kind: "closeTab" });
    expect(getBrowserShortcut(key("F4", { ctrlKey: true }))).toEqual({ kind: "closeTab" });
    expect(getBrowserShortcut(key("Tab", { ctrlKey: true }))).toEqual({
      delta: 1,
      kind: "cycleTab",
    });
    expect(getBrowserShortcut(key("Tab", { ctrlKey: true, shiftKey: true }))).toEqual({
      delta: -1,
      kind: "cycleTab",
    });
    expect(getBrowserShortcut(key("PageUp", { ctrlKey: true }))).toEqual({
      delta: -1,
      kind: "cycleTab",
    });
  });

  it("reads Ctrl+number off the physical key, with 9 meaning the last tab", () => {
    expect(getBrowserShortcut(key("2", { code: "Digit2", ctrlKey: true }))).toEqual({
      index: 1,
      kind: "tabAt",
    });
    expect(getBrowserShortcut(key("9", { code: "Digit9", ctrlKey: true }))).toEqual({
      index: "last",
      kind: "tabAt",
    });
  });

  it("gives the address bar three ways in", () => {
    expect(getBrowserShortcut(key("l", { ctrlKey: true }))).toEqual({ kind: "focusAddress" });
    expect(getBrowserShortcut(key("d", { altKey: true }))).toEqual({ kind: "focusAddress" });
    expect(getBrowserShortcut(key("F6"))).toEqual({ kind: "focusAddress" });
  });

  it("reloads on F5 and Ctrl+R, and walks history on Alt+arrows", () => {
    expect(getBrowserShortcut(key("F5"))).toEqual({ kind: "reload" });
    expect(getBrowserShortcut(key("r", { ctrlKey: true }))).toEqual({ kind: "reload" });
    expect(getBrowserShortcut(key("ArrowLeft", { altKey: true }))).toEqual({ kind: "back" });
    expect(getBrowserShortcut(key("ArrowRight", { altKey: true }))).toEqual({
      kind: "forward",
    });
  });

  it("bookmarks on Ctrl+D and opens 기록 on Ctrl+H", () => {
    expect(getBrowserShortcut(key("D", { ctrlKey: true }))).toEqual({ kind: "bookmark" });
    expect(getBrowserShortcut(key("h", { ctrlKey: true }))).toEqual({ kind: "history" });
  });

  it("leaves plain typing and other chords alone", () => {
    expect(getBrowserShortcut(key("t"))).toBeNull();
    expect(getBrowserShortcut(key("ArrowLeft"))).toBeNull();
    expect(getBrowserShortcut(key("t", { altKey: true, ctrlKey: true }))).toBeNull();
    expect(getBrowserShortcut(key("t", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});

describe("getShortcutTabIndex", () => {
  it("wraps a cycle at both ends", () => {
    expect(getShortcutTabIndex({ delta: 1, kind: "cycleTab" }, 2, 3)).toBe(0);
    expect(getShortcutTabIndex({ delta: -1, kind: "cycleTab" }, 0, 3)).toBe(2);
  });

  it("goes to the numbered tab, the last for 9, and nowhere past the end", () => {
    expect(getShortcutTabIndex({ index: 1, kind: "tabAt" }, 0, 3)).toBe(1);
    expect(getShortcutTabIndex({ index: "last", kind: "tabAt" }, 0, 3)).toBe(2);
    expect(getShortcutTabIndex({ index: 5, kind: "tabAt" }, 0, 3)).toBe(-1);
  });
});
