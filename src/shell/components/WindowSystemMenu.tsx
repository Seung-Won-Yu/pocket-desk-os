import AppIconTile from "../../components/AppIconTile";
import { type AppDefinition, type WindowInstance } from "../types";
import { Maximize2, Minus, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function WindowSystemMenu({
  app,
  instance,
  onClose,
  onDismiss,
  onMaximize,
  onMinimize,
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
  onRestore: () => void;
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
      className="window-system-menu"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDismiss();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <div className="window-system-menu-title">
        <AppIconTile accent={app.accent} icon={app.icon} size="tiny" />
        <strong>{app.title}</strong>
      </div>
      <button
        disabled={!instance.maximized}
        onClick={onRestore}
        ref={firstItemRef}
        role="menuitem"
        type="button"
      >
        <Square aria-hidden="true" size={15} />
        복원
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
