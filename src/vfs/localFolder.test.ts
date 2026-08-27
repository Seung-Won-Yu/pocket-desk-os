import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLocalFileKind,
  isLocalFolderAccessAvailable,
  isSensitiveLocalName,
  isSkippedLocalDirectory,
  LOCAL_FOLDER_MAX_BYTES,
  LOCAL_FOLDER_MAX_DEPTH,
  LOCAL_FOLDER_MAX_FILES,
  readLocalFolder,
} from "./localFolder";

function stubWindow(hostname: string, withPicker: boolean) {
  vi.stubGlobal("window", {
    location: { hostname },
    ...(withPicker ? { showDirectoryPicker: () => Promise.resolve() } : {}),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isLocalFolderAccessAvailable", () => {
  it("is available on the machine running the app", () => {
    for (const hostname of ["localhost", "127.0.0.1", "[::1]"]) {
      stubWindow(hostname, true);
      expect(isLocalFolderAccessAvailable()).toBe(true);
    }
  });

  it("is refused on the public deployment", () => {
    // The whole point of the gate: a public origin never gets a real handle.
    stubWindow("seung-won-yu.github.io", true);
    expect(isLocalFolderAccessAvailable()).toBe(false);
  });

  it("is refused on any other remote host, including lookalikes", () => {
    for (const hostname of ["example.com", "localhost.evil.test", "127.0.0.1.evil.test"]) {
      stubWindow(hostname, true);
      expect(isLocalFolderAccessAvailable()).toBe(false);
    }
  });

  it("is refused when the browser lacks the picker", () => {
    // Safari has no showDirectoryPicker, so the feature must stay hidden there.
    stubWindow("localhost", false);
    expect(isLocalFolderAccessAvailable()).toBe(false);
  });

  it("is refused when there is no window at all", () => {
    vi.stubGlobal("window", undefined);
    expect(isLocalFolderAccessAvailable()).toBe(false);
  });
});

describe("isSensitiveLocalName", () => {
  it("refuses to read files that usually hold credentials", () => {
    for (const name of [
      ".env",
      ".env.local",
      ".env.production",
      ".netrc",
      ".npmrc",
      ".pgpass",
      "id_rsa",
      "id_ed25519",
      "server.pem",
      "private.key",
      "cert.p12",
      "cert.pfx",
      "credentials",
      "secrets.json",
      "secret.yaml",
      "secrets.toml",
    ]) {
      expect(isSensitiveLocalName(name), name).toBe(true);
    }
  });

  it("matches regardless of case or surrounding whitespace", () => {
    expect(isSensitiveLocalName(".ENV")).toBe(true);
    expect(isSensitiveLocalName("  id_rsa  ")).toBe(true);
  });

  it("allows ordinary files with similar-looking names", () => {
    for (const name of [
      "environment.md",
      "keyboard.ts",
      "monkey.txt",
      "credentials.md",
      "id_helper.ts",
      "notes.json",
    ]) {
      expect(isSensitiveLocalName(name), name).toBe(false);
    }
  });
});

describe("isSkippedLocalDirectory", () => {
  it("skips key stores and build output", () => {
    for (const name of [
      ".git",
      ".ssh",
      ".gnupg",
      ".aws",
      "node_modules",
      "dist",
      "coverage",
      ".venv",
      "Library",
    ]) {
      expect(isSkippedLocalDirectory(name), name).toBe(true);
    }
  });

  it("skips every dot directory, not only the listed ones", () => {
    expect(isSkippedLocalDirectory(".anything")).toBe(true);
  });

  it("walks ordinary project directories", () => {
    for (const name of ["src", "docs", "사진", "assets"]) {
      expect(isSkippedLocalDirectory(name), name).toBe(false);
    }
  });
});

describe("getLocalFileKind", () => {
  it("maps text formats to a note", () => {
    for (const name of ["a.txt", "README.md", "data.json", "app.tsx", "style.css"]) {
      expect(getLocalFileKind(name), name).toBe("note");
    }
  });

  it("maps png to a canvas", () => {
    expect(getLocalFileKind("shot.PNG")).toBe("canvas");
  });

  it("returns null for anything the VFS cannot represent", () => {
    // A binary the desktop has no app for is skipped rather than imported as junk.
    for (const name of ["movie.mp4", "archive.zip", "app.exe", "font.woff2", "Makefile"]) {
      expect(getLocalFileKind(name), name).toBeNull();
    }
  });
});

describe("import limits", () => {
  it("keeps a bounded budget so a large tree cannot fill browser storage", () => {
    expect(LOCAL_FOLDER_MAX_FILES).toBeLessThanOrEqual(500);
    expect(LOCAL_FOLDER_MAX_DEPTH).toBeLessThanOrEqual(6);
    // Well under the 16MB the VFS snapshot itself allows.
    expect(LOCAL_FOLDER_MAX_BYTES).toBeLessThan(16 * 1024 * 1024);
  });
});

/**
 * A stand-in for FileSystemDirectoryHandle. The real picker opens a native OS
 * dialog no test harness can drive, but the walk — which is where the security
 * filtering lives — is entirely testable against this.
 */
type FakeTree = { [name: string]: string | FakeTree };

function makeDirectoryHandle(name: string, tree: FakeTree): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() {
      for (const [childName, value] of Object.entries(tree)) {
        if (typeof value === "string") {
          const blob = new Blob([value], { type: "text/plain" });
          yield {
            getFile: async () =>
              Object.assign(blob, { lastModified: 1_700_000_000_000, name: childName }),
            kind: "file" as const,
            name: childName,
          };
          continue;
        }
        yield makeDirectoryHandle(childName, value);
      }
    },
  } as unknown as FileSystemDirectoryHandle;
}

describe("readLocalFolder", () => {
  // Mirrors a real project folder: content worth importing, secrets that must
  // not be, and directories not worth walking.
  const tree: FakeTree = {
    ".env": "SECRET=abc123",
    ".ssh": { id_rsa: "ssh-key-material" },
    "README.md": "# 제목\n본문",
    "메모.txt": "진짜 파일 내용\n둘째 줄",
    "영상.mp4": "binary-ish",
    node_modules: { "pkg.txt": "junk" },
    문서: { "data.json": '{"a":1}' },
  };

  it("imports the real content and preserves nesting", async () => {
    const result = await readLocalFolder(
      makeDirectoryHandle("실제폴더테스트", tree),
      "desktop",
    );

    const names = result.entries.map((entry) => entry.name).sort();
    expect(names).toEqual(["README.md", "data.json", "메모.txt", "문서"]);

    const memo = result.entries.find((entry) => entry.name === "메모.txt");
    expect(memo?.kind).toBe("note");
    expect(memo?.content).toBe("진짜 파일 내용\n둘째 줄");
    expect(memo?.parentId).toBe("desktop");

    // data.json sits under the 문서 folder that was created for it.
    const folder = result.entries.find((entry) => entry.name === "문서");
    const nested = result.entries.find((entry) => entry.name === "data.json");
    expect(folder?.kind).toBe("folder");
    expect(nested?.parentId).toBe(folder?.id);
  });

  it("never reads a credential file", async () => {
    const result = await readLocalFolder(makeDirectoryHandle("root", tree), "desktop");

    const contents = result.entries.map((entry) => entry.content ?? "").join("\n");
    expect(contents).not.toContain("SECRET=abc123");
    expect(contents).not.toContain("ssh-key-material");
    expect(result.entries.some((entry) => entry.name === ".env")).toBe(false);
    expect(result.skipped).toContain(".env");
    expect(result.skipped).toContain(".ssh/");
  });

  it("skips build directories and formats it cannot represent", async () => {
    const result = await readLocalFolder(makeDirectoryHandle("root", tree), "desktop");
    expect(result.skipped).toContain("node_modules/");
    expect(result.skipped).toContain("영상.mp4");
    expect(result.entries.some((entry) => entry.name === "pkg.txt")).toBe(false);
  });

  it("stops at the file cap and reports it", async () => {
    const many: FakeTree = {};
    for (let index = 0; index < LOCAL_FOLDER_MAX_FILES + 20; index += 1) {
      many[`file-${index}.txt`] = "x";
    }
    const result = await readLocalFolder(makeDirectoryHandle("root", many), "desktop");
    expect(result.entries.length).toBeLessThanOrEqual(LOCAL_FOLDER_MAX_FILES);
    expect(result.truncated).toBe(true);
  });

  it("stops descending past the depth cap", async () => {
    let deepest: FakeTree = { "bottom.txt": "x" };
    for (let index = 0; index < LOCAL_FOLDER_MAX_DEPTH + 3; index += 1) {
      deepest = { [`level-${index}`]: deepest };
    }
    const result = await readLocalFolder(makeDirectoryHandle("root", deepest), "desktop");
    expect(result.truncated).toBe(true);
    expect(result.entries.some((entry) => entry.name === "bottom.txt")).toBe(false);
  });

  it("returns nothing for an empty folder without claiming truncation", async () => {
    const result = await readLocalFolder(makeDirectoryHandle("root", {}), "desktop");
    expect(result).toEqual({ entries: [], skipped: [], truncated: false });
  });
});
