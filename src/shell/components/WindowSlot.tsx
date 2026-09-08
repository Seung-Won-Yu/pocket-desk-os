import { Component, Suspense, memo, type ReactNode } from "react";
import { WindowFrame } from "./WindowFrame";
import {
  type AppContentProps,
  type AppDefinition,
  type SnapPreviewState,
  type SnapZone,
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
  /** Aero Shake: minimize every other window, or bring them back. */
  shake: (windowId: string) => void;
  snapPreviewChange: (preview: SnapPreviewState | null) => void;
  /** Puts a window in a snap zone: 스냅 레이아웃 goes through the shell. */
  snap: (windowId: string, zone: SnapZone) => void;
  /** Win+Z asked for a window's layout flyout; the window clears it. */
  closeSnapFlyout: () => void;
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
  /** Win+Z is asking this window for its layout flyout. */
  snapFlyoutRequested?: boolean;
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
  snapFlyoutRequested = false,
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
      onShake={() => frameOps.shake(instance.id)}
      documentLabel={documentLabel}
      hasUnsavedChanges={hasUnsavedChanges}
      onCloseSnapFlyout={frameOps.closeSnapFlyout}
      onSnap={(zone) => frameOps.snap(instance.id, zone)}
      onSnapPreviewChange={frameOps.snapPreviewChange}
      snapFlyoutRequested={snapFlyoutRequested}
      onToggleMaximize={() => frameOps.toggleMaximize(instance.id)}
      onUpdate={(patch) => frameOps.update(instance.id, patch)}
      peeked={peeked}
    >
      <AppContent {...contentProps} windowId={instance.id} />
    </WindowFrame>
  );
});

/**
 * Confines a chunk-load failure to one window. Every app is its own chunk, and
 * Suspense handles only the waiting: a rejected import throws, and with no
 * boundary here the error climbed to the shell's root and unmounted the whole
 * desktop — every other window's state gone because one app could not be
 * downloaded (a blocked request, or a stale tab asking for a hash that a
 * redeploy has since replaced).
 */
class AppChunkBoundary extends Component<
  { children: ReactNode; renderFailure: () => ReactNode; title: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(`PocketDesk could not load ${this.props.title}`, error);
  }

  render() {
    return this.state.failed ? this.props.renderFailure() : this.props.children;
  }
}

/**
 * What the window shows instead of its app when the app never arrived.
 *
 * The button refreshes the page rather than retrying the import, because a
 * retry provably cannot work: measured against the deployed build, a second
 * import of a chunk that failed once issues no request at all — the browser
 * remembers the failed module for the life of the document. A fresh
 * `React.lazy` is necessary and not sufficient. Windows, files and settings
 * are restored on load, so the refresh is a real recovery, and the window
 * says which app it is about rather than replacing the desktop with a crash
 * screen.
 */
function AppChunkError({ title }: { title: string }) {
  return (
    <div className="app-fill app-chunk-error" role="alert">
      <strong>{title}을 불러오지 못했습니다.</strong>
      <p>
        브라우저가 실패한 모듈을 이 탭에 기억하므로, 새로 고침해야 다시 불러올 수 있습니다. 다른
        창은 그대로 열려 있고, 파일과 설정은 유지됩니다.
      </p>
      <button className="is-primary" onClick={() => window.location.reload()} type="button">
        새로 고침
      </button>
    </div>
  );
}

/**
 * One window with its app's chunk handled: it waits for the app rather than
 * appearing as a frame that is on screen and deaf, and a load failure stays
 * inside this window as a message with a 다시 시도 button.
 */
export const AppWindow = memo(function AppWindow(props: WindowSlotProps) {
  const { app } = props;
  return (
    <AppChunkBoundary
      renderFailure={() => (
        <WindowSlot
          {...props}
          // Only built on failure, so a new object here costs nothing.
          app={{ ...app, component: () => <AppChunkError title={app.title} /> }}
        />
      )}
      title={app.title}
    >
      <Suspense fallback={null}>
        <WindowSlot {...props} />
      </Suspense>
    </AppChunkBoundary>
  );
});
