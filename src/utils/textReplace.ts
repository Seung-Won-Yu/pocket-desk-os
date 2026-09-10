/**
 * 바꾸기 for 메모장. 찾기 could point at every occurrence and do nothing about
 * any of them.
 */
export type TextMatch = { end: number; start: number };

/** One occurrence swapped out. The caret lands after what was put in. */
export function replaceTextMatch(text: string, match: TextMatch, replacement: string) {
  const start = Math.max(0, Math.min(match.start, text.length));
  const end = Math.max(start, Math.min(match.end, text.length));
  return {
    caret: start + replacement.length,
    text: `${text.slice(0, start)}${replacement}${text.slice(end)}`,
  };
}

/**
 * Every occurrence at once, applied from the end backwards so an earlier
 * replacement of a different length cannot slide the offsets of the ones
 * after it.
 */
export function replaceAllTextMatches(text: string, matches: TextMatch[], replacement: string) {
  const ordered = [...matches].sort((first, second) => second.start - first.start);
  let next = text;
  let count = 0;
  for (const match of ordered) {
    if (match.start < 0 || match.end > next.length || match.end < match.start) continue;
    next = `${next.slice(0, match.start)}${replacement}${next.slice(match.end)}`;
    count += 1;
  }
  return { count, text: next };
}

/**
 * Which match 바꾸기 acts on: the one the selection is sitting on, so pressing
 * it takes the occurrence you are looking at rather than the next one down.
 * Returns null when the selection is not on a match — Notepad then finds the
 * next one instead of replacing anything.
 */
export function getSelectedMatchIndex(
  matches: TextMatch[],
  selectionStart: number,
  selectionEnd: number,
) {
  const index = matches.findIndex(
    (match) => match.start === selectionStart && match.end === selectionEnd,
  );
  return index === -1 ? null : index;
}
