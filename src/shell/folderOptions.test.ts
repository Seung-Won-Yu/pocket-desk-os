// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  loadShowFileExtensions,
  loadShowHiddenItems,
  persistShowFileExtensions,
  persistShowHiddenItems,
} from "./folderOptions";

afterEach(() => {
  localStorage.clear();
});

describe("폴더 옵션", () => {
  it("starts with hidden items hidden, and — unlike Windows — extensions shown", () => {
    // The extension is the association here, not decoration.
    expect(loadShowFileExtensions()).toBe(true);
    expect(loadShowHiddenItems()).toBe(false);
  });

  it("round-trips both settings", () => {
    persistShowFileExtensions(true);
    persistShowHiddenItems(true);
    expect(loadShowFileExtensions()).toBe(true);
    expect(loadShowHiddenItems()).toBe(true);

    persistShowFileExtensions(false);
    persistShowHiddenItems(false);
    expect(loadShowFileExtensions()).toBe(false);
    expect(loadShowHiddenItems()).toBe(false);
  });

  it("only an explicit off turns extensions off, and only an explicit on reveals hidden items", () => {
    localStorage.setItem("pocket-desk-file-extensions-v1", "yes");
    localStorage.setItem("pocket-desk-hidden-items-v1", "1");
    expect(loadShowFileExtensions()).toBe(true);
    expect(loadShowHiddenItems()).toBe(false);
  });
});
