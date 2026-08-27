import { ChevronDown, ChevronUp, FileText, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import FileDialog from "../components/FileDialog";
import type { DesktopItem, ToastInput } from "../types";
import { getNextRovingIndex } from "../shell/keyboardNav";
import { VFS_DOCUMENTS_ID } from "../vfs/model";
import { handleMenuKeyboard } from "../shell/keyboardNav";
import { APP_BAR_HEIGHT } from "../shell/constants";
import { trapDialogFocus } from "../shell/dialogFocus";
import { clamp } from "../utils/format";

type NoteSaveStatus = "saved" | "dirty" | "saving";

/** One point Ctrl+Z can rewind to: the text, plus where the caret was in it. */
type NoteHistoryEntry = {
  selectionEnd: number;
  selectionStart: number;
  text: string;
};

/**
 * Which typing run a change belongs to. A run of the same kind folds into a
 * single undo step; `null` means the change stands on its own.
 */
type NoteEditRun = "delete" | "insert" | null;

type NoteFindMatch = {
  end: number;
  start: number;
};

type NoteEditorMenuState = {
  selectionEnd: number;
  selectionStart: number;
  x: number;
  y: number;
};

type NotepadAppProps = {
  activeNoteId: string;
  closeWindow: (windowId: string) => void;
  registerCloseGuard: (windowId: string, guard: (() => boolean) | null) => void;
  createVfsFolder: (parentId?: string) => DesktopItem;
  createVfsTextFile: () => DesktopItem;
  desktopItems: DesktopItem[];
  noteEntries: DesktopItem[];
  notify: (toast: ToastInput) => void;
  activateVfsEntry: (item: DesktopItem) => void;
  openVfsEntry: (item: DesktopItem) => void;
  saveNoteAs: (
    parentId: string,
    name: string,
    content: string,
    existingItemId?: string,
  ) => DesktopItem;
  saveNoteContent: (noteId: string, content: string) => void;
  windowId: string;
};

const NOTE_SAVE_EVENT = "pocket-desk-save-note";
const NOTE_OPEN_EVENT = "pocket-desk-open-note";
const NOTE_SAVE_AS_EVENT = "pocket-desk-save-note-as";
const NOTE_HISTORY_LIMIT = 120;
const NOTE_HISTORY_RUN_MS = 700;
const NOTE_CONTEXT_MENU_WIDTH = 232;
const NOTE_CONTEXT_MENU_HEIGHT = 240;
/** The window frame's own close button, which this app has to see coming. */
const CLIPBOARD_BLOCKED_TOAST: ToastInput = {
  detail: "브라우저가 클립보드 사용을 막았습니다. Ctrl+C나 Ctrl+V를 사용해 주세요.",
  title: "클립보드를 사용할 수 없음",
};

export default function NotepadApp({
  activeNoteId,
  closeWindow,
  registerCloseGuard,
  createVfsFolder,
  createVfsTextFile,
  desktopItems,
  noteEntries,
  notify,
  activateVfsEntry,
  openVfsEntry,
  saveNoteAs,
  saveNoteContent,
  windowId,
}: NotepadAppProps) {
  const activeNote = noteEntries.find((item) => item.id === activeNoteId) ?? noteEntries[0];
  const noteAppRef = useRef<HTMLDivElement | null>(null);
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorMenuRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const closeSaveRef = useRef<HTMLButtonElement | null>(null);
  const [text, setText] = useState(activeNote?.content ?? "");
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>("saved");
  const [noteMenu, setNoteMenu] = useState<"file" | "edit" | "view" | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(15);
  const [cursorPosition, setCursorPosition] = useState({ column: 1, line: 1 });
  const [fileDialogMode, setFileDialogMode] = useState<"open" | "save" | null>(null);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [history, setHistory] = useState<NoteHistoryEntry[]>([]);
  const [editorMenu, setEditorMenu] = useState<NoteEditorMenuState | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const historyRunRef = useRef<{ at: number; run: NoteEditRun }>({ at: 0, run: null });
  const editorSelectionRef = useRef({ end: 0, start: 0 });
  const finalSaveRef = useRef({ content: "", noteId: "", text: "" });
  const skipFinalSaveRef = useRef(false);
  const saveNoteContentRef = useRef(saveNoteContent);
  const hasUnsavedChanges = Boolean(activeNote) && text !== (activeNote?.content ?? "");
  const findMatches = useMemo(() => getNoteFindMatches(text, findQuery), [findQuery, text]);
  const findPosition =
    findMatches.length === 0 ? 0 : Math.min(findIndex, findMatches.length - 1) + 1;

  const save = () => {
    if (!activeNote) return;
    setSaveStatus("saving");
    saveNoteContent(activeNote.id, text);
    window.setTimeout(() => setSaveStatus("saved"), 220);
  };

  useEffect(() => {
    setText(activeNote?.content ?? "");
    setSaveStatus("saved");
  }, [activeNote?.content, activeNote?.id]);

  // Each document carries its own undo history — rewinding one tab into another
  // tab's text would be a data loss dressed up as an undo. Keyed on the id
  // alone, so a save of the open document does not throw its history away.
  useEffect(() => {
    setHistory([]);
    historyRunRef.current = { at: 0, run: null };
    setEditorMenu(null);
    setFindIndex(0);
  }, [activeNote?.id]);

  // Markdown documents open with the preview already showing.
  useEffect(() => {
    const name = activeNote?.name.toLowerCase() ?? "";
    if (name.endsWith(".md") || name.endsWith(".markdown")) setShowMarkdownPreview(true);
  }, [activeNote?.id, activeNote?.name]);

  useEffect(() => {
    if (!activeNote) return;
    if (text === (activeNote.content ?? "")) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("dirty");
    // While the close prompt is up, autosaving would answer the question for the
    // reader: "저장 안 함" has to be able to throw away what is on screen.
    if (closePromptOpen) return;

    const timer = window.setTimeout(() => {
      save();
    }, 850);

    return () => window.clearTimeout(timer);
  }, [activeNote?.content, activeNote?.id, closePromptOpen, text]);

  // Refs the unmount flush below reads, kept fresh every render because that
  // flush must not re-subscribe (and re-fire) whenever a prop identity changes.
  useEffect(() => {
    saveNoteContentRef.current = saveNoteContent;
    finalSaveRef.current = {
      content: activeNote?.content ?? "",
      noteId: activeNote?.id ?? "",
      text,
    };
  });

  /*
   * Autosave commits 850ms after a keystroke, and the shell can take the window
   * away sooner: Task Manager's 작업 끝내기, the window menu's 닫기, or a switch
   * to another virtual desktop, none of which this app can put a question in
   * front of. Flushing on the way out keeps the promise the dirty dot makes,
   * and is skipped when the reader has already answered "저장 안 함".
   */
  useEffect(() => {
    return () => {
      if (skipFinalSaveRef.current) return;
      const { content, noteId, text: pendingText } = finalSaveRef.current;
      if (!noteId || pendingText === content) return;
      saveNoteContentRef.current(noteId, pendingText);
    };
  }, []);

  useEffect(() => {
    const saveFromShortcut = () => save();
    window.addEventListener(NOTE_SAVE_EVENT, saveFromShortcut);
    return () => window.removeEventListener(NOTE_SAVE_EVENT, saveFromShortcut);
  }, [activeNote?.id, text]);

  useEffect(() => {
    const openFromShortcut = () => setFileDialogMode("open");
    const saveAsFromShortcut = () => setFileDialogMode("save");
    window.addEventListener(NOTE_OPEN_EVENT, openFromShortcut);
    window.addEventListener(NOTE_SAVE_AS_EVENT, saveAsFromShortcut);
    return () => {
      window.removeEventListener(NOTE_OPEN_EVENT, openFromShortcut);
      window.removeEventListener(NOTE_SAVE_AS_EVENT, saveAsFromShortcut);
    };
  }, []);

  /*
   * Windows never drops typed text without asking. The shell consults this guard
   * on every close path — the ✕, Alt+F4, the system menu, the taskbar, Task
   * Manager — so returning false is enough to hold the window open until the
   * user answers. Registered only while there is something to lose, so a clean
   * document still closes on the first click.
   */
  useEffect(() => {
    if (!hasUnsavedChanges) {
      registerCloseGuard(windowId, null);
      return;
    }

    registerCloseGuard(windowId, () => {
      setNoteMenu(null);
      setEditorMenu(null);
      setClosePromptOpen(true);
      return false;
    });
    return () => registerCloseGuard(windowId, null);
  }, [hasUnsavedChanges, registerCloseGuard, windowId]);

  useEffect(() => {
    if (!closePromptOpen) return;
    const frame = window.requestAnimationFrame(() => closeSaveRef.current?.focus());
    // Escape is 취소 wherever focus happens to be, and it is claimed in the
    // capture phase so the shell's own Escape handling stays out of it.
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setClosePromptOpen(false);
      noteEditorRef.current?.focus();
    };

    window.addEventListener("keydown", cancelOnEscape, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", cancelOnEscape, true);
    };
  }, [closePromptOpen]);

  useEffect(() => {
    if (!editorMenu) return;
    const frame = window.requestAnimationFrame(() => {
      editorMenuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editorMenu]);

  useEffect(() => {
    if (!editorMenu) return;
    const closeOnOutsidePointer = (event: Event) => {
      if (event.target instanceof Node && !editorMenuRef.current?.contains(event.target)) {
        setEditorMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setEditorMenu(null);
      noteEditorRef.current?.focus();
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editorMenu]);

  const updateCursorPosition = () => {
    const editor = noteEditorRef.current;
    if (!editor) return;
    const beforeCursor = editor.value.slice(0, editor.selectionStart);
    const lines = beforeCursor.split("\n");
    setCursorPosition({
      column: (lines[lines.length - 1]?.length ?? 0) + 1,
      line: lines.length,
    });
  };

  const rememberEditorSelection = () => {
    const editor = noteEditorRef.current;
    if (!editor) return;
    // Read before the keystroke lands, so an undo step knows where it began.
    editorSelectionRef.current = { end: editor.selectionEnd, start: editor.selectionStart };
  };

  /**
   * Records a point Ctrl+Z can return to. A steady run of single keystrokes
   * folds into one entry, so undo takes back a word rather than a letter, and
   * anything bigger — a paste, a replaced selection, a newline — stands alone.
   */
  const pushHistory = (entry: NoteHistoryEntry, run: NoteEditRun) => {
    const now = Date.now();
    const previous = historyRunRef.current;
    historyRunRef.current = { at: now, run };
    if (run !== null && previous.run === run && now - previous.at < NOTE_HISTORY_RUN_MS) {
      return;
    }
    setHistory((current) => [...current, entry].slice(-NOTE_HISTORY_LIMIT));
  };

  /** Puts the caret back once React has painted a programmatic text change. */
  const selectInEditor = (start: number, end: number) => {
    window.requestAnimationFrame(() => {
      const editor = noteEditorRef.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(start, end);
      editorSelectionRef.current = { end, start };
      updateCursorPosition();
    });
  };

  /** Replaces a range as one undo step and leaves the caret after the insertion. */
  const replaceEditorRange = (start: number, end: number, insertion: string) => {
    pushHistory({ selectionEnd: end, selectionStart: start, text }, null);
    setText(`${text.slice(0, start)}${insertion}${text.slice(end)}`);
    selectInEditor(start + insertion.length, start + insertion.length);
  };

  const handleEditorChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value;
    const selection = editorSelectionRef.current;
    pushHistory(
      { selectionEnd: selection.end, selectionStart: selection.start, text },
      getNoteEditRun(text, nextText),
    );
    setText(nextText);
  };

  /*
   * A controlled <textarea> has no working native undo: every render assigns
   * `value` back onto the element, and an assigned value wipes the browser's own
   * undo stack. The text has to stay controlled — the tab title, the Markdown
   * preview and 찾기 all read it — so the history lives here instead.
   */
  const undo = () => {
    setNoteMenu(null);
    setEditorMenu(null);
    const entry = history[history.length - 1];
    if (!entry) return;
    setHistory((current) => current.slice(0, -1));
    historyRunRef.current = { at: 0, run: null };
    setText(entry.text);
    selectInEditor(entry.selectionStart, entry.selectionEnd);
  };

  const insertDateTime = () => {
    const editor = noteEditorRef.current;
    if (!editor) return;
    setNoteMenu(null);
    replaceEditorRange(
      editor.selectionStart,
      editor.selectionEnd,
      new Date().toLocaleString("ko-KR"),
    );
  };

  const selectAllText = () => {
    setNoteMenu(null);
    setEditorMenu(null);
    const editor = noteEditorRef.current;
    if (!editor) return;
    editor.focus();
    editor.select();
    rememberEditorSelection();
    updateCursorPosition();
  };

  const requestClose = () => {
    setNoteMenu(null);
    setEditorMenu(null);
    if (!hasUnsavedChanges) {
      closeWindow(windowId);
      return;
    }
    setClosePromptOpen(true);
  };

  const closeAfterSave = () => {
    if (activeNote) saveNoteContent(activeNote.id, text);
    // The content is already written, so the unmount flush has nothing to add.
    skipFinalSaveRef.current = true;
    setClosePromptOpen(false);
    registerCloseGuard(windowId, null);
    closeWindow(windowId);
  };

  const closeWithoutSaving = () => {
    skipFinalSaveRef.current = true;
    setClosePromptOpen(false);
    registerCloseGuard(windowId, null);
    closeWindow(windowId);
  };

  const cancelClose = () => {
    setClosePromptOpen(false);
    noteEditorRef.current?.focus();
  };

  const openFind = () => {
    setNoteMenu(null);
    setEditorMenu(null);
    setFindOpen(true);
    window.requestAnimationFrame(() => findInputRef.current?.select());
  };

  const closeFind = () => {
    setFindOpen(false);
    // Focus lands back on the match, where the selection becomes visible again.
    noteEditorRef.current?.focus();
    updateCursorPosition();
  };

  /**
   * A textarea will not scroll itself to a selection set from script — measured
   * in Chrome, where neither focus() nor a re-focus moves the view — so the
   * match's row is worked out from the line height and the view moved by hand.
   * The row count comes from the newlines before the match, which is exact with
   * 자동 줄 바꿈 off and lands just above the match when a line has wrapped.
   */
  const scrollEditorToOffset = (editor: HTMLTextAreaElement, offset: number) => {
    const lineHeight = Number.parseFloat(window.getComputedStyle(editor).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    const top = (editor.value.slice(0, offset).split("\n").length - 1) * lineHeight;
    const alreadyInView =
      top >= editor.scrollTop && top + lineHeight <= editor.scrollTop + editor.clientHeight;
    if (alreadyInView) return;
    editor.scrollTop = clamp(top - editor.clientHeight / 3, 0, editor.scrollHeight);
  };

  /**
   * Selects a match and scrolls it into view. Focus is left where it is, so the
   * find field keeps taking keystrokes; closing 찾기 hands focus to the editor,
   * where the selection becomes visible again.
   */
  const revealFindMatch = (matches: NoteFindMatch[], index: number) => {
    setFindIndex(index);
    const match = matches[index];
    const editor = noteEditorRef.current;
    if (!match || !editor) return;
    editor.setSelectionRange(match.start, match.end);
    editorSelectionRef.current = { end: match.end, start: match.start };
    scrollEditorToOffset(editor, match.start);
    updateCursorPosition();
  };

  const stepFindMatch = (direction: 1 | -1) => {
    if (findMatches.length === 0) return;
    const from = Math.min(findIndex, findMatches.length - 1);
    revealFindMatch(findMatches, (from + direction + findMatches.length) % findMatches.length);
  };

  const handleFindQueryChange = (value: string) => {
    setFindQuery(value);
    // `findMatches` is a render behind, so the matches for what was just typed
    // are computed here to move the selection along with the typing.
    const matches = getNoteFindMatches(text, value);
    const caret = noteEditorRef.current?.selectionStart ?? 0;
    const fromCaret = matches.findIndex((match) => match.start >= caret);
    revealFindMatch(matches, fromCaret === -1 ? 0 : fromCaret);
  };

  const handleFindKeyboard = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeFind();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      stepFindMatch(event.shiftKey ? -1 : 1);
    }
  };

  const showEditorMenu = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    const editor = event.currentTarget;
    // Without this the host browser's own Reload / Inspect menu opens on top of
    // the desktop, which gives the whole illusion away.
    event.preventDefault();
    setNoteMenu(null);
    setEditorMenu({
      selectionEnd: editor.selectionEnd,
      selectionStart: editor.selectionStart,
      x: clamp(event.clientX, 8, Math.max(8, window.innerWidth - NOTE_CONTEXT_MENU_WIDTH)),
      y: clamp(
        event.clientY,
        8,
        Math.max(8, window.innerHeight - APP_BAR_HEIGHT - NOTE_CONTEXT_MENU_HEIGHT),
      ),
    });
  };

  const copyEditorSelection = async (menu: NoteEditorMenuState) => {
    setEditorMenu(null);
    const selected = text.slice(menu.selectionStart, menu.selectionEnd);
    if (!selected) return;
    if (!(await writeClipboardText(selected))) {
      notify(CLIPBOARD_BLOCKED_TOAST);
      return;
    }
    selectInEditor(menu.selectionStart, menu.selectionEnd);
  };

  const cutEditorSelection = async (menu: NoteEditorMenuState) => {
    setEditorMenu(null);
    const selected = text.slice(menu.selectionStart, menu.selectionEnd);
    if (!selected) return;
    // Nothing is removed unless the clipboard actually took a copy of it.
    if (!(await writeClipboardText(selected))) {
      notify(CLIPBOARD_BLOCKED_TOAST);
      return;
    }
    replaceEditorRange(menu.selectionStart, menu.selectionEnd, "");
  };

  const pasteIntoEditor = async (menu: NoteEditorMenuState) => {
    setEditorMenu(null);
    const pasted = await readClipboardText();
    if (pasted === null) {
      notify(CLIPBOARD_BLOCKED_TOAST);
      return;
    }
    replaceEditorRange(menu.selectionStart, menu.selectionEnd, pasted);
  };

  const deleteEditorSelection = (menu: NoteEditorMenuState) => {
    setEditorMenu(null);
    if (menu.selectionStart === menu.selectionEnd) return;
    replaceEditorRange(menu.selectionStart, menu.selectionEnd, "");
  };

  return (
    <div
      className="notepad-app app-fill"
      onKeyDown={(event) => {
        // Alt+F4 is the shell's shortcut, handled on `window`. Stopping the
        // event here is what lets the app ask about unsaved text first.
        if (event.altKey && event.key === "F4") {
          event.preventDefault();
          event.stopPropagation();
          requestClose();
          return;
        }
        if (event.key === "F3" && findOpen) {
          event.preventDefault();
          event.stopPropagation();
          stepFindMatch(event.shiftKey ? -1 : 1);
          return;
        }
        if (event.key === "Escape" && findOpen && !editorMenu && !fileDialogMode) {
          event.preventDefault();
          event.stopPropagation();
          closeFind();
          return;
        }
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key === "o") {
          event.preventDefault();
          event.stopPropagation();
          setNoteMenu(null);
          setFileDialogMode("open");
        } else if (key === "s" && event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          setNoteMenu(null);
          setFileDialogMode("save");
        } else if (key === "n") {
          event.preventDefault();
          event.stopPropagation();
          activateVfsEntry(createVfsTextFile());
        } else if (key === "f") {
          event.preventDefault();
          event.stopPropagation();
          openFind();
        } else if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          undo();
        }
      }}
      ref={noteAppRef}
    >
      <div className="note-menu-bar">
        <button
          aria-expanded={noteMenu === "file"}
          onClick={() => setNoteMenu((current) => (current === "file" ? null : "file"))}
          type="button"
        >
          파일
        </button>
        <button
          aria-expanded={noteMenu === "edit"}
          onClick={() => setNoteMenu((current) => (current === "edit" ? null : "edit"))}
          type="button"
        >
          편집
        </button>
        <button
          aria-expanded={noteMenu === "view"}
          onClick={() => setNoteMenu((current) => (current === "view" ? null : "view"))}
          type="button"
        >
          보기
        </button>
      </div>
      {noteMenu === "file" && (
        <div
          className="note-menu"
          role="menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
        >
          <button
            onClick={() => {
              setFileDialogMode("open");
              setNoteMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            열기 <kbd>Ctrl+O</kbd>
          </button>
          <button
            onClick={() => {
              const item = createVfsTextFile();
              activateVfsEntry(item);
              setNoteMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            새 탭 <kbd>Ctrl+N</kbd>
          </button>
          <button
            onClick={() => {
              save();
              setNoteMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            저장 <kbd>Ctrl+S</kbd>
          </button>
          <button
            onClick={() => {
              setFileDialogMode("save");
              setNoteMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            다른 이름으로 저장 <kbd>Ctrl+Shift+S</kbd>
          </button>
        </div>
      )}
      {noteMenu === "edit" && (
        <div
          className="note-menu"
          role="menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
        >
          <button disabled={history.length === 0} onClick={undo} role="menuitem" type="button">
            실행 취소 <kbd>Ctrl+Z</kbd>
          </button>
          <button onClick={openFind} role="menuitem" type="button">
            찾기 <kbd>Ctrl+F</kbd>
          </button>
          <button onClick={selectAllText} role="menuitem" type="button">
            모두 선택 <kbd>Ctrl+A</kbd>
          </button>
          <button onClick={insertDateTime} role="menuitem" type="button">
            시간/날짜 <kbd>F5</kbd>
          </button>
        </div>
      )}
      {noteMenu === "view" && (
        <div
          className="note-menu"
          role="menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
        >
          <button
            aria-checked={wordWrap}
            onClick={() => {
              setWordWrap((current) => !current);
              setNoteMenu(null);
            }}
            role="menuitemcheckbox"
            type="button"
          >
            자동 줄 바꿈 <span>{wordWrap ? "✓" : ""}</span>
          </button>
          <button
            disabled={fontSize >= 24}
            onClick={() => setFontSize((current) => Math.min(24, current + 1))}
            role="menuitem"
            type="button"
          >
            글꼴 크게
          </button>
          <button
            disabled={fontSize <= 12}
            onClick={() => setFontSize((current) => Math.max(12, current - 1))}
            role="menuitem"
            type="button"
          >
            글꼴 작게
          </button>
          <button
            aria-checked={showMarkdownPreview}
            onClick={() => {
              setShowMarkdownPreview((current) => !current);
              setNoteMenu(null);
            }}
            role="menuitemcheckbox"
            type="button"
          >
            Markdown 미리보기 <span>{showMarkdownPreview ? "✓" : ""}</span>
          </button>
        </div>
      )}
      <div className="note-tab-row">
        <div
          className="note-tabs"
          onKeyDown={(event) => {
            // role="tablist" promises Left/Right movement between documents.
            const index = noteEntries.findIndex((note) => note.id === activeNote?.id);
            const next = getNextRovingIndex(event.key, index, noteEntries.length);
            if (next === null) return;
            event.preventDefault();
            activateVfsEntry(noteEntries[next]);
          }}
          role="tablist"
        >
          {noteEntries.map((note) => (
            <button
              aria-controls="note-editor-panel"
              aria-selected={note.id === activeNote?.id}
              className={note.id === activeNote?.id ? "is-selected" : ""}
              key={note.id}
              onClick={() => activateVfsEntry(note)}
              role="tab"
              tabIndex={note.id === activeNote?.id ? 0 : -1}
              type="button"
            >
              <FileText aria-hidden="true" size={14} />
              <span>{note.name}</span>
              {note.id === activeNote?.id && saveStatus !== "saved" && (
                <span aria-label="저장되지 않은 변경 내용" className="note-dirty-dot" />
              )}
            </button>
          ))}
        </div>
        <button
          aria-label="새 탭"
          onClick={() => activateVfsEntry(createVfsTextFile())}
          title="새 탭"
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
      {findOpen && (
        <div aria-label="찾기" className="note-find-bar" role="search">
          <label className="note-find-field">
            <Search aria-hidden="true" size={14} />
            <input
              aria-label="찾을 내용"
              onChange={(event) => handleFindQueryChange(event.target.value)}
              onKeyDown={handleFindKeyboard}
              placeholder="찾을 내용"
              ref={findInputRef}
              type="text"
              value={findQuery}
            />
          </label>
          <span className="note-find-count">
            {findMatches.length > 0
              ? `${findPosition}/${findMatches.length}`
              : findQuery
                ? "결과 없음"
                : "0/0"}
          </span>
          <button
            aria-label="이전 찾기"
            disabled={findMatches.length === 0}
            onClick={() => stepFindMatch(-1)}
            title="이전 찾기 (Shift+F3)"
            type="button"
          >
            <ChevronUp aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="다음 찾기"
            disabled={findMatches.length === 0}
            onClick={() => stepFindMatch(1)}
            title="다음 찾기 (F3)"
            type="button"
          >
            <ChevronDown aria-hidden="true" size={16} />
          </button>
          <button aria-label="찾기 닫기" onClick={closeFind} title="닫기 (Esc)" type="button">
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      )}
      <div
        className={`note-workspace${showMarkdownPreview ? " is-split" : ""}`}
        id="note-editor-panel"
        role="tabpanel"
      >
        <textarea
          aria-label="메모 내용"
          className="note-editor"
          disabled={!activeNote}
          onChange={handleEditorChange}
          onClick={() => {
            rememberEditorSelection();
            updateCursorPosition();
          }}
          onContextMenu={showEditorMenu}
          onKeyDown={rememberEditorSelection}
          onKeyUp={updateCursorPosition}
          ref={noteEditorRef}
          spellCheck
          style={{ fontSize }}
          value={text}
          wrap={wordWrap ? "soft" : "off"}
        />
        {showMarkdownPreview && <MarkdownPreview text={text} />}
      </div>
      <div className="note-statusbar">
        <span>
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>
        <span>100%</span>
        <span>Windows (CRLF)</span>
        <span>UTF-8</span>
      </div>
      {fileDialogMode && (
        <FileDialog
          allowedKinds={["note"]}
          createVfsFolder={createVfsFolder}
          defaultExtension="txt"
          defaultName={activeNote?.name ?? "새 텍스트 문서.txt"}
          fileTypeLabel="텍스트 문서 (*.txt)"
          initialFolderId={activeNote?.parentId ?? VFS_DOCUMENTS_ID}
          items={desktopItems}
          mode={fileDialogMode}
          onCancel={() => setFileDialogMode(null)}
          onOpen={(item) => {
            activateVfsEntry(item);
            setFileDialogMode(null);
          }}
          onSave={({ existingItem, name, parentId }) => {
            const item = saveNoteAs(parentId, name, text, existingItem?.id);
            openVfsEntry(item);
            setFileDialogMode(null);
          }}
          title={fileDialogMode === "open" ? "열기" : "다른 이름으로 저장"}
        />
      )}
      {editorMenu && (
        <div
          aria-label="메모 편집 메뉴"
          className="note-menu note-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          onPointerDown={(event) => event.stopPropagation()}
          ref={editorMenuRef}
          role="menu"
          style={{ left: editorMenu.x, top: editorMenu.y }}
        >
          <button disabled={history.length === 0} onClick={undo} role="menuitem" type="button">
            실행 취소 <kbd>Ctrl+Z</kbd>
          </button>
          <button
            disabled={editorMenu.selectionStart === editorMenu.selectionEnd}
            onClick={() => void cutEditorSelection(editorMenu)}
            role="menuitem"
            type="button"
          >
            잘라내기 <kbd>Ctrl+X</kbd>
          </button>
          <button
            disabled={editorMenu.selectionStart === editorMenu.selectionEnd}
            onClick={() => void copyEditorSelection(editorMenu)}
            role="menuitem"
            type="button"
          >
            복사 <kbd>Ctrl+C</kbd>
          </button>
          <button
            onClick={() => void pasteIntoEditor(editorMenu)}
            role="menuitem"
            type="button"
          >
            붙여넣기 <kbd>Ctrl+V</kbd>
          </button>
          <button
            disabled={editorMenu.selectionStart === editorMenu.selectionEnd}
            onClick={() => deleteEditorSelection(editorMenu)}
            role="menuitem"
            type="button"
          >
            삭제 <kbd>Del</kbd>
          </button>
          <button onClick={selectAllText} role="menuitem" type="button">
            모두 선택 <kbd>Ctrl+A</kbd>
          </button>
        </div>
      )}
      {closePromptOpen && (
        <div className="note-close-overlay">
          <section
            aria-label="저장 확인"
            aria-modal="true"
            onKeyDown={(event) => trapDialogFocus(event, event.currentTarget)}
            role="alertdialog"
          >
            <strong>{activeNote?.name ?? "제목 없음"}의 변경 내용을 저장하시겠습니까?</strong>
            <p>저장하지 않으면 지금까지 입력한 내용이 사라집니다.</p>
            <div>
              <button
                className="is-primary"
                onClick={closeAfterSave}
                ref={closeSaveRef}
                type="button"
              >
                저장
              </button>
              <button onClick={closeWithoutSaving} type="button">
                저장 안 함
              </button>
              <button onClick={cancelClose} type="button">
                취소
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * Every place `query` appears in `text`, case-insensitively like Notepad's own
 * 찾기 default. Matched with a regular expression rather than a lowercased copy
 * of the text, because lowercasing can change a string's length and slide every
 * offset after it out of place.
 */
function getNoteFindMatches(text: string, query: string): NoteFindMatch[] {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const matches: NoteFindMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const end = match.index + (match[0].length || 1);
    matches.push({ end, start: match.index });
    pattern.lastIndex = end;
  }

  return matches;
}

/**
 * The typing run a change belongs to, or null when it should be its own undo
 * step. One character in or out continues a run; a newline ends it, so undo
 * stops at line boundaries instead of swallowing a whole paragraph.
 */
function getNoteEditRun(previous: string, next: string): NoteEditRun {
  const growth = next.length - previous.length;
  if (Math.abs(growth) !== 1) return null;

  let index = 0;
  while (index < previous.length && previous[index] === next[index]) index += 1;
  if (growth === 1) return next[index] === "\n" ? null : "insert";
  return previous[index] === "\n" ? null : "delete";
}

/** Reads the clipboard, or null when the browser refuses to hand it over. */
async function readClipboardText() {
  try {
    if (typeof navigator.clipboard?.readText !== "function") return null;
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

async function writeClipboardText(value: string) {
  try {
    if (typeof navigator.clipboard?.writeText !== "function") return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function MarkdownPreview({ text }: { text: string }) {
  const blocks = useMemo(() => renderMarkdownBlocks(text), [text]);

  return (
    <div className="markdown-preview" aria-label="Markdown 미리보기">
      {blocks.length > 0 ? (
        blocks
      ) : (
        <p className="markdown-empty">미리볼 Markdown 내용이 없습니다.</p>
      )}
    </div>
  );
}

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: JSX.Element[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const content = renderMarkdownInline(heading[2], `heading-${index}`);
      if (level === 1) blocks.push(<h2 key={`heading-${index}`}>{content}</h2>);
      if (level === 2) blocks.push(<h3 key={`heading-${index}`}>{content}</h3>);
      if (level === 3) blocks.push(<h4 key={`heading-${index}`}>{content}</h4>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: JSX.Element[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(
          <li key={`ul-${index}`}>
            {renderMarkdownInline(lines[index].trim().replace(/^[-*]\s+/, ""), `ul-${index}`)}
          </li>,
        );
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: JSX.Element[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(
          <li key={`ol-${index}`}>
            {renderMarkdownInline(lines[index].trim().replace(/^\d+\.\s+/, ""), `ol-${index}`)}
          </li>,
        );
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderMarkdownInline(quoteLines.join(" "), `quote-${index}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith(">") &&
      !lines[index].trim().startsWith("```")
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`}>{renderMarkdownInline(paragraphLines.join(" "), `p-${index}`)}</p>,
    );
  }

  return blocks;
}

function renderMarkdownInline(value: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push(value.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a href={link[2]} key={key} rel="noreferrer" target="_blank">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes;
}
