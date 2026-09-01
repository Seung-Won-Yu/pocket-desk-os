import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import { VFS_DOCUMENTS_ID, VFS_ROOT_ID } from "../vfs/model";
import {
  expandShellVars,
  expandShellWildcard,
  formatShellPath,
  getShellBuiltinVars,
  isWildcardPattern,
  getShellEntryByteSize,
  resolveShellParent,
  resolveShellTarget,
  runShellCommand,
  unescapeShellCarets,
  SHELL_ROOT_PATH,
  type ShellContext,
  type ShellProcess,
} from "./commandShell";

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

const docs = makeItem({ id: VFS_DOCUMENTS_ID, kind: "folder", name: "문서" });
const projects = makeItem({
  id: "folder-projects",
  kind: "folder",
  name: "프로젝트",
  parentId: VFS_DOCUMENTS_ID,
});
const memo = makeItem({
  content: "첫 줄\n둘째 줄",
  id: "note-memo",
  name: "메모.txt",
  parentId: VFS_DOCUMENTS_ID,
});
const picture = makeItem({
  content: "data:image/png;base64,AAAA",
  id: "canvas-1",
  kind: "canvas",
  name: "그림 1.png",
});

const entries = [docs, projects, memo, picture];

const processes: ShellProcess[] = [
  { appId: "notepad", id: "win-notepad", memoryMb: 42, title: "메모장" },
  { appId: "files", id: "win-files", memoryMb: 88, title: "파일 탐색기" },
];

function makeContext(overrides: Partial<ShellContext> = {}): ShellContext {
  return {
    cwdId: VFS_ROOT_ID,
    entries,
    env: {},
    hostName: "POCKETDESK",
    now: Date.UTC(2026, 7, 27, 3, 0, 0),
    processes,
    userName: "PocketDesk",
    ...overrides,
  };
}

const textOf = (result: { lines: Array<{ text: string }> }) =>
  result.lines.map((line) => line.text).join("\n");

describe("formatShellPath", () => {
  it("renders the desktop root as the Windows user path", () => {
    expect(formatShellPath(entries, VFS_ROOT_ID)).toBe(SHELL_ROOT_PATH);
  });

  it("appends each folder segment with backslashes", () => {
    expect(formatShellPath(entries, projects.id)).toBe(`${SHELL_ROOT_PATH}\\문서\\프로젝트`);
  });
});

describe("getShellEntryByteSize", () => {
  it("reports zero for folders and UTF-8 byte counts for files", () => {
    expect(getShellEntryByteSize(docs)).toBe(0);
    expect(getShellEntryByteSize(makeItem({ content: "abc", id: "x" }))).toBe(3);
    // Hangul is three bytes per character in UTF-8, not one.
    expect(getShellEntryByteSize(makeItem({ content: "가", id: "y" }))).toBe(3);
  });
});

describe("resolveShellTarget", () => {
  it("treats an empty path and '.' as the current directory", () => {
    expect(resolveShellTarget(entries, projects.id, "")).toEqual({
      folderId: projects.id,
      kind: "folder",
    });
    expect(resolveShellTarget(entries, projects.id, ".")).toEqual({
      folderId: projects.id,
      kind: "folder",
    });
  });

  it("walks '..' up to the parent and stops at the root", () => {
    expect(resolveShellTarget(entries, projects.id, "..")).toEqual({
      folderId: VFS_DOCUMENTS_ID,
      kind: "folder",
    });
    expect(resolveShellTarget(entries, VFS_ROOT_ID, "..\\..")).toEqual({
      folderId: VFS_ROOT_ID,
      kind: "folder",
    });
  });

  it("accepts absolute paths in every supported spelling", () => {
    for (const path of ["\\문서", "C:\\Users\\PocketDesk\\Desktop\\문서", "~\\문서", "/문서"]) {
      expect(resolveShellTarget(entries, projects.id, path)).toEqual({
        folderId: VFS_DOCUMENTS_ID,
        kind: "folder",
      });
    }
  });

  it("matches names case-insensitively and returns files as entries", () => {
    const target = resolveShellTarget(entries, VFS_DOCUMENTS_ID, "메모.TXT");
    expect(target).toEqual({ entry: memo, kind: "entry" });
  });

  it("fails on a missing segment and on descending through a file", () => {
    expect(resolveShellTarget(entries, VFS_ROOT_ID, "없는폴더")).toBeNull();
    expect(resolveShellTarget(entries, VFS_DOCUMENTS_ID, "메모.txt\\하위")).toBeNull();
  });
});

describe("resolveShellParent", () => {
  it("uses the current directory for a bare name", () => {
    expect(resolveShellParent(entries, VFS_DOCUMENTS_ID, "새 폴더")).toEqual({
      name: "새 폴더",
      parentId: VFS_DOCUMENTS_ID,
    });
  });

  it("splits a nested path into its real parent and final segment", () => {
    expect(resolveShellParent(entries, VFS_ROOT_ID, "문서\\프로젝트\\보고서.txt")).toEqual({
      name: "보고서.txt",
      parentId: projects.id,
    });
  });

  it("returns null when the parent folder does not exist", () => {
    expect(resolveShellParent(entries, VFS_ROOT_ID, "없는폴더\\파일.txt")).toBeNull();
  });

  it("rejects paths with no usable final segment", () => {
    expect(resolveShellParent(entries, VFS_ROOT_ID, "")).toBeNull();
    expect(resolveShellParent(entries, VFS_ROOT_ID, "..")).toBeNull();
  });
});

describe("runShellCommand: power", () => {
  it("maps shutdown flags onto the shell's power actions", () => {
    expect(runShellCommand("shutdown /s", makeContext()).effects).toEqual([
      { kind: "power", action: "off" },
    ]);
    expect(runShellCommand("shutdown /r /t 0", makeContext()).effects).toEqual([
      { kind: "power", action: "restart" },
    ]);
    expect(runShellCommand("shutdown /l", makeContext()).effects).toEqual([
      { kind: "power", action: "lock" },
    ]);
    expect(runShellCommand("logoff", makeContext()).effects).toEqual([
      { kind: "power", action: "lock" },
    ]);
  });

  it("prints usage instead of acting when no flag is given", () => {
    const result = runShellCommand("shutdown", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines.map((line) => line.text).join("\n")).toContain("/s");
  });
});

describe("runShellCommand: navigation", () => {
  it("ignores an empty line", () => {
    expect(runShellCommand("   ", makeContext())).toEqual({ effects: [], lines: [] });
  });

  it("reports the current path for a bare cd", () => {
    expect(textOf(runShellCommand("cd", makeContext({ cwdId: projects.id })))).toBe(
      `${SHELL_ROOT_PATH}\\문서\\프로젝트`,
    );
  });

  it("emits a chdir effect for a resolvable folder", () => {
    expect(runShellCommand("cd 문서", makeContext()).effects).toEqual([
      { folderId: VFS_DOCUMENTS_ID, kind: "chdir" },
    ]);
  });

  it("refuses to cd into a file", () => {
    const result = runShellCommand("cd 메모.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID }));
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("lists folders before files with a directory summary", () => {
    const text = textOf(runShellCommand("dir", makeContext({ cwdId: VFS_DOCUMENTS_ID })));
    expect(text.indexOf("프로젝트")).toBeLessThan(text.indexOf("메모.txt"));
    expect(text).toContain("<DIR>");
    expect(text).toContain("1개 파일");
  });

  it("omits the '..' row at the desktop root", () => {
    const rootText = textOf(runShellCommand("dir", makeContext()));
    const nestedText = textOf(runShellCommand("dir", makeContext({ cwdId: VFS_DOCUMENTS_ID })));
    expect(rootText).not.toContain("..");
    expect(nestedText).toContain("..");
  });

  it("prints nested folders in the tree view", () => {
    const text = textOf(runShellCommand("tree", makeContext()));
    expect(text).toContain("문서");
    expect(text).toContain("프로젝트");
  });

  it("searches names recursively and reports full paths", () => {
    const text = textOf(runShellCommand("find 메모", makeContext()));
    expect(text).toBe(`${SHELL_ROOT_PATH}\\문서\\메모.txt`);
  });
});

describe("runShellCommand: files", () => {
  it("prints file content one line per row", () => {
    const result = runShellCommand("type 메모.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID }));
    expect(result.lines.map((line) => line.text)).toEqual(["첫 줄", "둘째 줄"]);
  });

  it("refuses to dump a binary image as text", () => {
    const result = runShellCommand("type 그림 1.png", makeContext());
    expect(result.lines[0].kind).toBe("error");
  });

  it("echoes plain text without touching the file system", () => {
    const result = runShellCommand("echo 안녕", makeContext());
    expect(result.effects).toEqual([]);
    expect(textOf(result)).toBe("안녕");
  });

  it("writes a new file in the current directory", () => {
    const result = runShellCommand("echo 내용 > 새파일.txt", makeContext());
    expect(result.effects).toEqual([
      {
        content: "내용",
        existingItemId: undefined,
        kind: "writeFile",
        name: "새파일.txt",
        parentId: VFS_ROOT_ID,
      },
    ]);
  });

  it("honours a folder path in the redirection target", () => {
    const result = runShellCommand("echo 내용 > 문서\\프로젝트\\보고서.txt", makeContext());
    expect(result.effects).toEqual([
      {
        content: "내용",
        existingItemId: undefined,
        kind: "writeFile",
        name: "보고서.txt",
        parentId: projects.id,
      },
    ]);
  });

  it("appends to an existing file instead of replacing it", () => {
    const result = runShellCommand(
      "echo 셋째 줄 >> 메모.txt",
      makeContext({ cwdId: VFS_DOCUMENTS_ID }),
    );
    expect(result.effects).toEqual([
      {
        content: "첫 줄\n둘째 줄\n셋째 줄",
        existingItemId: memo.id,
        kind: "writeFile",
        name: "메모.txt",
        parentId: VFS_DOCUMENTS_ID,
      },
    ]);
  });

  it("overwrites an existing file on single redirection", () => {
    const result = runShellCommand(
      "echo 새 내용 > 메모.txt",
      makeContext({ cwdId: VFS_DOCUMENTS_ID }),
    );
    expect(result.effects[0]).toMatchObject({ content: "새 내용", existingItemId: memo.id });
  });

  it("rejects redirection onto a folder", () => {
    const result = runShellCommand("echo 내용 > 문서", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("rejects redirection for commands that do not support it", () => {
    const result = runShellCommand("dir > out.txt", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("creates a folder in the current directory", () => {
    expect(runShellCommand("md 새 폴더", makeContext()).effects).toEqual([
      { kind: "mkdir", name: "새 폴더", parentId: VFS_ROOT_ID },
    ]);
  });

  it("creates a nested folder under its real parent, not as one long name", () => {
    expect(runShellCommand("md 문서\\보관", makeContext()).effects).toEqual([
      { kind: "mkdir", name: "보관", parentId: VFS_DOCUMENTS_ID },
    ]);
  });

  it("refuses to create a folder that already exists", () => {
    const result = runShellCommand("md 문서", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("deletes a file with del", () => {
    expect(
      runShellCommand("del 메모.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID })).effects,
    ).toEqual([{ itemIds: [memo.id], kind: "delete" }]);
  });

  it("sends the user to rd when del targets a folder", () => {
    const result = runShellCommand("del 문서", makeContext());
    expect(result.effects).toEqual([]);
    expect(textOf(result)).toContain("rd");
  });

  it("deletes a folder tree with rd", () => {
    expect(runShellCommand("rd 문서\\프로젝트", makeContext()).effects).toEqual([
      { itemIds: [projects.id], kind: "delete" },
    ]);
  });

  it("protects system folders, the desktop root, and the current directory", () => {
    expect(runShellCommand("rd 문서", makeContext()).effects).toEqual([]);
    expect(runShellCommand("rd \\", makeContext()).effects).toEqual([]);
    expect(runShellCommand("rd .", makeContext({ cwdId: projects.id })).effects).toEqual([]);
  });

  it("copies and moves a file into a target folder", () => {
    expect(runShellCommand("copy 그림 1.png 문서", makeContext()).effects).toEqual([]);
    expect(runShellCommand('copy "그림 1.png" 문서', makeContext()).effects).toEqual([
      { itemIds: [picture.id], kind: "copy", parentId: VFS_DOCUMENTS_ID },
    ]);
    expect(runShellCommand('move "그림 1.png" 문서', makeContext()).effects).toEqual([
      { itemIds: [picture.id], kind: "move", parentId: VFS_DOCUMENTS_ID },
    ]);
  });

  it("renames a file", () => {
    expect(
      runShellCommand("ren 메모.txt 일지.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID }))
        .effects,
    ).toEqual([{ itemId: memo.id, kind: "rename", name: "일지.txt" }]);
  });
});

describe("runShellCommand: processes and system", () => {
  it("lists every open window with a 1-based pid", () => {
    const text = textOf(runShellCommand("tasklist", makeContext()));
    expect(text).toContain("메모장");
    expect(text).toContain("파일 탐색기");
  });

  it("says so when nothing is running", () => {
    expect(textOf(runShellCommand("tasklist", makeContext({ processes: [] })))).toBe(
      "실행 중인 창이 없습니다.",
    );
  });

  it("kills the window behind a pid", () => {
    expect(runShellCommand("taskkill /pid 2", makeContext()).effects).toEqual([
      { kind: "killWindow", windowId: "win-files" },
    ]);
  });

  it("rejects an out-of-range or non-numeric pid", () => {
    for (const command of ["taskkill /pid 9", "taskkill /pid abc", "taskkill"]) {
      const result = runShellCommand(command, makeContext());
      expect(result.effects).toEqual([]);
      expect(result.lines[0].kind).toBe("error");
    }
  });

  it("launches an app by alias and opens a file by name", () => {
    expect(runShellCommand("start notepad", makeContext()).effects).toEqual([
      { appId: "notepad", kind: "launch" },
    ]);
    expect(runShellCommand("start calc.exe", makeContext()).effects).toEqual([
      { appId: "calculator", kind: "launch" },
    ]);
    expect(
      runShellCommand("start 메모.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID })).effects,
    ).toEqual([{ itemId: memo.id, kind: "open" }]);
  });

  it("clears and exits through effects rather than output", () => {
    expect(runShellCommand("cls", makeContext())).toEqual({
      effects: [{ kind: "clear" }],
      lines: [],
    });
    expect(runShellCommand("exit", makeContext())).toEqual({
      effects: [{ kind: "exit" }],
      lines: [],
    });
  });

  it("reports identity and system details", () => {
    expect(textOf(runShellCommand("whoami", makeContext()))).toBe("POCKETDESK\\PocketDesk");
    expect(textOf(runShellCommand("hostname", makeContext()))).toBe("POCKETDESK");
    expect(textOf(runShellCommand("systeminfo", makeContext()))).toContain(
      "실행 중인 창:           2개",
    );
  });

  it("lists the available commands for help", () => {
    const text = textOf(runShellCommand("help", makeContext()));
    expect(text).toContain("dir");
    expect(text).toContain("taskkill");
  });

  it("reports an unknown command without side effects", () => {
    const result = runShellCommand("frobnicate", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
    expect(result.lines[0].text).toContain("frobnicate");
  });

  it("accepts commands in any casing", () => {
    expect(runShellCommand("CD 문서", makeContext()).effects).toEqual([
      { folderId: VFS_DOCUMENTS_ID, kind: "chdir" },
    ]);
  });
});

describe("environment variables", () => {
  it("exposes the built-ins cmd resolves without a user setting them", () => {
    const vars = getShellBuiltinVars(makeContext({ cwdId: projects.id }));
    expect(vars.CD).toBe(`${SHELL_ROOT_PATH}\\문서\\프로젝트`);
    expect(vars.USERNAME).toBe("PocketDesk");
    expect(vars.COMPUTERNAME).toBe("POCKETDESK");
    expect(vars.USERPROFILE).toBe("C:\\Users\\PocketDesk");
  });

  it("substitutes %NAME% from the environment and the built-ins", () => {
    const context = makeContext({ env: { GREETING: "안녕" } });
    expect(expandShellVars("echo %GREETING%", context)).toBe("echo 안녕");
    expect(expandShellVars("echo %USERNAME%", context)).toBe("echo PocketDesk");
  });

  it("lets a user variable shadow a built-in", () => {
    const context = makeContext({ env: { USERNAME: "다른사람" } });
    expect(expandShellVars("echo %USERNAME%", context)).toBe("echo 다른사람");
  });

  it("matches names case-insensitively", () => {
    const context = makeContext({ env: { GREETING: "안녕" } });
    expect(expandShellVars("echo %greeting%", context)).toBe("echo 안녕");
  });

  it("leaves an unknown name untouched instead of blanking it", () => {
    expect(expandShellVars("echo %NOPE% 100%", makeContext())).toBe("echo %NOPE% 100%");
  });

  it("expands before the command runs", () => {
    const context = makeContext({ env: { TARGET: "문서" } });
    expect(runShellCommand("cd %TARGET%", context).effects).toEqual([
      { folderId: VFS_DOCUMENTS_ID, kind: "chdir" },
    ]);
  });

  it("lists every variable for a bare set", () => {
    const text = textOf(runShellCommand("set", makeContext({ env: { GREETING: "안녕" } })));
    expect(text).toContain("GREETING=안녕");
    expect(text).toContain("USERNAME=PocketDesk");
  });

  it("prints a single variable by name", () => {
    const context = makeContext({ env: { GREETING: "안녕" } });
    expect(textOf(runShellCommand("set GREETING", context))).toBe("GREETING=안녕");
    expect(textOf(runShellCommand("set greeting", context))).toBe("GREETING=안녕");
  });

  it("reports an unknown variable as an error", () => {
    const result = runShellCommand("set NOPE", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("assigns and clears through effects", () => {
    expect(runShellCommand("set GREETING=안녕", makeContext()).effects).toEqual([
      { kind: "setEnv", name: "GREETING", value: "안녕" },
    ]);
    expect(runShellCommand("set GREETING=", makeContext()).effects).toEqual([
      { kind: "clearEnv", name: "GREETING" },
    ]);
  });

  it("rejects a name that is not a valid identifier", () => {
    const result = runShellCommand("set 1BAD=x", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });
});

describe("wildcards", () => {
  it("recognises only patterns that contain * or ?", () => {
    expect(isWildcardPattern("*.txt")).toBe(true);
    expect(isWildcardPattern("memo?.txt")).toBe(true);
    expect(isWildcardPattern("메모.txt")).toBe(false);
  });

  it("matches by extension within one folder", () => {
    const matches = expandShellWildcard(entries, VFS_DOCUMENTS_ID, "*.txt");
    expect(matches.map((entry) => entry.id)).toEqual([memo.id]);
  });

  it("resolves a pattern under an explicit folder path", () => {
    const matches = expandShellWildcard(entries, VFS_ROOT_ID, "문서\\*.txt");
    expect(matches.map((entry) => entry.id)).toEqual([memo.id]);
  });

  it("treats ? as exactly one character", () => {
    expect(expandShellWildcard(entries, VFS_ROOT_ID, "그림 ?.png").map((e) => e.id)).toEqual([
      picture.id,
    ]);
    expect(expandShellWildcard(entries, VFS_ROOT_ID, "그림 ??.png")).toEqual([]);
  });

  it("does not let a regex metacharacter in the name act as a pattern", () => {
    const odd = makeItem({ id: "odd", name: "a+b.txt" });
    const withOdd = [...entries, odd];
    expect(expandShellWildcard(withOdd, VFS_ROOT_ID, "a+b.txt").map((e) => e.id)).toEqual([
      "odd",
    ]);
    expect(expandShellWildcard(withOdd, VFS_ROOT_ID, "aab.txt")).toEqual([]);
  });

  it("returns nothing when the folder in the pattern does not exist", () => {
    expect(expandShellWildcard(entries, VFS_ROOT_ID, "없는폴더\\*.txt")).toEqual([]);
  });

  it("deletes every matching file in one effect", () => {
    const result = runShellCommand("del *.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID }));
    expect(result.effects).toEqual([{ itemIds: [memo.id], kind: "delete" }]);
  });

  it("never sweeps a folder into a file wildcard", () => {
    const result = runShellCommand("del *", makeContext());
    expect(result.effects).toEqual([{ itemIds: [picture.id], kind: "delete" }]);
  });

  it("reports a pattern that matches nothing", () => {
    const result = runShellCommand("del *.zip", makeContext());
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("copies and moves every match into the target folder", () => {
    expect(runShellCommand("copy *.png 문서", makeContext()).effects).toEqual([
      { itemIds: [picture.id], kind: "copy", parentId: VFS_DOCUMENTS_ID },
    ]);
    expect(runShellCommand("move *.png 문서", makeContext()).effects).toEqual([
      { itemIds: [picture.id], kind: "move", parentId: VFS_DOCUMENTS_ID },
    ]);
  });

  it("narrows a dir listing to the matching rows", () => {
    const text = textOf(runShellCommand("dir *.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID })));
    expect(text).toContain("메모.txt");
    expect(text).not.toContain("프로젝트");
  });
});

describe("pipelines", () => {
  it("filters the previous stage's output with find", () => {
    const text = textOf(
      runShellCommand("dir | find 메모", makeContext({ cwdId: VFS_DOCUMENTS_ID })),
    );
    expect(text).toContain("메모.txt");
    expect(text).not.toContain("프로젝트");
    expect(text).not.toContain("드라이브의 볼륨");
  });

  it("matches case-insensitively", () => {
    const text = textOf(runShellCommand("help | find TASKKILL", makeContext()));
    expect(text).toContain("taskkill");
  });

  it("chains more than one filter", () => {
    const text = textOf(
      runShellCommand("dir | find 메모 | find txt", makeContext({ cwdId: VFS_DOCUMENTS_ID })),
    );
    expect(text).toContain("메모.txt");
  });

  it("sorts the previous stage's lines", () => {
    const lines = runShellCommand(
      "type 메모.txt | sort",
      makeContext({ cwdId: VFS_DOCUMENTS_ID }),
    ).lines.map((line) => line.text);
    expect(lines).toEqual(["둘째 줄", "첫 줄"]);
  });

  it("passes lines straight through more", () => {
    const lines = runShellCommand(
      "type 메모.txt | more",
      makeContext({ cwdId: VFS_DOCUMENTS_ID }),
    ).lines.map((line) => line.text);
    expect(lines).toEqual(["첫 줄", "둘째 줄"]);
  });

  it("keeps the first stage's side effects", () => {
    expect(runShellCommand("md 새 폴더 | find 폴더", makeContext()).effects).toEqual([
      { kind: "mkdir", name: "새 폴더", parentId: VFS_ROOT_ID },
    ]);
  });

  it("rejects a filter that does not read standard input", () => {
    const result = runShellCommand("dir | del x", makeContext());
    expect(result.lines[0].kind).toBe("error");
  });

  it("rejects an empty pipeline stage", () => {
    expect(runShellCommand("dir |", makeContext()).lines[0].kind).toBe("error");
    expect(runShellCommand("| find x", makeContext()).lines[0].kind).toBe("error");
  });

  it("does not split on a pipe inside quotes", () => {
    const result = runShellCommand('echo "a | b"', makeContext());
    expect(textOf(result)).toBe('"a | b"');
  });
});

describe("batch files", () => {
  const script = makeItem({
    content: "rem 주석\nmd 보관\n\n:: 다른 주석\necho 완료 > 보관\\로그.txt",
    id: "note-bat",
    name: "설치.bat",
  });
  const withScript = [...entries, script];

  it("queues the script body for a bare .bat name", () => {
    const result = runShellCommand("설치.bat", makeContext({ entries: withScript }));
    expect(result.effects).toEqual([
      { kind: "runScript", lines: ["md 보관", "echo 완료 > 보관\\로그.txt"] },
    ]);
  });

  it("queues the same body through call", () => {
    expect(
      runShellCommand("call 설치.bat", makeContext({ entries: withScript })).effects,
    ).toEqual([{ kind: "runScript", lines: ["md 보관", "echo 완료 > 보관\\로그.txt"] }]);
  });

  it("refuses call on a file that is not a batch file", () => {
    const result = runShellCommand("call 메모.txt", makeContext({ cwdId: VFS_DOCUMENTS_ID }));
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });

  it("still reports an unknown command that is not a batch file", () => {
    const result = runShellCommand("frobnicate", makeContext({ entries: withScript }));
    expect(result.effects).toEqual([]);
    expect(result.lines[0].kind).toBe("error");
  });
});

describe("caret escaping", () => {
  it("drops the escape and keeps the character", () => {
    expect(unescapeShellCarets("echo a ^> b")).toBe("echo a > b");
    expect(unescapeShellCarets("echo a ^| b")).toBe("echo a | b");
    expect(unescapeShellCarets("echo a ^^ b")).toBe("echo a ^ b");
  });

  it("treats ^> as text rather than a redirection", () => {
    const result = runShellCommand("echo md 보관 ^> 로그.txt", makeContext());
    expect(result.effects).toEqual([]);
    expect(textOf(result)).toBe("md 보관 > 로그.txt");
  });

  it("still redirects on an unescaped > later in the same line", () => {
    const result = runShellCommand("echo md 보관 ^> 로그.txt > 설치.bat", makeContext());
    expect(result.effects).toEqual([
      {
        content: "md 보관 > 로그.txt",
        existingItemId: undefined,
        kind: "writeFile",
        name: "설치.bat",
        parentId: VFS_ROOT_ID,
      },
    ]);
  });

  it("treats ^| as text rather than a pipe", () => {
    expect(textOf(runShellCommand("echo a ^| b", makeContext()))).toBe("a | b");
  });
});
