import { describe, expect, it } from "vitest";
import { SHELL_SHORTCUTS } from "./shortcuts";

describe("SHELL_SHORTCUTS", () => {
  it("names every group and every action", () => {
    for (const group of SHELL_SHORTCUTS) {
      expect(group.title.trim()).not.toBe("");
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(item.action.trim()).not.toBe("");
        expect(item.keys.trim()).not.toBe("");
      }
    }
  });

  it("lists no key combination twice", () => {
    const keys = SHELL_SHORTCUTS.flatMap((group) => group.items.map((item) => item.keys));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
