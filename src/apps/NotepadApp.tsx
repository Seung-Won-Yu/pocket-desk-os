import { FileText, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import FileDialog from "../components/FileDialog";
import type { DesktopItem } from "../types";
import { VFS_DOCUMENTS_ID } from "../vfs/model";

type NoteSaveStatus = "saved" | "dirty" | "saving";

type NotepadAppProps = {
  activeNoteId: string;
  createVfsFolder: (parentId?: string) => DesktopItem;
  createVfsTextFile: () => DesktopItem;
  desktopItems: DesktopItem[];
  noteEntries: DesktopItem[];
  openVfsEntry: (item: DesktopItem) => void;
  saveNoteAs: (
    parentId: string,
    name: string,
    content: string,
    existingItemId?: string,
  ) => DesktopItem;
  saveNoteContent: (noteId: string, content: string) => void;
};

const NOTE_SAVE_EVENT = "pocket-desk-save-note";
const NOTE_OPEN_EVENT = "pocket-desk-open-note";
const NOTE_SAVE_AS_EVENT = "pocket-desk-save-note-as";

export default function NotepadApp({
  activeNoteId,
  createVfsFolder,
  createVfsTextFile,
  desktopItems,
  noteEntries,
  openVfsEntry,
  saveNoteAs,
  saveNoteContent,
}: NotepadAppProps) {
  const activeNote = noteEntries.find((item) => item.id === activeNoteId) ?? noteEntries[0];
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState(activeNote?.content ?? "");
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>("saved");
  const [noteMenu, setNoteMenu] = useState<"file" | "edit" | "view" | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(15);
  const [cursorPosition, setCursorPosition] = useState({ column: 1, line: 1 });
  const [fileDialogMode, setFileDialogMode] = useState<"open" | "save" | null>(null);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

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
    const timer = window.setTimeout(() => {
      save();
    }, 850);

    return () => window.clearTimeout(timer);
  }, [activeNote?.content, activeNote?.id, text]);

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

  const insertDateTime = () => {
    const editor = noteEditorRef.current;
    if (!editor) return;
    const insertion = new Date().toLocaleString("ko-KR");
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    setText((current) => `${current.slice(0, start)}${insertion}${current.slice(end)}`);
    setNoteMenu(null);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + insertion.length, start + insertion.length);
      updateCursorPosition();
    });
  };

  return (
    <div
      className="notepad-app app-fill"
      onKeyDown={(event) => {
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
          openVfsEntry(createVfsTextFile());
        }
      }}
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
        <div className="note-menu" role="menu">
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
              openVfsEntry(item);
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
        <div className="note-menu" role="menu">
          <button
            onClick={() => {
              noteEditorRef.current?.select();
              setNoteMenu(null);
              updateCursorPosition();
            }}
            role="menuitem"
            type="button"
          >
            모두 선택 <kbd>Ctrl+A</kbd>
          </button>
          <button onClick={insertDateTime} role="menuitem" type="button">
            시간/날짜 <kbd>F5</kbd>
          </button>
        </div>
      )}
      {noteMenu === "view" && (
        <div className="note-menu" role="menu">
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
        <div className="note-tabs" role="tablist">
          {noteEntries.map((note) => (
            <button
              aria-selected={note.id === activeNote?.id}
              className={note.id === activeNote?.id ? "is-selected" : ""}
              key={note.id}
              onClick={() => openVfsEntry(note)}
              role="tab"
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
          onClick={() => openVfsEntry(createVfsTextFile())}
          title="새 탭"
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
      <div className={`note-workspace${showMarkdownPreview ? " is-split" : ""}`}>
        <textarea
          aria-label="메모 내용"
          className="note-editor"
          disabled={!activeNote}
          onChange={(event) => setText(event.target.value)}
          onClick={updateCursorPosition}
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
            openVfsEntry(item);
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
    </div>
  );
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
