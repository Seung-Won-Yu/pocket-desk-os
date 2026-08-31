import { type AppId, type DesktopItem } from "../types";
import { getVfsEntryAssociation, getVfsEntryExtension } from "../vfs/model";
import { type DefaultAppMap } from "./preferences";

export const JUMP_LIST_LIMIT = 5;

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
  for (const [appId, list] of byApp) {
    byApp.set(
      appId,
      [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, JUMP_LIST_LIMIT),
    );
  }
  return byApp;
}
