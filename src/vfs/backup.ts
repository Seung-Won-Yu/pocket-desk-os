import type { DesktopItem } from "../types";
import { createStoredZip, readStoredZipFile } from "./zip";

const VFS_BACKUP_FILE_NAME = "pocket-desk-vfs.json";
const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BACKUP_ENTRY_COUNT = 2000;

type VfsItemNormalizer = (value: unknown, index: number) => DesktopItem | null;

function createVfsBackup(entries: DesktopItem[]) {
  return {
    app: "PocketDesk OS",
    exportedAt: new Date().toISOString(),
    entries,
    version: 1,
  };
}

function normalizeImportedVfsEntries(value: unknown, normalize: VfsItemNormalizer) {
  if (!value || typeof value !== "object") {
    throw new Error("백업 JSON을 읽을 수 없습니다.");
  }

  const backup = value as { app?: unknown; entries?: unknown; version?: unknown };
  if (backup.app !== "PocketDesk OS" || backup.version !== 1) {
    throw new Error("지원하지 않는 PocketDesk 백업 형식입니다.");
  }

  const entries = backup.entries;
  if (!Array.isArray(entries)) {
    throw new Error("백업 안에 파일 목록이 없습니다.");
  }
  if (entries.length > MAX_BACKUP_ENTRY_COUNT) {
    throw new Error(`백업은 최대 ${MAX_BACKUP_ENTRY_COUNT}개 항목까지 가져올 수 있습니다.`);
  }

  const seenIds = new Set<string>();
  const normalized = entries
    .map((item, index) => normalize(item, index))
    .filter((item): item is DesktopItem => Boolean(item))
    .map((item) => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        return item;
      }

      const nextItem = { ...item, id: `${item.kind}-${crypto.randomUUID()}` };
      seenIds.add(nextItem.id);
      return nextItem;
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  if (normalized.length === 0) {
    throw new Error("가져올 수 있는 파일이 없습니다.");
  }

  return normalized;
}

export function createVfsBackupZip(entries: DesktopItem[]) {
  if (entries.length > MAX_BACKUP_ENTRY_COUNT) {
    throw new Error(`백업은 최대 ${MAX_BACKUP_ENTRY_COUNT}개 항목까지 내보낼 수 있습니다.`);
  }
  const payload = JSON.stringify(createVfsBackup(entries), null, 2);
  const data = new TextEncoder().encode(payload);
  return createStoredZip([{ data, name: VFS_BACKUP_FILE_NAME }]);
}

export async function readVfsBackupZip(file: File, normalize: VfsItemNormalizer) {
  if (file.size === 0 || file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("ZIP 백업 크기가 허용 범위를 벗어났습니다.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const payload = readStoredZipFile(bytes, VFS_BACKUP_FILE_NAME);
  let parsed: unknown;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    parsed = JSON.parse(decoded);
  } catch {
    throw new Error("백업 JSON이 손상되었습니다.");
  }
  return normalizeImportedVfsEntries(parsed, normalize);
}
