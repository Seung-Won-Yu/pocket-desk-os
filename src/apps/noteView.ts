/**
 * 메모장 확대/축소와 줄 이동. The status bar has always printed a flat
 * "100%" while 글꼴 크게 moved the text between 12 and 24px, so the number
 * meant nothing. Zoom is a level here — the percentage the bar shows is the
 * one the text is drawn at — and the caret arithmetic for Ctrl+G lives
 * beside it, where it can be pinned without a textarea.
 */
export const NOTE_ZOOM_LEVELS = [80, 90, 100, 110, 125, 150, 175, 200];
export const NOTE_DEFAULT_ZOOM = 100;
/** The size 100% draws at; every other level is this scaled. */
export const NOTE_BASE_FONT_SIZE = 15;

export function getNoteFontSize(zoom: number) {
  return Math.round((NOTE_BASE_FONT_SIZE * zoom) / 100);
}

/**
 * The next level up (delta > 0) or down, stopping at the ends rather than
 * wrapping — a zoom that jumps from 200% back to 80% loses the reader's place.
 */
export function getNoteZoomStep(zoom: number, delta: number) {
  const index = NOTE_ZOOM_LEVELS.indexOf(zoom);
  const from = index >= 0 ? index : NOTE_ZOOM_LEVELS.indexOf(NOTE_DEFAULT_ZOOM);
  if (delta === 0) return NOTE_ZOOM_LEVELS[from];
  const next = from + (delta > 0 ? 1 : -1);
  return NOTE_ZOOM_LEVELS[Math.min(NOTE_ZOOM_LEVELS.length - 1, Math.max(0, next))];
}

export function getNoteLineCount(text: string) {
  return text.split("\n").length;
}

/** The offset the given 1-based line starts at, clamped into the document. */
export function getNoteLineStart(text: string, line: number) {
  const lines = text.split("\n");
  const target = Math.min(Math.max(1, Math.trunc(line)), lines.length);
  let offset = 0;
  for (let index = 0; index < target - 1; index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

/** The offset that line ends at, before its newline. */
export function getNoteLineEnd(text: string, line: number) {
  const lines = text.split("\n");
  const target = Math.min(Math.max(1, Math.trunc(line)), lines.length);
  return getNoteLineStart(text, target) + lines[target - 1].length;
}

/** The 1-based line and column an offset falls on, for the status bar. */
export function getNoteCursorPosition(text: string, offset: number) {
  const safe = Math.min(Math.max(0, offset), text.length);
  const before = text.slice(0, safe).split("\n");
  return { column: before[before.length - 1].length + 1, line: before.length };
}

export type NoteGoToResult = { error: string } | { line: number };

/**
 * Windows refuses a line number the document does not have rather than
 * guessing at the nearest one, and says so in the box it was typed into.
 */
export function parseNoteGoToLine(input: string, lineCount: number): NoteGoToResult {
  const trimmed = input.trim();
  if (!/^[0-9]+$/.test(trimmed)) return { error: "줄 번호를 숫자로 입력하세요." };
  const line = Number(trimmed);
  if (line < 1 || line > lineCount) {
    return { error: `줄 번호는 1에서 ${lineCount} 사이여야 합니다.` };
  }
  return { line };
}
