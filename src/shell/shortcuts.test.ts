import { describe, expect, it } from "vitest";
import { SHELL_SHORTCUTS, isShellReservedChord } from "./shortcuts";

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

describe("isShellReservedChord", () => {
  const chord = (overrides: Partial<Parameters<typeof isShellReservedChord>[0]>) =>
    isShellReservedChord({
      altKey: false,
      ctrlKey: false,
      key: "a",
      metaKey: false,
      shiftKey: false,
      ...overrides,
    });

  it("claims the Win chords the shell handles", () => {
    for (const key of ["d", "e", "i", "l", "m"]) {
      expect(chord({ key, metaKey: true })).toBe(true);
    }
    expect(chord({ key: "Tab", metaKey: true })).toBe(true);
    expect(chord({ key: "ArrowLeft", metaKey: true })).toBe(true);
    expect(chord({ key: "S", metaKey: true, shiftKey: true })).toBe(true);
    expect(chord({ key: "PrintScreen" })).toBe(true);
    expect(chord({ ctrlKey: true, key: "Escape", shiftKey: true })).toBe(true);
    expect(chord({ altKey: true, ctrlKey: true, key: "r" })).toBe(true);
  });

  it("leaves an app's own Ctrl chords alone", () => {
    for (const key of ["s", "o", "n", "f", "z", "y", "a", "t", "w", "l"]) {
      expect(chord({ ctrlKey: true, key })).toBe(false);
    }
    // Cmd+S saves in the app; only Cmd+Shift+S is the shell's.
    expect(chord({ key: "s", metaKey: true })).toBe(false);
    expect(chord({ key: "q", metaKey: true })).toBe(false);
  });

  it("stands aside when another modifier joins the Win key", () => {
    // Ctrl+Win+D and Alt+Win+D are nobody's shell chord, so an app may take
    // them — and on a Mac, Cmd is held for multi-select, not for the shell.
    expect(chord({ ctrlKey: true, key: "d", metaKey: true })).toBe(false);
    expect(chord({ altKey: true, key: "d", metaKey: true })).toBe(false);
  });
});
