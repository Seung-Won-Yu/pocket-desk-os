import AppIconTile from "../../components/AppIconTile";
import { type DesktopItem } from "../../types";
import { formatVfsEntrySize, formatVfsPropertyDate } from "../../utils/format";
import { getVfsEntryAssociation } from "../../vfs/model";
import { CONTEXT_MENU_WIDTH } from "../constants";
import { trapDialogFocus } from "../dialogFocus";
import { type DesktopSortKey, type DesktopViewMode } from "../types";
import {
  Check,
  ChevronRight,
  ClipboardPaste,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Grid2X2,
  Info,
  LayoutGrid,
  Palette,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DesktopContextMenu({
  alignToGrid,
  currentSort,
  currentView,
  onChangeWallpaper,
  onCreateNote,
  onPaste,
  onRefresh,
  onSort,
  onToggleGrid,
  onViewChange,
  pasteEnabled,
  x,
  y,
}: {
  alignToGrid: boolean;
  currentSort: DesktopSortKey;
  currentView: DesktopViewMode;
  onChangeWallpaper: () => void;
  onCreateNote: () => void;
  onPaste: () => void;
  onRefresh: () => void;
  onSort: (sortKey: DesktopSortKey) => void;
  onToggleGrid: () => void;
  onViewChange: (viewMode: DesktopViewMode) => void;
  pasteEnabled: boolean;
  x: number;
  y: number;
}) {
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [submenu, setSubmenu] = useState<"new" | "sort" | "view" | null>(null);
  const opensLeft = x > window.innerWidth - CONTEXT_MENU_WIDTH * 2 - 20;

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  return (
    <div
      aria-label="바탕 화면 메뉴"
      className={`desktop-context-menu ${opensLeft ? "opens-left" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <div className="desktop-menu-row" onMouseEnter={() => setSubmenu("view")}>
        <button
          aria-expanded={submenu === "view"}
          aria-haspopup="menu"
          onClick={() => setSubmenu((current) => (current === "view" ? null : "view"))}
          ref={firstItemRef}
          role="menuitem"
          type="button"
        >
          <LayoutGrid aria-hidden="true" size={16} />
          <span>보기</span>
          <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
        </button>
        {submenu === "view" && (
          <div aria-label="보기" className="desktop-context-submenu" role="menu">
            {(
              [
                ["large", "큰 아이콘"],
                ["medium", "보통 아이콘"],
                ["small", "작은 아이콘"],
              ] as Array<[DesktopViewMode, string]>
            ).map(([viewMode, label]) => (
              <button
                aria-checked={currentView === viewMode}
                key={viewMode}
                onClick={() => onViewChange(viewMode)}
                role="menuitemradio"
                type="button"
              >
                {currentView === viewMode ? <Check aria-hidden="true" size={15} /> : <span />}
                {label}
              </button>
            ))}
            <span aria-hidden="true" className="menu-separator" />
            <button
              aria-checked={alignToGrid}
              onClick={onToggleGrid}
              role="menuitemcheckbox"
              type="button"
            >
              {alignToGrid ? <Check aria-hidden="true" size={15} /> : <span />}
              아이콘을 그리드에 맞춤
            </button>
          </div>
        )}
      </div>
      <div className="desktop-menu-row" onMouseEnter={() => setSubmenu("sort")}>
        <button
          aria-expanded={submenu === "sort"}
          aria-haspopup="menu"
          onClick={() => setSubmenu((current) => (current === "sort" ? null : "sort"))}
          role="menuitem"
          type="button"
        >
          <Grid2X2 aria-hidden="true" size={16} />
          <span>정렬 기준</span>
          <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
        </button>
        {submenu === "sort" && (
          <div aria-label="정렬 기준" className="desktop-context-submenu" role="menu">
            {(
              [
                ["name", "이름"],
                ["type", "항목 유형"],
                ["modified", "수정한 날짜"],
              ] as Array<[DesktopSortKey, string]>
            ).map(([sortKey, label]) => (
              <button
                aria-checked={currentSort === sortKey}
                key={sortKey}
                onClick={() => onSort(sortKey)}
                role="menuitemradio"
                type="button"
              >
                {currentSort === sortKey ? <Check aria-hidden="true" size={15} /> : <span />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onRefresh}
        onMouseEnter={() => setSubmenu(null)}
        role="menuitem"
        type="button"
      >
        <RefreshCw aria-hidden="true" size={16} />
        새로 고침
      </button>
      <span aria-hidden="true" className="menu-separator" />
      <button
        disabled={!pasteEnabled}
        onClick={onPaste}
        onMouseEnter={() => setSubmenu(null)}
        role="menuitem"
        type="button"
      >
        <ClipboardPaste aria-hidden="true" size={16} />
        붙여넣기
      </button>
      <div className="desktop-menu-row" onMouseEnter={() => setSubmenu("new")}>
        <button
          aria-expanded={submenu === "new"}
          aria-haspopup="menu"
          onClick={() => setSubmenu((current) => (current === "new" ? null : "new"))}
          role="menuitem"
          type="button"
        >
          <FilePlus2 aria-hidden="true" size={16} />
          <span>새로 만들기</span>
          <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
        </button>
        {submenu === "new" && (
          <div aria-label="새로 만들기" className="desktop-context-submenu" role="menu">
            <button onClick={onCreateNote} role="menuitem" type="button">
              <FileText aria-hidden="true" size={16} />
              텍스트 문서
            </button>
          </div>
        )}
      </div>
      <span aria-hidden="true" className="menu-separator" />
      <button
        onClick={onChangeWallpaper}
        onMouseEnter={() => setSubmenu(null)}
        role="menuitem"
        type="button"
      >
        <Palette aria-hidden="true" size={16} />
        개인 설정
      </button>
    </div>
  );
}

export function DesktopIconContextMenu({
  appPinned,
  itemSelectionCount,
  onCopy,
  onDelete,
  onOpen,
  onProperties,
  onRename,
  onTogglePin,
  target,
  x,
  y,
}: {
  appPinned?: boolean;
  itemSelectionCount: number;
  onCopy?: () => void;
  onDelete?: () => void;
  onOpen: () => void;
  onProperties?: () => void;
  onRename?: () => void;
  onTogglePin?: () => void;
  target: {
    accent: string;
    icon: LucideIcon;
    kind: "app" | "item";
    title: string;
  };
  x: number;
  y: number;
}) {
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => firstItemRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      aria-label="바탕 화면 항목 메뉴"
      className="desktop-context-menu desktop-icon-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <div className="desktop-context-title">
        <AppIconTile
          accent={target.accent}
          icon={target.icon}
          size="tiny"
          tone={target.kind === "item" ? "file" : "app"}
        />
        <strong>{target.title}</strong>
      </div>
      <button onClick={onOpen} ref={firstItemRef} role="menuitem" type="button">
        <ExternalLink aria-hidden="true" size={16} />
        열기
      </button>
      {onCopy && (
        <button onClick={onCopy} role="menuitem" type="button">
          <Copy aria-hidden="true" size={16} />
          복사
        </button>
      )}
      {onRename && (
        <button
          disabled={itemSelectionCount > 1}
          onClick={onRename}
          role="menuitem"
          type="button"
        >
          <Pencil aria-hidden="true" size={16} />
          이름 바꾸기
        </button>
      )}
      {onTogglePin && (
        <button onClick={onTogglePin} role="menuitem" type="button">
          {appPinned ? (
            <PinOff aria-hidden="true" size={16} />
          ) : (
            <Pin aria-hidden="true" size={16} />
          )}
          {appPinned ? "작업 표시줄에서 제거" : "작업 표시줄에 고정"}
        </button>
      )}
      {onDelete && (
        <button
          className="desktop-context-danger"
          onClick={onDelete}
          role="menuitem"
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
          삭제
        </button>
      )}
      {onProperties && (
        <>
          <span aria-hidden="true" className="menu-separator" />
          <button onClick={onProperties} role="menuitem" type="button">
            <Info aria-hidden="true" size={16} />
            속성
          </button>
        </>
      )}
    </div>
  );
}

export function DesktopItemPropertiesDialog({
  item,
  onClose,
}: {
  item: DesktopItem;
  onClose: () => void;
}) {
  const association = getVfsEntryAssociation(item);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="file-properties-overlay desktop-properties-overlay"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="바탕 화면 파일 속성"
        aria-modal="true"
        className="file-properties-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          trapDialogFocus(event, event.currentTarget);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <AppIconTile
            accent={association.accent}
            icon={association.icon}
            size="medium"
            tone="file"
          />
          <div>
            <h2>{item.name}</h2>
            <span>{association.typeLabel}</span>
          </div>
          <button aria-label="파일 속성 닫기" onClick={onClose} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <dl>
          <div>
            <dt>파일 형식</dt>
            <dd>{association.typeLabel}</dd>
          </div>
          <div>
            <dt>연결 프로그램</dt>
            <dd>{association.appTitle}</dd>
          </div>
          <div>
            <dt>위치</dt>
            <dd>바탕 화면</dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>{formatVfsEntrySize(item)}</dd>
          </div>
          <div>
            <dt>만든 날짜</dt>
            <dd>{formatVfsPropertyDate(item.createdAt)}</dd>
          </div>
          <div>
            <dt>수정한 날짜</dt>
            <dd>{formatVfsPropertyDate(item.updatedAt)}</dd>
          </div>
        </dl>
        <footer>
          <button onClick={onClose} ref={confirmRef} type="button">
            확인
          </button>
        </footer>
      </section>
    </div>
  );
}
