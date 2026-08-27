import type { DesktopItem } from "../types";

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
  return createStoredZip(VFS_BACKUP_FILE_NAME, data);
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

function createStoredZip(fileName: string, data: Uint8Array) {
  const fileNameBytes = new TextEncoder().encode(fileName);
  const crc = crc32(data);
  const localHeaderSize = 30 + fileNameBytes.length;
  const centralHeaderSize = 46 + fileNameBytes.length;
  const totalSize = localHeaderSize + data.length + centralHeaderSize + 22;
  const bytes = new Uint8Array(totalSize);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  const writeBytes = (chunk: Uint8Array) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  };
  const writeUint16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const writeUint32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };

  const writeFileHeader = () => {
    writeUint32(0x04034b50);
    writeUint16(20);
    writeUint16(0x0800);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(crc);
    writeUint32(data.length);
    writeUint32(data.length);
    writeUint16(fileNameBytes.length);
    writeUint16(0);
    writeBytes(fileNameBytes);
    writeBytes(data);
  };

  const writeCentralDirectory = () => {
    writeUint32(0x02014b50);
    writeUint16(20);
    writeUint16(20);
    writeUint16(0x0800);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(crc);
    writeUint32(data.length);
    writeUint32(data.length);
    writeUint16(fileNameBytes.length);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(0);
    writeUint32(0);
    writeBytes(fileNameBytes);
  };

  writeFileHeader();
  const centralDirectoryOffset = offset;
  writeCentralDirectory();
  const centralDirectorySize = offset - centralDirectoryOffset;

  writeUint32(0x06054b50);
  writeUint16(0);
  writeUint16(0);
  writeUint16(1);
  writeUint16(1);
  writeUint32(centralDirectorySize);
  writeUint32(centralDirectoryOffset);
  writeUint16(0);

  return bytes;
}

function readStoredZipFile(bytes: Uint8Array, fileName: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const expectedCrc = view.getUint32(offset + 14, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameOffset = offset + 30;
    const dataOffset = nameOffset + fileNameLength + extraLength;
    const nextOffset = dataOffset + compressedSize;
    if (nameOffset + fileNameLength > bytes.length || dataOffset > bytes.length) {
      throw new Error("ZIP 파일 헤더가 손상되었습니다.");
    }
    const currentFileName = decoder.decode(
      bytes.slice(nameOffset, nameOffset + fileNameLength),
    );

    if (flags & 0x0001) {
      throw new Error("암호화된 ZIP은 지원하지 않습니다.");
    }
    if (flags & 0x0008) {
      throw new Error("데이터 디스크립터 ZIP은 지원하지 않습니다.");
    }
    if (compressionMethod !== 0) {
      throw new Error("PocketDesk에서 내보낸 ZIP만 가져올 수 있습니다.");
    }
    if (compressedSize !== uncompressedSize) {
      throw new Error("ZIP 파일 크기 정보가 올바르지 않습니다.");
    }
    if (nextOffset > bytes.length) {
      throw new Error("ZIP 파일이 손상되었습니다.");
    }
    if (currentFileName === fileName) {
      const payload = bytes.slice(dataOffset, nextOffset);
      if (crc32(payload) !== expectedCrc) {
        throw new Error("ZIP 백업 무결성 검사에 실패했습니다.");
      }
      return payload;
    }

    offset = nextOffset;
  }

  throw new Error(`${fileName} 파일을 찾지 못했습니다.`);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
