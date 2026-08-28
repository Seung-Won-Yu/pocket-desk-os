import AppIconTile from "../../components/AppIconTile";
import { type AppDefinition, type WindowInstance } from "../types";
import { Maximize2, Minus, Move, Scaling, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useReturnFocus } from "../dialogFocus";
import { handleMenuKeyboard } from "../keyboardNav";

export function WindowSystemMenu({
  app,
  instance,
  onClose,
  onDismiss,
  onMaximize,
  onMinimize,
  onMove,
  onResize,
  onRestore,
  x,
  y,
}: {
  app: AppDefinition;
  instance: WindowInstance;
  onClose: () => void;
  onDismiss: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onMove: () => void;
  onResize: () => void;
  onRestore: () => void;
  x: number;
  y: number;
}) {
  useReturnFocus();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /*
     * 복원 is disabled unless the window is maximized, and a disabled button
     * cannot take focus — so on an ordinary window the menu opened with focus
     * still on <body> and the arrow keys did nothing at all. Focus the first
     * item that can actually take it.
     */
    const frameId = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not([disabled])')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className="window-system-menu"
      onContextMenu={(event) => event.preventDefault()}
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDismiss();
          return;
        }
        handleMenuKeyboard(event, event.currentTarget);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <div className="window-system-menu-title">
        <AppIconTile accent={app.accent} icon={app.icon} size="tiny" />
        <strong>{app.title}</strong>
      </div>
      <button disabled={!instance.maximized} onClick={onRestore} role="menuitem" type="button">
        <Square aria-hidden="true" size={15} />
        복원
      </button>
      {/*
       * Windows moves and resizes a window from here with the arrow keys, and
       * these two items were missing — with the resize handles hidden from
       * assistive technology as well, a keyboard user had no way at all to
       * move or resize a window.
       */}
      <button disabled={instance.maximized} onClick={onMove} role="menuitem" type="button">
        <Move aria-hidden="true" size={15} />
        이동
      </button>
      <button disabled={instance.maximized} onClick={onResize} role="menuitem" type="button">
        <Scaling aria-hidden="true" size={15} />
        크기 조정
      </button>
      <button onClick={onMinimize} role="menuitem" type="button">
        <Minus aria-hidden="true" size={15} />
        최소화
      </button>
      <button onClick={onMaximize} role="menuitem" type="button">
        <Maximize2 aria-hidden="true" size={15} />
        {instance.maximized ? "이전 크기로" : "최대화"}
      </button>
      <span aria-hidden="true" className="menu-separator" />
      <button className="is-danger" onClick={onClose} role="menuitem" type="button">
        <X aria-hidden="true" size={15} />
        닫기
      </button>
    </div>
  );
}
