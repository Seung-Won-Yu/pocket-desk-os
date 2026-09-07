import { describe, expect, it } from "vitest";
import {
  archiveFromDataUrl,
  archiveToDataUrl,
  createItemsFromArchive,
  buildArchiveEntries,
  createArchive,
  getArchiveName,
  isArchiveItem,
  readArchiveEntries,
} from "./archive";
import { createStoredZip } from "./zip";
import type { DesktopItem } from "../types";

function item(overrides: Partial<DesktopItem> & Pick<DesktopItem, "id" | "kind" | "name">) {
  const entry: DesktopItem = {
    createdAt: 1,
    parentId: "vfs-root",
    showOnDesktop: false,
    updatedAt: 1,
    x: 0,
    y: 0,
    ...overrides,
  };
  return entry;
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

/** 문서/ 폴더 하나에 메모와 그림, 그리고 그 아래 하위 폴더까지. */
const tree: DesktopItem[] = [
  item({ id: "folder", kind: "folder", name: "문서" }),
  item({
    content: "장보기\n우유",
    id: "note",
    kind: "note",
    name: "메모.txt",
    parentId: "folder",
  }),
  item({ content: PNG, id: "png", kind: "canvas", name: "그림.png", parentId: "folder" }),
  item({ id: "inner", kind: "folder", name: "하위", parentId: "folder" }),
  item({ content: "안쪽", id: "deep", kind: "note", name: "깊은.txt", parentId: "inner" }),
  item({ content: "바깥", id: "outside", kind: "note", name: "바깥.txt" }),
];

describe("buildArchiveEntries", () => {
  it("names members relative to what is being compressed, folders included", () => {
    expect(buildArchiveEntries(tree, ["folder"]).map((entry) => entry.name)).toEqual([
      "문서/",
      "문서/그림.png",
      "문서/메모.txt",
      "문서/하위/",
      "문서/하위/깊은.txt",
    ]);
  });

  it("compresses several chosen entries side by side", () => {
    expect(buildArchiveEntries(tree, ["outside", "inner"]).map((entry) => entry.name)).toEqual([
      "바깥.txt",
      "하위/",
      "하위/깊은.txt",
    ]);
  });

  it("leaves a trashed child out, and refuses a selection of nothing", () => {
    const withTrash = tree.map((entry) =>
      entry.id === "note" ? { ...entry, trashed: true } : entry,
    );
    expect(buildArchiveEntries(withTrash, ["folder"]).map((entry) => entry.name)).not.toContain(
      "문서/메모.txt",
    );
    expect(() => buildArchiveEntries(tree, ["missing"])).toThrow("압축할 항목이 없습니다");
  });

  it("puts a drawing's PNG bytes in, not its data URL text", () => {
    const entry = buildArchiveEntries(tree, ["png"])[0];
    // The PNG signature, so an unarchiver sees a picture.
    expect([...entry.data.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("readArchiveEntries", () => {
  it("round-trips a folder tree through a real archive", () => {
    const extracted = readArchiveEntries(createArchive(tree, ["folder"]));
    expect(extracted.map((entry) => [entry.path.join("/"), entry.kind])).toEqual([
      ["문서", "folder"],
      ["문서/그림.png", "canvas"],
      ["문서/메모.txt", "note"],
      ["문서/하위", "folder"],
      ["문서/하위/깊은.txt", "note"],
    ]);
    expect(extracted.find((entry) => entry.path.slice(-1)[0] === "메모.txt")?.content).toBe(
      "장보기\n우유",
    );
    expect(extracted.find((entry) => entry.path.slice(-1)[0] === "그림.png")?.content).toBe(
      PNG,
    );
  });

  it("creates the folders a member's path implies, even with no directory entry", () => {
    const archive = createStoredZip([
      { data: new TextEncoder().encode("깊이"), name: "a/b/c.txt" },
    ]);
    expect(
      readArchiveEntries(archive).map((entry) => [entry.path.join("/"), entry.kind]),
    ).toEqual([
      ["a", "folder"],
      ["a/b", "folder"],
      ["a/b/c.txt", "note"],
    ]);
  });

  it("names a file it cannot put back rather than writing it as something else", () => {
    const archive = createStoredZip([{ data: new Uint8Array([1, 2, 3]), name: "설치.exe" }]);
    expect(() => readArchiveEntries(archive)).toThrow("다룰 수 없는 파일이 있습니다: 설치.exe");
  });

  it("says so when a text member is not text", () => {
    const archive = createStoredZip([{ data: new Uint8Array([0xff, 0xfe]), name: "메모.txt" }]);
    expect(() => readArchiveEntries(archive)).toThrow("텍스트로 읽을 수 없습니다");
  });

  it("only makes a shortcut of a .url that points where a shortcut may point", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    const safe = readArchiveEntries(
      createStoredZip([{ data: encode("https://example.com/"), name: "링크.url" }]),
    );
    expect(safe[0]).toEqual({
      content: "https://example.com/",
      kind: "shortcut",
      path: ["링크.url"],
    });

    // Anything else stays the text it is; no shortcut is fabricated.
    const unsafe = readArchiveEntries(
      createStoredZip([{ data: encode("javascript:alert(1)"), name: "링크.url" }]),
    );
    expect(unsafe[0].kind).toBe("note");
    expect(unsafe[0].content).toBe("javascript:alert(1)");
  });
});

describe("archive naming and content", () => {
  it("names one item after itself and many after their folder", () => {
    expect(getArchiveName(tree, ["folder"], "바탕 화면")).toBe("문서.zip");
    expect(getArchiveName(tree, ["note"], "바탕 화면")).toBe("메모.zip");
    expect(getArchiveName(tree, ["note", "png"], "문서")).toBe("문서.zip");
  });

  it("recognises an archive entry by its extension", () => {
    expect(isArchiveItem(item({ id: "a", kind: "note", name: "묶음.zip" }))).toBe(true);
    expect(isArchiveItem(item({ id: "b", kind: "note", name: "메모.txt" }))).toBe(false);
    expect(isArchiveItem(item({ id: "c", kind: "folder", name: "zip" }))).toBe(false);
  });

  it("round-trips the archive's bytes through the string the model stores", () => {
    const bytes = createArchive(tree, ["outside"]);
    const restored = archiveFromDataUrl(archiveToDataUrl(bytes));
    expect([...restored]).toEqual([...bytes]);
    expect(() => archiveFromDataUrl("data:text/plain;base64,AAAA")).toThrow(
      "압축 파일 내용을 읽을 수 없습니다",
    );
  });
});

describe("createItemsFromArchive", () => {
  it("puts the archive's contents under one new folder, parents before children", () => {
    let next = 0;
    const items = createItemsFromArchive(readArchiveEntries(createArchive(tree, ["folder"])), {
      makeId: () => `id-${(next += 1)}`,
      now: 100,
      parentId: "vfs-root",
      rootName: "문서 압축 풀기",
    });
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const pathOf = (entry: DesktopItem): string => {
      const parent = byId.get(entry.parentId);
      return parent ? `${pathOf(parent)}/${entry.name}` : entry.name;
    };
    expect(items.map(pathOf)).toEqual([
      "문서 압축 풀기",
      "문서 압축 풀기/문서",
      "문서 압축 풀기/문서/그림.png",
      "문서 압축 풀기/문서/메모.txt",
      "문서 압축 풀기/문서/하위",
      "문서 압축 풀기/문서/하위/깊은.txt",
    ]);
    expect(items[0]).toMatchObject({ kind: "folder", parentId: "vfs-root" });
    expect(items.every((entry) => entry.showOnDesktop === false)).toBe(true);
    expect(items.every((entry) => entry.createdAt === 100)).toBe(true);
  });

  it("extracts into whichever folder it is told to", () => {
    const items = createItemsFromArchive(readArchiveEntries(createArchive(tree, ["outside"])), {
      makeId: () => crypto.randomUUID(),
      now: 1,
      parentId: "vfs-documents",
      rootName: "바깥",
    });
    expect(items[0].parentId).toBe("vfs-documents");
    expect(items[1]).toMatchObject({ content: "바깥", kind: "note", name: "바깥.txt" });
  });
});
