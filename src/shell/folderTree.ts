import type { DesktopItem } from "../types";
import { VFS_ROOT_ID } from "../vfs/model";

/**
 * Explorer's 탐색 창 as a real tree. The sidebar was five fixed shortcuts, so
 * a folder you made yourself never appeared in it however deep you were
 * standing inside it — the pane said nothing about where you were.
 *
 * 바탕 화면 is the only root here because it is the only root in the file
 * system: 문서, 사진, 게임 and 다운로드 are its children, and Windows shows
 * them exactly that way rather than as siblings of the desktop.
 */
export type FolderTreeRow = {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  id: string;
  name: string;
};

/** A folder's own subfolders, in the order the pane lists them. */
export function getVfsChildFolders(
  items: DesktopItem[],
  parentId: string,
  showHidden: boolean,
) {
  return items
    .filter(
      (item) =>
        item.kind === "folder" &&
        !item.trashed &&
        item.parentId === parentId &&
        (showHidden || !item.hidden),
    )
    .sort((first, second) => first.name.localeCompare(second.name, "ko", { numeric: true }));
}

/**
 * Every folder between the root and this one, outermost first. Used to open
 * the pane onto the folder the window is showing. Cycle-safe: a parent chain
 * that loops stops rather than hanging the render.
 */
export function getVfsFolderAncestorIds(items: DesktopItem[], folderId: string) {
  const byId = new Map(items.map((item) => [item.id, item] as const));
  const chain: string[] = [];
  const seen = new Set<string>([folderId]);
  let current = byId.get(folderId)?.parentId;
  while (current && current !== VFS_ROOT_ID && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = byId.get(current)?.parentId;
  }
  if (current === VFS_ROOT_ID) chain.push(VFS_ROOT_ID);
  return chain.reverse();
}

/**
 * Flattens the visible part of the tree into the rows the pane renders. Only
 * expanded folders contribute children, so a big tree costs nothing while it
 * is closed.
 */
export function buildVfsFolderTree(
  items: DesktopItem[],
  expandedIds: Iterable<string>,
  showHidden: boolean,
  rootName = "바탕 화면",
  rootId = VFS_ROOT_ID,
): FolderTreeRow[] {
  const expanded = new Set(expandedIds);
  const rows: FolderTreeRow[] = [];
  const walked = new Set<string>();

  const walk = (id: string, name: string, depth: number) => {
    if (walked.has(id)) return;
    walked.add(id);
    const children = getVfsChildFolders(items, id, showHidden);
    const isExpanded = expanded.has(id);
    rows.push({ depth, expanded: isExpanded, hasChildren: children.length > 0, id, name });
    if (!isExpanded) return;
    children.forEach((child) => walk(child.id, child.name, depth + 1));
  };

  walk(rootId, rootName, 0);
  return rows;
}

/** Clicking a twisty: open what is closed, close what is open. */
export function toggleFolderTreeExpansion(expandedIds: string[], folderId: string) {
  return expandedIds.includes(folderId)
    ? expandedIds.filter((id) => id !== folderId)
    : [...expandedIds, folderId];
}

/**
 * The keyboard a tree owes its user, from the ARIA practices and from
 * Explorer: Right opens a closed branch then steps into it, Left closes an
 * open one then steps out to the parent, Up/Down walk the rows on screen.
 */
export function getFolderTreeKeyAction(
  key: string,
  rows: FolderTreeRow[],
  focusedId: string,
): { kind: "collapse" | "expand" } | { id: string; kind: "focus" } | null {
  const index = rows.findIndex((row) => row.id === focusedId);
  if (index < 0) return null;
  const row = rows[index];

  if (key === "ArrowRight") {
    if (row.hasChildren && !row.expanded) return { kind: "expand" };
    if (row.hasChildren && rows[index + 1]) return { id: rows[index + 1].id, kind: "focus" };
    return null;
  }
  if (key === "ArrowLeft") {
    if (row.hasChildren && row.expanded) return { kind: "collapse" };
    for (let above = index - 1; above >= 0; above -= 1) {
      if (rows[above].depth < row.depth) return { id: rows[above].id, kind: "focus" };
    }
    return null;
  }
  if (key === "ArrowDown" && rows[index + 1]) return { id: rows[index + 1].id, kind: "focus" };
  if (key === "ArrowUp" && rows[index - 1]) return { id: rows[index - 1].id, kind: "focus" };
  if (key === "Home") return { id: rows[0].id, kind: "focus" };
  if (key === "End") return { id: rows[rows.length - 1].id, kind: "focus" };
  return null;
}
