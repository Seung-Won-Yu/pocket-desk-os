import AppIconTile from "../../components/AppIconTile";
import { type DesktopItem, type IconPosition } from "../../types";
import { getVfsEntryAssociation } from "../../vfs/model";
import { type AppDefinition, type DesktopViewMode } from "../types";
import { type LucideIcon } from "lucide-react";
import { useRef, type PointerEvent } from "react";

export function DesktopIcon({
  app,
  badge,
  onContextMenu,
  onMove,
  onOpen,
  onSelect,
  position,
  selected,
  tabStop,
}: {
  app: AppDefinition;
  /** Shown on the tile and in the icon's name; the recycle bin uses it. */
  badge?: string;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDropIntoFolder?: (folderId: string) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  position: IconPosition;
  selected: boolean;
  tabStop?: boolean;
}) {
  const Icon = app.icon;
  return (
    <DesktopIconButton
      accent={app.accent}
      badge={badge}
      icon={Icon}
      onContextMenu={onContextMenu}
      onMove={onMove}
      onOpen={onOpen}
      onSelect={onSelect}
      position={position}
      selected={selected}
      tabStop={tabStop}
      title={app.title}
    />
  );
}

export function DesktopItemIcon({
  draftName,
  item,
  onCancelRename,
  onChangeDraftName,
  onCommitRename,
  onContextMenu,
  onDropIntoFolder,
  onMove,
  onOpen,
  onSelect,
  renaming,
  selected,
  tabStop,
  viewMode,
}: {
  draftName: string;
  item: DesktopItem;
  onCancelRename: () => void;
  onChangeDraftName: (name: string) => void;
  onCommitRename: () => void;
  onDropIntoFolder?: (folderId: string) => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  renaming: boolean;
  selected: boolean;
  tabStop?: boolean;
  viewMode: DesktopViewMode;
}) {
  const association = getVfsEntryAssociation(item);
  return (
    <>
      <DesktopIconButton
        accent={association.accent}
        icon={association.icon}
        onContextMenu={onContextMenu}
        thumbnail={item.kind === "canvas" && item.content ? item.content : undefined}
        onDropIntoFolder={onDropIntoFolder}
        onMove={onMove}
        onOpen={onOpen}
        onSelect={onSelect}
        position={item}
        selected={selected}
        tabStop={tabStop}
        title={item.name}
        tone="file"
      />
      {renaming && (
        <form
          className={`desktop-icon-rename desktop-icon-rename-${viewMode}`}
          onPointerDown={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            onCommitRename();
          }}
          style={{ left: item.x, top: item.y }}
        >
          <input
            aria-label="바탕 화면 파일 이름"
            autoFocus
            onBlur={onCommitRename}
            onChange={(event) => onChangeDraftName(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              onCancelRename();
            }}
            value={draftName}
          />
        </form>
      )}
    </>
  );
}

export function DesktopIconButton({
  accent,
  badge,
  icon: Icon,
  onContextMenu,
  thumbnail,
  onDropIntoFolder,
  onMove,
  onOpen,
  onSelect,
  position,
  selected,
  tabStop = false,
  title,
  tone = "app",
}: {
  accent: string;
  /** A count shown on the tile — the recycle bin's contents, as Windows shows a full bin. */
  badge?: string;
  icon: LucideIcon;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDropIntoFolder?: (folderId: string) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  position: IconPosition;
  /** A data URL to show in place of the generic tile (picture files). */
  thumbnail?: string;
  selected: boolean;
  tabStop?: boolean;
  title: string;
  tone?: "app" | "file";
}) {
  const dragState = useRef<{
    moved: boolean;
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressNextClick = useRef(false);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      moved: false,
      originX: position.x,
      originY: position.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      state.moved = true;
      onMove({ x: state.originX + deltaX, y: state.originY + deltaY });
    }
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;
    if (event.currentTarget.hasPointerCapture(state.pointerId)) {
      event.currentTarget.releasePointerCapture(state.pointerId);
    }

    // Dropping over an open Explorer window files the item into that folder.
    // Pointer capture keeps the icon as the event target, so hit-test manually.
    if (state.moved && onDropIntoFolder) {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const folderId =
        under?.closest<HTMLElement>("[data-vfs-drop-folder]")?.dataset.vfsDropFolder;
      if (folderId) onDropIntoFolder(folderId);
    }

    suppressNextClick.current = state.moved;
    dragState.current = null;
    window.setTimeout(() => {
      suppressNextClick.current = false;
    }, 50);
  };

  const handleClick = () => {
    if (suppressNextClick.current) return;
  };

  return (
    <button
      // The badge is part of the name, or a screen reader hears "휴지통" whether
      // it is full or empty.
      aria-label={badge ? `${title}, ${badge}` : undefined}
      className={`desktop-icon ${selected ? "is-selected" : ""}`}
      onClick={(event) => {
        handleClick();
        if (!suppressNextClick.current) onSelect(event);
      }}
      onContextMenu={onContextMenu}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!suppressNextClick.current) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      onPointerCancel={endDrag}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      style={{ left: position.x, top: position.y }}
      // One tab stop for the whole desktop, arrows to move within it. Every icon
      // used to be its own stop, so Tab walked through all of them.
      tabIndex={tabStop ? 0 : -1}
      // Only a name long enough to be clipped gets the tooltip; a short one
      // would just be read twice.
      title={title.length > 10 ? title : undefined}
      type="button"
    >
      {thumbnail ? (
        // Windows shows a picture file as its picture; a generic tile for a
        // drawing the user just made looked like nothing had been saved.
        <span aria-hidden="true" className="app-icon-tile app-icon-large icon-thumbnail">
          <img alt="" draggable={false} src={thumbnail} />
        </span>
      ) : (
        <span className={`desktop-icon-tile-wrap${badge ? " has-badge" : ""}`}>
          <AppIconTile accent={accent} icon={Icon} size="large" tone={tone} />
          {badge && (
            <span aria-hidden="true" className="desktop-icon-badge">
              {badge.replace(/[^0-9]/g, "") || badge}
            </span>
          )}
        </span>
      )}
      <span>{title}</span>
    </button>
  );
}
