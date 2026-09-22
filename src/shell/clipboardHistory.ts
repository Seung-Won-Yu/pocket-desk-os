/**
 * 클립보드 기록 (Win+V). The shell had a clipboard for files and nothing at
 * all for text: whatever was copied last was the only thing that existed.
 * Windows keeps the last several and lets you reach back past the newest,
 * which is the point of the panel.
 */
export type ClipboardHistoryEntry = {
  /** When it was copied, for the "방금 전" line. */
  at: number;
  id: string;
  text: string;
};

/** Windows keeps 25; ten is enough to reach back without a scrollbar. */
export const CLIPBOARD_HISTORY_LIMIT = 10;
/** A copied novel is not what the panel is for; the entry is cut to this. */
export const CLIPBOARD_ENTRY_MAX_LENGTH = 4000;

export function pushClipboardEntry(
  history: ClipboardHistoryEntry[],
  text: string,
  at: number,
  id: string,
): ClipboardHistoryEntry[] {
  // Whitespace on its own is not something anyone reaches back for.
  if (!text.trim()) return history;
  const kept = text.slice(0, CLIPBOARD_ENTRY_MAX_LENGTH);
  // Copying the same thing again moves it to the top rather than doubling it.
  const rest = history.filter((entry) => entry.text !== kept);
  return [{ at, id, text: kept }, ...rest].slice(0, CLIPBOARD_HISTORY_LIMIT);
}

export function removeClipboardEntry(history: ClipboardHistoryEntry[], id: string) {
  return history.filter((entry) => entry.id !== id);
}

/** One line for the panel: the newlines collapse, the tail becomes an ellipsis. */
export function describeClipboardEntry(text: string, maxLength = 80) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}

/**
 * Pasting into a field the panel is covering: the text lands where the caret
 * was, replacing whatever was selected, and the caret ends up after it.
 */
export function insertClipboardText(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string,
) {
  const start = Math.min(Math.max(0, selectionStart), value.length);
  const end = Math.min(Math.max(start, selectionEnd), value.length);
  return {
    caret: start + text.length,
    value: `${value.slice(0, start)}${text}${value.slice(end)}`,
  };
}
