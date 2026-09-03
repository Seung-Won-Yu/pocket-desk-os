import { memo } from "react";
import { WindowFrame } from "./WindowFrame";
import {
  type AppContentProps,
  type AppDefinition,
  type SnapPreviewState,
  type WindowInstance,
  type WindowMotion,
} from "../types";

/** The shell operations a window frame needs, keyed by window id. */
export type WindowFrameOps = {
  close: (windowId: string) => void;
  focus: (windowId: string) => void;
  minimize: (windowId: string) => void;
  openSystemMenu: (event: React.MouseEvent<HTMLDivElement>, windowId: string) => void;
  setInteracting: (windowId: string, interacting: boolean) => void;
  snapPreviewChange: (preview: SnapPreviewState | null) => void;
  toggleMaximize: (windowId: string) => void;
  update: (windowId: string, patch: Partial<WindowInstance>) => void;
};

export type WindowSlotProps = {
  active: boolean;
  app: AppDefinition;
  /** Everything an app receives except its own window id — shared by all windows. */
  contentProps: Omit<AppContentProps, "windowId">;
  documentLabel?: string;
  frameOps: WindowFrameOps;
  hasUnsavedChanges: boolean;
  instance: WindowInstance;
  motion?: WindowMotion;
  /** Aero Peek target: shown alone while the rest are dimmed. */
  peeked?: boolean;
};

/**
 * One window: its frame plus its app. Memoized, so a shell commit that
 * touches only some other window — a drag reports ~60 commits a second —
 * leaves this one's frame and app subtree entirely alone. That contract
 * holds because every prop here is reference-stable across such commits:
 * `frameOps` and the operations inside `contentProps` are ref-backed
 * proxies built once, the data inside `contentProps` only changes when the
 * data changes, and an untouched window keeps its `instance` object.
 * Inline closures below are fine — they live inside the memo boundary.
 */
export const WindowSlot = memo(function WindowSlot({
  active,
  app,
  contentProps,
  documentLabel,
  frameOps,
  hasUnsavedChanges,
  instance,
  motion,
  peeked = false,
}: WindowSlotProps) {
  const AppContent = app.component;
  return (
    <WindowFrame
      app={app}
      active={active}
      instance={instance}
      motion={motion}
      onClose={() => frameOps.close(instance.id)}
      onFocus={() => frameOps.focus(instance.id)}
      onMinimize={() => frameOps.minimize(instance.id)}
      onInteractionChange={(interacting) => frameOps.setInteracting(instance.id, interacting)}
      onOpenSystemMenu={(event) => frameOps.openSystemMenu(event, instance.id)}
      documentLabel={documentLabel}
      hasUnsavedChanges={hasUnsavedChanges}
      onSnapPreviewChange={frameOps.snapPreviewChange}
      onToggleMaximize={() => frameOps.toggleMaximize(instance.id)}
      onUpdate={(patch) => frameOps.update(instance.id, patch)}
      peeked={peeked}
    >
      <AppContent {...contentProps} windowId={instance.id} />
    </WindowFrame>
  );
});
