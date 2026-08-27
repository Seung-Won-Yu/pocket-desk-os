import type { AppId, DesktopItem } from "../types";
import { getVfsFolder, getVfsFolderPath, isVfsSystemFolderId, VFS_ROOT_ID } from "../vfs/model";

export const SHELL_VERSION = "PocketDesk OS [Version 10.0.19045.1]";
export const SHELL_VOLUME_SERIAL = "1A2B-3C4D";
export const SHELL_DRIVE_LABEL = "PocketDesk";
export const SHELL_ROOT_PATH = "C:\\Users\\PocketDesk\\Desktop";

export type ShellLineKind = "error" | "input" | "output";

export type ShellLine = {
  kind: ShellLineKind;
  text: string;
};

export type ShellEffect =
  | { kind: "chdir"; folderId: string }
  | { kind: "clear" }
  | { kind: "copy"; itemIds: string[]; parentId: string }
  | { kind: "delete"; itemIds: string[] }
  | { kind: "exit" }
  | { kind: "killWindow"; windowId: string }
  | { kind: "launch"; appId: AppId }
  | { kind: "mkdir"; name: string; parentId: string }
  | { kind: "move"; itemIds: string[]; parentId: string }
  | { kind: "open"; itemId: string }
  | { kind: "clearEnv"; name: string }
  | { kind: "rename"; itemId: string; name: string }
  | { kind: "runScript"; lines: string[] }
  | { kind: "setEnv"; name: string; value: string }
  | {
      kind: "writeFile";
      content: string;
      existingItemId?: string;
      name: string;
      parentId: string;
    };

export type ShellProcess = {
  appId: AppId;
  id: string;
  memoryMb: number;
  title: string;
};

export type ShellContext = {
  cwdId: string;
  entries: DesktopItem[];
  /** User-defined variables, expanded as %NAME% before a command is parsed. */
  env: Record<string, string>;
  hostName: string;
  now: number;
  processes: ShellProcess[];
  userName: string;
};

export type ShellResult = {
  effects: ShellEffect[];
  lines: ShellLine[];
};

type ShellTarget = { entry: DesktopItem; kind: "entry" } | { folderId: string; kind: "folder" };

const APP_LAUNCH_ALIASES: Record<string, AppId> = {
  calc: "calculator",
  "calc.exe": "calculator",
  calculator: "calculator",
  cmd: "terminal",
  "cmd.exe": "terminal",
  control: "settings",
  edge: "browser",
  explorer: "files",
  "explorer.exe": "files",
  minesweeper: "minesweeper",
  msedge: "browser",
  mspaint: "paint",
  "mspaint.exe": "paint",
  notepad: "notepad",
  "notepad.exe": "notepad",
  paint: "paint",
  settings: "settings",
  taskmgr: "taskmanager",
  "taskmgr.exe": "taskmanager",
  terminal: "terminal",
  thispc: "thispc",
};

const COMMAND_HELP: Array<[string, string]> = [
  ["help", "사용할 수 있는 명령 목록을 표시합니다."],
  ["dir (ls)", "현재 디렉터리의 파일과 폴더를 표시합니다."],
  ["cd (chdir)", "디렉터리를 이동합니다. cd .. 은 상위, cd \\ 은 바탕 화면."],
  ["pwd", "현재 디렉터리 경로를 표시합니다."],
  ["tree", "현재 디렉터리부터 하위 구조를 표시합니다."],
  ["type (cat)", "텍스트 파일 내용을 표시합니다."],
  ["echo", "텍스트를 표시합니다. echo 내용 > 파일.txt 로 저장합니다."],
  ["md (mkdir)", "새 폴더를 만듭니다."],
  ["del (erase)", "파일을 휴지통으로 보냅니다."],
  ["rd (rmdir, rm)", "폴더와 하위 항목을 휴지통으로 보냅니다."],
  ["copy", "파일이나 폴더를 복사합니다."],
  ["move", "파일이나 폴더를 다른 폴더로 옮깁니다."],
  ["ren (rename)", "이름을 바꿉니다."],
  ["find (findstr)", "이름에 문자열이 포함된 항목을 찾습니다."],
  ["set", "환경 변수를 보거나 지정합니다. set NAME=값, set NAME= 로 삭제."],
  ["| (파이프)", "출력에 find, findstr, sort, more 를 연결합니다."],
  ["* ?", "dir, del, copy, move 에서 이름 패턴으로 여러 파일을 다룹니다."],
  ["call", "저장된 .bat 파일의 명령을 한 줄씩 실행합니다."],
  ["start", "앱이나 파일을 실행합니다. start notepad"],
  ["tasklist", "실행 중인 창 목록을 표시합니다."],
  ["taskkill", "창을 닫습니다. taskkill /pid <번호>"],
  ["systeminfo", "시스템 정보를 표시합니다."],
  ["ver", "PocketDesk OS 버전을 표시합니다."],
  ["date / time", "현재 날짜나 시간을 표시합니다."],
  ["whoami / hostname", "사용자와 컴퓨터 이름을 표시합니다."],
  ["vol", "드라이브 볼륨 정보를 표시합니다."],
  ["cls (clear)", "화면을 지웁니다."],
  ["exit", "명령 프롬프트를 닫습니다."],
];

export function getShellEntryByteSize(entry: DesktopItem) {
  if (entry.kind === "folder") return 0;
  const content = entry.content ?? "";
  if (typeof TextEncoder === "undefined") return content.length;
  return new TextEncoder().encode(content).byteLength;
}

export function formatShellPath(entries: DesktopItem[], folderId: string) {
  const segments = getVfsFolderPath(entries, folderId).slice(1);
  return [SHELL_ROOT_PATH, ...segments.map((segment) => segment.name)].join("\\");
}

function listChildren(entries: DesktopItem[], parentId: string) {
  return entries
    .filter((entry) => !entry.trashed && entry.parentId === parentId)
    .sort((first, second) => {
      if (first.kind === "folder" && second.kind !== "folder") return -1;
      if (first.kind !== "folder" && second.kind === "folder") return 1;
      return first.name.localeCompare(second.name, "ko");
    });
}

function matchesName(entry: DesktopItem, name: string) {
  return entry.name.toLowerCase() === name.toLowerCase();
}

function splitPathSegments(raw: string) {
  return raw
    .replace(/\//g, "\\")
    .split("\\")
    .filter((segment) => segment.length > 0);
}

/**
 * Walks a cmd-style path and reports whether it lands on a folder or a file.
 * Returns null when any segment is missing.
 */
export function resolveShellTarget(
  entries: DesktopItem[],
  cwdId: string,
  raw: string,
): ShellTarget | null {
  const normalized = raw.trim().replace(/\//g, "\\");
  if (normalized === "" || normalized === ".") return { folderId: cwdId, kind: "folder" };

  const isAbsolute =
    normalized.startsWith("\\") ||
    normalized.toLowerCase().startsWith("c:") ||
    normalized === "~" ||
    normalized.startsWith("~\\");

  let cursor = isAbsolute ? VFS_ROOT_ID : cwdId;
  const stripped = normalized
    .replace(/^c:/i, "")
    .replace(/^~/, "")
    .replace(/^\\Users\\PocketDesk\\Desktop/i, "");
  const segments = splitPathSegments(stripped);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === ".") continue;
    if (segment === "..") {
      const folder = getVfsFolder(entries, cursor);
      cursor = folder ? folder.parentId : VFS_ROOT_ID;
      continue;
    }

    const match = listChildren(entries, cursor).find((entry) => matchesName(entry, segment));
    if (!match) return null;
    if (match.kind !== "folder") {
      return index === segments.length - 1 ? { entry: match, kind: "entry" } : null;
    }
    cursor = match.id;
  }

  return { folderId: cursor, kind: "folder" };
}

/**
 * Splits a path into the folder that would hold it and the final segment, so
 * `md docs\\2026` and `echo x > docs\\note.txt` land in `docs` rather than
 * creating an entry whose name contains a separator. Returns null when the
 * parent folder does not exist.
 */
export function resolveShellParent(entries: DesktopItem[], cwdId: string, raw: string) {
  const normalized = raw.trim().replace(/\//g, "\\");
  const segments = splitPathSegments(normalized);
  const name = segments[segments.length - 1];
  if (!name || name === "." || name === "..") return null;

  const parentPath = normalized.slice(0, normalized.lastIndexOf(name));
  const parent =
    segments.length === 1
      ? { folderId: cwdId, kind: "folder" as const }
      : resolveShellTarget(entries, cwdId, parentPath);
  if (!parent || parent.kind !== "folder") return null;

  return { name, parentId: parent.folderId };
}

/** Built-in variables cmd resolves without the user ever setting them. */
export function getShellBuiltinVars(context: ShellContext): Record<string, string> {
  const stamp = new Date(context.now);
  return {
    CD: formatShellPath(context.entries, context.cwdId),
    COMPUTERNAME: context.hostName,
    DATE: stamp.toLocaleDateString("ko-KR"),
    TIME: stamp.toLocaleTimeString("ko-KR"),
    USERNAME: context.userName,
    USERPROFILE: SHELL_ROOT_PATH.replace(/\\Desktop$/i, ""),
  };
}

/**
 * Substitutes %NAME% before parsing, the way cmd does. An unknown name is left
 * alone rather than blanked, so a stray percent sign still reads back literally.
 */
export function expandShellVars(input: string, context: ShellContext) {
  const vars = { ...getShellBuiltinVars(context), ...context.env };
  const lookup = new Map(
    Object.entries(vars).map(([key, value]) => [key.toUpperCase(), value]),
  );
  return input.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (whole, name: string) => {
    const value = lookup.get(name.toUpperCase());
    return value === undefined ? whole : value;
  });
}

export function isWildcardPattern(value: string) {
  return value.includes("*") || value.includes("?");
}

function wildcardToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
}

/**
 * Resolves `*.txt`-style arguments against one folder. A pattern with no match
 * returns an empty list, which each command reports in its own words.
 */
export function expandShellWildcard(entries: DesktopItem[], cwdId: string, pattern: string) {
  const normalized = pattern.trim().replace(/\//g, "\\");
  const separator = normalized.lastIndexOf("\\");
  const leaf = separator >= 0 ? normalized.slice(separator + 1) : normalized;
  const parentPath = separator >= 0 ? normalized.slice(0, separator) : "";
  const parent = parentPath
    ? resolveShellTarget(entries, cwdId, parentPath)
    : { folderId: cwdId, kind: "folder" as const };
  if (!parent || parent.kind !== "folder") return [];

  const matcher = wildcardToRegExp(leaf);
  return listChildren(entries, parent.folderId).filter((entry) => matcher.test(entry.name));
}

function splitPipeline(input: string) {
  const segments: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') quoted = !quoted;
    if (input[index - 1] === "^") {
      current += char;
      continue;
    }
    if (!quoted && char === "|") {
      segments.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  segments.push(current.trim());
  return segments;
}

/**
 * Applies a downstream pipeline stage to the previous stage's output. Only the
 * filters that read standard input in cmd are supported.
 */
function applyPipelineFilter(lines: ShellLine[], segment: string): ShellResult {
  const tokens = tokenize(segment);
  const command = (tokens[0] ?? "").toLowerCase();
  const argument = tokens.slice(1).join(" ");
  const text = lines.filter((line) => line.kind !== "input");

  if (command === "find" || command === "findstr") {
    if (!argument) {
      return { effects: [], lines: [err(`사용법: ... | ${command} <찾을 문자열>`)] };
    }
    const needle = argument.toLowerCase();
    return {
      effects: [],
      lines: text.filter((line) => line.text.toLowerCase().includes(needle)),
    };
  }

  if (command === "sort") {
    return {
      effects: [],
      lines: [...text].sort((first, second) => first.text.localeCompare(second.text, "ko")),
    };
  }

  if (command === "more") {
    return { effects: [], lines: text };
  }

  return {
    effects: [],
    lines: [
      err(
        `'${tokens[0] ?? ""}'은(는) 파이프에서 사용할 수 없습니다. find, findstr, sort, more 를 지원합니다.`,
      ),
    ],
  };
}

export function runShellCommand(input: string, context: ShellContext): ShellResult {
  const expanded = expandShellVars(input, context);
  const segments = splitPipeline(expanded);
  const first = runSingleCommand(segments[0], context);
  if (segments.length === 1) return first;

  if (segments.some((segment) => !segment)) {
    return { effects: [], lines: [err("파이프 양쪽에 명령이 있어야 합니다.")] };
  }

  // Downstream stages only reshape text; the first stage owns every side effect.
  let lines = first.lines;
  for (const segment of segments.slice(1)) {
    lines = applyPipelineFilter(lines, segment).lines;
  }
  return { effects: first.effects, lines };
}

function tokenize(input: string) {
  const tokens: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of input) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

/** Drops cmd's `^` escape so `^>` reads back as a literal character. */
export function unescapeShellCarets(input: string) {
  return input.replace(/\^(.)/g, "$1");
}

function splitRedirection(input: string) {
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') quoted = !quoted;
    // `^>` is an escaped character, not a redirection.
    if (input[index - 1] === "^") continue;
    if (quoted || char !== ">") continue;
    const append = input[index + 1] === ">";
    return {
      append,
      command: input.slice(0, index).trim(),
      target: input.slice(index + (append ? 2 : 1)).trim(),
    };
  }
  return null;
}

const out = (text: string): ShellLine => ({ kind: "output", text });
const err = (text: string): ShellLine => ({ kind: "error", text });

function padStart(value: string, width: number) {
  return value.padStart(width, " ");
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatDirTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = date.getHours();
  const meridiem = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}  ${meridiem} ${pad(hour12)}:${pad(date.getMinutes())}`;
}

/** The row body of a `dir` listing, reused when a wildcard narrows the results. */
function renderDirRows(context: ShellContext, entries: DesktopItem[]): ShellLine[] {
  let fileCount = 0;
  let byteTotal = 0;
  let dirCount = 0;
  const rows = entries.map((entry) => {
    if (entry.kind === "folder") {
      dirCount += 1;
      return out(`${formatDirTimestamp(entry.updatedAt)}    <DIR>          ${entry.name}`);
    }
    const size = getShellEntryByteSize(entry);
    fileCount += 1;
    byteTotal += size;
    return out(
      `${formatDirTimestamp(entry.updatedAt)}    ${padStart(formatCount(size), 14)} ${entry.name}`,
    );
  });

  return [
    ...rows,
    out(
      `${padStart(`${formatCount(fileCount)}개 파일`, 22)}${padStart(`${formatCount(byteTotal)} 바이트`, 22)}`,
    ),
    out(`${padStart(`${formatCount(dirCount)}개 디렉터리`, 22)}`),
  ];
}

function renderDir(context: ShellContext, folderId: string): ShellLine[] {
  const children = listChildren(context.entries, folderId);
  const folder = getVfsFolder(context.entries, folderId);
  const lines: ShellLine[] = [
    out(` C 드라이브의 볼륨: ${SHELL_DRIVE_LABEL}`),
    out(` 볼륨 일련 번호: ${SHELL_VOLUME_SERIAL}`),
    out(""),
    out(` ${formatShellPath(context.entries, folderId)} 디렉터리`),
    out(""),
    out(`${formatDirTimestamp(folder?.updatedAt ?? context.now)}    <DIR>          .`),
  ];

  if (folderId !== VFS_ROOT_ID) {
    lines.push(
      out(`${formatDirTimestamp(folder?.createdAt ?? context.now)}    <DIR>          ..`),
    );
  }

  let fileCount = 0;
  let byteTotal = 0;
  let dirCount = folderId === VFS_ROOT_ID ? 1 : 2;

  for (const entry of children) {
    if (entry.kind === "folder") {
      dirCount += 1;
      lines.push(out(`${formatDirTimestamp(entry.updatedAt)}    <DIR>          ${entry.name}`));
      continue;
    }
    const size = getShellEntryByteSize(entry);
    fileCount += 1;
    byteTotal += size;
    lines.push(
      out(
        `${formatDirTimestamp(entry.updatedAt)}    ${padStart(formatCount(size), 14)} ${entry.name}`,
      ),
    );
  }

  lines.push(
    out(
      `${padStart(`${formatCount(fileCount)}개 파일`, 22)}${padStart(`${formatCount(byteTotal)} 바이트`, 22)}`,
    ),
    out(`${padStart(`${formatCount(dirCount)}개 디렉터리`, 22)}`),
  );
  return lines;
}

function renderTree(context: ShellContext, folderId: string): ShellLine[] {
  const lines: ShellLine[] = [
    out("폴더 PATH 목록"),
    out(`볼륨 일련 번호는 ${SHELL_VOLUME_SERIAL}입니다.`),
    out(formatShellPath(context.entries, folderId).toUpperCase()),
  ];

  const walk = (parentId: string, prefix: string, depth: number) => {
    if (depth > 12) return;
    const children = listChildren(context.entries, parentId);
    children.forEach((entry, index) => {
      const last = index === children.length - 1;
      lines.push(out(`${prefix}${last ? "└─" : "├─"}${entry.name}`));
      if (entry.kind === "folder") {
        walk(entry.id, `${prefix}${last ? "   " : "│  "}`, depth + 1);
      }
    });
  };

  walk(folderId, "", 0);
  if (lines.length === 3) lines.push(out("하위 폴더가 없습니다."));
  return lines;
}

function collectSearchMatches(entries: DesktopItem[], rootId: string, needle: string) {
  const matches: Array<{ entry: DesktopItem; parentId: string }> = [];
  const walk = (parentId: string, depth: number) => {
    if (depth > 12) return;
    for (const entry of listChildren(entries, parentId)) {
      if (entry.name.toLowerCase().includes(needle)) matches.push({ entry, parentId });
      if (entry.kind === "folder") walk(entry.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return matches;
}

function runSingleCommand(input: string, context: ShellContext): ShellResult {
  const trimmed = input.trim();
  if (!trimmed) return { effects: [], lines: [] };

  const redirection = splitRedirection(trimmed);
  const commandText = unescapeShellCarets(redirection ? redirection.command : trimmed);
  const tokens = tokenize(commandText);
  const command = (tokens[0] ?? "").toLowerCase();
  const args = tokens.slice(1);
  const argText = tokens.slice(1).join(" ");

  if (redirection && command !== "echo" && command !== "type") {
    return {
      effects: [],
      lines: [err(`${command} 명령은 파일 리디렉션을 지원하지 않습니다.`)],
    };
  }

  switch (command) {
    case "help":
    case "?": {
      const width = Math.max(...COMMAND_HELP.map(([name]) => name.length));
      return {
        effects: [],
        lines: [
          out("PocketDesk 명령 프롬프트에서 사용할 수 있는 명령입니다."),
          out(""),
          ...COMMAND_HELP.map(([name, detail]) =>
            out(`${name.padEnd(width + 3, " ")}${detail}`),
          ),
        ],
      };
    }

    case "set": {
      if (args.length === 0) {
        const all = { ...getShellBuiltinVars(context), ...context.env };
        return {
          effects: [],
          lines: Object.keys(all)
            .sort()
            .map((name) => out(`${name}=${all[name]}`)),
        };
      }

      const assignment = argText.indexOf("=");
      if (assignment < 0) {
        const name = argText.trim();
        const all = { ...getShellBuiltinVars(context), ...context.env };
        const match = Object.keys(all).find((key) => key.toUpperCase() === name.toUpperCase());
        if (!match) {
          return { effects: [], lines: [err(`환경 변수 ${name}을(를) 찾을 수 없습니다.`)] };
        }
        return { effects: [], lines: [out(`${match}=${all[match]}`)] };
      }

      const name = argText.slice(0, assignment).trim();
      const value = argText.slice(assignment + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return { effects: [], lines: [err("환경 변수 이름이 잘못되었습니다.")] };
      }
      if (!value) {
        return { effects: [{ kind: "clearEnv", name }], lines: [] };
      }
      return { effects: [{ kind: "setEnv", name, value }], lines: [] };
    }

    case "cls":
    case "clear":
      return { effects: [{ kind: "clear" }], lines: [] };

    case "exit":
      return { effects: [{ kind: "exit" }], lines: [] };

    case "ver":
      return { effects: [], lines: [out(""), out(SHELL_VERSION), out("")] };

    case "vol":
      return {
        effects: [],
        lines: [
          out(` C 드라이브의 볼륨: ${SHELL_DRIVE_LABEL}`),
          out(` 볼륨 일련 번호: ${SHELL_VOLUME_SERIAL}`),
        ],
      };

    case "whoami":
      return { effects: [], lines: [out(`${context.hostName}\\${context.userName}`)] };

    case "hostname":
      return { effects: [], lines: [out(context.hostName)] };

    case "date":
      return {
        effects: [],
        lines: [out(`현재 날짜: ${new Date(context.now).toLocaleDateString("ko-KR")}`)],
      };

    case "time":
      return {
        effects: [],
        lines: [out(`현재 시간: ${new Date(context.now).toLocaleTimeString("ko-KR")}`)],
      };

    case "pwd":
      return { effects: [], lines: [out(formatShellPath(context.entries, context.cwdId))] };

    case "systeminfo": {
      const fileCount = context.entries.filter((entry) => !entry.trashed).length;
      return {
        effects: [],
        lines: [
          out(`호스트 이름:            ${context.hostName}`),
          out(`OS 이름:                PocketDesk OS`),
          out(`OS 버전:                ${SHELL_VERSION}`),
          out(`시스템 종류:            Browser-based x64`),
          out(`등록된 사용자:          ${context.userName}`),
          out(`실행 중인 창:           ${context.processes.length}개`),
          out(`가상 파일 시스템 항목:  ${fileCount}개`),
          out(`저장 위치:              IndexedDB (pocket-desk-vfs)`),
        ],
      };
    }

    case "tasklist": {
      if (context.processes.length === 0) {
        return { effects: [], lines: [out("실행 중인 창이 없습니다.")] };
      }
      const nameWidth = Math.max(12, ...context.processes.map((item) => item.title.length));
      return {
        effects: [],
        lines: [
          out(
            `${"이미지 이름".padEnd(nameWidth + 2)}${padStart("PID", 6)}${padStart("메모리 사용", 14)}`,
          ),
          out(`${"=".repeat(nameWidth + 2)}${"=".repeat(6)}${"=".repeat(14)}`),
          ...context.processes.map((item, index) =>
            out(
              `${item.title.padEnd(nameWidth + 2)}${padStart(String(index + 1), 6)}${padStart(`${formatCount(item.memoryMb)} MB`, 14)}`,
            ),
          ),
        ],
      };
    }

    case "taskkill": {
      const pidFlag = args.findIndex((value) => value.toLowerCase() === "/pid");
      const pidValue = pidFlag >= 0 ? Number(args[pidFlag + 1]) : Number(args[0]);
      const target = context.processes[pidValue - 1];
      if (!Number.isInteger(pidValue) || !target) {
        return {
          effects: [],
          lines: [err("사용법: taskkill /pid <번호>. 번호는 tasklist 로 확인하세요.")],
        };
      }
      return {
        effects: [{ kind: "killWindow", windowId: target.id }],
        lines: [out(`성공: PID ${pidValue} 프로세스(${target.title})를 종료했습니다.`)],
      };
    }

    case "cd":
    case "chdir": {
      if (args.length === 0) {
        return { effects: [], lines: [out(formatShellPath(context.entries, context.cwdId))] };
      }
      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (!target) {
        return { effects: [], lines: [err("지정된 경로를 찾을 수 없습니다.")] };
      }
      if (target.kind === "entry") {
        return { effects: [], lines: [err("디렉터리 이름이 잘못되었습니다.")] };
      }
      return { effects: [{ folderId: target.folderId, kind: "chdir" }], lines: [] };
    }

    case "dir":
    case "ls": {
      if (isWildcardPattern(argText)) {
        const matches = expandShellWildcard(context.entries, context.cwdId, argText);
        if (matches.length === 0) {
          return { effects: [], lines: [err("파일을 찾을 수 없습니다.")] };
        }
        return { effects: [], lines: renderDirRows(context, matches) };
      }
      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (!target || target.kind === "entry") {
        return { effects: [], lines: [err("파일을 찾을 수 없습니다.")] };
      }
      return { effects: [], lines: renderDir(context, target.folderId) };
    }

    case "tree": {
      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (!target || target.kind === "entry") {
        return { effects: [], lines: [err("지정된 경로를 찾을 수 없습니다.")] };
      }
      return { effects: [], lines: renderTree(context, target.folderId) };
    }

    case "type":
    case "cat": {
      if (args.length === 0) {
        return { effects: [], lines: [err("사용법: type <파일 이름>")] };
      }
      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (!target) {
        return { effects: [], lines: [err(`${argText} 파일을 찾을 수 없습니다.`)] };
      }
      if (target.kind === "folder") {
        return {
          effects: [],
          lines: [err("액세스가 거부되었습니다. 폴더는 표시할 수 없습니다.")],
        };
      }
      const content = target.entry.content ?? "";
      if (content.startsWith("data:")) {
        return {
          effects: [],
          lines: [
            err(`${target.entry.name}은 이진 이미지 파일입니다. 그림판에서 열어 주세요.`),
          ],
        };
      }
      if (!content) return { effects: [], lines: [out("")] };
      return { effects: [], lines: content.split("\n").map(out) };
    }

    case "echo": {
      const text = commandText.slice(commandText.toLowerCase().indexOf("echo") + 4).trim();
      if (!redirection) {
        return { effects: [], lines: [out(text || "")] };
      }
      if (!redirection.target) {
        return { effects: [], lines: [err("리디렉션할 파일 이름이 없습니다.")] };
      }
      const existing = resolveShellTarget(context.entries, context.cwdId, redirection.target);
      if (existing?.kind === "folder") {
        return {
          effects: [],
          lines: [err("액세스가 거부되었습니다. 폴더에는 쓸 수 없습니다.")],
        };
      }
      const destination = resolveShellParent(
        context.entries,
        context.cwdId,
        redirection.target,
      );
      if (!destination) {
        return { effects: [], lines: [err("지정된 경로를 찾을 수 없습니다.")] };
      }
      const previous = existing?.kind === "entry" ? (existing.entry.content ?? "") : "";
      const nextContent = redirection.append && previous ? `${previous}\n${text}` : text;
      const name = existing?.kind === "entry" ? existing.entry.name : destination.name;
      return {
        effects: [
          {
            content: nextContent,
            existingItemId: existing?.kind === "entry" ? existing.entry.id : undefined,
            kind: "writeFile",
            name,
            parentId:
              existing?.kind === "entry" ? existing.entry.parentId : destination.parentId,
          },
        ],
        lines: [out(`${name}에 ${redirection.append ? "추가" : "저장"}했습니다.`)],
      };
    }

    case "md":
    case "mkdir": {
      if (args.length === 0) {
        return { effects: [], lines: [err("사용법: md <폴더 이름>")] };
      }
      const existing = resolveShellTarget(context.entries, context.cwdId, argText);
      if (existing) {
        return {
          effects: [],
          lines: [err(`하위 디렉터리 또는 파일 ${argText}이(가) 이미 있습니다.`)],
        };
      }
      const destination = resolveShellParent(context.entries, context.cwdId, argText);
      if (!destination) {
        return { effects: [], lines: [err("지정된 경로를 찾을 수 없습니다.")] };
      }
      return {
        effects: [{ kind: "mkdir", name: destination.name, parentId: destination.parentId }],
        lines: [out(`${destination.name} 폴더를 만들었습니다.`)],
      };
    }

    case "del":
    case "erase":
    case "rm":
    case "rd":
    case "rmdir": {
      if (args.length === 0) {
        return { effects: [], lines: [err(`사용법: ${command} <이름>`)] };
      }
      if (isWildcardPattern(argText)) {
        const matches = expandShellWildcard(context.entries, context.cwdId, argText).filter(
          (entry) => entry.kind !== "folder",
        );
        if (matches.length === 0) {
          return { effects: [], lines: [err(`${argText}과(와) 일치하는 파일이 없습니다.`)] };
        }
        return {
          effects: [{ itemIds: matches.map((entry) => entry.id), kind: "delete" }],
          lines: [out(`${matches.length}개 파일을 휴지통으로 보냈습니다.`)],
        };
      }

      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (!target) {
        return { effects: [], lines: [err(`${argText}을(를) 찾을 수 없습니다.`)] };
      }
      if (target.kind === "folder") {
        // cmd keeps folders out of `del`; `rd` is the folder command.
        if (command === "del" || command === "erase") {
          return {
            effects: [],
            lines: [err(`${argText}은(는) 폴더입니다. rd 명령을 사용하세요.`)],
          };
        }
        if (target.folderId === VFS_ROOT_ID) {
          return { effects: [], lines: [err("바탕 화면은 삭제할 수 없습니다.")] };
        }
        const folder = getVfsFolder(context.entries, target.folderId);
        if (!folder) {
          return { effects: [], lines: [err(`${argText}을(를) 찾을 수 없습니다.`)] };
        }
        if (isVfsSystemFolderId(folder.id)) {
          return {
            effects: [],
            lines: [err(`${folder.name}은(는) 시스템 폴더라 삭제할 수 없습니다.`)],
          };
        }
        if (target.folderId === context.cwdId) {
          return { effects: [], lines: [err("현재 디렉터리는 삭제할 수 없습니다.")] };
        }
        return {
          effects: [{ itemIds: [folder.id], kind: "delete" }],
          lines: [out(`${folder.name} 폴더와 하위 항목을 휴지통으로 보냈습니다.`)],
        };
      }
      return {
        effects: [{ itemIds: [target.entry.id], kind: "delete" }],
        lines: [out(`${target.entry.name}을(를) 휴지통으로 보냈습니다.`)],
      };
    }

    case "copy": {
      if (args.length < 2) {
        return { effects: [], lines: [err("사용법: copy <원본> <대상 폴더>")] };
      }
      const destination = resolveShellTarget(
        context.entries,
        context.cwdId,
        args.slice(1).join(" "),
      );
      if (!destination || destination.kind === "entry") {
        return { effects: [], lines: [err("대상 폴더를 찾을 수 없습니다.")] };
      }

      if (isWildcardPattern(args[0])) {
        const matches = expandShellWildcard(context.entries, context.cwdId, args[0]).filter(
          (entry) => entry.kind !== "folder",
        );
        if (matches.length === 0) {
          return { effects: [], lines: [err(`${args[0]}과(와) 일치하는 파일이 없습니다.`)] };
        }
        return {
          effects: [
            {
              itemIds: matches.map((entry) => entry.id),
              kind: "copy",
              parentId: destination.folderId,
            },
          ],
          lines: [out(`        ${matches.length}개 파일이 복사되었습니다.`)],
        };
      }

      const source = resolveShellTarget(context.entries, context.cwdId, args[0]);
      if (!source || source.kind === "folder") {
        return { effects: [], lines: [err("원본 파일을 찾을 수 없습니다.")] };
      }
      return {
        effects: [{ itemIds: [source.entry.id], kind: "copy", parentId: destination.folderId }],
        lines: [out("        1개 파일이 복사되었습니다.")],
      };
    }

    case "move": {
      if (args.length < 2) {
        return { effects: [], lines: [err("사용법: move <원본> <대상 폴더>")] };
      }
      const destination = resolveShellTarget(
        context.entries,
        context.cwdId,
        args.slice(1).join(" "),
      );
      if (!destination || destination.kind === "entry") {
        return { effects: [], lines: [err("대상 폴더를 찾을 수 없습니다.")] };
      }

      if (isWildcardPattern(args[0])) {
        const matches = expandShellWildcard(context.entries, context.cwdId, args[0]).filter(
          (entry) => entry.kind !== "folder",
        );
        if (matches.length === 0) {
          return { effects: [], lines: [err(`${args[0]}과(와) 일치하는 파일이 없습니다.`)] };
        }
        return {
          effects: [
            {
              itemIds: matches.map((entry) => entry.id),
              kind: "move",
              parentId: destination.folderId,
            },
          ],
          lines: [out(`        ${matches.length}개 파일이 이동되었습니다.`)],
        };
      }

      const source = resolveShellTarget(context.entries, context.cwdId, args[0]);
      if (!source || source.kind === "folder") {
        return { effects: [], lines: [err("원본 파일을 찾을 수 없습니다.")] };
      }
      return {
        effects: [{ itemIds: [source.entry.id], kind: "move", parentId: destination.folderId }],
        lines: [out("        1개 파일이 이동되었습니다.")],
      };
    }

    case "ren":
    case "rename": {
      if (args.length < 2) {
        return { effects: [], lines: [err("사용법: ren <현재 이름> <새 이름>")] };
      }
      const source = resolveShellTarget(context.entries, context.cwdId, args[0]);
      if (!source || source.kind === "folder") {
        return { effects: [], lines: [err("이름을 바꿀 파일을 찾을 수 없습니다.")] };
      }
      const nextName = args.slice(1).join(" ");
      return {
        effects: [{ itemId: source.entry.id, kind: "rename", name: nextName }],
        lines: [out(`${source.entry.name} -> ${nextName}`)],
      };
    }

    case "find":
    case "findstr": {
      if (args.length === 0) {
        return { effects: [], lines: [err("사용법: find <찾을 문자열>")] };
      }
      const needle = argText.toLowerCase();
      const matches = collectSearchMatches(context.entries, context.cwdId, needle);
      if (matches.length === 0) {
        return { effects: [], lines: [out(`"${argText}"과 일치하는 항목이 없습니다.`)] };
      }
      return {
        effects: [],
        lines: matches.map(({ entry, parentId }) =>
          out(`${formatShellPath(context.entries, parentId)}\\${entry.name}`),
        ),
      };
    }

    case "call": {
      if (args.length === 0) {
        return { effects: [], lines: [err("사용법: call <배치 파일.bat>")] };
      }
      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (!target || target.kind === "folder") {
        return { effects: [], lines: [err(`${argText} 배치 파일을 찾을 수 없습니다.`)] };
      }
      if (!/\.bat$/i.test(target.entry.name)) {
        return {
          effects: [],
          lines: [err(`${target.entry.name}은(는) 배치 파일이 아닙니다.`)],
        };
      }
      return {
        effects: [{ kind: "runScript", lines: readScriptLines(target.entry) }],
        lines: [],
      };
    }

    case "start": {
      if (args.length === 0) {
        return { effects: [], lines: [err("사용법: start <앱 이름 또는 파일>")] };
      }
      const alias = APP_LAUNCH_ALIASES[argText.toLowerCase()];
      if (alias) {
        return { effects: [{ appId: alias, kind: "launch" }], lines: [out(`${argText} 실행`)] };
      }
      const target = resolveShellTarget(context.entries, context.cwdId, argText);
      if (target?.kind === "entry") {
        return {
          effects: [{ itemId: target.entry.id, kind: "open" }],
          lines: [out(`${target.entry.name} 열기`)],
        };
      }
      if (target?.kind === "folder") {
        return {
          effects: [{ appId: "files", kind: "launch" }],
          lines: [out("파일 탐색기 실행")],
        };
      }
      return { effects: [], lines: [err(`${argText}을(를) 찾을 수 없습니다.`)] };
    }

    default: {
      const script = resolveShellTarget(context.entries, context.cwdId, commandText.trim());
      if (script?.kind === "entry" && /\.bat$/i.test(script.entry.name)) {
        return {
          effects: [{ kind: "runScript", lines: readScriptLines(script.entry) }],
          lines: [],
        };
      }
      return {
        effects: [],
        lines: [
          err(
            `'${tokens[0]}'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램이 아닙니다. help 를 입력해 보세요.`,
          ),
        ],
      };
    }
  }
}

/** Batch bodies drop blank lines and `rem` comments before they are queued. */
function readScriptLines(entry: DesktopItem) {
  return (entry.content ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(rem\b|::)/i.test(line));
}
