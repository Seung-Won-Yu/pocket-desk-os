import { type AppId, type DesktopItem } from "../types";
import { getVfsEntryAssociation, getVfsEntryExtension } from "../vfs/model";
import { RECENT_OPENS_KEY } from "./constants";
import { type DefaultAppMap } from "./preferences";

export const JUMP_LIST_LIMIT = 5;
/** How many open timestamps are kept; oldest fall off first. */
export const RECENT_OPENS_LIMIT = 50;

/**
 * When the user last opened each entry, by item id. Windows sorts a jump list
 * by use, not by modification — without this, opening a document from the
 * list never moved it up, and a file edited by anything (autosave included)
 * outranked the file actually being worked in.
 */
export type RecentOpensMap = Record<string, number>;

export function loadRecentOpens(): RecentOpensMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_OPENS_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed).filter(
      (pair): pair is [string, number] =>
        typeof pair[1] === "number" && Number.isFinite(pair[1]),
    );
    return Object.fromEntries(entries.slice(-RECENT_OPENS_LIMIT));
  } catch {
    return {};
  }
}

export function persistRecentOpens(opens: RecentOpensMap) {
  try {
    localStorage.setItem(RECENT_OPENS_KEY, JSON.stringify(opens));
  } catch {
    // Losing the write must not lose the session.
  }
}

/** Stamps one open, dropping the oldest stamp once the cap is reached. */
export function recordRecentOpen(
  opens: RecentOpensMap,
  itemId: string,
  now: number,
): RecentOpensMap {
  const next: RecentOpensMap = { ...opens, [itemId]: now };
  const ids = Object.keys(next);
  if (ids.length <= RECENT_OPENS_LIMIT) return next;
  const oldest = ids.reduce((a, b) => (next[a] <= next[b] ? a : b));
  delete next[oldest];
  return next;
}

/**
 * What a taskbar button's right-click menu shows above the app actions: the
 * documents that app would open, newest first — Windows' 최근 항목. Grouping
 * follows the same rule as double-clicking a file (the file-type default app
 * wins over the built-in association), so the jump list never lists a file
 * that would actually open somewhere else.
 */
export function buildRecentDocumentsByApp(
  items: DesktopItem[],
  defaultApps: DefaultAppMap,
  recentOpens: RecentOpensMap = {},
): Map<AppId, DesktopItem[]> {
  const byApp = new Map<AppId, DesktopItem[]>();
  for (const item of items) {
    if (item.trashed) continue;
    const targetAppId =
      defaultApps[getVfsEntryExtension(item)] ?? getVfsEntryAssociation(item).appId;
    const list = byApp.get(targetAppId);
    if (list) {
      list.push(item);
    } else {
      byApp.set(targetAppId, [item]);
    }
  }
  // Recency is the LATER of last-opened and last-modified — deliberately not
  // opens-only: a terminal-written file exists before anyone has opened it,
  // and a document that just changed is news even if another one was opened
  // earlier. An open therefore lifts a stale file, but never outranks a
  // fresher edit.
  const recency = (item: DesktopItem) => Math.max(recentOpens[item.id] ?? 0, item.updatedAt);
  for (const [appId, list] of byApp) {
    byApp.set(
      appId,
      [...list].sort((a, b) => recency(b) - recency(a)).slice(0, JUMP_LIST_LIMIT),
    );
  }
  return byApp;
}
