import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  House,
  Paintbrush,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { DesktopItem, VfsEntryKind } from "../types";
import { normalizeSearchText } from "../utils/format";
import {
  formatDesktopItemTime,
  getVfsEntryAssociation,
  getVfsFolderPath,
  VFS_DOCUMENTS_ID,
  VFS_PICTURES_ID,
  VFS_ROOT_ID,
} from "../vfs/model";

export type FileDialogSaveResult = {
  existingItem?: DesktopItem;
  name: string;
  parentId: string;
};

type FileDialogProps = {
  allowedKinds: VfsEntryKind[];
  createVfsFolder: (parentId?: string) => DesktopItem;
  defaultExtension?: string;
  defaultName?: string;
  fileTypeLabel: string;
  initialFolderId: string;
  items: DesktopItem[];
  mode: "open" | "save";
  onCancel: () => void;
  onOpen?: (item: DesktopItem) => void;
  onSave?: (result: FileDialogSaveResult) => void;
  title: string;
};

export default function FileDialog({
  allowedKinds,
  createVfsFolder,
  defaultExtension,
  defaultName = "",
  fileTypeLabel,
  initialFolderId,
  items,
  mode,
  onCancel,
  onOpen,
  onSave,
  title,
}: FileDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const fileNameRef = useRef<HTMLInputElement | null>(null);
  const replaceConfirmRef = useRef<HTMLButtonElement | null>(null);
  const [history, setHistory] = useState([initialFolderId]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fileName, setFileName] = useState(defaultName);
  const [replaceCandidate, setReplaceCandidate] = useState<DesktopItem | null>(null);
  const currentFolderId = history[historyIndex] ?? VFS_ROOT_ID;
  const folderPath = useMemo(
    () => getVfsFolderPath(items, currentFolderId),
    [currentFolderId, items],
  );
  const currentFolderName = folderPath[folderPath.length - 1]?.name ?? "바탕 화면";
  const allowedKindSet = useMemo(() => new Set(allowedKinds), [allowedKinds]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return items
      .filter(
        (item) =>
          !item.trashed &&
          item.parentId === currentFolderId &&
          (item.kind === "folder" || allowedKindSet.has(item.kind)) &&
          (!normalizedQuery || normalizeSearchText(item.name).includes(normalizedQuery)),
      )
      .sort((first, second) => {
        if (first.kind === "folder" && second.kind !== "folder") return -1;
        if (first.kind !== "folder" && second.kind === "folder") return 1;
        return first.name.localeCompare(second.name, "ko", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [allowedKindSet, currentFolderId, items, query]);
  const selectedItem = visibleItems.find((item) => item.id === selectedId);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (mode === "save") fileNameRef.current?.select();
      else dialogRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (
      currentFolderId === VFS_ROOT_ID ||
      items.some((item) => item.id === currentFolderId && item.kind === "folder" && !item.trashed)
    ) {
      return;
    }
    setHistory((current) => [...current.slice(0, historyIndex + 1), VFS_ROOT_ID]);
    setHistoryIndex((current) => current + 1);
  }, [currentFolderId, historyIndex, items]);

  useEffect(() => {
    if (!replaceCandidate) return;
    const frame = window.requestAnimationFrame(() => replaceConfirmRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [replaceCandidate]);

  const resetSelection = () => {
    setQuery("");
    setSelectedId(null);
    setReplaceCandidate(null);
  };

  const navigateTo = (folderId: string) => {
    if (folderId === currentFolderId) return;
    if (
      folderId !== VFS_ROOT_ID &&
      !items.some((item) => item.id === folderId && item.kind === "folder" && !item.trashed)
    ) {
      return;
    }
    setHistory((current) => [...current.slice(0, historyIndex + 1), folderId]);
    setHistoryIndex((current) => current + 1);
    resetSelection();
  };

  const visitHistory = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= history.length) return;
    setHistoryIndex(nextIndex);
    resetSelection();
  };

  const navigateUp = () => {
    const parent = folderPath[folderPath.length - 2];
    if (parent) navigateTo(parent.id);
  };

  const openItem = (item: DesktopItem) => {
    if (item.kind === "folder") {
      navigateTo(item.id);
      return;
    }
    if (mode === "open") onOpen?.(item);
  };

  const getSaveName = () => {
    const trimmed = fileName.trim().slice(0, 48);
    if (!trimmed) return "";
    if (!defaultExtension || /\.[^.]+$/.test(trimmed)) return trimmed;
    return `${trimmed}.${defaultExtension}`.slice(0, 48);
  };

  const submitSave = (confirmedItem?: DesktopItem) => {
    const name = getSaveName();
    if (!name) {
      fileNameRef.current?.focus();
      return;
    }
    const existingItem =
      confirmedItem ??
      items.find(
        (item) =>
          !item.trashed &&
          item.parentId === currentFolderId &&
          item.kind !== "folder" &&
          allowedKindSet.has(item.kind) &&
          item.name.localeCompare(name, "ko", { sensitivity: "base" }) === 0,
      );
    if (existingItem && replaceCandidate?.id !== existingItem.id) {
      setReplaceCandidate(existingItem);
      return;
    }
    onSave?.({ existingItem, name, parentId: currentFolderId });
  };

  const submitPrimaryAction = () => {
    if (mode === "save") {
      submitSave();
      return;
    }
    if (selectedItem) openItem(selectedItem);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") {
      const focusScope = replaceCandidate
        ? dialogRef.current?.querySelector<HTMLElement>(".file-dialog-replace-overlay")
        : dialogRef.current;
      const focusable = Array.from(
        focusScope?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.closest('[aria-hidden="true"]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last) {
        if (
          event.shiftKey &&
          (document.activeElement === first || !focusScope?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (replaceCandidate) setReplaceCandidate(null);
      else onCancel();
      return;
    }
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "search") {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submitPrimaryAction();
    }
  };

  return (
    <div
      className="file-dialog-overlay"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        dialogRef.current?.focus();
      }}
    >
      <section
        aria-label={title}
        aria-modal="true"
        className="file-dialog"
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="file-dialog-titlebar">
          <strong>{title}</strong>
          <button aria-label={`${title} 닫기`} onClick={onCancel} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="file-dialog-navigation">
          <div aria-label="폴더 탐색" className="file-dialog-nav-buttons" role="group">
            <button
              aria-label="뒤로"
              disabled={historyIndex <= 0}
              onClick={() => visitHistory(historyIndex - 1)}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="앞으로"
              disabled={historyIndex >= history.length - 1}
              onClick={() => visitHistory(historyIndex + 1)}
              type="button"
            >
              <ArrowRight aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="위로"
              disabled={folderPath.length <= 1}
              onClick={navigateUp}
              type="button"
            >
              <ArrowUp aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="file-dialog-address">
            {folderPath.map((segment, index) => (
              <div key={segment.id}>
                {index > 0 && <ChevronRight aria-hidden="true" size={13} />}
                <button onClick={() => navigateTo(segment.id)} type="button">
                  {index === 0 && <House aria-hidden="true" size={14} />}
                  <span>{segment.name}</span>
                </button>
              </div>
            ))}
          </div>
          <label className="file-dialog-search">
            <Search aria-hidden="true" size={15} />
            <input
              aria-label={`${currentFolderName} 검색`}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`${currentFolderName} 검색`}
              type="search"
              value={query}
            />
          </label>
        </div>

        <div className="file-dialog-commandbar">
          <button
            onClick={() => {
              const folder = createVfsFolder(currentFolderId);
              setSelectedId(folder.id);
            }}
            type="button"
          >
            <FilePlus2 aria-hidden="true" size={15} />
            새 폴더
          </button>
        </div>

        <div className="file-dialog-workspace">
          <aside>
            {(
              [
                [VFS_ROOT_ID, "바탕 화면", House],
                [VFS_DOCUMENTS_ID, "문서", FileText],
                [VFS_PICTURES_ID, "사진", Paintbrush],
              ] as const
            ).map(([folderId, label, Icon]) => (
              <button
                className={currentFolderId === folderId ? "is-selected" : ""}
                key={folderId}
                onClick={() => navigateTo(folderId)}
                type="button"
              >
                <Icon aria-hidden="true" size={15} />
                {label}
              </button>
            ))}
          </aside>

          <div className="file-dialog-list-wrap">
            <div aria-hidden="true" className="file-dialog-list-header">
              <span>이름</span>
              <span>수정한 날짜</span>
              <span>유형</span>
            </div>
            <div aria-label={`${currentFolderName} 항목`} className="file-dialog-list" role="listbox">
              {visibleItems.map((item) => {
                const association = getVfsEntryAssociation(item);
                const ItemIcon = association.icon;
                return (
                  <button
                    aria-selected={selectedId === item.id}
                    className={selectedId === item.id ? "is-selected" : ""}
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      if (mode === "save" && item.kind !== "folder") setFileName(item.name);
                    }}
                    onDoubleClick={() => openItem(item)}
                    role="option"
                    type="button"
                  >
                    <ItemIcon aria-hidden="true" size={17} />
                    <span>{item.name}</span>
                    <small>{formatDesktopItemTime(item.updatedAt)}</small>
                    <small>{association.typeLabel}</small>
                  </button>
                );
              })}
              {visibleItems.length === 0 && (
                <div className="file-dialog-empty">
                  <Folder aria-hidden="true" size={26} />
                  <span>{query ? "검색 결과가 없습니다." : "이 폴더는 비어 있습니다."}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="file-dialog-footer">
          {mode === "save" && (
            <label className="file-dialog-name-field">
              <span>파일 이름:</span>
              <input
                aria-label="파일 이름"
                onChange={(event) => {
                  setFileName(event.target.value);
                  setReplaceCandidate(null);
                }}
                ref={fileNameRef}
                value={fileName}
              />
            </label>
          )}
          <div className="file-dialog-type-row">
            <span>{mode === "save" ? "파일 형식:" : "파일 유형:"}</span>
            <strong>{fileTypeLabel}</strong>
          </div>
          <div className="file-dialog-actions">
            <button
              className="is-primary"
              disabled={mode === "open" ? !selectedItem : !getSaveName()}
              onClick={submitPrimaryAction}
              type="button"
            >
              {mode === "open" ? "열기" : "저장"}
            </button>
            <button onClick={onCancel} type="button">취소</button>
          </div>
        </footer>

        {replaceCandidate && (
          <div className="file-dialog-replace-overlay">
            <section aria-label="파일 바꾸기 확인" aria-modal="true" role="alertdialog">
              <strong>이 파일을 바꾸시겠습니까?</strong>
              <p>같은 이름의 파일이 이미 있습니다. 기존 내용을 새 내용으로 바꿉니다.</p>
              <div>
                <button
                  className="is-primary"
                  onClick={() => submitSave(replaceCandidate)}
                  ref={replaceConfirmRef}
                  type="button"
                >
                  바꾸기
                </button>
                <button onClick={() => setReplaceCandidate(null)} type="button">취소</button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
