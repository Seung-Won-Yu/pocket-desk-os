import { describe, expect, it } from "vitest";
import { TEXT_PREVIEW_LINES, getTextPreview } from "./FilesApp";

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
