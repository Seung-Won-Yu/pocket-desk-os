import { VFS_ROOT_ID, getVfsFolderPath } from "./model";
import type { DesktopItem } from "../types";

/**
 * The address bar's text form. Windows lets you read the path, type another
 * one, and press Enter; the breadcrumbs alone could only be clicked.
 */

/** Either separator, the way Windows accepts both. */
const SEPARATOR = /[\\/]+/;

/** `바탕 화면\문서` — the chain the breadcrumbs show, as one line. */
export function formatVfsPathText(items: DesktopItem[], folderId: string) {
  return getVfsFolderPath(items, folderId)
    .map((segment) => segment.name)
    .join("\\");
}

/**
 * The folder a typed path names, or null when no such folder exists.
 *
 * Empty text, or a path that is only separators, means the desktop root — the
 * same place `바탕 화면` names. Matching ignores case and surrounding spaces;
 * `.` keeps the current level and `..` climbs one, as a shell would.
 */
export function resolveVfsPathText(
  items: DesktopItem[],
  text: string,
  fromFolderId: string = VFS_ROOT_ID,
): string | null {
  const parts = text
    .split(SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return VFS_ROOT_ID;

  const rootName = getVfsFolderPath(items, VFS_ROOT_ID)[0]?.name ?? "바탕 화면";
  // A path that starts at the desktop is absolute; anything else is read from
  // the folder the window is showing.
  let current =
    parts[0].toLowerCase() === rootName.toLowerCase()
      ? (parts.shift(), VFS_ROOT_ID)
      : fromFolderId;

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      const chain = getVfsFolderPath(items, current);
      current = chain[chain.length - 2]?.id ?? VFS_ROOT_ID;
      continue;
    }
    const match = items.find(
      (item) =>
        item.parentId === current &&
        item.kind === "folder" &&
        !item.trashed &&
        item.name.toLowerCase() === part.toLowerCase(),
    );
    if (!match) return null;
    current = match.id;
  }
  return current;
}
