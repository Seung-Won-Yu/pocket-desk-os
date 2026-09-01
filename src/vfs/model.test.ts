import { afterEach, describe, expect, it, vi } from "vitest";
import { appMetadata } from "../apps/metadata";
import type { DesktopItem } from "../types";
import {
  VFS_DOCUMENTS_ID,
  VFS_DOWNLOADS_ID,
  VFS_GAMES_ID,
  VFS_PICTURES_ID,
  VFS_ROOT_ID,
  VFS_SYSTEM_FOLDER_IDS,
  canMoveVfsEntries,
  createVfsEntryAssociation,
  createVfsSystemFolders,
  formatDesktopItemTime,
  getDefaultVfsEntryName,
  getUniqueCanvasItemName,
  getUniqueRenamedVfsItemName,
  getUniqueTextFileName,
  getUniqueVfsCopyName,
  getUniqueVfsEntryName,
  getVfsDescendantIds,
  getVfsEntryAssociation,
  getVfsEntryDetail,
  getVfsEntryExtension,
  getVfsEntryKindDefaultApp,
  getVfsFolder,
  getVfsFolderPath,
  getVfsNameParts,
  getVfsShortcutTarget,
  getVfsTopLevelIds,
  isVfsSystemFolderId,
  MAX_VFS_NAME_LENGTH,
  normalizeVfsEntryName,
  truncateVfsName,
} from "./model";

function makeItem(overrides: Partial<DesktopItem> & { id: string }): DesktopItem {
  return {
    createdAt: 0,
    kind: "note",
    name: overrides.id,
    parentId: VFS_ROOT_ID,
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function makeFolder(id: string, parentId: string, name = id): DesktopItem {
  return makeItem({ id, kind: "folder", name, parentId });
}

function makeNote(id: string, parentId: string, name = id): DesktopItem {
  return makeItem({ id, kind: "note", name, parentId });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("module constants", () => {
  it("pins the well-known ids the persistence layer relies on", () => {
    expect(VFS_ROOT_ID).toBe("desktop");
    expect(VFS_DOCUMENTS_ID).toBe("vfs-system-documents");
    expect(VFS_PICTURES_ID).toBe("vfs-system-pictures");
    expect(VFS_GAMES_ID).toBe("vfs-system-games");
    expect(VFS_DOWNLOADS_ID).toBe("vfs-system-downloads");
    expect([...VFS_SYSTEM_FOLDER_IDS]).toEqual([
      VFS_DOCUMENTS_ID,
      VFS_PICTURES_ID,
      VFS_GAMES_ID,
      VFS_DOWNLOADS_ID,
    ]);
  });
});

describe("isVfsSystemFolderId", () => {
  it("recognises every protected system folder", () => {
    for (const id of VFS_SYSTEM_FOLDER_IDS) {
      expect(isVfsSystemFolderId(id)).toBe(true);
    }
  });

  it("does not protect the desktop root or user folders", () => {
    expect(isVfsSystemFolderId(VFS_ROOT_ID)).toBe(false);
    expect(isVfsSystemFolderId("folder-1")).toBe(false);
    expect(isVfsSystemFolderId("")).toBe(false);
    expect(isVfsSystemFolderId("vfs-system-documents-2")).toBe(false);
  });
});

describe("createVfsSystemFolders", () => {
  it("seeds the default folders directly under the desktop", () => {
    const folders = createVfsSystemFolders(1_000_000);

    expect(folders.map((folder) => folder.id)).toEqual([
      VFS_DOCUMENTS_ID,
      VFS_PICTURES_ID,
      VFS_GAMES_ID,
      VFS_DOWNLOADS_ID,
    ]);
    expect(folders.map((folder) => folder.name)).toEqual(["문서", "사진", "게임", "다운로드"]);
    for (const folder of folders) {
      expect(folder.kind).toBe("folder");
      expect(folder.parentId).toBe(VFS_ROOT_ID);
      expect(folder.showOnDesktop).toBe(false);
      expect(folder.x).toBe(0);
      expect(folder.y).toBe(0);
      expect(folder.updatedAt).toBe(folder.createdAt);
    }
  });

  it("staggers createdAt so the folders keep a stable ascending order", () => {
    const folders = createVfsSystemFolders(1_000_000);
    expect(folders.map((folder) => folder.createdAt)).toEqual([
      990_000, 991_000, 992_000, 993_000,
    ]);
  });

  it("uses the current clock when no timestamp is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-01T00:00:00.000Z"));
    const [documents] = createVfsSystemFolders();
    expect(documents.createdAt).toBe(Date.now() - 10_000);
  });
});

describe("getUniqueTextFileName", () => {
  it("uses the plain base name when the documents folder is empty", () => {
    expect(getUniqueTextFileName([])).toBe("새 텍스트 문서.txt");
  });

  it("defaults to the documents folder when no parent is given", () => {
    const items = [makeNote("n1", VFS_DOCUMENTS_ID, "새 텍스트 문서.txt")];
    expect(getUniqueTextFileName(items)).toBe("새 텍스트 문서 (2).txt");
  });

  it("keeps counting past the first collision", () => {
    const items = [
      makeNote("n1", VFS_DOCUMENTS_ID, "새 텍스트 문서.txt"),
      makeNote("n2", VFS_DOCUMENTS_ID, "새 텍스트 문서 (2).txt"),
      makeNote("n3", VFS_DOCUMENTS_ID, "새 텍스트 문서 (3).txt"),
    ];
    expect(getUniqueTextFileName(items)).toBe("새 텍스트 문서 (4).txt");
  });

  it("ignores same-named files that live in another folder", () => {
    const items = [makeNote("n1", "folder-a", "새 텍스트 문서.txt")];
    expect(getUniqueTextFileName(items)).toBe("새 텍스트 문서.txt");
    expect(getUniqueTextFileName(items, "folder-a")).toBe("새 텍스트 문서 (2).txt");
  });

  it("ignores trashed files when checking for collisions", () => {
    const items = [
      makeItem({
        id: "n1",
        name: "새 텍스트 문서.txt",
        parentId: VFS_DOCUMENTS_ID,
        trashed: true,
      }),
    ];
    expect(getUniqueTextFileName(items)).toBe("새 텍스트 문서.txt");
  });
});

describe("getUniqueCanvasItemName", () => {
  it("starts numbering at 1 rather than reusing a bare base name", () => {
    expect(getUniqueCanvasItemName([])).toBe("그림 1.png");
  });

  it("defaults to the pictures folder and skips taken numbers", () => {
    const items = [
      makeItem({ id: "c1", kind: "canvas", name: "그림 1.png", parentId: VFS_PICTURES_ID }),
      makeItem({ id: "c2", kind: "canvas", name: "그림 2.png", parentId: VFS_PICTURES_ID }),
    ];
    expect(getUniqueCanvasItemName(items)).toBe("그림 3.png");
  });

  it("fills the lowest free number instead of appending to the end", () => {
    const items = [
      makeItem({ id: "c1", kind: "canvas", name: "그림 1.png", parentId: VFS_PICTURES_ID }),
      makeItem({ id: "c3", kind: "canvas", name: "그림 3.png", parentId: VFS_PICTURES_ID }),
    ];
    expect(getUniqueCanvasItemName(items)).toBe("그림 2.png");
  });

  it("scopes collisions to the requested parent and skips trashed items", () => {
    const items = [
      makeItem({ id: "c1", kind: "canvas", name: "그림 1.png", parentId: "folder-a" }),
      makeItem({
        id: "c2",
        kind: "canvas",
        name: "그림 1.png",
        parentId: VFS_PICTURES_ID,
        trashed: true,
      }),
    ];
    expect(getUniqueCanvasItemName(items)).toBe("그림 1.png");
    expect(getUniqueCanvasItemName(items, "folder-a")).toBe("그림 2.png");
  });
});

describe("getVfsNameParts", () => {
  it("splits on the last dot", () => {
    expect(getVfsNameParts("보고서.txt")).toEqual({ base: "보고서", extension: ".txt" });
    expect(getVfsNameParts("archive.tar.gz")).toEqual({
      base: "archive.tar",
      extension: ".gz",
    });
  });

  it("treats names without a usable dot as extensionless", () => {
    expect(getVfsNameParts("새 폴더")).toEqual({ base: "새 폴더", extension: "" });
    expect(getVfsNameParts("")).toEqual({ base: "", extension: "" });
  });

  it("keeps a leading dot as part of the base name", () => {
    expect(getVfsNameParts(".hidden")).toEqual({ base: ".hidden", extension: "" });
    expect(getVfsNameParts(".")).toEqual({ base: ".", extension: "" });
  });

  it("keeps a trailing dot as part of the base name", () => {
    expect(getVfsNameParts("file.")).toEqual({ base: "file.", extension: "" });
  });
});

describe("normalizeVfsEntryName", () => {
  it("trims and collapses whitespace runs", () => {
    expect(normalizeVfsEntryName("  새   폴더  ")).toBe("새 폴더");
    expect(normalizeVfsEntryName("a\t\nb")).toBe("a b");
  });

  it("truncates to 48 characters", () => {
    expect(normalizeVfsEntryName("x".repeat(60))).toBe("x".repeat(48));
    expect(normalizeVfsEntryName("x".repeat(48))).toHaveLength(48);
  });

  it("returns an empty string for whitespace-only names", () => {
    expect(normalizeVfsEntryName("   ")).toBe("");
  });
});

describe("getDefaultVfsEntryName", () => {
  it("maps every entry kind to its own default name", () => {
    expect(getDefaultVfsEntryName("folder")).toBe("새 폴더");
    expect(getDefaultVfsEntryName("canvas")).toBe("새 그림.canvas");
    expect(getDefaultVfsEntryName("game")).toBe("게임.game");
    expect(getDefaultVfsEntryName("shortcut")).toBe("바로 가기.url");
    expect(getDefaultVfsEntryName("note")).toBe("새 메모.txt");
  });
});

describe("getUniqueVfsCopyName", () => {
  it("appends the copy suffix before the extension", () => {
    expect(getUniqueVfsCopyName(new Set(), "보고서.txt")).toBe("보고서 - 복사본.txt");
  });

  it("numbers repeat copies starting at 2", () => {
    expect(getUniqueVfsCopyName(new Set(["보고서 - 복사본.txt"]), "보고서.txt")).toBe(
      "보고서 - 복사본 (2).txt",
    );
    expect(
      getUniqueVfsCopyName(
        new Set(["보고서 - 복사본.txt", "보고서 - 복사본 (2).txt"]),
        "보고서.txt",
      ),
    ).toBe("보고서 - 복사본 (3).txt");
  });

  it("handles extensionless names such as folders", () => {
    expect(getUniqueVfsCopyName(new Set(), "새 폴더")).toBe("새 폴더 - 복사본");
    expect(getUniqueVfsCopyName(new Set(["새 폴더 - 복사본"]), "새 폴더")).toBe(
      "새 폴더 - 복사본 (2)",
    );
  });

  it("keeps only the final extension segment", () => {
    expect(getUniqueVfsCopyName(new Set(), "archive.tar.gz")).toBe("archive.tar - 복사본.gz");
  });

  it("treats a dotfile as extensionless", () => {
    expect(getUniqueVfsCopyName(new Set(), ".hidden")).toBe(".hidden - 복사본");
  });

  it("is unaffected by names that only collide in a different folder", () => {
    expect(getUniqueVfsCopyName(new Set(["다른.txt"]), "보고서.txt")).toBe(
      "보고서 - 복사본.txt",
    );
  });
});

describe("getUniqueVfsEntryName", () => {
  it("returns the requested name when the folder has no conflict", () => {
    expect(getUniqueVfsEntryName([], "folder-a", "메모.txt")).toBe("메모.txt");
  });

  it("suffixes a parenthesised counter on conflict", () => {
    const items = [makeNote("n1", "folder-a", "메모.txt")];
    expect(getUniqueVfsEntryName(items, "folder-a", "메모.txt")).toBe("메모 (2).txt");
  });

  it("keeps counting until it finds a free slot", () => {
    const items = [
      makeNote("n1", "folder-a", "메모.txt"),
      makeNote("n2", "folder-a", "메모 (2).txt"),
    ];
    expect(getUniqueVfsEntryName(items, "folder-a", "메모.txt")).toBe("메모 (3).txt");
  });

  it("scopes conflicts to the target folder", () => {
    const items = [makeNote("n1", "folder-b", "메모.txt")];
    expect(getUniqueVfsEntryName(items, "folder-a", "메모.txt")).toBe("메모.txt");
  });

  it("ignores trashed siblings", () => {
    const items = [
      makeItem({ id: "n1", name: "메모.txt", parentId: "folder-a", trashed: true }),
    ];
    expect(getUniqueVfsEntryName(items, "folder-a", "메모.txt")).toBe("메모.txt");
  });

  it("truncates the deduplicated name to 48 characters", () => {
    const longName = `${"가".repeat(50)}.txt`;
    const items = [makeNote("n1", "folder-a", longName)];
    const result = getUniqueVfsEntryName(items, "folder-a", longName);
    expect(result).toHaveLength(48);
    expect(result).toBe("가".repeat(48));
  });

  it("caps an over-long name even when nothing conflicts", () => {
    const longName = `${"가".repeat(50)}.txt`;
    const result = getUniqueVfsEntryName([], "folder-a", longName);
    expect(result).toHaveLength(48);
    expect(result).toBe("가".repeat(48));
  });
});

describe("getUniqueRenamedVfsItemName", () => {
  const items = [
    makeFolder("folder-a", VFS_ROOT_ID, "작업"),
    makeNote("n1", "folder-a", "메모.txt"),
    makeNote("n2", "folder-a", "다른.txt"),
    makeNote("root-note", VFS_ROOT_ID, "루트.txt"),
  ];

  it("normalizes the requested name", () => {
    expect(getUniqueRenamedVfsItemName(items, "n1", "  새   이름.txt ")).toBe("새 이름.txt");
  });

  it("returns the item's own name when renaming to itself", () => {
    expect(getUniqueRenamedVfsItemName(items, "n1", "메모.txt")).toBe("메모.txt");
  });

  it("falls back to the current name when the request normalizes to empty", () => {
    expect(getUniqueRenamedVfsItemName(items, "n1", "   ")).toBe("메모.txt");
    expect(getUniqueRenamedVfsItemName(items, "n1", "")).toBe("메모.txt");
  });

  it("deduplicates with a space-separated counter, not parentheses", () => {
    expect(getUniqueRenamedVfsItemName(items, "n1", "다른.txt")).toBe("다른 2.txt");
  });

  it("keeps counting while renamed candidates stay taken", () => {
    const crowded = [
      ...items,
      makeNote("n3", "folder-a", "다른 2.txt"),
      makeNote("n4", "folder-a", "다른 3.txt"),
    ];
    expect(getUniqueRenamedVfsItemName(crowded, "n1", "다른.txt")).toBe("다른 4.txt");
  });

  it("only considers siblings in the same folder", () => {
    expect(getUniqueRenamedVfsItemName(items, "n1", "루트.txt")).toBe("루트.txt");
    expect(getUniqueRenamedVfsItemName(items, "root-note", "작업")).toBe("작업 2");
  });

  it("ignores trashed siblings", () => {
    const withTrash = [
      ...items,
      makeItem({ id: "n5", name: "휴지.txt", parentId: "folder-a", trashed: true }),
    ];
    expect(getUniqueRenamedVfsItemName(withTrash, "n1", "휴지.txt")).toBe("휴지.txt");
  });

  it("falls back to 'untitled' and the desktop root for an unknown item id", () => {
    expect(getUniqueRenamedVfsItemName(items, "missing", "  ")).toBe("untitled");
    expect(getUniqueRenamedVfsItemName(items, "missing", "루트.txt")).toBe("루트 2.txt");
  });

  it("shortens the base, not the extension, to fit the counter inside 48 characters", () => {
    const longName = `${"가".repeat(44)}.txt`;
    expect(longName).toHaveLength(48);
    const crowded = [...items, makeNote("n6", "folder-a", longName)];
    const result = getUniqueRenamedVfsItemName(crowded, "n1", longName);
    expect(result).toHaveLength(48);
    expect(result).toBe(`${"가".repeat(42)} 2.txt`);
  });
});

describe("getVfsEntryExtension", () => {
  it("takes the extension from the file name, lowercased", () => {
    expect(getVfsEntryExtension(makeItem({ id: "n1", name: "README.MD" }))).toBe("md");
    expect(getVfsEntryExtension(makeItem({ id: "n1", name: "보고서.TxT" }))).toBe("txt");
  });

  it("falls back to a per-kind extension when the name has none", () => {
    expect(getVfsEntryExtension(makeItem({ id: "f", kind: "folder", name: "문서" }))).toBe(
      "folder",
    );
    expect(getVfsEntryExtension(makeItem({ id: "c", kind: "canvas", name: "그림" }))).toBe(
      "canvas",
    );
    expect(getVfsEntryExtension(makeItem({ id: "g", kind: "game", name: "게임" }))).toBe(
      "game",
    );
    expect(getVfsEntryExtension(makeItem({ id: "s", kind: "shortcut", name: "링크" }))).toBe(
      "url",
    );
    expect(getVfsEntryExtension(makeItem({ id: "n", kind: "note", name: "메모" }))).toBe("txt");
  });

  it("prefers the name extension over the kind fallback", () => {
    expect(getVfsEntryExtension(makeItem({ id: "c", kind: "canvas", name: "그림.png" }))).toBe(
      "png",
    );
    expect(getVfsEntryExtension(makeItem({ id: "n", kind: "note", name: "노트.md" }))).toBe(
      "md",
    );
  });

  it("ignores a dotfile-style leading dot", () => {
    expect(getVfsEntryExtension(makeItem({ id: "n", kind: "note", name: ".gitignore" }))).toBe(
      "txt",
    );
  });
});

describe("getVfsEntryAssociation", () => {
  it("labels folders as file folders owned by the explorer", () => {
    const association = getVfsEntryAssociation(
      makeItem({ id: "f", kind: "folder", name: "문서" }),
    );
    expect(association.appId).toBe("files");
    expect(association.typeLabel).toBe("파일 폴더");
    expect(association.extension).toBe("folder");
    expect(association.appTitle).toBe("파일 탐색기");
    expect(association.accent).toBe(appMetadata.files.accent);
    expect(association.icon).toBe(appMetadata.files.icon);
  });

  it("treats the folder kind as a folder even when the name looks like a file", () => {
    const association = getVfsEntryAssociation(
      makeItem({ id: "f", kind: "folder", name: "폴더.txt" }),
    );
    expect(association.typeLabel).toBe("파일 폴더");
    expect(association.extension).toBe("folder");
  });

  it("maps text documents to notepad", () => {
    const association = getVfsEntryAssociation(makeItem({ id: "n", name: "메모.txt" }));
    expect(association.appId).toBe("notepad");
    expect(association.appTitle).toBe("메모장");
    expect(association.typeLabel).toBe("텍스트 문서");
    expect(association.extension).toBe("txt");
  });

  it("maps both markdown extensions to notepad with the markdown label", () => {
    for (const name of ["노트.md", "노트.markdown"]) {
      const association = getVfsEntryAssociation(makeItem({ id: "n", name }));
      expect(association.appId).toBe("notepad");
      expect(association.typeLabel).toBe("Markdown 문서");
    }
    expect(getVfsEntryAssociation(makeItem({ id: "n", name: "노트.markdown" })).extension).toBe(
      "markdown",
    );
  });

  it("opens a png in the viewer and a bare canvas in the editor", () => {
    const png = getVfsEntryAssociation(makeItem({ id: "c", kind: "canvas", name: "그림.png" }));
    expect(png.appId).toBe("photos");
    expect(png.typeLabel).toBe("PNG 이미지");

    const canvas = getVfsEntryAssociation(makeItem({ id: "c", kind: "canvas", name: "그림" }));
    expect(canvas.appId).toBe("paint");
    expect(canvas.typeLabel).toBe("캔버스 이미지");
    expect(canvas.extension).toBe("canvas");
  });

  it("maps url shortcuts to the browser", () => {
    const association = getVfsEntryAssociation(
      makeItem({ id: "s", kind: "shortcut", name: "바로 가기.url" }),
    );
    expect(association.appId).toBe("browser");
    expect(association.appTitle).toBe("Microsoft Edge");
    expect(association.typeLabel).toBe("인터넷 바로 가기");
  });

  it("routes game files to their own app, defaulting to minesweeper", () => {
    const defaulted = getVfsEntryAssociation(
      makeItem({ id: "g", kind: "game", name: "게임.game" }),
    );
    expect(defaulted.appId).toBe("minesweeper");
    expect(defaulted.typeLabel).toBe("게임 파일");

    const explicit = getVfsEntryAssociation(
      makeItem({ appId: "calculator", id: "g", kind: "game", name: "게임.game" }),
    );
    expect(explicit.appId).toBe("calculator");
    expect(explicit.appTitle).toBe("계산기");
    expect(explicit.typeLabel).toBe("게임 파일");
  });

  it("builds a generic upper-cased label for unknown extensions", () => {
    const association = getVfsEntryAssociation(makeItem({ id: "n", name: "설명서.pdf" }));
    expect(association.typeLabel).toBe("PDF 파일");
    expect(association.extension).toBe("pdf");
    expect(association.appId).toBe("notepad");
  });

  it("falls back to the kind's default app for unknown extensions", () => {
    expect(
      getVfsEntryAssociation(makeItem({ id: "s", kind: "shortcut", name: "링크.lnk" })).appId,
    ).toBe("browser");
    expect(
      getVfsEntryAssociation(makeItem({ appId: "settings", id: "n", name: "설정.cfg" })).appId,
    ).toBe("settings");
  });
});

describe("createVfsEntryAssociation", () => {
  it("copies accent, title and icon straight from the app metadata", () => {
    const association = createVfsEntryAssociation("paint", "psd", "포토샵 문서");
    expect(association).toEqual({
      accent: appMetadata.paint.accent,
      appId: "paint",
      appTitle: appMetadata.paint.title,
      extension: "psd",
      icon: appMetadata.paint.icon,
      typeLabel: "포토샵 문서",
    });
  });
});

describe("getVfsEntryKindDefaultApp", () => {
  it("prefers an explicitly stored appId", () => {
    expect(
      getVfsEntryKindDefaultApp(makeItem({ appId: "calculator", id: "n", kind: "folder" })),
    ).toBe("calculator");
  });

  it("maps each kind to its owning app", () => {
    expect(getVfsEntryKindDefaultApp(makeItem({ id: "f", kind: "folder" }))).toBe("files");
    expect(getVfsEntryKindDefaultApp(makeItem({ id: "c", kind: "canvas" }))).toBe("paint");
    expect(getVfsEntryKindDefaultApp(makeItem({ id: "g", kind: "game" }))).toBe("minesweeper");
    expect(getVfsEntryKindDefaultApp(makeItem({ id: "s", kind: "shortcut" }))).toBe("browser");
    expect(getVfsEntryKindDefaultApp(makeItem({ id: "n", kind: "note" }))).toBe("notepad");
  });
});

describe("getVfsShortcutTarget", () => {
  it("returns the trimmed stored url", () => {
    expect(
      getVfsShortcutTarget(makeItem({ content: "  https://example.dev/docs  ", id: "s" })),
    ).toBe("https://example.dev/docs");
  });

  it("falls back to a placeholder when no url is stored", () => {
    expect(getVfsShortcutTarget(makeItem({ id: "s" }))).toBe("https://example.com");
    expect(getVfsShortcutTarget(makeItem({ content: "", id: "s" }))).toBe(
      "https://example.com",
    );
    expect(getVfsShortcutTarget(makeItem({ content: "   \n ", id: "s" }))).toBe(
      "https://example.com",
    );
  });
});

describe("getVfsEntryDetail", () => {
  it("describes folders generically", () => {
    expect(getVfsEntryDetail(makeItem({ id: "f", kind: "folder", name: "문서" }))).toBe(
      "파일과 하위 폴더를 보관하는 폴더입니다.",
    );
  });

  it("previews note content, trimmed", () => {
    expect(getVfsEntryDetail(makeItem({ content: "  안녕  ", id: "n", kind: "note" }))).toBe(
      "안녕",
    );
  });

  it("explains that a note is empty when it has no usable content", () => {
    expect(getVfsEntryDetail(makeItem({ id: "n", kind: "note" }))).toBe(
      "저장된 메모 내용이 없습니다.",
    );
    expect(getVfsEntryDetail(makeItem({ content: "   ", id: "n", kind: "note" }))).toBe(
      "저장된 메모 내용이 없습니다.",
    );
  });

  it("distinguishes a saved canvas from an empty one", () => {
    expect(
      getVfsEntryDetail(
        makeItem({ content: "data:image/png;base64,AAA", id: "c", kind: "canvas" }),
      ),
    ).toBe("저장된 PNG 그림입니다. 그림판에서 다시 열 수 있습니다.");
    expect(getVfsEntryDetail(makeItem({ id: "c", kind: "canvas" }))).toBe(
      "그림판에서 새 그림을 그릴 수 있습니다.",
    );
    expect(getVfsEntryDetail(makeItem({ content: "", id: "c", kind: "canvas" }))).toBe(
      "그림판에서 새 그림을 그릴 수 있습니다.",
    );
  });

  it("names the launching app for game files", () => {
    expect(getVfsEntryDetail(makeItem({ id: "g", kind: "game", name: "게임.game" }))).toBe(
      "지뢰찾기로 실행되는 게임 파일입니다.",
    );
    expect(
      getVfsEntryDetail(
        makeItem({ appId: "calculator", id: "g", kind: "game", name: "게임.game" }),
      ),
    ).toBe("계산기로 실행되는 게임 파일입니다.");
  });

  it("names the browser and target url for shortcuts", () => {
    expect(
      getVfsEntryDetail(
        makeItem({
          content: "https://example.dev",
          id: "s",
          kind: "shortcut",
          name: "바로 가기.url",
        }),
      ),
    ).toBe("Microsoft Edge에서 https://example.dev 주소를 엽니다.");
    expect(
      getVfsEntryDetail(makeItem({ id: "s", kind: "shortcut", name: "바로 가기.url" })),
    ).toBe("Microsoft Edge에서 https://example.com 주소를 엽니다.");
  });
});

describe("formatDesktopItemTime", () => {
  function freezeClock() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-05-01T12:00:00.000Z"));
    return Date.now();
  }

  it("reports sub-minute ages as 'just now'", () => {
    const now = freezeClock();
    expect(formatDesktopItemTime(now)).toBe("방금 전");
    expect(formatDesktopItemTime(now - 29_000)).toBe("방금 전");
  });

  it("reports minute ages, rounding to the nearest minute", () => {
    const now = freezeClock();
    expect(formatDesktopItemTime(now - 30_000)).toBe("1분 전");
    expect(formatDesktopItemTime(now - 5 * 60_000)).toBe("5분 전");
    expect(formatDesktopItemTime(now - 59 * 60_000)).toBe("59분 전");
  });

  it("collapses anything an hour old or older to 'today'", () => {
    const now = freezeClock();
    expect(formatDesktopItemTime(now - 60 * 60_000)).toBe("오늘");
    expect(formatDesktopItemTime(now - 40 * 24 * 60 * 60_000)).toBe("오늘");
  });

  it("clamps future timestamps to 'just now'", () => {
    const now = freezeClock();
    expect(formatDesktopItemTime(now + 10 * 60_000)).toBe("방금 전");
  });
});

describe("getVfsFolder", () => {
  const items = [
    makeFolder("folder-a", VFS_ROOT_ID),
    makeNote("note-a", VFS_ROOT_ID),
    makeItem({ id: "folder-trashed", kind: "folder", parentId: VFS_ROOT_ID, trashed: true }),
  ];

  it("returns null for the desktop root, which is not a stored item", () => {
    expect(getVfsFolder(items, VFS_ROOT_ID)).toBeNull();
  });

  it("returns the matching folder", () => {
    expect(getVfsFolder(items, "folder-a")?.id).toBe("folder-a");
  });

  it("refuses non-folders, trashed folders and unknown ids", () => {
    expect(getVfsFolder(items, "note-a")).toBeUndefined();
    expect(getVfsFolder(items, "folder-trashed")).toBeUndefined();
    expect(getVfsFolder(items, "nope")).toBeUndefined();
  });
});

describe("getVfsFolderPath", () => {
  const items = [
    makeFolder("a", VFS_ROOT_ID, "문서"),
    makeFolder("b", "a", "2024"),
    makeFolder("c", "b", "1월"),
    makeNote("note", "a"),
    makeItem({ id: "trashed", kind: "folder", name: "삭제됨", parentId: "a", trashed: true }),
  ];

  it("returns just the desktop segment for the root", () => {
    expect(getVfsFolderPath(items, VFS_ROOT_ID)).toEqual([
      { id: VFS_ROOT_ID, name: "바탕 화면" },
    ]);
  });

  it("builds the full chain from the desktop down to the folder", () => {
    expect(getVfsFolderPath(items, "c")).toEqual([
      { id: VFS_ROOT_ID, name: "바탕 화면" },
      { id: "a", name: "문서" },
      { id: "b", name: "2024" },
      { id: "c", name: "1월" },
    ]);
  });

  it("falls back to the desktop when the chain cannot be resolved", () => {
    expect(getVfsFolderPath(items, "missing")).toEqual([
      { id: VFS_ROOT_ID, name: "바탕 화면" },
    ]);
    expect(getVfsFolderPath(items, "note")).toEqual([{ id: VFS_ROOT_ID, name: "바탕 화면" }]);
    expect(getVfsFolderPath(items, "trashed")).toEqual([
      { id: VFS_ROOT_ID, name: "바탕 화면" },
    ]);
  });

  it("does not loop forever on a cyclic parent chain", () => {
    const cyclic = [makeFolder("x", "y"), makeFolder("y", "x")];
    expect(getVfsFolderPath(cyclic, "x")).toEqual([{ id: VFS_ROOT_ID, name: "바탕 화면" }]);
  });

  it("does not loop forever on a self-parenting folder", () => {
    const selfParent = [makeFolder("x", "x")];
    expect(getVfsFolderPath(selfParent, "x")).toEqual([{ id: VFS_ROOT_ID, name: "바탕 화면" }]);
  });
});

describe("getVfsDescendantIds", () => {
  const items = [
    makeFolder("a", VFS_ROOT_ID),
    makeFolder("a1", "a"),
    makeNote("a1-note", "a1"),
    makeNote("a-note", "a"),
    makeFolder("b", VFS_ROOT_ID),
    makeNote("b-note", "b"),
  ];

  it("includes the roots themselves", () => {
    expect([...getVfsDescendantIds(items, ["a-note"])]).toEqual(["a-note"]);
  });

  it("collects the whole subtree, not just direct children", () => {
    expect(getVfsDescendantIds(items, ["a"])).toEqual(
      new Set(["a", "a1", "a1-note", "a-note"]),
    );
  });

  it("collects several subtrees at once and excludes unrelated items", () => {
    const result = getVfsDescendantIds(items, ["a1", "b"]);
    expect(result).toEqual(new Set(["a1", "a1-note", "b", "b-note"]));
    expect(result.has("a")).toBe(false);
    expect(result.has("a-note")).toBe(false);
  });

  it("returns an empty set for no roots", () => {
    expect(getVfsDescendantIds(items, []).size).toBe(0);
  });

  it("keeps unknown root ids in the result without inventing children", () => {
    expect(getVfsDescendantIds(items, ["ghost"])).toEqual(new Set(["ghost"]));
  });

  it("terminates on cyclic parent relationships", () => {
    const cyclic = [makeFolder("x", "y"), makeFolder("y", "x")];
    expect(getVfsDescendantIds(cyclic, ["x"])).toEqual(new Set(["x", "y"]));
  });
});

describe("getVfsTopLevelIds", () => {
  const items = [
    makeFolder("a", VFS_ROOT_ID),
    makeFolder("a1", "a"),
    makeNote("a1-note", "a1"),
    makeFolder("b", VFS_ROOT_ID),
    makeNote("b-note", "b"),
  ];

  it("keeps unrelated selections as-is and preserves input order", () => {
    expect(getVfsTopLevelIds(items, ["b", "a"])).toEqual(["b", "a"]);
  });

  it("drops a child whose parent is also selected", () => {
    expect(getVfsTopLevelIds(items, ["a", "a1"])).toEqual(["a"]);
    expect(getVfsTopLevelIds(items, ["a1", "a"])).toEqual(["a"]);
  });

  it("drops a deep descendant whose ancestor is selected", () => {
    expect(getVfsTopLevelIds(items, ["a", "a1-note"])).toEqual(["a"]);
    expect(getVfsTopLevelIds(items, ["a", "a1", "a1-note", "b"])).toEqual(["a", "b"]);
  });

  it("keeps an intermediate folder when only its own child is also selected", () => {
    expect(getVfsTopLevelIds(items, ["a1", "a1-note"])).toEqual(["a1"]);
  });

  it("removes duplicate ids, keeping the first occurrence", () => {
    expect(getVfsTopLevelIds(items, ["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("keeps ids that are not present in the item list", () => {
    expect(getVfsTopLevelIds(items, ["ghost"])).toEqual(["ghost"]);
  });

  it("returns an empty list for an empty selection", () => {
    expect(getVfsTopLevelIds(items, [])).toEqual([]);
  });

  it("terminates on a cyclic parent chain", () => {
    const cyclic = [makeFolder("x", "y"), makeFolder("y", "x")];
    expect(getVfsTopLevelIds(cyclic, ["x"])).toEqual([]);
    expect(getVfsTopLevelIds(cyclic, ["x", "y"])).toEqual([]);
  });
});

describe("canMoveVfsEntries", () => {
  const items = [
    ...createVfsSystemFolders(1_000_000),
    makeFolder("a", VFS_ROOT_ID),
    makeFolder("a1", "a"),
    makeFolder("a1x", "a1"),
    makeFolder("b", VFS_ROOT_ID),
    makeNote("note", VFS_ROOT_ID),
    makeNote("doc-note", VFS_DOCUMENTS_ID),
    makeItem({ id: "trashed-folder", kind: "folder", parentId: VFS_ROOT_ID, trashed: true }),
  ];

  it("allows moving into another folder or back to the desktop", () => {
    expect(canMoveVfsEntries(items, ["note"], "a")).toBe(true);
    expect(canMoveVfsEntries(items, ["doc-note"], VFS_ROOT_ID)).toBe(true);
    expect(canMoveVfsEntries(items, ["a"], "b")).toBe(true);
  });

  it("allows a no-op move into the current parent", () => {
    expect(canMoveVfsEntries(items, ["doc-note"], VFS_DOCUMENTS_ID)).toBe(true);
  });

  it("allows moving into a system folder", () => {
    expect(canMoveVfsEntries(items, ["note"], VFS_DOCUMENTS_ID)).toBe(true);
  });

  it("rejects targets that are not usable folders", () => {
    expect(canMoveVfsEntries(items, ["a"], "note")).toBe(false);
    expect(canMoveVfsEntries(items, ["a"], "trashed-folder")).toBe(false);
    expect(canMoveVfsEntries(items, ["a"], "missing")).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(canMoveVfsEntries(items, [], "a")).toBe(false);
  });

  it("protects the system folders from being moved", () => {
    for (const id of VFS_SYSTEM_FOLDER_IDS) {
      expect(canMoveVfsEntries(items, [id], "a")).toBe(false);
      expect(canMoveVfsEntries(items, ["note", id], "a")).toBe(false);
    }
  });

  it("still allows moving items that merely live inside a system folder", () => {
    expect(canMoveVfsEntries(items, ["doc-note"], "a")).toBe(true);
  });

  it("rejects moving a folder into itself", () => {
    expect(canMoveVfsEntries(items, ["a"], "a")).toBe(false);
  });

  it("rejects moving a folder into its own subtree at any depth", () => {
    expect(canMoveVfsEntries(items, ["a"], "a1")).toBe(false);
    expect(canMoveVfsEntries(items, ["a"], "a1x")).toBe(false);
  });

  it("checks the subtree of the reduced roots, not of every selected id", () => {
    // "a1" reduces away because "a" is selected, but its subtree is still off limits.
    expect(canMoveVfsEntries(items, ["a", "a1"], "a1x")).toBe(false);
    // Moving only the inner folder up to the desktop is fine.
    expect(canMoveVfsEntries(items, ["a1"], VFS_ROOT_ID)).toBe(true);
  });

  it("rejects when any selected root would swallow the target", () => {
    expect(canMoveVfsEntries(items, ["b", "a"], "a1")).toBe(false);
    expect(canMoveVfsEntries(items, ["b", "note"], "a1")).toBe(true);
  });
});

describe("name length capping", () => {
  it("never returns a name longer than the cap", () => {
    const base = "가".repeat(80);
    expect(truncateVfsName(base)).toHaveLength(MAX_VFS_NAME_LENGTH);
    expect(normalizeVfsEntryName(base)).toHaveLength(MAX_VFS_NAME_LENGTH);
    expect(getUniqueVfsEntryName([], "folder-a", base).length).toBeLessThanOrEqual(
      MAX_VFS_NAME_LENGTH,
    );
    expect(getUniqueVfsCopyName(new Set(), base).length).toBeLessThanOrEqual(
      MAX_VFS_NAME_LENGTH,
    );
  });

  it("drops a whole emoji instead of leaving a lone surrogate", () => {
    const emoji = `a${"🙂".repeat(30)}`;
    const truncated = truncateVfsName(emoji);
    expect(truncated.length).toBeLessThanOrEqual(MAX_VFS_NAME_LENGTH);
    // A split surrogate pair would make the last code unit an unpaired D800-DBFF.
    const lastUnit = truncated.charCodeAt(truncated.length - 1);
    expect(lastUnit >= 0xd800 && lastUnit <= 0xdbff).toBe(false);
    expect([...truncated].every((character) => character === "a" || character === "🙂")).toBe(
      true,
    );
  });

  it("does not hand back the very name it was deduplicating", () => {
    const existing = "가".repeat(MAX_VFS_NAME_LENGTH);
    const items = [makeNote("n1", "folder-a", existing)];
    expect(getUniqueVfsEntryName(items, "folder-a", existing)).not.toBe(existing);
    expect(
      getUniqueRenamedVfsItemName([...items, makeNote("n2", "folder-a")], "n2", existing),
    ).not.toBe(existing);
    expect(getUniqueVfsCopyName(new Set([existing]), existing)).not.toBe(existing);
  });

  it("keeps the extension intact while shortening the base", () => {
    const existing = `${"가".repeat(44)}.txt`;
    const items = [makeNote("n1", "folder-a", existing)];
    expect(getUniqueVfsEntryName(items, "folder-a", existing).endsWith(".txt")).toBe(true);
    expect(getUniqueVfsCopyName(new Set([existing]), existing).endsWith(".txt")).toBe(true);
  });
});
