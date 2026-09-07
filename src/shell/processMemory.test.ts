import { describe, expect, it } from "vitest";
import { estimateProcessMemoryMb } from "./processMemory";

describe("estimateProcessMemoryMb", () => {
  it("gives each app its own baseline", () => {
    expect(estimateProcessMemoryMb("browser", 0, false)).toBe(96);
    expect(estimateProcessMemoryMb("terminal", 0, false)).toBe(30);
    // An app with no entry still gets a figure.
    expect(estimateProcessMemoryMb("clock", 0, false)).toBe(24);
  });

  it("counts the document the window actually holds", () => {
    const empty = estimateProcessMemoryMb("notepad", 0, false);
    const withDocument = estimateProcessMemoryMb("notepad", 8 * 1024 * 1024, false);
    expect(withDocument - empty).toBe(8);
  });

  it("charges a maximized window for its bigger surface", () => {
    expect(
      estimateProcessMemoryMb("files", 0, true) - estimateProcessMemoryMb("files", 0, false),
    ).toBe(16);
  });

  it("never returns less than the baseline for a nonsense size", () => {
    expect(estimateProcessMemoryMb("files", -5000, false)).toBe(48);
  });
});
