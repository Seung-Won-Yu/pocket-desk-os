// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_DESKTOP_NAME_LENGTH,
  getDesktopName,
  loadDesktopNames,
  normalizeDesktopName,
  normalizeDesktopNames,
  persistDesktopNames,
  removeDesktopName,
  renameDesktop,
} from "./desktopNames";

afterEach(() => {
  localStorage.clear();
});

describe("getDesktopName", () => {
  it("uses the name when there is one and the number when there is not", () => {
    expect(getDesktopName(["작업", ""], 0)).toBe("작업");
    expect(getDesktopName(["작업", ""], 1)).toBe("데스크톱 2");
    expect(getDesktopName([], 2)).toBe("데스크톱 3");
  });
});

describe("renameDesktop", () => {
  it("names a desktop, padding the list to reach it", () => {
    expect(renameDesktop([], 2, "게임")).toEqual(["", "", "게임"]);
  });

  it("an empty name gives the number back, and trailing blanks are dropped", () => {
    expect(renameDesktop(["작업", "게임"], 1, "   ")).toEqual(["작업"]);
    expect(renameDesktop(["작업"], 0, "")).toEqual([]);
  });

  it("collapses whitespace and caps the length", () => {
    expect(normalizeDesktopName("  회사   작업  ")).toBe("회사 작업");
    expect(renameDesktop([], 0, "가".repeat(50))[0]).toHaveLength(MAX_DESKTOP_NAME_LENGTH);
  });

  it("returns the same list when nothing would change", () => {
    const names = ["작업"];
    expect(renameDesktop(names, 0, "작업")).toBe(names);
    // The default is not a name: typing it changes nothing.
    expect(renameDesktop(names, 1, "데스크톱 2")).toBe(names);
  });
});

describe("removeDesktopName", () => {
  it("moves the names up with their desktops", () => {
    // Closing 데스크톱 1 used to hand its name to whatever slid into its place.
    expect(removeDesktopName(["첫째", "둘째", "셋째"], 0)).toEqual(["둘째", "셋째"]);
    expect(removeDesktopName(["첫째", "둘째", "셋째"], 1)).toEqual(["첫째", "셋째"]);
    expect(removeDesktopName(["첫째", "둘째"], 1)).toEqual(["첫째"]);
  });

  it("leaves the list alone for an index it does not hold", () => {
    const names = ["첫째"];
    expect(removeDesktopName(names, 4)).toBe(names);
  });
});

describe("desktop name persistence", () => {
  it("round-trips through storage", () => {
    expect(persistDesktopNames(["작업", "", "게임"])).toBe(true);
    expect(loadDesktopNames()).toEqual(["작업", "", "게임"]);
  });

  it("reads nothing out of a broken or foreign value", () => {
    localStorage.setItem("pocket-desk-desktop-names-v1", "{broken");
    expect(loadDesktopNames()).toEqual([]);
    expect(normalizeDesktopNames([1, "작업", null])).toEqual(["", "작업", ""]);
    expect(normalizeDesktopNames("작업")).toEqual([]);
  });
});
