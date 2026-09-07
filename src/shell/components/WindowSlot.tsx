import {
  Component,
  Suspense,
  memo,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  /** Aero Shake: minimize every other window, or bring them back. */
  shake: (windowId: string) => void;
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
      onShake={() => frameOps.shake(instance.id)}
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

/** What the window shows instead of its app when the app never arrived. */
function AppChunkError({ onRetry, title }: { onRetry: () => void; title: string }) {
  return (
    <div className="app-fill app-chunk-error" role="alert">
      <strong>{title}을 불러오지 못했습니다.</strong>
      <p>연결을 확인하고 다시 시도하세요. 다른 창은 그대로 열려 있습니다.</p>
      <button className="is-primary" onClick={onRetry} type="button">
        다시 시도
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
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const { app } = props;
  // Identity matters: WindowSlot is memoized on this object.
  const attemptApp = useMemo<AppDefinition>(
    () => (attempt === 0 ? app : { ...app, component: app.reload?.() ?? app.component }),
    [app, attempt],
  );
  return (
    <AppChunkBoundary
      // A failed boundary cannot un-fail itself; the retry remounts it.
      key={attempt}
      renderFailure={() => (
        <WindowSlot
          {...props}
          app={{
            ...app,
            component: () => <AppChunkError onRetry={retry} title={app.title} />,
          }}
        />
      )}
      title={app.title}
    >
      <Suspense fallback={null}>
        <WindowSlot {...props} app={attemptApp} />
      </Suspense>
    </AppChunkBoundary>
  );
});
