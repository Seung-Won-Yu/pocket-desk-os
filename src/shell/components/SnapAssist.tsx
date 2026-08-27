import { useEffect, useRef } from "react";
import AppIconTile from "../../components/AppIconTile";
import { trapDialogFocus } from "../dialogFocus";
import { getApp } from "../appCatalog";
import { getSnapPreviewStyle } from "../windowGeometry";
import { type SnapZone, type WindowInstance } from "../types";

/**
 * Windows' Snap Assist: after a window takes one half, the opposite half offers
 * the remaining windows so the pair can be arranged in a single gesture.
 */
export function SnapAssist({
  candidates,
  onDismiss,
  onPick,
  zone,
}: {
  candidates: WindowInstance[];
  onDismiss: () => void;
  onPick: (windowId: string) => void;
  zone: SnapZone;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hasCandidates = candidates.length > 0;

  // Without focus inside, the Escape handler below never receives the key.
  useEffect(() => {
    if (!hasCandidates) return;
    const frameId = window.requestAnimationFrame(() => rootRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [hasCandidates]);

  if (!hasCandidates) return null;

  return (
    <div
      aria-label="화면 나누기 후보"
      className="snap-assist"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDismiss();
          return;
        }
        trapDialogFocus(event, event.currentTarget);
      }}
      aria-modal="true"
      ref={rootRef}
      role="dialog"
      style={getSnapPreviewStyle(zone)}
      tabIndex={-1}
    >
      <p className="snap-assist-title">나란히 놓을 창을 고르세요</p>
      <div className="snap-assist-grid">
        {candidates.map((item) => {
          const app = getApp(item.appId);
          return (
            <button
              className="snap-assist-card"
              key={item.id}
              onClick={() => onPick(item.id)}
              type="button"
            >
              <AppIconTile accent={app.accent} icon={app.icon} size="large" />
              <strong>{app.title}</strong>
              <small>{item.minimized ? "최소화됨" : `${Math.round(item.width)}px`}</small>
            </button>
          );
        })}
      </div>
      <button className="snap-assist-dismiss" onClick={onDismiss} type="button">
        나중에
      </button>
    </div>
  );
}
