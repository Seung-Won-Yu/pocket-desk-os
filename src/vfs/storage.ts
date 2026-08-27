import type { DesktopItem } from "../types";
import { blobToDataUrl, dataUrlToBlob, isImageDataUrl } from "./imageCodec";

const VFS_DB_NAME = "pocket-desk-vfs";
const VFS_DB_VERSION = 2;
const VFS_STORE_NAME = "entries";
const VFS_META_STORE_NAME = "meta";
export const MAX_ENTRY_COUNT = 2000;
export const MAX_CONTENT_BYTES = 16 * 1024 * 1024;

type VfsItemNormalizer = (value: unknown, index: number) => DesktopItem | null;

let writeQueue: Promise<void> = Promise.resolve();
const contentEncoder = new TextEncoder();
/**
 * Encoded images, keyed by the data URL they came from. Every save rewrites the
 * whole snapshot, so without this a large picture would be re-encoded on each
 * rename or icon nudge. Bounded because the entries it holds are already in
 * memory as strings anyway.
 */
const imageBlobCache = new Map<string, Blob>();
const IMAGE_BLOB_CACHE_LIMIT = 48;

/** A stored entry keeps image bytes as a Blob; everything else is unchanged. */
type StoredVfsEntry = Omit<DesktopItem, "content"> & { content?: string | Blob };

function toStoredEntry(entry: DesktopItem): StoredVfsEntry {
  const content = entry.content;
  if (typeof content !== "string" || !isImageDataUrl(content)) return entry;

  const cached = imageBlobCache.get(content);
  if (cached) return { ...entry, content: cached };

  const blob = dataUrlToBlob(content);
  if (!blob) return entry;

  if (imageBlobCache.size >= IMAGE_BLOB_CACHE_LIMIT) imageBlobCache.clear();
  imageBlobCache.set(content, blob);
  return { ...entry, content: blob };
}

async function fromStoredEntry(value: unknown): Promise<unknown> {
  if (!value || typeof value !== "object") return value;
  const entry = value as StoredVfsEntry;
  if (!(entry.content instanceof Blob)) return value;

  const content = await blobToDataUrl(entry.content);
  imageBlobCache.set(content, entry.content);
  return { ...entry, content };
}

export class VfsStorageError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "VfsStorageError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export async function readVfsEntries(normalize: VfsItemNormalizer): Promise<DesktopItem[]> {
  const database = await openVfsDatabase();

  try {
    const transaction = database.transaction(VFS_STORE_NAME, "readonly");
    const request = transaction.objectStore(VFS_STORE_NAME).getAll();
    const values = await requestResult<unknown[]>(request, "가상 파일 목록을 읽지 못했습니다.");
    await transactionDone(transaction, "가상 파일 읽기 트랜잭션이 실패했습니다.");
    const decoded = await Promise.all(values.map(fromStoredEntry));

    return decoded
      .map((item, index) => normalize(item, index))
      .filter((item): item is DesktopItem => Boolean(item))
      .sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    database.close();
  }
}

export function persistVfsEntries(entries: DesktopItem[]): Promise<void> {
  let snapshot: DesktopItem[];
  try {
    // Snapshot eagerly so a later mutation cannot reach the queued write, but
    // report the failure as a rejection: callers handle it with .catch(), and a
    // synchronous throw would escape that entirely.
    snapshot = cloneAndValidateSnapshot(entries);
  } catch (error) {
    return Promise.reject(error);
  }

  const nextWrite = writeQueue.catch(() => undefined).then(() => writeVfsSnapshot(snapshot));
  writeQueue = nextWrite;
  return nextWrite;
}

export async function flushVfsWrites() {
  await writeQueue;
}

async function writeVfsSnapshot(entries: DesktopItem[]) {
  const database = await openVfsDatabase();

  try {
    const transaction = database.transaction(
      [VFS_STORE_NAME, VFS_META_STORE_NAME],
      "readwrite",
    );
    const entriesStore = transaction.objectStore(VFS_STORE_NAME);
    const metaStore = transaction.objectStore(VFS_META_STORE_NAME);

    entriesStore.clear();
    entries.forEach((entry) => entriesStore.put(toStoredEntry(entry)));
    metaStore.put({
      entryCount: entries.length,
      key: "snapshot",
      schemaVersion: VFS_DB_VERSION,
      updatedAt: Date.now(),
    });

    await transactionDone(transaction, "가상 파일 저장 트랜잭션이 실패했습니다.");
  } finally {
    database.close();
  }
}

function openVfsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VFS_DB_NAME, VFS_DB_VERSION);
    let settled = false;

    request.onupgradeneeded = () => {
      const database = request.result;
      const transaction = request.transaction;

      const entriesStore = database.objectStoreNames.contains(VFS_STORE_NAME)
        ? transaction?.objectStore(VFS_STORE_NAME)
        : database.createObjectStore(VFS_STORE_NAME, { keyPath: "id" });

      if (entriesStore && !entriesStore.indexNames.contains("parentId")) {
        entriesStore.createIndex("parentId", "parentId", { unique: false });
      }
      if (entriesStore && !entriesStore.indexNames.contains("kind")) {
        entriesStore.createIndex("kind", "kind", { unique: false });
      }
      if (!database.objectStoreNames.contains(VFS_META_STORE_NAME)) {
        database.createObjectStore(VFS_META_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new VfsStorageError("가상 파일 데이터베이스를 열지 못했습니다.", request.error));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new VfsStorageError("다른 탭이 가상 파일 데이터베이스 업데이트를 막고 있습니다."));
    };
  });
}

function requestResult<T>(request: IDBRequest<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new VfsStorageError(message, request.error));
  });
}

function transactionDone(transaction: IDBTransaction, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new VfsStorageError(message, transaction.error));
    transaction.onerror = () => {
      // The abort event owns rejection so the original transaction error is retained.
    };
  });
}

export function cloneAndValidateSnapshot(entries: DesktopItem[]) {
  if (entries.length > MAX_ENTRY_COUNT) {
    throw new VfsStorageError(`가상 파일은 최대 ${MAX_ENTRY_COUNT}개까지 저장할 수 있습니다.`);
  }

  const ids = new Set<string>();
  let contentBytes = 0;

  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) {
      throw new VfsStorageError("중복되거나 비어 있는 파일 ID가 있습니다.");
    }
    ids.add(entry.id);
    contentBytes += contentEncoder.encode(entry.content ?? "").length;
  }

  if (contentBytes > MAX_CONTENT_BYTES) {
    throw new VfsStorageError("가상 파일 내용이 저장 한도를 초과했습니다.");
  }

  return entries.map((entry) => ({ ...entry }));
}
