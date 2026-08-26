import { describe, expect, it, vi } from "vitest";
import type { DesktopItem, VfsEntryKind } from "../types";
import { createVfsBackupZip, readVfsBackupZip } from "./backup";

const BACKUP_FILE_NAME = "pocket-desk-vfs.json";
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

const ENTRY_KINDS: VfsEntryKind[] = ["folder", "note", "canvas", "shortcut", "game"];

function makeEntry(overrides: Partial<DesktopItem> & { id: string }): DesktopItem {
  return {
    createdAt: 1,
    kind: "note",
    name: overrides.id,
    parentId: "desktop",
    showOnDesktop: false,
    updatedAt: 1,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function isEntryKind(value: unknown): value is VfsEntryKind {
  return typeof value === "string" && ENTRY_KINDS.includes(value as VfsEntryKind);
}

/** A deliberately strict normalizer, mirroring what the app hands to the reader. */
function normalizeEntry(value: unknown, index: number): DesktopItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (typeof raw.name !== "string" || raw.name.length === 0) return null;
  if (!isEntryKind(raw.kind)) return null;

  const entry: DesktopItem = {
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : index,
    id: raw.id,
    kind: raw.kind,
    name: raw.name,
    parentId: typeof raw.parentId === "string" ? raw.parentId : "desktop",
    showOnDesktop: raw.showOnDesktop === true,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : index,
    x: typeof raw.x === "number" ? raw.x : 0,
    y: typeof raw.y === "number" ? raw.y : 0,
  };
  if (typeof raw.content === "string") entry.content = raw.content;
  return entry;
}

function toFile(bytes: Uint8Array, name = "backup.zip") {
  // Copy into a plain ArrayBuffer so the BlobPart type holds regardless of how the
  // incoming Uint8Array's buffer is parameterised.
  return new File([new Uint8Array(bytes).buffer], name, { type: "application/zip" });
}

/**
 * Independent table-driven CRC-32/ISO-HDLC reference, used as an oracle for the
 * bitwise implementation inside backup.ts. Validated against published vectors
 * in the "crc32 reference oracle" suite below.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32Reference(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type ZipEntryInput = {
  compressedSize?: number;
  compressionMethod?: number;
  crc?: number;
  data: Uint8Array;
  flags?: number;
  name: string;
  uncompressedSize?: number;
};

/** Minimal stored-ZIP writer used to craft inputs the production writer cannot produce. */
function buildZip(inputs: ZipEntryInput[]) {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const central: number[] = [];
  const pushUint16 = (target: number[], value: number) => {
    target.push(value & 0xff, (value >>> 8) & 0xff);
  };
  const pushUint32 = (target: number[], value: number) => {
    target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
  };

  for (const input of inputs) {
    const nameBytes = encoder.encode(input.name);
    const crc = input.crc ?? crc32Reference(input.data);
    const compressedSize = input.compressedSize ?? input.data.length;
    const uncompressedSize = input.uncompressedSize ?? input.data.length;
    const flags = input.flags ?? 0x0800;
    const method = input.compressionMethod ?? 0;
    const localOffset = local.length;

    pushUint32(local, LOCAL_HEADER_SIGNATURE);
    pushUint16(local, 20);
    pushUint16(local, flags);
    pushUint16(local, method);
    pushUint16(local, 0);
    pushUint16(local, 0);
    pushUint32(local, crc);
    pushUint32(local, compressedSize);
    pushUint32(local, uncompressedSize);
    pushUint16(local, nameBytes.length);
    pushUint16(local, 0);
    for (const byte of nameBytes) local.push(byte);
    for (const byte of input.data) local.push(byte);

    pushUint32(central, CENTRAL_HEADER_SIGNATURE);
    pushUint16(central, 20);
    pushUint16(central, 20);
    pushUint16(central, flags);
    pushUint16(central, method);
    pushUint16(central, 0);
    pushUint16(central, 0);
    pushUint32(central, crc);
    pushUint32(central, compressedSize);
    pushUint32(central, uncompressedSize);
    pushUint16(central, nameBytes.length);
    pushUint16(central, 0);
    pushUint16(central, 0);
    pushUint16(central, 0);
    pushUint16(central, 0);
    pushUint32(central, 0);
    pushUint32(central, localOffset);
    for (const byte of nameBytes) central.push(byte);
  }

  const tail: number[] = [];
  pushUint32(tail, EOCD_SIGNATURE);
  pushUint16(tail, 0);
  pushUint16(tail, 0);
  pushUint16(tail, inputs.length);
  pushUint16(tail, inputs.length);
  pushUint32(tail, central.length);
  pushUint32(tail, local.length);
  pushUint16(tail, 0);

  return new Uint8Array([...local, ...central, ...tail]);
}

/** Wraps arbitrary bytes as the backup JSON member of an otherwise valid ZIP. */
function zipWithPayload(payload: Uint8Array) {
  return buildZip([{ data: payload, name: BACKUP_FILE_NAME }]);
}

function zipWithJsonText(text: string) {
  return zipWithPayload(new TextEncoder().encode(text));
}

function zipWithBackupObject(backup: unknown) {
  return zipWithJsonText(JSON.stringify(backup));
}

function validBackup(entries: DesktopItem[]) {
  return {
    app: "PocketDesk OS",
    entries,
    exportedAt: "2024-05-01T00:00:00.000Z",
    version: 1,
  };
}

function patched(bytes: Uint8Array, write: (view: DataView) => void) {
  const copy = bytes.slice();
  write(new DataView(copy.buffer, copy.byteOffset, copy.byteLength));
  return copy;
}

type ParsedZip = {
  centralSignature: number;
  compressedSize: number;
  compressionMethod: number;
  crc: number;
  entryCount: number;
  eocdSignature: number;
  extraLength: number;
  fileName: string;
  flags: number;
  localSignature: number;
  payload: Uint8Array;
  totalEntryCount: number;
  uncompressedSize: number;
  versionNeeded: number;
};

function parseZip(bytes: Uint8Array): ParsedZip {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fileNameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataOffset = 30 + fileNameLength + extraLength;
  const compressedSize = view.getUint32(18, true);
  const centralOffset = dataOffset + compressedSize;
  const eocdOffset = centralOffset + 46 + fileNameLength;

  return {
    centralSignature: view.getUint32(centralOffset, true),
    compressedSize,
    compressionMethod: view.getUint16(8, true),
    crc: view.getUint32(14, true),
    entryCount: view.getUint16(eocdOffset + 8, true),
    eocdSignature: view.getUint32(eocdOffset, true),
    extraLength,
    fileName: new TextDecoder().decode(bytes.slice(30, 30 + fileNameLength)),
    flags: view.getUint16(6, true),
    localSignature: view.getUint32(0, true),
    payload: bytes.slice(dataOffset, centralOffset),
    totalEntryCount: view.getUint16(eocdOffset + 10, true),
    uncompressedSize: view.getUint32(22, true),
    versionNeeded: view.getUint16(4, true),
  };
}

/* -------------------------------------------------------------------------- */
/* oracle self-check                                                          */
/* -------------------------------------------------------------------------- */

describe("crc32 reference oracle", () => {
  it("matches published CRC-32/ISO-HDLC vectors", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(crc32Reference(encode(""))).toBe(0x00000000);
    expect(crc32Reference(encode("a"))).toBe(0xe8b7be43);
    expect(crc32Reference(encode("123456789"))).toBe(0xcbf43926);
    expect(crc32Reference(encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
});

/* -------------------------------------------------------------------------- */
/* createVfsBackupZip                                                         */
/* -------------------------------------------------------------------------- */

describe("createVfsBackupZip", () => {
  const entries = [
    makeEntry({ createdAt: 10, id: "folder-1", kind: "folder", name: "문서" }),
    makeEntry({ content: "안녕하세요", createdAt: 20, id: "note-1", name: "메모.txt" }),
  ];

  it("writes a single stored entry named after the backup JSON", () => {
    const parsed = parseZip(createVfsBackupZip(entries));

    expect(parsed.localSignature).toBe(LOCAL_HEADER_SIGNATURE);
    expect(parsed.centralSignature).toBe(CENTRAL_HEADER_SIGNATURE);
    expect(parsed.eocdSignature).toBe(EOCD_SIGNATURE);
    expect(parsed.entryCount).toBe(1);
    expect(parsed.totalEntryCount).toBe(1);
    expect(parsed.fileName).toBe(BACKUP_FILE_NAME);
    expect(parsed.versionNeeded).toBe(20);
    expect(parsed.extraLength).toBe(0);
  });

  it("stores the payload uncompressed and unencrypted with the UTF-8 name flag set", () => {
    const parsed = parseZip(createVfsBackupZip(entries));

    expect(parsed.compressionMethod).toBe(0);
    expect(parsed.flags & 0x0800).toBe(0x0800);
    expect(parsed.flags & 0x0001).toBe(0);
    expect(parsed.flags & 0x0008).toBe(0);
    expect(parsed.compressedSize).toBe(parsed.uncompressedSize);
    expect(parsed.compressedSize).toBe(parsed.payload.length);
  });

  it("writes a CRC that matches an independent CRC-32 implementation", () => {
    const parsed = parseZip(createVfsBackupZip(entries));
    expect(parsed.crc).toBe(crc32Reference(parsed.payload));
  });

  it("sizes the archive exactly for one stored entry", () => {
    const bytes = createVfsBackupZip(entries);
    const nameLength = new TextEncoder().encode(BACKUP_FILE_NAME).length;
    const parsed = parseZip(bytes);
    expect(bytes.length).toBe(30 + nameLength + parsed.payload.length + 46 + nameLength + 22);
  });

  it("stores a pretty-printed UTF-8 JSON envelope", () => {
    const parsed = parseZip(createVfsBackupZip(entries));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(parsed.payload);

    expect(text).toContain("\n");
    const envelope = JSON.parse(text) as Record<string, unknown>;
    expect(envelope.app).toBe("PocketDesk OS");
    expect(envelope.version).toBe(1);
    expect(envelope.entries).toEqual(entries);
    expect(typeof envelope.exportedAt).toBe("string");
    expect(new Date(String(envelope.exportedAt)).toISOString()).toBe(envelope.exportedAt);
  });

  it("round-trips multi-byte names and content byte for byte", () => {
    const tricky = [
      makeEntry({ content: "한글 \u{1F600} ✓", createdAt: 5, id: "note-2", name: "테스트 🙂.txt" }),
    ];
    const parsed = parseZip(createVfsBackupZip(tricky));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(parsed.payload);
    const envelope = JSON.parse(text) as { entries: DesktopItem[] };
    expect(envelope.entries[0].name).toBe("테스트 🙂.txt");
    expect(envelope.entries[0].content).toBe("한글 \u{1F600} ✓");
  });

  it("accepts an empty entry list", () => {
    const parsed = parseZip(createVfsBackupZip([]));
    const envelope = JSON.parse(new TextDecoder().decode(parsed.payload)) as { entries: unknown[] };
    expect(envelope.entries).toEqual([]);
  });

  it("exports up to 2000 entries and refuses more", () => {
    const build = (count: number) =>
      Array.from({ length: count }, (_unused, index) =>
        makeEntry({ createdAt: index, id: `note-${index}` }),
      );

    expect(() => createVfsBackupZip(build(2000))).not.toThrow();
    expect(() => createVfsBackupZip(build(2001))).toThrow(
      /백업은 최대 2000개 항목까지 내보낼 수 있습니다/,
    );
  });

  it("produces a fresh exportedAt on every call", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
      const first = parseZip(createVfsBackupZip(entries));
      vi.setSystemTime(new Date("2024-06-02T03:04:05.000Z"));
      const second = parseZip(createVfsBackupZip(entries));

      const read = (payload: Uint8Array) =>
        (JSON.parse(new TextDecoder().decode(payload)) as { exportedAt: string }).exportedAt;
      expect(read(first.payload)).toBe("2024-01-01T00:00:00.000Z");
      expect(read(second.payload)).toBe("2024-06-02T03:04:05.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* readVfsBackupZip - happy path                                              */
/* -------------------------------------------------------------------------- */

describe("readVfsBackupZip round trip", () => {
  it("reads back everything createVfsBackupZip wrote", async () => {
    const entries = [
      makeEntry({ createdAt: 10, id: "folder-1", kind: "folder", name: "문서" }),
      makeEntry({
        content: "본문",
        createdAt: 20,
        id: "note-1",
        name: "메모.txt",
        parentId: "folder-1",
        showOnDesktop: true,
        x: 40,
        y: 80,
      }),
      makeEntry({ createdAt: 30, id: "shortcut-1", kind: "shortcut", name: "링크.url" }),
    ];

    const restored = await readVfsBackupZip(toFile(createVfsBackupZip(entries)), normalizeEntry);
    expect(restored).toEqual(entries);
  });

  it("sorts restored entries by createdAt regardless of stored order", async () => {
    const bytes = zipWithBackupObject(
      validBackup([
        makeEntry({ createdAt: 300, id: "c" }),
        makeEntry({ createdAt: 100, id: "a" }),
        makeEntry({ createdAt: 200, id: "b" }),
      ]),
    );

    const restored = await readVfsBackupZip(toFile(bytes), normalizeEntry);
    expect(restored.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("drops entries the normalizer rejects and keeps the rest", async () => {
    const bytes = zipWithJsonText(
      JSON.stringify({
        app: "PocketDesk OS",
        entries: [
          { createdAt: 1, id: "ok-1", kind: "note", name: "좋음.txt" },
          { createdAt: 2, kind: "note", name: "아이디 없음" },
          "not an object",
          null,
          { createdAt: 3, id: "ok-2", kind: "unknown-kind", name: "종류 이상" },
          { createdAt: 4, id: "ok-3", kind: "folder", name: "폴더" },
        ],
        version: 1,
      }),
    );

    const restored = await readVfsBackupZip(toFile(bytes), normalizeEntry);
    expect(restored.map((entry) => entry.id)).toEqual(["ok-1", "ok-3"]);
  });

  it("passes each raw entry with its original array index to the normalizer", async () => {
    const spy = vi.fn(normalizeEntry);
    const bytes = zipWithJsonText(
      JSON.stringify({
        app: "PocketDesk OS",
        entries: [
          { id: "a", kind: "note", name: "a" },
          { id: "b", kind: "note", name: "b" },
        ],
        version: 1,
      }),
    );

    const restored = await readVfsBackupZip(toFile(bytes), spy);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map((call) => call[1])).toEqual([0, 1]);
    expect(spy.mock.calls[0][0]).toEqual({ id: "a", kind: "note", name: "a" });
    // The normalizer's index fallback is what ends up in the restored entry.
    expect(restored.map((entry) => entry.createdAt)).toEqual([0, 1]);
  });

  it("walks past unrelated archive members to find the backup JSON", async () => {
    const encoder = new TextEncoder();
    const backupJson = JSON.stringify(validBackup([makeEntry({ id: "note-1" })]));
    const bytes = buildZip([
      { data: encoder.encode("readme"), name: "README.txt" },
      { data: encoder.encode(backupJson), name: BACKUP_FILE_NAME },
    ]);

    const restored = await readVfsBackupZip(toFile(bytes), normalizeEntry);
    expect(restored.map((entry) => entry.id)).toEqual(["note-1"]);
  });
});

/* -------------------------------------------------------------------------- */
/* readVfsBackupZip - duplicate ids                                           */
/* -------------------------------------------------------------------------- */

describe("readVfsBackupZip duplicate id handling", () => {
  it("reassigns duplicate ids instead of dropping or merging entries", async () => {
    const bytes = zipWithBackupObject(
      validBackup([
        makeEntry({ createdAt: 1, id: "note-1", name: "첫째.txt" }),
        makeEntry({ createdAt: 2, id: "note-1", name: "둘째.txt" }),
        makeEntry({ createdAt: 3, id: "note-1", kind: "folder", name: "셋째" }),
      ]),
    );

    const restored = await readVfsBackupZip(toFile(bytes), normalizeEntry);

    expect(restored).toHaveLength(3);
    expect(restored.map((entry) => entry.name)).toEqual(["첫째.txt", "둘째.txt", "셋째"]);
    expect(new Set(restored.map((entry) => entry.id)).size).toBe(3);
    const uuidSuffix = /^note-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
    expect(restored[0].id).toBe("note-1");
    expect(restored[1].id).toMatch(uuidSuffix);
    // The regenerated id is prefixed with the entry's own kind, not the original id.
    expect(restored[2].id.startsWith("folder-")).toBe(true);
  });

  it("keeps non-id fields intact while regenerating an id", async () => {
    const bytes = zipWithBackupObject(
      validBackup([
        makeEntry({ createdAt: 1, id: "dupe", name: "a.txt" }),
        makeEntry({ content: "본문", createdAt: 2, id: "dupe", name: "b.txt", x: 7, y: 9 }),
      ]),
    );

    const restored = await readVfsBackupZip(toFile(bytes), normalizeEntry);
    expect(restored[1]).toMatchObject({ content: "본문", name: "b.txt", x: 7, y: 9 });
  });
});

/* -------------------------------------------------------------------------- */
/* readVfsBackupZip - file level validation                                   */
/* -------------------------------------------------------------------------- */

describe("readVfsBackupZip file size validation", () => {
  it("rejects an empty file", async () => {
    await expect(readVfsBackupZip(toFile(new Uint8Array(0)), normalizeEntry)).rejects.toThrow(
      /ZIP 백업 크기가 허용 범위를 벗어났습니다/,
    );
  });

  it("rejects a file larger than 20 MB", async () => {
    const tooBig = new Uint8Array(20 * 1024 * 1024 + 1);
    await expect(readVfsBackupZip(toFile(tooBig), normalizeEntry)).rejects.toThrow(
      /ZIP 백업 크기가 허용 범위를 벗어났습니다/,
    );
  });

  it("checks the size before reading any bytes", async () => {
    const spy = vi.fn(normalizeEntry);
    await expect(readVfsBackupZip(toFile(new Uint8Array(0)), spy)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* readVfsBackupZip - zip structure validation                                 */
/* -------------------------------------------------------------------------- */

describe("readVfsBackupZip zip structure validation", () => {
  const goodZip = () => createVfsBackupZip([makeEntry({ id: "note-1", name: "메모.txt" })]);

  it("rejects an encrypted entry (general purpose flag bit 0)", async () => {
    const bytes = patched(goodZip(), (view) => view.setUint16(6, 0x0801, true));
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /암호화된 ZIP은 지원하지 않습니다/,
    );
  });

  it("rejects a data descriptor entry (general purpose flag bit 3)", async () => {
    const bytes = patched(goodZip(), (view) => view.setUint16(6, 0x0808, true));
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /데이터 디스크립터 ZIP은 지원하지 않습니다/,
    );
  });

  it("rejects any compression method other than stored", async () => {
    for (const method of [8, 9, 14]) {
      const bytes = patched(goodZip(), (view) => view.setUint16(8, method, true));
      await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
        /PocketDesk에서 내보낸 ZIP만 가져올 수 있습니다/,
      );
    }
  });

  it("rejects mismatched compressed and uncompressed sizes", async () => {
    const bytes = patched(goodZip(), (view) =>
      view.setUint32(22, view.getUint32(22, true) + 1, true),
    );
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /ZIP 파일 크기 정보가 올바르지 않습니다/,
    );
  });

  it("rejects a payload whose CRC does not match", async () => {
    const bytes = patched(goodZip(), (view) =>
      view.setUint32(14, view.getUint32(14, true) ^ 0xffffffff, true),
    );
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /ZIP 백업 무결성 검사에 실패했습니다/,
    );
  });

  it("detects a single flipped payload byte through the CRC check", async () => {
    const bytes = goodZip();
    const parsed = parseZip(bytes);
    const dataOffset = 30 + new TextEncoder().encode(BACKUP_FILE_NAME).length;
    const tampered = bytes.slice();
    tampered[dataOffset + Math.floor(parsed.payload.length / 2)] ^= 0x20;

    await expect(readVfsBackupZip(toFile(tampered), normalizeEntry)).rejects.toThrow(
      /ZIP 백업 무결성 검사에 실패했습니다/,
    );
  });

  it("rejects a header that claims a longer name than the archive holds", async () => {
    const bytes = patched(goodZip(), (view) => view.setUint16(26, 60000, true));
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /ZIP 파일 헤더가 손상되었습니다/,
    );
  });

  it("rejects a truncated archive whose payload runs past the end", async () => {
    const bytes = goodZip();
    const dataOffset = 30 + new TextEncoder().encode(BACKUP_FILE_NAME).length;
    // Cut one byte short of the declared payload end.
    const truncated = bytes.slice(0, dataOffset + parseZip(bytes).payload.length - 1);
    await expect(readVfsBackupZip(toFile(truncated), normalizeEntry)).rejects.toThrow(
      /ZIP 파일이 손상되었습니다/,
    );
  });

  it("reports a missing backup member when the archive holds other files only", async () => {
    const bytes = buildZip([{ data: new TextEncoder().encode("hi"), name: "other.json" }]);
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /pocket-desk-vfs\.json 파일을 찾지 못했습니다/,
    );
  });

  it("reports a missing backup member for input that is not a ZIP at all", async () => {
    const bytes = new TextEncoder().encode("이건 그냥 텍스트 파일입니다. 절대 ZIP이 아닙니다.");
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /pocket-desk-vfs\.json 파일을 찾지 못했습니다/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* readVfsBackupZip - payload validation                                      */
/* -------------------------------------------------------------------------- */

describe("readVfsBackupZip payload validation", () => {
  it("rejects payload bytes that are not valid UTF-8", async () => {
    // 0xff is never a legal UTF-8 lead byte, so the fatal decoder must reject it.
    const payload = new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d]);
    await expect(readVfsBackupZip(toFile(zipWithPayload(payload)), normalizeEntry)).rejects.toThrow(
      /백업 JSON이 손상되었습니다/,
    );
  });

  it("rejects a truncated multi-byte UTF-8 sequence", async () => {
    // Leading two bytes of "한" (EC 95 9C) without its final continuation byte.
    const payload = new Uint8Array([0xec, 0x95]);
    await expect(readVfsBackupZip(toFile(zipWithPayload(payload)), normalizeEntry)).rejects.toThrow(
      /백업 JSON이 손상되었습니다/,
    );
  });

  it("rejects malformed JSON", async () => {
    for (const text of ["", "{", '{"app": ', "not json"]) {
      await expect(readVfsBackupZip(toFile(zipWithJsonText(text)), normalizeEntry)).rejects.toThrow(
        /백업 JSON이 손상되었습니다/,
      );
    }
  });

  it("rejects a JSON document that is not an object", async () => {
    for (const text of ["null", "123", '"hello"', "true"]) {
      await expect(readVfsBackupZip(toFile(zipWithJsonText(text)), normalizeEntry)).rejects.toThrow(
        /백업 JSON을 읽을 수 없습니다/,
      );
    }
  });

  it("rejects a foreign app name", async () => {
    const bytes = zipWithBackupObject({
      app: "SomeOtherDesk",
      entries: [makeEntry({ id: "note-1" })],
      version: 1,
    });
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /지원하지 않는 PocketDesk 백업 형식입니다/,
    );
  });

  it("rejects an unsupported format version, including a stringified one", async () => {
    for (const version of [0, 2, "1", null] as const) {
      const bytes = zipWithBackupObject({
        app: "PocketDesk OS",
        entries: [makeEntry({ id: "note-1" })],
        version,
      });
      await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
        /지원하지 않는 PocketDesk 백업 형식입니다/,
      );
    }
  });

  it("treats a bare JSON array as a wrong-format backup", async () => {
    await expect(readVfsBackupZip(toFile(zipWithJsonText("[]")), normalizeEntry)).rejects.toThrow(
      /지원하지 않는 PocketDesk 백업 형식입니다/,
    );
  });

  it("rejects a backup whose entries field is missing or not an array", async () => {
    const shapes: unknown[] = [undefined, null, {}, "entries", 5];
    for (const entries of shapes) {
      const bytes = zipWithBackupObject({ app: "PocketDesk OS", entries, version: 1 });
      await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
        /백업 안에 파일 목록이 없습니다/,
      );
    }
  });

  it("imports up to 2000 entries and refuses more", async () => {
    const build = (count: number) =>
      Array.from({ length: count }, (_unused, index) =>
        makeEntry({ createdAt: index, id: `note-${index}` }),
      );

    const atLimit = await readVfsBackupZip(
      toFile(zipWithBackupObject(validBackup(build(2000)))),
      normalizeEntry,
    );
    expect(atLimit).toHaveLength(2000);

    await expect(
      readVfsBackupZip(toFile(zipWithBackupObject(validBackup(build(2001)))), normalizeEntry),
    ).rejects.toThrow(/백업은 최대 2000개 항목까지 가져올 수 있습니다/);
  });

  it("checks the entry count before normalizing anything", async () => {
    const spy = vi.fn(normalizeEntry);
    const entries = Array.from({ length: 2001 }, (_unused, index) =>
      makeEntry({ createdAt: index, id: `note-${index}` }),
    );
    await expect(
      readVfsBackupZip(toFile(zipWithBackupObject(validBackup(entries))), spy),
    ).rejects.toThrow(/최대 2000개/);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a backup that yields no usable entries", async () => {
    await expect(
      readVfsBackupZip(toFile(zipWithBackupObject(validBackup([]))), normalizeEntry),
    ).rejects.toThrow(/가져올 수 있는 파일이 없습니다/);

    await expect(
      readVfsBackupZip(toFile(createVfsBackupZip([])), normalizeEntry),
    ).rejects.toThrow(/가져올 수 있는 파일이 없습니다/);

    const bytes = zipWithJsonText(
      JSON.stringify({ app: "PocketDesk OS", entries: [{ nope: true }, 7], version: 1 }),
    );
    await expect(readVfsBackupZip(toFile(bytes), normalizeEntry)).rejects.toThrow(
      /가져올 수 있는 파일이 없습니다/,
    );
  });
});
