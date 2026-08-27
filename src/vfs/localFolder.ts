import type { DesktopItem } from "../types";
import { getVfsNameParts, VFS_ROOT_ID } from "./model";

/**
 * Bridges a folder the user picks on their own machine into the virtual file
 * system, and writes entries back out to one.
 *
 * This is deliberately gated to local development. The deployed site is public,
 * and the browser's permission prompt only guarantees the user chose the folder
 * — it does not protect the granted handle from the page itself. Any script
 * injection, compromised dependency or poisoned deploy would inherit that handle
 * and, since the app already makes outbound requests, could exfiltrate whatever
 * it read. Real files stay a local-only capability until that risk is worth it.
 */

/** `showDirectoryPicker` is not in TypeScript's DOM lib yet. */
type DirectoryPickerOptions = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (
    options?: DirectoryPickerOptions,
  ) => Promise<FileSystemDirectoryHandle>;
};

/** The async iterator side of the handle is also missing from the DOM lib. */
type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
};

export const LOCAL_FOLDER_MAX_FILES = 200;
export const LOCAL_FOLDER_MAX_BYTES = 8 * 1024 * 1024;
export const LOCAL_FOLDER_MAX_DEPTH = 4;

/**
 * Names that commonly hold credentials. Importing one would copy a secret into
 * browser storage, and this app makes outbound network calls — so they are
 * skipped rather than read, even though the user granted the folder.
 */
const SENSITIVE_NAME_PATTERN =
  /^(\.env(\..*)?|\.netrc|\.npmrc|\.pgpass|id_[a-z0-9]+|.*\.pem|.*\.key|.*\.p12|.*\.pfx|credentials|secrets?\.(json|ya?ml|toml))$/i;

/** Directories that are never worth walking, and ones that hold keys. */
const SKIPPED_DIRECTORY_PATTERN =
  /^(\.git|\.ssh|\.gnupg|\.aws|\.config|node_modules|dist|build|coverage|\.next|\.cache|__pycache__|\.venv|venv|Library|System)$/i;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "log",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "css",
  "html",
  "xml",
  "yml",
  "yaml",
  "toml",
  "ini",
  "sh",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "h",
  "cpp",
  "sql",
  "gitignore",
]);
const IMAGE_EXTENSIONS = new Set(["png"]);

export function isLocalFolderAccessAvailable() {
  if (typeof window === "undefined") return false;
  if (typeof (window as DirectoryPickerWindow).showDirectoryPicker !== "function") return false;

  // Only the machine running the app, never the public deployment.
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isSensitiveLocalName(name: string) {
  return SENSITIVE_NAME_PATTERN.test(name.trim());
}

export function isSkippedLocalDirectory(name: string) {
  return SKIPPED_DIRECTORY_PATTERN.test(name.trim()) || name.startsWith(".");
}

/** Which VFS kind a real file maps to, or null when it cannot be represented. */
export function getLocalFileKind(name: string): "canvas" | "note" | null {
  const extension = getVfsNameParts(name).extension.replace(/^\./, "").toLowerCase();
  if (!extension) return null;
  if (IMAGE_EXTENSIONS.has(extension)) return "canvas";
  if (TEXT_EXTENSIONS.has(extension)) return "note";
  return null;
}

export type LocalFolderImport = {
  entries: DesktopItem[];
  skipped: string[];
  truncated: boolean;
};

export async function pickLocalDirectory(mode: "read" | "readwrite") {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("이 브라우저는 폴더 선택을 지원하지 않습니다.");
  return picker({ id: "pocketdesk-local-folder", mode, startIn: "documents" });
}

/**
 * Walks a picked directory and produces VFS entries. Reads only; the handle is
 * never retained, so the permission dies with the call.
 */
export async function readLocalFolder(
  handle: FileSystemDirectoryHandle,
  parentId = VFS_ROOT_ID,
  now = Date.now(),
): Promise<LocalFolderImport> {
  const entries: DesktopItem[] = [];
  const skipped: string[] = [];
  let bytes = 0;
  let truncated = false;

  const walk = async (
    directory: FileSystemDirectoryHandle,
    directoryParentId: string,
    depth: number,
  ) => {
    if (depth > LOCAL_FOLDER_MAX_DEPTH) {
      truncated = true;
      return;
    }

    for await (const child of (directory as IterableDirectoryHandle).values()) {
      if (entries.length >= LOCAL_FOLDER_MAX_FILES || bytes >= LOCAL_FOLDER_MAX_BYTES) {
        truncated = true;
        return;
      }

      if (child.kind === "directory") {
        if (isSkippedLocalDirectory(child.name)) {
          skipped.push(`${child.name}/`);
          continue;
        }
        const folderId = `folder-${crypto.randomUUID()}`;
        entries.push({
          createdAt: now,
          id: folderId,
          kind: "folder",
          name: child.name.slice(0, 48),
          parentId: directoryParentId,
          showOnDesktop: false,
          updatedAt: now,
          x: 0,
          y: 0,
        });
        await walk(child, folderId, depth + 1);
        continue;
      }

      if (isSensitiveLocalName(child.name)) {
        skipped.push(child.name);
        continue;
      }
      const kind = getLocalFileKind(child.name);
      if (!kind) {
        skipped.push(child.name);
        continue;
      }

      const file = await child.getFile();
      if (bytes + file.size > LOCAL_FOLDER_MAX_BYTES) {
        truncated = true;
        return;
      }
      bytes += file.size;

      const content =
        kind === "canvas" ? await readAsDataUrl(file) : (await file.text()).slice(0, 200_000);
      entries.push({
        content,
        createdAt: file.lastModified || now,
        id: `${kind}-${crypto.randomUUID()}`,
        kind,
        name: child.name.slice(0, 48),
        parentId: directoryParentId,
        showOnDesktop: false,
        updatedAt: file.lastModified || now,
        x: 0,
        y: 0,
      });
    }
  };

  await walk(handle, parentId, 0);
  return { entries, skipped, truncated };
}

/** Writes the direct children of one VFS folder out as real files. */
export async function writeLocalFolder(
  handle: FileSystemDirectoryHandle,
  entries: DesktopItem[],
  parentId: string,
) {
  const children = entries.filter((entry) => !entry.trashed && entry.parentId === parentId);
  let written = 0;

  for (const entry of children) {
    if (entry.kind === "folder") {
      const directory = await handle.getDirectoryHandle(entry.name, { create: true });
      written += await writeLocalFolder(directory, entries, entry.id);
      continue;
    }

    const file = await handle.getFileHandle(entry.name, { create: true });
    const writable = await file.createWritable();
    try {
      await writable.write(toWritableContent(entry));
      written += 1;
    } finally {
      await writable.close();
    }
  }

  return written;
}

function toWritableContent(entry: DesktopItem): Blob | string {
  const content = entry.content ?? "";
  const match = /^data:([^;]+);base64,(.*)$/.exec(content);
  if (!match) return content;

  const binary = atob(match[2]);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
