import { describe, expect, it } from "vitest";
import {
  ZIP_MAX_ENTRIES,
  createStoredZip,
  crc32,
  isSafeZipEntryName,
  readStoredZip,
  readStoredZipFile,
} from "./zip";

const bytesOf = (text: string) => new TextEncoder().encode(text);
const textOf = (data: Uint8Array) => new TextDecoder().decode(data);

describe("isSafeZipEntryName", () => {
  it("takes a relative path, with or without a directory marker", () => {
    expect(isSafeZipEntryName("메모.txt")).toBe(true);
    expect(isSafeZipEntryName("문서/메모.txt")).toBe(true);
    expect(isSafeZipEntryName("문서/")).toBe(true);
  });

  it("refuses a name that would write outside where it was extracted", () => {
    // A ZIP name is data. An unarchiver that trusts it writes where it says.
    expect(isSafeZipEntryName("../밖으로.txt")).toBe(false);
    expect(isSafeZipEntryName("문서/../../밖으로.txt")).toBe(false);
    expect(isSafeZipEntryName("/절대경로.txt")).toBe(false);
    expect(isSafeZipEntryName("C:/윈도우.txt")).toBe(false);
    expect(isSafeZipEntryName("문서\\메모.txt")).toBe(false);
    expect(isSafeZipEntryName("문서//메모.txt")).toBe(false);
    expect(isSafeZipEntryName("./메모.txt")).toBe(false);
    expect(isSafeZipEntryName("")).toBe(false);
    expect(isSafeZipEntryName("가".repeat(300))).toBe(false);
  });

  it("refuses control characters in a name", () => {
    expect(isSafeZipEntryName("메모\u0000.txt")).toBe(false);
    expect(isSafeZipEntryName("메모\n.txt")).toBe(false);
    expect(isSafeZipEntryName("메모\u007f.txt")).toBe(false);
  });
});

describe("createStoredZip and readStoredZip", () => {
  it("round-trips several entries, folders and UTF-8 names included", () => {
    const archive = createStoredZip([
      { data: new Uint8Array(), name: "문서/" },
      { data: bytesOf("장보기\n우유"), name: "문서/메모.txt" },
      { data: new Uint8Array([0, 1, 2, 253, 254, 255]), name: "그림.png" },
    ]);
    const read = readStoredZip(archive);
    expect(read.map((entry) => entry.name)).toEqual(["문서/", "문서/메모.txt", "그림.png"]);
    expect(read[0].data).toHaveLength(0);
    expect(textOf(read[1].data)).toBe("장보기\n우유");
    expect([...read[2].data]).toEqual([0, 1, 2, 253, 254, 255]);
  });

  it("writes a real central directory: one record per entry, both counts equal", () => {
    const archive = createStoredZip([
      { data: bytesOf("a"), name: "a.txt" },
      { data: bytesOf("b"), name: "b.txt" },
    ]);
    const view = new DataView(archive.buffer);
    // End-of-central-directory sits in the last 22 bytes of a comment-free ZIP.
    const end = archive.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 8, true)).toBe(2);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const directoryOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(directoryOffset, true)).toBe(0x02014b50);
    expect(view.getUint32(end + 12, true)).toBe(end - directoryOffset);
  });

  it("marks a directory entry with the attribute an unarchiver looks for", () => {
    const archive = createStoredZip([{ data: new Uint8Array(), name: "문서/" }]);
    const view = new DataView(archive.buffer);
    const end = archive.length - 22;
    const directoryOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(directoryOffset + 38, true)).toBe(0x10);
  });

  it("refuses an empty archive, a duplicate name and an unsafe name", () => {
    expect(() => createStoredZip([])).toThrow("압축할 항목이 없습니다");
    expect(() =>
      createStoredZip([
        { data: bytesOf("a"), name: "같은.txt" },
        { data: bytesOf("b"), name: "같은.txt" },
      ]),
    ).toThrow("이름이 겹칩니다");
    expect(() => createStoredZip([{ data: bytesOf("a"), name: "../밖.txt" }])).toThrow(
      "압축할 수 없는 이름입니다",
    );
  });

  it("refuses more entries than it will carry", () => {
    const many = Array.from({ length: ZIP_MAX_ENTRIES + 1 }, (_, index) => ({
      data: new Uint8Array(),
      name: `파일${index}.txt`,
    }));
    expect(() => createStoredZip(many)).toThrow(`최대 ${ZIP_MAX_ENTRIES}개`);
  });

  it("catches a flipped byte through the CRC, and names the entry", () => {
    const archive = createStoredZip([{ data: bytesOf("정확한 내용"), name: "메모.txt" }]);
    const dataOffset = 30 + new TextEncoder().encode("메모.txt").length;
    const tampered = archive.slice();
    tampered[dataOffset] ^= 0x20;
    expect(() => readStoredZip(tampered)).toThrow(/무결성 검사에 실패했습니다: 메모\.txt/);
  });

  it("refuses an archive that carries a path escaping its own folder", () => {
    // Written by hand, since createStoredZip will not produce one.
    const archive = createStoredZip([{ data: bytesOf("x"), name: "safe.txt" }]);
    const forged = archive.slice();
    // Same eight bytes of name, so every length and the CRC still agree — only
    // the path changed, which is exactly the attack.
    forged.set(new TextEncoder().encode("../a.txt"), 30);
    expect(() => readStoredZip(forged)).toThrow(/허용되지 않는 ZIP 항목 이름입니다/);
  });

  it("refuses what is not a stored ZIP", () => {
    expect(() => readStoredZip(bytesOf("이건 ZIP이 아닙니다"))).toThrow(
      "ZIP 항목을 찾지 못했습니다",
    );
    const archive = createStoredZip([{ data: bytesOf("x"), name: "a.txt" }]);
    const deflated = archive.slice();
    new DataView(deflated.buffer).setUint16(8, 8, true);
    expect(() => readStoredZip(deflated)).toThrow("압축된 ZIP은 지원하지 않습니다");
  });

  it("reads one named member, and says so when it is not there", () => {
    const archive = createStoredZip([
      { data: bytesOf("첫째"), name: "a.txt" },
      { data: bytesOf("둘째"), name: "b.txt" },
    ]);
    expect(textOf(readStoredZipFile(archive, "b.txt"))).toBe("둘째");
    expect(() => readStoredZipFile(archive, "c.txt")).toThrow("c.txt 파일을 찾지 못했습니다");
  });
});

describe("crc32", () => {
  it("matches the known value for the standard check string", () => {
    expect(crc32(bytesOf("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});
