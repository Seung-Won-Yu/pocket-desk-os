import type { LucideIcon } from "lucide-react";
import { appMetadata } from "../apps/metadata";
import type { AppId, DesktopItem, VfsEntryKind } from "../types";

export const VFS_ROOT_ID = "desktop";
export const VFS_DOCUMENTS_ID = "vfs-system-documents";
export const VFS_PICTURES_ID = "vfs-system-pictures";
export const VFS_GAMES_ID = "vfs-system-games";
export const VFS_SYSTEM_FOLDER_IDS = [VFS_DOCUMENTS_ID, VFS_PICTURES_ID, VFS_GAMES_ID] as const;

export type VfsPathSegment = {
  id: string;
  name: string;
};

export const MAX_VFS_NAME_LENGTH = 48;

/**
 * Truncates to a UTF-16 length budget on code-point boundaries, so an emoji is
 * dropped whole instead of leaving a lone surrogate behind.
 */
export function truncateVfsName(value: string, limit = MAX_VFS_NAME_LENGTH) {
  if (value.length <= limit) return value;

  let result = "";
  for (const character of value) {
    if (result.length + character.length > limit) break;
    result += character;
  }
  return result;
}

/**
 * Builds `base + suffix + extension` already within the name cap. The cap has to
 * be applied before the uniqueness check — truncating afterwards can shorten a
 * candidate back into the very name it was meant to avoid.
 */
function buildCappedVfsName(base: string, suffix: string, extension: string) {
  const budget = MAX_VFS_NAME_LENGTH - suffix.length - extension.length;
  const trimmedBase = budget > 0 ? truncateVfsName(base, budget) : "";
  return `${trimmedBase}${suffix}${extension}`;
}

export type VfsEntryAssociation = {
  accent: string;
  appId: AppId;
  appTitle: string;
  extension: string;
  icon: LucideIcon;
  typeLabel: string;
};

export function getUniqueTextFileName(items: DesktopItem[], parentId = VFS_DOCUMENTS_ID) {
  const existingNames = new Set(
    items
      .filter((item) => item.parentId === parentId && !item.trashed)
      .map((item) => item.name),
  );
  const baseName = "새 텍스트 문서.txt";
  if (!existingNames.has(baseName)) return baseName;

  for (let index = 2; index < 1000; index += 1) {
    const name = `새 텍스트 문서 (${index}).txt`;
    if (!existingNames.has(name)) return name;
  }
  return `새 텍스트 문서 ${Date.now()}.txt`;
}

export function getUniqueVfsCopyName(existingNames: Set<string>, sourceName: string) {
  const { base, extension } = getVfsNameParts(sourceName);
  const firstCopyName = buildCappedVfsName(base, " - 복사본", extension);
  if (!existingNames.has(firstCopyName)) return firstCopyName;

  for (let index = 2; index < 1000; index += 1) {
    const name = buildCappedVfsName(base, ` - 복사본 (${index})`, extension);
    if (!existingNames.has(name)) return name;
  }
  return buildCappedVfsName(base, ` - 복사본 ${Date.now()}`, extension);
}

export function getUniqueVfsEntryName(
  items: DesktopItem[],
  parentId: string,
  requestedName: string,
) {
  const existingNames = new Set(
    items
      .filter((item) => item.parentId === parentId && !item.trashed)
      .map((item) => item.name),
  );
  const cappedName = truncateVfsName(requestedName);
  if (!existingNames.has(cappedName)) return cappedName;

  const { base, extension } = getVfsNameParts(cappedName);
  for (let index = 2; index < 1000; index += 1) {
    const name = buildCappedVfsName(base, ` (${index})`, extension);
    if (!existingNames.has(name)) return name;
  }
  return buildCappedVfsName(base, ` ${Date.now()}`, extension);
}

export function getDefaultVfsEntryName(kind: VfsEntryKind) {
  if (kind === "canvas") return "새 그림.canvas";
  if (kind === "folder") return "새 폴더";
  if (kind === "game") return "게임.game";
  if (kind === "shortcut") return "바로 가기.url";
  return "새 메모.txt";
}

export function getUniqueCanvasItemName(items: DesktopItem[], parentId = VFS_PICTURES_ID) {
  const existingNames = new Set(
    items
      .filter((item) => item.parentId === parentId && !item.trashed)
      .map((item) => item.name),
  );

  for (let index = 1; index < 1000; index += 1) {
    const name = `그림 ${index}.png`;
    if (!existingNames.has(name)) {
      return name;
    }
  }

  return `그림 ${Date.now()}.png`;
}

export function normalizeVfsEntryName(name: string) {
  return truncateVfsName(name.trim().replace(/\s+/g, " "));
}

export function getVfsNameParts(name: string) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { base: name, extension: "" };
  }

  return {
    base: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

export function getUniqueRenamedVfsItemName(
  items: DesktopItem[],
  itemId: string,
  name: string,
) {
  const target = items.find((item) => item.id === itemId);
  const currentName = target?.name ?? "untitled";
  const requestedName = normalizeVfsEntryName(name) || currentName;
  const existingNames = new Set(
    items
      .filter(
        (item) =>
          item.id !== itemId &&
          !item.trashed &&
          item.parentId === (target?.parentId ?? VFS_ROOT_ID),
      )
      .map((item) => item.name),
  );

  if (!existingNames.has(requestedName)) {
    return requestedName;
  }

  const { base, extension } = getVfsNameParts(requestedName);
  for (let index = 2; index < 1000; index += 1) {
    const nextName = buildCappedVfsName(base, ` ${index}`, extension);
    if (!existingNames.has(nextName)) {
      return nextName;
    }
  }

  return buildCappedVfsName(base, ` ${Date.now()}`, extension);
}

export function getVfsEntryExtension(item: DesktopItem) {
  const extension = getVfsNameParts(item.name).extension.replace(/^\./, "").toLowerCase();
  if (extension) return extension;
  if (item.kind === "folder") return "folder";
  if (item.kind === "canvas") return "canvas";
  if (item.kind === "game") return "game";
  if (item.kind === "shortcut") return "url";
  return "txt";
}

export function getVfsEntryAssociation(item: DesktopItem): VfsEntryAssociation {
  const extension = getVfsEntryExtension(item);

  if (item.kind === "folder" || extension === "folder") {
    return createVfsEntryAssociation("files", "folder", "파일 폴더");
  }

  if (extension === "txt") {
    return createVfsEntryAssociation("notepad", extension, "텍스트 문서");
  }

  if (extension === "md" || extension === "markdown") {
    return createVfsEntryAssociation("notepad", extension, "Markdown 문서");
  }

  if (extension === "png") {
    return createVfsEntryAssociation("paint", extension, "PNG 이미지");
  }

  if (extension === "canvas") {
    return createVfsEntryAssociation("paint", extension, "캔버스 이미지");
  }

  if (extension === "url") {
    return createVfsEntryAssociation("browser", extension, "인터넷 바로 가기");
  }

  if (extension === "game") {
    return createVfsEntryAssociation(item.appId ?? "minesweeper", extension, "게임 파일");
  }

  return createVfsEntryAssociation(
    getVfsEntryKindDefaultApp(item),
    extension,
    `${extension.toUpperCase()} 파일`,
  );
}

export function createVfsEntryAssociation(
  appId: AppId,
  extension: string,
  typeLabel: string,
): VfsEntryAssociation {
  const app = appMetadata[appId];
  return {
    accent: app.accent,
    appId,
    appTitle: app.title,
    extension,
    icon: app.icon,
    typeLabel,
  };
}

export function getVfsEntryKindDefaultApp(item: DesktopItem): AppId {
  if (item.appId) return item.appId;
  if (item.kind === "folder") return "files";
  if (item.kind === "canvas") return "paint";
  if (item.kind === "game") return "minesweeper";
  if (item.kind === "shortcut") return "browser";
  return "notepad";
}

export function getVfsEntryDetail(item: DesktopItem) {
  const association = getVfsEntryAssociation(item);
  if (item.kind === "folder") {
    return "파일과 하위 폴더를 보관하는 폴더입니다.";
  }
  if (item.kind === "note") {
    return item.content?.trim() || "저장된 메모 내용이 없습니다.";
  }
  if (item.kind === "canvas") {
    return item.content
      ? "저장된 PNG 그림입니다. 그림판에서 다시 열 수 있습니다."
      : "그림판에서 새 그림을 그릴 수 있습니다.";
  }
  if (item.kind === "game") {
    return `${association.appTitle}로 실행되는 게임 파일입니다.`;
  }
  return `${association.appTitle}에서 ${getVfsShortcutTarget(item)} 주소를 엽니다.`;
}

export function getVfsShortcutTarget(item: DesktopItem) {
  const content = typeof item.content === "string" ? item.content.trim() : "";
  if (content) return content;
  return "https://example.com";
}

export function formatDesktopItemTime(createdAt: number) {
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  return "오늘";
}

export function isVfsSystemFolderId(itemId: string) {
  return VFS_SYSTEM_FOLDER_IDS.includes(itemId as (typeof VFS_SYSTEM_FOLDER_IDS)[number]);
}

export function getVfsFolder(items: DesktopItem[], folderId: string) {
  if (folderId === VFS_ROOT_ID) return null;
  return items.find((item) => item.id === folderId && item.kind === "folder" && !item.trashed);
}

export function getVfsFolderPath(items: DesktopItem[], folderId: string): VfsPathSegment[] {
  const path: VfsPathSegment[] = [{ id: VFS_ROOT_ID, name: "바탕 화면" }];
  if (folderId === VFS_ROOT_ID) return path;

  const visited = new Set<string>();
  const parents: VfsPathSegment[] = [];
  let currentId = folderId;

  while (currentId !== VFS_ROOT_ID && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = getVfsFolder(items, currentId);
    if (!folder) return path;
    parents.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return currentId === VFS_ROOT_ID ? [...path, ...parents] : path;
}

export function getVfsDescendantIds(items: DesktopItem[], rootIds: string[]) {
  const descendants = new Set(rootIds);
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of items) {
      if (!descendants.has(item.id) && descendants.has(item.parentId)) {
        descendants.add(item.id);
        changed = true;
      }
    }
  }

  return descendants;
}

export function getVfsTopLevelIds(items: DesktopItem[], itemIds: string[]) {
  const selected = new Set(itemIds);
  return itemIds.filter((itemId, index) => {
    if (itemIds.indexOf(itemId) !== index) return false;
    let parentId = items.find((item) => item.id === itemId)?.parentId;
    const visited = new Set<string>();
    while (parentId && parentId !== VFS_ROOT_ID && !visited.has(parentId)) {
      if (selected.has(parentId)) return false;
      visited.add(parentId);
      parentId = items.find((item) => item.id === parentId)?.parentId;
    }
    return true;
  });
}

export function canMoveVfsEntries(
  items: DesktopItem[],
  itemIds: string[],
  targetParentId: string,
) {
  const targetIsFolder =
    targetParentId === VFS_ROOT_ID || Boolean(getVfsFolder(items, targetParentId));
  if (!targetIsFolder) return false;

  const roots = getVfsTopLevelIds(items, itemIds);
  if (roots.length === 0 || roots.some(isVfsSystemFolderId)) return false;
  const movedTree = getVfsDescendantIds(items, roots);
  return !movedTree.has(targetParentId);
}

export function createVfsSystemFolders(now = Date.now()): DesktopItem[] {
  return [
    [VFS_DOCUMENTS_ID, "문서"],
    [VFS_PICTURES_ID, "사진"],
    [VFS_GAMES_ID, "게임"],
  ].map(([id, name], index) => ({
    createdAt: now - (10 - index) * 1000,
    id,
    kind: "folder" as const,
    name,
    parentId: VFS_ROOT_ID,
    showOnDesktop: false,
    updatedAt: now - (10 - index) * 1000,
    x: 0,
    y: 0,
  }));
}
