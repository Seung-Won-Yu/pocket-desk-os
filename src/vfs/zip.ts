/**
 * A ZIP archive of stored (uncompressed) entries.
 *
 * The backup export has written single-file ZIPs since 0.9; this is the same
 * format generalized to many entries, so Explorer can compress a selection and
 * read one back. Stored, not deflated: the shell has no compressor, and a ZIP
 * whose entries are stored is a real ZIP that Windows, macOS and every
 * unarchiver opens. The UI is honest about it — the archive is not smaller
 * than what went in, it is one file instead of many.
 */

/** One member of an archive. A name ending in "/" is a directory. */
export type ZipEntry = {
  data: Uint8Array;
  name: string;
};

/**
 * Members per archive, and total bytes. An archive ends up as one value in the
 * virtual file system's snapshot, so both are bounded before anything is built.
 */
export const ZIP_MAX_ENTRIES = 512;
export const ZIP_MAX_BYTES = 12 * 1024 * 1024;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
/** Bit 11: the file name is UTF-8, which every name here is. */
const UTF8_NAME_FLAG = 0x0800;
const DIRECTORY_ATTRIBUTES = 0x10;

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A path an archive may carry. A ZIP name is data, and an unarchiver that
 * trusts it writes wherever the name says — so absolute paths, drive letters,
 * `..` segments, backslashes and control characters are refused rather than
 * cleaned up, on the way in as well as on the way out.
 */
export function isSafeZipEntryName(name: string) {
  if (!name || name.length > 240) return false;
  if (name.startsWith("/") || name.includes("\\") || /^[a-zA-Z]:/.test(name)) return false;
  if (name.includes("//")) return false;
  // Control characters in a name are refused rather than stripped; a loop
  // rather than a regex, so the guard is readable and needs no escapes.
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return false;
  }
  // A trailing empty segment is the directory marker and is expected.
  const segments = name.split("/").filter((segment, index, all) => {
    return !(segment === "" && index === all.length - 1);
  });
  return (
    segments.length > 0 && segments.every((segment) => segment !== "." && segment !== "..")
  );
}

export function createStoredZip(entries: ZipEntry[]) {
  if (entries.length === 0) throw new Error("압축할 항목이 없습니다.");
  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new Error(`압축은 최대 ${ZIP_MAX_ENTRIES}개 항목까지 넣을 수 있습니다.`);
  }
  const names = new Set<string>();
  for (const entry of entries) {
    if (!isSafeZipEntryName(entry.name)) {
      throw new Error(`압축할 수 없는 이름입니다: ${entry.name}`);
    }
    if (names.has(entry.name)) throw new Error(`이름이 겹칩니다: ${entry.name}`);
    names.add(entry.name);
  }

  const encoder = new TextEncoder();
  const members = entries.map((entry) => ({
    crc: crc32(entry.data),
    data: entry.data,
    isDirectory: entry.name.endsWith("/"),
    nameBytes: encoder.encode(entry.name),
  }));
  const totalData = members.reduce((sum, member) => sum + member.data.length, 0);
  if (totalData > ZIP_MAX_BYTES) {
    throw new Error("압축할 내용이 너무 큽니다.");
  }

  const localSize = members.reduce(
    (sum, member) => sum + 30 + member.nameBytes.length + member.data.length,
    0,
  );
  const centralSize = members.reduce((sum, member) => sum + 46 + member.nameBytes.length, 0);
  const bytes = new Uint8Array(localSize + centralSize + 22);
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

  const localOffsets: number[] = [];
  for (const member of members) {
    localOffsets.push(offset);
    writeUint32(LOCAL_HEADER_SIGNATURE);
    writeUint16(20);
    writeUint16(UTF8_NAME_FLAG);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(member.crc);
    writeUint32(member.data.length);
    writeUint32(member.data.length);
    writeUint16(member.nameBytes.length);
    writeUint16(0);
    writeBytes(member.nameBytes);
    writeBytes(member.data);
  }

  const centralDirectoryOffset = offset;
  members.forEach((member, index) => {
    writeUint32(CENTRAL_HEADER_SIGNATURE);
    writeUint16(20);
    writeUint16(20);
    writeUint16(UTF8_NAME_FLAG);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(member.crc);
    writeUint32(member.data.length);
    writeUint32(member.data.length);
    writeUint16(member.nameBytes.length);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(member.isDirectory ? DIRECTORY_ATTRIBUTES : 0);
    writeUint32(localOffsets[index]);
    writeBytes(member.nameBytes);
  });
  const centralDirectorySize = offset - centralDirectoryOffset;

  writeUint32(END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(0);
  writeUint16(0);
  writeUint16(members.length);
  writeUint16(members.length);
  writeUint32(centralDirectorySize);
  writeUint32(centralDirectoryOffset);
  writeUint16(0);

  return bytes;
}

/** Every stored entry in an archive, in the order the archive lists them. */
export function readStoredZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== LOCAL_HEADER_SIGNATURE) break;

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const expectedCrc = view.getUint32(offset + 14, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameOffset = offset + 30;
    const dataOffset = nameOffset + nameLength + extraLength;
    const nextOffset = dataOffset + compressedSize;

    if (nameOffset + nameLength > bytes.length || dataOffset > bytes.length) {
      throw new Error("ZIP 파일 헤더가 손상되었습니다.");
    }
    if (flags & 0x0001) throw new Error("암호화된 ZIP은 지원하지 않습니다.");
    if (flags & 0x0008) throw new Error("데이터 디스크립터 ZIP은 지원하지 않습니다.");
    if (compressionMethod !== 0) {
      throw new Error("압축된 ZIP은 지원하지 않습니다. 저장 방식 ZIP만 읽습니다.");
    }
    if (compressedSize !== uncompressedSize) {
      throw new Error("ZIP 파일 크기 정보가 올바르지 않습니다.");
    }
    if (nextOffset > bytes.length) throw new Error("ZIP 파일이 손상되었습니다.");
    if (entries.length >= ZIP_MAX_ENTRIES) {
      throw new Error(`ZIP 항목이 ${ZIP_MAX_ENTRIES}개를 넘습니다.`);
    }

    let name: string;
    try {
      name = decoder.decode(bytes.slice(nameOffset, nameOffset + nameLength));
    } catch {
      throw new Error("ZIP 항목 이름을 읽을 수 없습니다.");
    }
    if (!isSafeZipEntryName(name)) {
      throw new Error(`허용되지 않는 ZIP 항목 이름입니다: ${name}`);
    }
    const data = bytes.slice(dataOffset, nextOffset);
    if (crc32(data) !== expectedCrc) {
      throw new Error(`ZIP 무결성 검사에 실패했습니다: ${name}`);
    }
    entries.push({ data, name });
    offset = nextOffset;
  }

  if (entries.length === 0) throw new Error("ZIP 항목을 찾지 못했습니다.");
  return entries;
}

/** One named member of an archive, for readers that want a single file. */
export function readStoredZipFile(bytes: Uint8Array, fileName: string) {
  const entry = readStoredZip(bytes).find((member) => member.name === fileName);
  if (!entry) throw new Error(`${fileName} 파일을 찾지 못했습니다.`);
  return entry.data;
}
