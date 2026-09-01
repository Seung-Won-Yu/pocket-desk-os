import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatShellPath,
  resolveShellTarget,
  runShellCommand,
  SHELL_VERSION,
  type ShellLine,
  type ShellProcess,
} from "../shell/commandShell";
import type { AppId, DesktopItem, OpenWindowInfo, SoundEffectName } from "../types";
import { getVfsFolder, VFS_ROOT_ID } from "../vfs/model";

type TerminalAppProps = {
  closeWindow: (windowId: string) => void;
  deleteVfsEntry: (itemId: string) => void;
  desktopItems: DesktopItem[];
  duplicateVfsEntries: (itemIds: string[], options?: { parentId?: string }) => string[];
  createVfsFolder: (parentId?: string, name?: string) => DesktopItem;
  moveVfsEntries: (itemIds: string[], parentId: string) => boolean;
  openApp: (appId: AppId) => void;
  requestPowerAction: (action: "lock" | "off" | "restart") => void;
  openVfsEntry: (item: DesktopItem) => void;
  openWindows: OpenWindowInfo[];
  userName: string;
  playSound: (effect: SoundEffectName) => void;
  renameVfsEntry: (itemId: string, name: string) => void;
  saveNoteAs: (
    parentId: string,
    name: string,
    content: string,
    existingItemId?: string,
    options?: { activate?: boolean },
  ) => DesktopItem;
  windowId: string;
};

const HISTORY_LIMIT = 80;

function createBanner(): ShellLine[] {
  return [
    { kind: "output", text: SHELL_VERSION },
    { kind: "output", text: "(c) PocketDesk. 브라우저 안에서 동작하는 가상 셸입니다." },
    { kind: "output", text: "" },
    { kind: "output", text: "help 를 입력하면 사용할 수 있는 명령을 볼 수 있습니다." },
    { kind: "output", text: "" },
  ];
}

export default function TerminalApp({
  closeWindow,
  createVfsFolder,
  deleteVfsEntry,
  desktopItems,
  duplicateVfsEntries,
  moveVfsEntries,
  openApp,
  requestPowerAction,
  openVfsEntry,
  openWindows,
  playSound,
  renameVfsEntry,
  saveNoteAs,
  userName,
  windowId,
}: TerminalAppProps) {
  const [lines, setLines] = useState<ShellLine[]>(() => createBanner());
  const [draft, setDraft] = useState("");
  const [cwdId, setCwdId] = useState(VFS_ROOT_ID);
  const [history, setHistory] = useState<string[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [scriptQueue, setScriptQueue] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A folder deleted from Explorer must not leave the prompt pointing at nothing.
  useEffect(() => {
    if (cwdId === VFS_ROOT_ID) return;
    if (!getVfsFolder(desktopItems, cwdId)) setCwdId(VFS_ROOT_ID);
  }, [cwdId, desktopItems]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines]);

  const prompt = useMemo(() => formatShellPath(desktopItems, cwdId), [cwdId, desktopItems]);

  const processes = useMemo<ShellProcess[]>(
    () =>
      openWindows.map((item, index) => ({
        appId: item.appId,
        id: item.id,
        // Deterministic per-window figure so repeated `tasklist` calls stay stable.
        memoryMb: 24 + ((index * 37) % 96),
        title: item.title,
      })),
    [openWindows],
  );

  const submit = (raw: string) => {
    const echoed: ShellLine = { kind: "input", text: `${prompt}> ${raw}` };
    const result = runShellCommand(raw, {
      cwdId,
      entries: desktopItems,
      env,
      hostName: "POCKETDESK",
      now: Date.now(),
      processes,
      userName,
    });

    let cleared = false;
    for (const effect of result.effects) {
      switch (effect.kind) {
        case "chdir":
          setCwdId(effect.folderId);
          break;
        case "clear":
          cleared = true;
          break;
        case "copy":
          duplicateVfsEntries(effect.itemIds, { parentId: effect.parentId });
          break;
        case "delete":
          effect.itemIds.forEach(deleteVfsEntry);
          break;
        case "exit":
          closeWindow(windowId);
          return;
        case "killWindow":
          closeWindow(effect.windowId);
          break;
        case "launch":
          openApp(effect.appId);
          break;
        case "power":
          requestPowerAction(effect.action);
          // A blocked action (a guard said no) simply leaves the desktop as
          // is; nothing further for this line to do either way.
          return;
        case "mkdir":
          // Name it on creation: a follow-up rename would not see this folder,
          // because the callback still reads the pre-update entry list.
          createVfsFolder(effect.parentId, effect.name);
          break;
        case "move":
          moveVfsEntries(effect.itemIds, effect.parentId);
          break;
        case "open": {
          const entry = desktopItems.find((item) => item.id === effect.itemId);
          if (entry) openVfsEntry(entry);
          break;
        }
        case "clearEnv":
          setEnv((current) => {
            const next = { ...current };
            delete next[effect.name.toUpperCase()];
            return next;
          });
          break;
        case "rename":
          renameVfsEntry(effect.itemId, effect.name);
          break;
        case "runScript":
          setScriptQueue((current) => [...current, ...effect.lines]);
          break;
        case "setEnv":
          setEnv((current) => ({ ...current, [effect.name.toUpperCase()]: effect.value }));
          break;
        case "writeFile":
          // cmd writes redirects silently; the foreground document stays put.
          saveNoteAs(effect.parentId, effect.name, effect.content, effect.existingItemId, {
            activate: false,
          });
          break;
      }
    }

    if (result.lines.some((line) => line.kind === "error")) playSound("error");
    setLines((current) => (cleared ? [] : [...current, echoed, ...result.lines]));
    if (raw.trim()) {
      setHistory((current) =>
        [...current.filter((item) => item !== raw), raw].slice(-HISTORY_LIMIT),
      );
    }
    setHistoryIndex(null);
  };

  // Batch lines run one per commit, so each command sees what the line before it
  // wrote to the file system instead of a stale entry list.
  useEffect(() => {
    if (scriptQueue.length === 0) return;
    const [next, ...rest] = scriptQueue;
    const timer = window.setTimeout(() => {
      setScriptQueue(rest);
      submit(next);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptQueue]);

  const completeDraft = () => {
    const match = /(\S*)$/.exec(draft);
    const fragment = match ? match[1] : "";
    const target = resolveShellTarget(desktopItems, cwdId, fragment.replace(/[^\\/]*$/, ""));
    const parentId = target && target.kind === "folder" ? target.folderId : cwdId;
    const leaf = fragment.split(/[\\/]/).slice(-1)[0]?.toLowerCase() ?? "";
    const candidates = desktopItems
      .filter(
        (item) =>
          !item.trashed &&
          item.parentId === parentId &&
          item.name.toLowerCase().startsWith(leaf),
      )
      .map((item) => item.name)
      .sort((first, second) => first.localeCompare(second, "ko"));

    if (candidates.length === 0) return;
    if (candidates.length > 1) {
      setLines((current) => [
        ...current,
        { kind: "input", text: `${prompt}> ${draft}` },
        ...candidates.map((name): ShellLine => ({ kind: "output", text: name })),
      ]);
      return;
    }

    const completion = candidates[0].includes(" ") ? `"${candidates[0]}"` : candidates[0];
    setDraft(draft.slice(0, draft.length - leaf.length) + completion);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(draft);
      setDraft("");
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      completeDraft();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const nextIndex =
        historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setDraft(history[nextIndex]);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setDraft("");
        return;
      }
      setHistoryIndex(nextIndex);
      setDraft(history[nextIndex]);
      return;
    }
    if (event.key === "l" && event.ctrlKey) {
      event.preventDefault();
      setLines([]);
      return;
    }
    if (event.key === "c" && event.ctrlKey) {
      setLines((current) => [...current, { kind: "input", text: `${prompt}> ${draft}^C` }]);
      setDraft("");
    }
  };

  return (
    <div
      className="terminal-app"
      onClick={(event) => {
        /*
         * Clicking the window puts the caret back in the prompt — but a click
         * also ends a drag, and focusing collapses the selection. Dragging
         * across the output therefore deselected it on mouseup, leaving no way
         * to copy anything the terminal had printed.
         */
        const selection = window.getSelection();
        const anchor = selection?.anchorNode;
        // Only a live selection inside this terminal blocks the refocus. A null
        // selection blocked it forever, and one left in another window blocked
        // it from here.
        if (
          selection &&
          !selection.isCollapsed &&
          anchor &&
          event.currentTarget.contains(
            anchor instanceof Element ? anchor : anchor.parentElement,
          )
        ) {
          return;
        }
        inputRef.current?.focus();
      }}
      onContextMenu={(event) => {
        // The fake desktop's own menus are the ones that belong here, and cmd
        // reserves the right click for paste; Chrome's menu was appearing over
        // the shell instead.
        event.preventDefault();
      }}
    >
      <div className="terminal-scroll" ref={scrollRef}>
        {lines.map((line, index) => (
          <pre className={`terminal-line is-${line.kind}`} key={`${index}-${line.text}`}>
            {line.text || " "}
          </pre>
        ))}
        <div className="terminal-prompt">
          <label className="terminal-path" htmlFor={`terminal-input-${windowId}`}>
            {prompt}&gt;
          </label>
          <input
            aria-label="명령 입력"
            autoComplete="off"
            autoFocus
            id={`terminal-input-${windowId}`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            spellCheck={false}
            value={draft}
          />
        </div>
      </div>
    </div>
  );
}
