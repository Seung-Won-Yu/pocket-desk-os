import { type DesktopItem, type VfsEntryKind } from "../types";
import { isSafeHttpUrl } from "../utils/safeUrl";
import { bytesToDataUrl } from "./imageCodec";
import { getVfsEntryExtension, sanitizeVfsFileName } from "./model";
import { type ZipEntry, createStoredZip, readStoredZip } from "./zip";

/**
 * 압축(ZIP) 파일로 압축 / 압축 풀기 — Explorer's own archiving, over the same
 * stored-ZIP format the backup export has always written.
 *
 * The archive holds the file system's own shapes: a folder becomes a directory
 * entry, a drawing becomes its PNG bytes, and a text file becomes UTF-8. That
 * means an archive made here opens in Windows Explorer, and one made there
 * comes back with its folders intact.
 */

export const ARCHIVE_MIME = "application/zip";
export const ARCHIVE_EXTENSION = "zip";
const ARCHIVE_DATA_URL_PATTERN = /^data:application\/zip;base64,([A-Za-z0-9+/=]*)$/;

/** Extensions the shell can put back as a file, and the kind each becomes. */
const EXTRACTABLE_KINDS: Record<string, VfsEntryKind> = {
  canvas: "canvas",
  csv: "note",
  game: "game",
  json: "note",
  log: "note",
  markdown: "note",
  md: "note",
  png: "canvas",
  txt: "note",
  url: "shortcut",
};

function decodeText(data: Uint8Array, name: string) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    throw new Error(`${name}은(는) 텍스트로 읽을 수 없습니다.`);
  }
}

/** The bytes one entry contributes to an archive. */
function getEntryBytes(item: DesktopItem) {
  if (item.kind === "folder") return new Uint8Array();
  const content = item.content ?? "";
  if (item.kind === "canvas") {
    const match = /^data:image\/[a-z0-9+.-]+;base64,([A-Za-z0-9+/=]*)$/i.exec(content);
    if (match) {
      const binary = atob(match[1]);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }
  }
  return new TextEncoder().encode(content);
}

/**
 * The archive members for a selection: every chosen entry, plus everything
 * under a chosen folder, named relative to the folder being compressed — the
 * way Windows names them, so extracting gives back the same shape.
 */
export function buildArchiveEntries(items: DesktopItem[], rootIds: string[]): ZipEntry[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const roots = rootIds
    .map((id) => byId.get(id))
    .filter((item): item is DesktopItem => Boolean(item) && !item?.trashed);
  if (roots.length === 0) throw new Error("압축할 항목이 없습니다.");

  const entries: ZipEntry[] = [];
  const visit = (item: DesktopItem, prefix: string) => {
    const name = `${prefix}${item.name}`;
    if (item.kind === "folder") {
      entries.push({ data: new Uint8Array(), name: `${name}/` });
      const children = items
        .filter((child) => child.parentId === item.id && !child.trashed)
        .sort((first, second) => first.name.localeCompare(second.name, "ko"));
      for (const child of children) visit(child, `${name}/`);
      return;
    }
    entries.push({ data: getEntryBytes(item), name });
  };
  for (const root of roots) visit(root, "");
  return entries;
}

/** A selection compressed into one archive's bytes. */
export function createArchive(items: DesktopItem[], rootIds: string[]) {
  return createStoredZip(buildArchiveEntries(items, rootIds));
}

/** The name Windows gives an archive: the single item's, or the folder's. */
export function getArchiveName(items: DesktopItem[], rootIds: string[], folderName: string) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const base =
    rootIds.length === 1
      ? (byId.get(rootIds[0])?.name.replace(/\.[^.]+$/, "") ?? folderName)
      : folderName;
  return `${sanitizeVfsFileName(base, "새 압축 파일")}.${ARCHIVE_EXTENSION}`;
}

/** Whether an entry is an archive this app can open. */
export function isArchiveItem(item: DesktopItem) {
  return item.kind !== "folder" && getVfsEntryExtension(item) === ARCHIVE_EXTENSION;
}

export function archiveToDataUrl(bytes: Uint8Array) {
  return bytesToDataUrl(bytes, ARCHIVE_MIME);
}

export function archiveFromDataUrl(content: string) {
  const match = ARCHIVE_DATA_URL_PATTERN.exec(content);
  if (!match) throw new Error("압축 파일 내용을 읽을 수 없습니다.");
  let binary: string;
  try {
    binary = atob(match[1]);
  } catch {
    throw new Error("압축 파일 내용이 손상되었습니다.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export type ExtractedEntry = {
  content?: string;
  kind: VfsEntryKind;
  /** Path segments from the extraction root, the last one being the name. */
  path: string[];
};

/**
 * What an archive should become in the file system: folders first, then files,
 * each with the kind its extension implies. A member the shell cannot put back
 * as a file is named and refused rather than written as something it is not.
 */
export function readArchiveEntries(bytes: Uint8Array): ExtractedEntry[] {
  const members = readStoredZip(bytes);
  const folders = new Set<string>();
  const extracted: ExtractedEntry[] = [];

  const addFolders = (segments: string[]) => {
    for (let depth = 1; depth <= segments.length; depth += 1) {
      const path = segments.slice(0, depth);
      const key = path.join("/");
      if (folders.has(key)) continue;
      folders.add(key);
      extracted.push({ kind: "folder", path });
    }
  };

  for (const member of members) {
    const rawSegments = member.name.split("/").filter(Boolean);
    const segments = rawSegments.map((segment) => sanitizeVfsFileName(segment, ""));
    if (segments.length === 0 || segments.some((segment) => !segment)) {
      throw new Error(`압축 파일 안의 이름을 쓸 수 없습니다: ${member.name}`);
    }
    if (member.name.endsWith("/")) {
      addFolders(segments);
      continue;
    }
    addFolders(segments.slice(0, -1));

    const name = segments[segments.length - 1];
    const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    const kind = EXTRACTABLE_KINDS[extension];
    if (!kind) {
      throw new Error(`PocketDesk가 다룰 수 없는 파일이 있습니다: ${name}`);
    }
    if (kind === "canvas") {
      extracted.push({
        // Both a .png and a .canvas hold PNG bytes; the model keeps either as
        // an image data URL.
        content: bytesToDataUrl(member.data, "image/png"),
        kind,
        path: segments,
      });
      continue;
    }
    const text = decodeText(member.data, name);
    if (kind === "shortcut") {
      /*
       * A .url member is only a shortcut if it points somewhere this shell
       * would let a shortcut point. Anything else is kept as the text it is,
       * rather than fabricating a shortcut to an unchecked target.
       */
      const target = text.trim();
      extracted.push(
        isSafeHttpUrl(target)
          ? { content: target, kind: "shortcut", path: segments }
          : { content: text, kind: "note", path: segments },
      );
      continue;
    }
    extracted.push({ content: text, kind, path: segments });
  }

  return extracted;
}

/**
 * The file-system entries an archive becomes, under one new folder named after
 * the archive — the way Windows extracts. Folders arrive before the files
 * inside them, so every parent id is known by the time it is needed.
 */
export function createItemsFromArchive(
  extracted: ExtractedEntry[],
  options: { makeId: () => string; now: number; parentId: string; rootName: string },
): DesktopItem[] {
  const { makeId, now, parentId, rootName } = options;
  const root: DesktopItem = {
    createdAt: now,
    id: makeId(),
    kind: "folder",
    name: rootName,
    parentId,
    showOnDesktop: false,
    updatedAt: now,
    x: 0,
    y: 0,
  };
  const folderIds = new Map<string, string>([["", root.id]]);
  const items: DesktopItem[] = [root];

  for (const entry of extracted) {
    const parentKey = entry.path.slice(0, -1).join("/");
    const holder = folderIds.get(parentKey);
    if (!holder) {
      // Files come after the folders that hold them, so this cannot happen for
      // an archive readArchiveEntries produced.
      throw new Error(`압축 파일 안의 폴더를 찾지 못했습니다: ${parentKey}`);
    }
    const item: DesktopItem = {
      content: entry.content,
      createdAt: now,
      id: makeId(),
      kind: entry.kind,
      name: entry.path[entry.path.length - 1],
      parentId: holder,
      showOnDesktop: false,
      updatedAt: now,
      x: 0,
      y: 0,
    };
    if (entry.kind === "folder") folderIds.set(entry.path.join("/"), item.id);
    items.push(item);
  }

  return items;
}
