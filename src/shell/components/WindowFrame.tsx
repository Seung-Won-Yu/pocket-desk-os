import AppIconTile from "../../components/AppIconTile";
import { clamp } from "../../utils/format";
import { APP_BAR_HEIGHT, WINDOW_DRAG_THRESHOLD } from "../constants";
import {
  type AppDefinition,
  type SnapPreviewState,
  type SnapZone,
  type WindowInstance,
  type WindowMotion,
} from "../types";
import { getSnapPreviewStyle, getWindowSnapPatch, getWindowSnapZone } from "../windowGeometry";
import { Copy, Minus, Square, X } from "lucide-react";
import { useState, type CSSProperties, type PointerEvent } from "react";
import { handleMenuKeyboard } from "../keyboardNav";

const FALLBACK_MIN_WIDTH = 320;
const FALLBACK_MIN_HEIGHT = 240;

type WindowResizeEdge = "e" | "n" | "ne" | "nw" | "s" | "se" | "sw" | "w";

const WINDOW_RESIZE_EDGES: WindowResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export function WindowFrame({
  active,
  app,
  documentLabel,
  hasUnsavedChanges = false,
  children,
  instance,
  motion,
  onClose,
  onFocus,
  onMinimize,
  onOpenSystemMenu,
  onSnapPreviewChange,
  onToggleMaximize,
  onUpdate,
}: {
  active: boolean;
  app: AppDefinition;
  documentLabel?: string;
  hasUnsavedChanges?: boolean;
  children: React.ReactNode;
  instance: WindowInstance;
  motion?: WindowMotion;
  onClose: () => void;
  onFocus: () => void;
  onMinimize: () => void;
  onOpenSystemMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSnapPreviewChange: (preview: SnapPreviewState | null) => void;
  onToggleMaximize: () => void;
  onUpdate: (patch: Partial<WindowInstance>) => void;
}) {
  const [snapFlyoutOpen, setSnapFlyoutOpen] = useState(false);
  // An app declares the size its own UI stops working below.
  const minWidth = app.minSize?.width ?? FALLBACK_MIN_WIDTH;
  const minHeight = app.minSize?.height ?? FALLBACK_MIN_HEIGHT;

  /*
   * A minimized window stays mounted and is hidden with CSS. Returning null
   * unmounted the app, which threw away everything it held: an unsaved Notepad
   * draft, the calculator's display, terminal scrollback, a game in progress.
   * Minimizing in Windows is purely visual, and Win+D is meant to be a peek.
   */
  const minSizeVars = {
    "--window-min-height": `${minHeight}px`,
    "--window-min-width": `${minWidth}px`,
  } as CSSProperties;
  const frameStyle: CSSProperties = instance.maximized
    ? {
        ...minSizeVars,
        inset: `0 0 ${APP_BAR_HEIGHT}px 0`,
        zIndex: instance.z,
      }
    : {
        ...minSizeVars,
        left: instance.x,
        top: instance.y,
        width: instance.width,
        height: instance.height,
        zIndex: instance.z,
      };

  const startMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The window controls sit inside the title bar, so their pointerdown
    // bubbles here. Treating it as a drag start moved the window out from
    // under the restore button before the click could toggle it.
    if ((event.target as HTMLElement).closest("button, select, input")) return;
    event.preventDefault();
    onFocus();
    const startX = event.clientX;
    const startY = event.clientY;

    /*
     * Dragging a maximized window restores it and lets it follow the cursor, as
     * Windows does. The restored window is placed so the pointer keeps the same
     * proportional grip on its title bar, rather than jumping to a corner.
     */
    const restoring = instance.maximized;
    const width = restoring ? Math.min(instance.width, window.innerWidth - 16) : instance.width;
    const height = restoring
      ? Math.min(instance.height, window.innerHeight - APP_BAR_HEIGHT - 16)
      : instance.height;
    const grip = restoring ? Math.min(0.9, startX / Math.max(1, window.innerWidth)) : 0;
    const baseX = restoring
      ? clamp(startX - width * grip, 8, Math.max(8, window.innerWidth - width - 8))
      : instance.x;
    const baseY = restoring ? 8 : instance.y;
    // Windows only leaves the maximized state once the pointer actually travels;
    // committing on pointerdown restored the window on a plain click too.
    let pendingRestore = restoring;

    let activeSnapZone: SnapZone | null = null;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (pendingRestore) {
        const travelled = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (travelled < WINDOW_DRAG_THRESHOLD) return;
        pendingRestore = false;
        onUpdate({
          height,
          maximized: false,
          snapZone: undefined,
          width,
          x: baseX,
          y: baseY,
        });
      }
      const nextX = baseX + moveEvent.clientX - startX;
      const nextY = baseY + moveEvent.clientY - startY;
      activeSnapZone = getWindowSnapZone(moveEvent.clientX, moveEvent.clientY);
      onSnapPreviewChange(activeSnapZone ? { zone: activeSnapZone } : null);
      onUpdate({
        snapZone: undefined,
        x: clamp(nextX, 8, Math.max(8, window.innerWidth - width - 8)),
        y: clamp(nextY, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8)),
      });
    };

    const onPointerUp = () => {
      if (activeSnapZone) {
        onUpdate({ ...getWindowSnapPatch(activeSnapZone), snapZone: activeSnapZone });
      }
      onSnapPreviewChange(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startResize = (event: PointerEvent<HTMLDivElement>, edge: WindowResizeEdge) => {
    if (event.button !== 0 || instance.maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    const startX = event.clientX;
    const startY = event.clientY;
    const { width, height, x, y } = instance;
    const right = x + width;
    const bottom = y + height;
    const maxBottom = window.innerHeight - APP_BAR_HEIGHT - 8;
    const grow = {
      east: edge.includes("e"),
      north: edge.includes("n"),
      south: edge.includes("s"),
      west: edge.includes("w"),
    };

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const patch: Partial<WindowInstance> = {};

      if (grow.east) {
        patch.width = clamp(
          width + moveEvent.clientX - startX,
          minWidth,
          window.innerWidth - x - 8,
        );
      } else if (grow.west) {
        const nextX = clamp(x + moveEvent.clientX - startX, 8, right - minWidth);
        patch.width = right - nextX;
        patch.x = nextX;
      }

      if (grow.south) {
        patch.height = clamp(height + moveEvent.clientY - startY, minHeight, maxBottom - y);
      } else if (grow.north) {
        const nextY = clamp(y + moveEvent.clientY - startY, 8, bottom - minHeight);
        patch.height = bottom - nextY;
        patch.y = nextY;
      }

      // A hand-resized window is no longer in a snap layout.
      onUpdate({ ...patch, snapZone: undefined });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleTitlebarDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".window-controls")) return;
    onToggleMaximize();
  };

  const applySnapLayout = (zone: SnapZone) => {
    onFocus();
    onUpdate(getWindowSnapPatch(zone));
    setSnapFlyoutOpen(false);
  };

  return (
    <article
      aria-label={app.title}
      aria-hidden={instance.minimized ? "true" : undefined}
      className={`window-frame ${active ? "is-active" : ""} ${
        instance.maximized ? "is-maximized" : ""
      } ${instance.minimized ? "is-minimized" : ""} ${motion ? `is-${motion}` : ""}`}
      onPointerDown={onFocus}
      style={frameStyle}
    >
      <div
        className="window-titlebar"
        onContextMenu={onOpenSystemMenu}
        onDoubleClick={handleTitlebarDoubleClick}
        onPointerDown={startMove}
      >
        <div className="window-title">
          <AppIconTile accent={app.accent} icon={app.icon} size="tiny" />
          {/* Windows names the window after the document it holds. */}
          {/* Windows marks an unsaved document with a leading asterisk. */}
          <span>
            {documentLabel
              ? `${hasUnsavedChanges ? "*" : ""}${documentLabel} - ${app.title}`
              : app.title}
          </span>
        </div>
        <div className="window-controls">
          <button
            aria-label={`${app.title} 최소화`}
            onClick={onMinimize}
            title="최소화"
            type="button"
          >
            <Minus aria-hidden="true" size={14} />
          </button>
          <div
            className="maximize-control"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setSnapFlyoutOpen(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSnapFlyoutOpen(false);
                event.currentTarget
                  .querySelector<HTMLButtonElement>(":scope > button")
                  ?.focus();
              }
            }}
            onMouseEnter={() => !instance.maximized && setSnapFlyoutOpen(true)}
            onMouseLeave={() => setSnapFlyoutOpen(false)}
          >
            <button
              aria-expanded={snapFlyoutOpen}
              aria-haspopup="menu"
              aria-label={`${app.title} 최대화`}
              onClick={onToggleMaximize}
              onFocus={() => !instance.maximized && setSnapFlyoutOpen(true)}
              title="최대화"
              type="button"
            >
              {instance.maximized ? (
                <Copy aria-hidden="true" size={12} />
              ) : (
                <Square aria-hidden="true" size={11} />
              )}
            </button>
            {snapFlyoutOpen && !instance.maximized && (
              <div
                aria-label="스냅 레이아웃"
                className="snap-layout-flyout"
                role="menu"
                onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
              >
                <button
                  aria-label="왼쪽 절반에 맞춤"
                  onClick={() => applySnapLayout("left")}
                  role="menuitem"
                  title="왼쪽 절반"
                  type="button"
                >
                  <span className="snap-layout-thumb snap-left" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <button
                  aria-label="오른쪽 절반에 맞춤"
                  onClick={() => applySnapLayout("right")}
                  role="menuitem"
                  title="오른쪽 절반"
                  type="button"
                >
                  <span className="snap-layout-thumb snap-right" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <button
                  aria-label="화면에 최대화"
                  onClick={() => applySnapLayout("top")}
                  role="menuitem"
                  title="최대화"
                  type="button"
                >
                  <span className="snap-layout-thumb snap-top" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
              </div>
            )}
          </div>
          <button aria-label={`${app.title} 닫기`} onClick={onClose} title="닫기" type="button">
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
      <div className="window-content">{children}</div>
      {!instance.maximized &&
        WINDOW_RESIZE_EDGES.map((edge) => (
          <div
            aria-hidden="true"
            className={`resize-handle is-${edge}`}
            key={edge}
            onPointerDown={(event) => startResize(event, edge)}
          />
        ))}
    </article>
  );
}

export function SnapPreview({ zone }: { zone: SnapZone }) {
  return <div aria-hidden="true" className="snap-preview" style={getSnapPreviewStyle(zone)} />;
}
