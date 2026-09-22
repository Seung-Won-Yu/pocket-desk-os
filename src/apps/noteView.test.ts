import { describe, expect, it } from "vitest";
import {
  getNoteCursorPosition,
  getNoteFontSize,
  getNoteLineCount,
  getNoteLineEnd,
  getNoteLineStart,
  getNoteZoomStep,
  NOTE_BASE_FONT_SIZE,
  NOTE_DEFAULT_ZOOM,
  NOTE_ZOOM_LEVELS,
  parseNoteGoToLine,
} from "./noteView";

const document = "한 줄\n두 줄\n세 줄";

describe("getNoteFontSize", () => {
  it("draws 100% at the base size", () => {
    expect(getNoteFontSize(NOTE_DEFAULT_ZOOM)).toBe(NOTE_BASE_FONT_SIZE);
  });

  it("scales the base size by the level", () => {
    expect(getNoteFontSize(200)).toBe(30);
    expect(getNoteFontSize(80)).toBe(12);
  });
});

describe("getNoteZoomStep", () => {
  it("moves one level at a time", () => {
    expect(getNoteZoomStep(100, 1)).toBe(110);
    expect(getNoteZoomStep(100, -1)).toBe(90);
  });

  it("stops at the ends instead of wrapping", () => {
    expect(getNoteZoomStep(NOTE_ZOOM_LEVELS[0], -1)).toBe(NOTE_ZOOM_LEVELS[0]);
    const top = NOTE_ZOOM_LEVELS[NOTE_ZOOM_LEVELS.length - 1];
    expect(getNoteZoomStep(top, 1)).toBe(top);
  });

  it("treats a level it does not know as the default", () => {
    expect(getNoteZoomStep(137, 1)).toBe(110);
  });

  it("stays put for a wheel that reported no direction", () => {
    expect(getNoteZoomStep(125, 0)).toBe(125);
  });
});

describe("getNoteLineCount", () => {
  it("counts an empty document as one line", () => {
    expect(getNoteLineCount("")).toBe(1);
  });

  it("counts the line after a trailing newline", () => {
    expect(getNoteLineCount("한 줄\n")).toBe(2);
  });
});

describe("getNoteLineStart", () => {
  it("finds the offset each line begins at", () => {
    expect(getNoteLineStart(document, 1)).toBe(0);
    expect(getNoteLineStart(document, 2)).toBe(4);
    expect(getNoteLineStart(document, 3)).toBe(8);
  });

  it("clamps a line the document does not have", () => {
    expect(getNoteLineStart(document, 99)).toBe(8);
    expect(getNoteLineStart(document, 0)).toBe(0);
  });
});

describe("getNoteLineEnd", () => {
  it("stops before the newline", () => {
    expect(getNoteLineEnd(document, 1)).toBe(3);
    expect(getNoteLineEnd(document, 3)).toBe(11);
  });
});

describe("getNoteCursorPosition", () => {
  it("reads the line and column an offset falls on", () => {
    expect(getNoteCursorPosition(document, 0)).toEqual({ column: 1, line: 1 });
    expect(getNoteCursorPosition(document, 5)).toEqual({ column: 2, line: 2 });
  });

  it("clamps an offset past the end", () => {
    expect(getNoteCursorPosition(document, 999)).toEqual({ column: 4, line: 3 });
  });
});

describe("parseNoteGoToLine", () => {
  it("takes a line the document has", () => {
    expect(parseNoteGoToLine("2", 3)).toEqual({ line: 2 });
    expect(parseNoteGoToLine(" 3 ", 3)).toEqual({ line: 3 });
  });

  it("refuses a line past the end, naming the range", () => {
    expect(parseNoteGoToLine("4", 3)).toEqual({ error: "줄 번호는 1에서 3 사이여야 합니다." });
  });

  it("refuses zero and negatives", () => {
    expect(parseNoteGoToLine("0", 3)).toEqual({ error: "줄 번호는 1에서 3 사이여야 합니다." });
    expect(parseNoteGoToLine("-2", 3)).toEqual({ error: "줄 번호를 숫자로 입력하세요." });
  });

  it("refuses what is not a number, including an empty box", () => {
    expect(parseNoteGoToLine("", 3)).toEqual({ error: "줄 번호를 숫자로 입력하세요." });
    expect(parseNoteGoToLine("2.5", 3)).toEqual({ error: "줄 번호를 숫자로 입력하세요." });
    expect(parseNoteGoToLine("둘", 3)).toEqual({ error: "줄 번호를 숫자로 입력하세요." });
  });
});
