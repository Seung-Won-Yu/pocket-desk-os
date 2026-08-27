import { House, Monitor, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { AppId, DesktopItem } from "../types";
import { clamp, formatVfsEntrySize, normalizeSearchText } from "../utils/format";
import { formatDesktopItemTime, getVfsEntryAssociation, getVfsEntryDetail } from "../vfs/model";

type RecycleBinAppProps = {
  emptyRecycleBin: () => void;
  openApp: (appId: AppId) => void;
  permanentlyDeleteVfsEntry: (itemId: string) => void;
  restoreVfsEntry: (itemId: string) => void;
  trashedItems: DesktopItem[];
};

export default function RecycleBinApp({
  emptyRecycleBin,
  openApp,
  permanentlyDeleteVfsEntry,
  restoreVfsEntry,
  trashedItems,
}: RecycleBinAppProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "empty" | null>(null);
  const [query, setQuery] = useState("");
  const files = useMemo(
    () =>
      trashedItems.map((item) => {
        const association = getVfsEntryAssociation(item);
        return {
          association,
          detail: getVfsEntryDetail(item),
          icon: association.icon,
          id: item.id,
          item,
          name: item.name,
          removed: formatDesktopItemTime(item.trashedAt ?? item.updatedAt),
          type: association.typeLabel,
        };
      }),
    [trashedItems],
  );
  const visibleFiles = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return files;
    return files.filter((file) =>
      [file.name, file.type, file.detail]
        .map(normalizeSearchText)
        .some((field) => field.includes(normalizedQuery)),
    );
  }, [files, query]);
  const [selected, setSelected] = useState(0);
  const selectedFile = visibleFiles[Math.min(selected, visibleFiles.length - 1)];

  useEffect(() => {
    setSelected((current) =>
      visibleFiles.length === 0 ? 0 : clamp(current, 0, visibleFiles.length - 1),
    );
  }, [visibleFiles.length]);

  return (
    <div className="recycle-app app-fill">
      <aside className="recycle-sidebar">
        <button onClick={() => openApp("files")} type="button">
          <House aria-hidden="true" size={16} />홈
        </button>
        <button onClick={() => openApp("thispc")} type="button">
          <Monitor aria-hidden="true" size={16} />내 PC
        </button>
        <button aria-current="page" className="is-selected" type="button">
          <Trash2 aria-hidden="true" size={16} />
          휴지통
        </button>
      </aside>
      <section className="recycle-main">
        <div className="file-tab-strip">
          <div className="file-tab">
            <Trash2 aria-hidden="true" size={15} />
            <span>휴지통</span>
          </div>
        </div>
        <div className="recycle-explorer-top">
          <div className="file-address-row">
            <div className="file-address">
              <House aria-hidden="true" size={15} />
              <span>홈</span>
              <span aria-hidden="true">›</span>
              <strong>휴지통</strong>
            </div>
            <label className="file-search">
              <Search aria-hidden="true" size={15} />
              <input
                aria-label="휴지통 검색"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="휴지통 검색"
                value={query}
              />
            </label>
          </div>
          <div className="file-command-strip recycle-command-strip">
            <button
              className="file-command-action"
              disabled={!selectedFile}
              onClick={() => selectedFile && restoreVfsEntry(selectedFile.id)}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} />
              <span>복원</span>
            </button>
            <button
              className="file-command-action file-danger"
              disabled={!selectedFile}
              onClick={() => setConfirmAction("delete")}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              <span>영구 삭제</span>
            </button>
            <span aria-hidden="true" className="file-command-separator" />
            <button
              className="file-command-action"
              disabled={files.length === 0}
              onClick={() => setConfirmAction("empty")}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              <span>휴지통 비우기</span>
            </button>
          </div>
        </div>
        <div className="recycle-workspace">
          {visibleFiles.length > 0 && (
            <div aria-hidden="true" className="recycle-list-header">
              <span>이름</span>
              <span>삭제한 날짜</span>
              <span>유형</span>
              <span>크기</span>
            </div>
          )}
          <div
            aria-label="삭제된 항목"
            className="file-list recycle-list file-view-details"
            role="listbox"
          >
            {visibleFiles.map((file, index) => {
              const FileIcon = file.icon;
              return (
                <button
                  aria-selected={selected === index}
                  className={selected === index ? "is-selected" : ""}
                  key={file.id}
                  onClick={() => setSelected(index)}
                  onDoubleClick={() => restoreVfsEntry(file.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    restoreVfsEntry(file.id);
                  }}
                  role="option"
                  type="button"
                >
                  <FileIcon aria-hidden="true" size={18} />
                  <span>{file.name}</span>
                  <small>{file.removed}</small>
                  <small>{file.type}</small>
                  <small>
                    {file.item.kind === "folder" ? "" : formatVfsEntrySize(file.item)}
                  </small>
                </button>
              );
            })}
            {visibleFiles.length === 0 && (
              <div className="recycle-empty">
                {files.length === 0 ? (
                  <>
                    <Trash2 aria-hidden="true" size={30} />
                    <strong>휴지통이 비어 있습니다</strong>
                  </>
                ) : (
                  <>
                    <Search aria-hidden="true" size={24} />
                    <strong>검색 결과 없음</strong>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="file-statusbar">
          <span>{visibleFiles.length}개 항목</span>
          <span>{selectedFile ? "1개 선택됨" : "선택한 항목 없음"}</span>
        </div>
      </section>
      {confirmAction && (
        <ConfirmDialog
          confirmLabel={confirmAction === "empty" ? "모두 삭제" : "삭제"}
          detail={
            confirmAction === "empty"
              ? `${files.length}개 항목이 영구적으로 삭제됩니다.`
              : `"${selectedFile?.name ?? "선택한 항목"}" 항목이 영구적으로 삭제됩니다.`
          }
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction === "empty") {
              emptyRecycleBin();
            } else if (selectedFile) {
              permanentlyDeleteVfsEntry(selectedFile.id);
            }
            setConfirmAction(null);
          }}
          title={confirmAction === "empty" ? "휴지통을 비울까요?" : "이 항목을 삭제할까요?"}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  confirmLabel,
  detail,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  detail: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  return (
    <div className="confirm-overlay" onPointerDown={onCancel}>
      <section
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{detail}</p>
        <div>
          <button onClick={onCancel} ref={cancelRef} type="button">
            취소
          </button>
          <button className="is-danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function trapDialogFocus(event: React.KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
