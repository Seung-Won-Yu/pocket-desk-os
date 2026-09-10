import type { DesktopItem } from "../types";
import { normalizeSearchText } from "../utils/format";

/**
 * Searching inside the files, the way Windows Search reads an indexed text
 * file rather than only its name. Explorer's box matched the name, the type
 * and the connected app — so a memo could hold the word you were looking for
 * and never come up.
 */

/**
 * Only what is honestly text. A drawing's content is a data URL and a `.zip`
 * is base64, so scanning either would match on the encoding rather than on
 * anything a person wrote.
 */
export function getVfsSearchableText(item: DesktopItem) {
  if (item.trashed) return null;
  if (item.kind === "note") return item.content ?? null;
  // A shortcut's text is where it points, which is what Explorer shows for it.
  if (item.kind === "shortcut") return item.content ?? null;
  return null;
}

/**
 * How much of one file is read. A long note is still searched — this only
 * bounds the work per file so a folder of large notes cannot lock the
 * keystroke that typed the query.
 */
export const VFS_CONTENT_SEARCH_LIMIT = 20000;

export const VFS_SNIPPET_RADIUS = 28;

export type VfsContentMatch = {
  /** Where the match sits inside `snippet`, for marking it. */
  matchStart: number;
  matchLength: number;
  snippet: string;
};

/**
 * The first place the query appears inside a file, as the line Explorer would
 * show under the name: whitespace collapsed, a window either side, and an
 * ellipsis wherever text was cut away.
 */
export function findVfsContentMatch(
  item: DesktopItem,
  query: string,
  radius = VFS_SNIPPET_RADIUS,
): VfsContentMatch | null {
  const needle = normalizeSearchText(query);
  if (!needle) return null;
  const raw = getVfsSearchableText(item);
  if (!raw) return null;

  // Collapsed first, then searched, so the offsets belong to the text that is
  // actually shown — searching the raw string and slicing the collapsed one
  // would mark the wrong characters.
  const text = raw.slice(0, VFS_CONTENT_SEARCH_LIMIT).replace(/\s+/g, " ").trim();
  const at = text.toLowerCase().indexOf(needle);
  if (at === -1) return null;

  const from = Math.max(0, at - radius);
  const to = Math.min(text.length, at + needle.length + radius);
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  return {
    matchLength: needle.length,
    matchStart: prefix.length + (at - from),
    snippet: `${prefix}${text.slice(from, to)}${suffix}`,
  };
}

/** True when the query appears anywhere in the part of the file that is read. */
export function vfsContentIncludes(item: DesktopItem, query: string) {
  return findVfsContentMatch(item, query, 0) !== null;
}
