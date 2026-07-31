import type { LucideIcon } from "lucide-react";
import { appMetadata } from "../apps/metadata";
import type { AppId, DesktopItem, VfsEntryKind } from "../types";

export type VfsEntryAssociation = {
  accent: string;
  appId: AppId;
  appTitle: string;
  extension: string;
  icon: LucideIcon;
  typeLabel: string;
};

export function getUniqueTextFileName(items: DesktopItem[]) {
  const existingNames = new Set(items.map((item) => item.name));
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
  const firstCopyName = `${base} - 복사본${extension}`;
  if (!existingNames.has(firstCopyName)) return firstCopyName;

  for (let index = 2; index < 1000; index += 1) {
    const name = `${base} - 복사본 (${index})${extension}`;
    if (!existingNames.has(name)) return name;
  }
  return `${base} - 복사본 ${Date.now()}${extension}`.slice(0, 48);
}

export function getDefaultVfsEntryName(kind: VfsEntryKind) {
  if (kind === "canvas") return "새 그림.canvas";
  if (kind === "folder") return "가져온 폴더";
  if (kind === "game") return "게임.game";
  if (kind === "shortcut") return "바로 가기.url";
  return "새 메모.txt";
}

export function getUniqueCanvasItemName(items: DesktopItem[]) {
  const existingNames = new Set(items.map((item) => item.name));

  for (let index = 1; index < 1000; index += 1) {
    const name = `그림 ${index}.png`;
    if (!existingNames.has(name)) {
      return name;
    }
  }

  return `그림 ${Date.now()}.png`;
}

export function normalizeVfsEntryName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 48);
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

export function getUniqueRenamedVfsItemName(items: DesktopItem[], itemId: string, name: string) {
  const currentName = items.find((item) => item.id === itemId)?.name ?? "untitled";
  const requestedName = normalizeVfsEntryName(name) || currentName;
  const existingNames = new Set(items.filter((item) => item.id !== itemId).map((item) => item.name));

  if (!existingNames.has(requestedName)) {
    return requestedName;
  }

  const { base, extension } = getVfsNameParts(requestedName);
  for (let index = 2; index < 1000; index += 1) {
    const nextName = `${base} ${index}${extension}`;
    if (!existingNames.has(nextName)) {
      return nextName.slice(0, 48);
    }
  }

  return `${base} ${Date.now()}${extension}`.slice(0, 48);
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
    return createVfsEntryAssociation("files", "folder", "Folder");
  }

  if (extension === "txt") {
    return createVfsEntryAssociation("notepad", extension, "TXT document");
  }

  if (extension === "md" || extension === "markdown") {
    return createVfsEntryAssociation("notepad", extension, "Markdown document");
  }

  if (extension === "png") {
    return createVfsEntryAssociation("paint", extension, "PNG image");
  }

  if (extension === "canvas") {
    return createVfsEntryAssociation("paint", extension, "Canvas image");
  }

  if (extension === "url") {
    return createVfsEntryAssociation("browser", extension, "URL shortcut");
  }

  if (extension === "game") {
    return createVfsEntryAssociation(item.appId ?? "minesweeper", extension, "Game file");
  }

  return createVfsEntryAssociation(getVfsEntryKindDefaultApp(item), extension, `${extension.toUpperCase()} file`);
}

export function createVfsEntryAssociation(appId: AppId, extension: string, typeLabel: string): VfsEntryAssociation {
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
    return "가져온 ZIP에 포함된 폴더 항목입니다.";
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
