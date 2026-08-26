import AppIconTile from "../../components/AppIconTile";
import { type DesktopItem, type IconPosition } from "../../types";
import { getVfsEntryAssociation } from "../../vfs/model";
import { type AppDefinition, type DesktopViewMode } from "../types";
import { type LucideIcon } from "lucide-react";
import { useRef, type PointerEvent } from "react";

export function DesktopIcon({
  app,
  onContextMenu,
  onMove,
  onOpen,
  onSelect,
  position,
  selected,
}: {
  app: AppDefinition;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  position: IconPosition;
  selected: boolean;
}) {
  const Icon = app.icon;
  return (
    <DesktopIconButton
      accent={app.accent}
      icon={Icon}
      onContextMenu={onContextMenu}
      onMove={onMove}
      onOpen={onOpen}
      onSelect={onSelect}
      position={position}
      selected={selected}
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
  onMove,
  onOpen,
  onSelect,
  renaming,
  selected,
  viewMode,
}: {
  draftName: string;
  item: DesktopItem;
  onCancelRename: () => void;
  onChangeDraftName: (name: string) => void;
  onCommitRename: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  renaming: boolean;
  selected: boolean;
  viewMode: DesktopViewMode;
}) {
  const association = getVfsEntryAssociation(item);
  return (
    <>
      <DesktopIconButton
        accent={association.accent}
        icon={association.icon}
        onContextMenu={onContextMenu}
        onMove={onMove}
        onOpen={onOpen}
        onSelect={onSelect}
        position={item}
        selected={selected}
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
  icon: Icon,
  onContextMenu,
  onMove,
  onOpen,
  onSelect,
  position,
  selected,
  title,
  tone = "app",
}: {
  accent: string;
  icon: LucideIcon;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  position: IconPosition;
  selected: boolean;
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
      title={title}
      type="button"
    >
      <AppIconTile accent={accent} icon={Icon} size="large" tone={tone} />
      <span>{title}</span>
    </button>
  );
}
