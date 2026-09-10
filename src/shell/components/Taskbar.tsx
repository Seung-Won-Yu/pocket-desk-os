import AppIconTile from "../../components/AppIconTile";
import { WindowThumbnail } from "./WindowThumbnail";
import { type AppId, type DesktopItem } from "../../types";
import { clamp } from "../../utils/format";
import { NOTIFICATIONS_READ_KEY } from "../constants";
import { getTaskbarAppOrder } from "../taskbarOrder";
import { getApp } from "../appCatalog";
import { getVfsEntryAssociation } from "../../vfs/model";
import { formatWindowTitle } from "../windowTitle";
import { createCalendarGrid, formatNotificationTime, getLocalDateKey } from "../startSearch";
import { type ClockAlarm, getAlarmDateKeys } from "../clock";
import {
  CALENDAR_EVENT_LIMIT,
  type CalendarEvent,
  MAX_CALENDAR_TITLE_LENGTH,
  formatCalendarEventDay,
  getEventDateKeys,
  getEventsForDate,
  isValidEventTime,
} from "../calendarEvents";
import { type TaskbarPosition, isVerticalTaskbar } from "../taskbarPosition";
import { type ArrangeMode } from "../windowArrangement";
import { type AppDefinition, type ToastMessage, type WindowInstance } from "../types";
import { BrandMark, StartGlyph } from "./Branding";
import { Clock } from "./Clock";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  FolderOpen,
  Layers,
  LayoutGrid,
  MonitorDown,
  Moon,
  Pin,
  PinOff,
  Play,
  Rows3,
  Search,
  Settings,
  SquarePlus,
  SquareTerminal,
  Sun,
  Volume2,
  Wifi,
  X,
  AlarmClock,
  Plus,
  SunMoon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getNextRovingIndex, handleMenuKeyboard } from "../keyboardNav";

export function Taskbar({
  activeDesktopIndex,
  activeDesktopName,
  activeWindowId,
  availableApps,
  brightness,
  nightLight,
  onSetNightLight,
  clockAlarms,
  calendarEvents,
  onAddCalendarEvent,
  onRemoveCalendarEvent,
  desktopCount,
  onToggleTaskView,
  taskViewOpen,
  notificationHistory,
  onClearNotifications,
  onNotificationCentreOpenChange,
  onOpenNotificationItem,
  onDismissNotification,
  onOpenSettingsSection,
  onReorderPinnedApp,
  onOpenStart,
  getDocumentLabel,
  onArrangeWindows,
  onOpenApp,
  onPeekDesktop,
  onPeekWindow,
  onOpenNewWindow,
  onOpenRunDialog,
  clock24h,
  onSearch,
  searchQuery,
  onSetBrightness,
  focusAssist,
  onSetFocusAssist,
  taskbarPosition,
  onSetSoundEnabled,
  onSetVolume,
  onShowDesktop,
  onTogglePinnedApp,
  onCloseWindow,
  onOpenRecentDocument,
  onToggleWindow,
  pinnedAppIds,
  recentDocumentsByApp,
  soundEnabled,
  volume,
  startOpen,
  windows,
}: {
  activeDesktopIndex: number;
  /** What the desktop in front is called — its own name, or its number. */
  activeDesktopName: string;
  activeWindowId?: string;
  availableApps: AppDefinition[];
  brightness: number;
  /** 야간 조명 — the warm wash, toggled from 빠른 설정. */
  nightLight: boolean;
  onSetNightLight: (enabled: boolean) => void;
  desktopCount: number;
  onToggleTaskView: () => void;
  taskViewOpen: boolean;
  notificationHistory: ToastMessage[];
  /** The clock's alarms; the tray calendar dots the days they ring on. */
  clockAlarms: ClockAlarm[];
  /** 캘린더 일정: the entries the tray calendar lists, dots and adds to. */
  calendarEvents: CalendarEvent[];
  onAddCalendarEvent: (date: string, time: string | null, title: string) => void;
  onRemoveCalendarEvent: (eventId: string) => void;
  onClearNotifications: () => void;
  /** Opens the entry a notification is about, the way Windows notifications act. */
  onOpenNotificationItem: (itemId: string) => void;
  /** Drops one notification from the centre, as Windows dismisses them singly. */
  onDismissNotification: (notificationId: string) => void;
  /**
   * The banners belong to the panel while it is open: the ones already up go
   * with it, and no new one is raised until it closes.
   */
  onNotificationCentreOpenChange: (open: boolean) => void;
  /** Drag a pinned taskbar button onto another to rearrange them. */
  onReorderPinnedApp: (movedId: AppId, targetId: AppId) => void;
  /** The clock's 날짜 및 시간 조정 and 작업 표시줄 설정 open 설정 at their page. */
  onOpenSettingsSection: (section: "personalization" | "time") => void;
  onOpenStart: (event: React.MouseEvent<HTMLButtonElement>) => void;
  getDocumentLabel: (windowId: string, appId: AppId) => string | undefined;
  /** 창 계단식 배열 / 위아래 정렬 / 나란히 정렬 from the taskbar menu. */
  onArrangeWindows: (mode: ArrangeMode) => void;
  onOpenApp: (appId: AppId) => void;
  /** Aero Peek at the desktop while the show-desktop strip is hovered. */
  onPeekDesktop: (peek: boolean) => void;
  /** Aero Peek at one window while its taskbar thumbnail is hovered. */
  onPeekWindow: (windowId: string | null) => void;
  onOpenNewWindow: (appId: AppId) => void;
  onOpenRunDialog: () => void;
  clock24h: boolean;
  onSearch: (query: string) => void;
  searchQuery: string;
  onSetBrightness: (brightness: number) => void;
  focusAssist: boolean;
  onSetFocusAssist: (enabled: boolean) => void;
  /** Which screen edge the bar is on; the flyouts anchor off it. */
  taskbarPosition: TaskbarPosition;
  onSetSoundEnabled: (enabled: boolean) => void;
  onSetVolume: (volume: number) => void;
  onShowDesktop: () => void;
  onTogglePinnedApp: (appId: AppId) => void;
  onCloseWindow: (id: string) => void;
  onOpenRecentDocument: (item: DesktopItem) => void;
  onToggleWindow: (id: string) => void;
  pinnedAppIds: AppId[];
  /** Per-app 최근 항목 for the jump list; see src/shell/jumpList.ts. */
  recentDocumentsByApp: Map<AppId, DesktopItem[]>;
  soundEnabled: boolean;
  volume: number;
  startOpen: boolean;
  windows: WindowInstance[];
}) {
  const taskbarRef = useRef<HTMLElement | null>(null);
  const [rovingAppId, setRovingAppId] = useState<AppId | null>(null);
  const [readNotificationId, setReadNotificationId] = useState<string | null>(() =>
    localStorage.getItem(NOTIFICATIONS_READ_KEY),
  );

  useEffect(() => {
    // The history survives a reload, so the read marker has to as well — the
    // badge used to resurrect for notifications read before the refresh.
    if (readNotificationId) localStorage.setItem(NOTIFICATIONS_READ_KEY, readNotificationId);
  }, [readNotificationId]);
  const unreadNotificationCount = (() => {
    if (!readNotificationId) return notificationHistory.length;
    const index = notificationHistory.findIndex((item) => item.id === readNotificationId);
    /*
     * A marker that is no longer in the history means the notification the
     * reader had seen was dismissed — everything left is at least as old, so
     * nothing is unread. Counting the whole history here made the badge come
     * back the moment one notification was dropped.
     */
    return index === -1 ? 0 : index;
  })();
  const trayRef = useRef<HTMLDivElement | null>(null);
  const vertical = isVerticalTaskbar(taskbarPosition);
  const [preview, setPreview] = useState<{
    anchor: CSSProperties;
    app: AppDefinition;
    windows: WindowInstance[];
  } | null>(null);
  const [taskbarMenu, setTaskbarMenu] = useState<{ appId: AppId; x: number; y: number } | null>(
    null,
  );
  const [shellMenu, setShellMenu] = useState<{ x: number; y: number } | null>(null);
  const taskbarMenuButtonRef = useRef<HTMLButtonElement>(null);
  const shellMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [trayPanel, setTrayPanel] = useState<"notifications" | "quick" | null>(null);
  /*
   * Reported from an effect rather than from the toggle, because the panel also
   * closes on Escape and on a click outside it — hooking only the button would
   * have left the shell believing the centre was still open, and suppressed
   * every banner from then on.
   */
  const centreOpenChangeRef = useRef(onNotificationCentreOpenChange);
  centreOpenChangeRef.current = onNotificationCentreOpenChange;
  useEffect(() => {
    centreOpenChangeRef.current(trayPanel === "notifications");
  }, [trayPanel]);
  const availableAppIds = new Set(availableApps.map((app) => app.id));
  // Windows rearranges pinned taskbar buttons by dragging one onto another.
  const [clockMenu, setClockMenu] = useState<{ x: number; y: number } | null>(null);
  const [draggingAppId, setDraggingAppId] = useState<AppId | null>(null);
  const [appDropTargetId, setAppDropTargetId] = useState<AppId | null>(null);
  // The same order Win+1…9 counts along, from the same helper.
  const taskbarApps = getTaskbarAppOrder(
    pinnedAppIds,
    availableAppIds,
    windows.map((item) => item.appId),
  ).map((appId) => ({
    app: getApp(appId),
    windows: windows.filter((item) => item.appId === appId),
  }));

  /*
   * The roving stop has to name a button that is still on the bar. Closing the
   * last window of an unpinned app, or unpinning one, removed the button the
   * stop pointed at and left the whole band out of the tab order.
   */
  const rovingTabStopId =
    taskbarApps.find(({ app }) => app.id === rovingAppId)?.app.id ??
    taskbarApps[0]?.app.id ??
    null;

  /**
   * Where a flyout sits along the bar. A menu opened from a horizontal bar
   * follows the pointer left to right and the stylesheet lifts it clear of the
   * bar; on a vertical bar the roles of the two axes swap, and the anchor has
   * to swap with them or every menu piles up at the top-left corner.
   *
   * Measured inside the bar, because that is the containing block these
   * flyouts are positioned against.
   */
  const anchorOnBar = (point: { x: number; y: number }, half: number): CSSProperties => {
    const box = taskbarRef.current?.getBoundingClientRect();
    if (vertical) {
      const span = box?.height ?? window.innerHeight;
      return { top: clamp(point.y - (box?.top ?? 0), half, Math.max(half, span - half)) };
    }
    const span = box?.width ?? window.innerWidth;
    return { left: clamp(point.x - (box?.left ?? 0), half, Math.max(half, span - half)) };
  };

  const showPreview = (
    element: HTMLElement,
    app: AppDefinition,
    windowItems: WindowInstance[],
  ) => {
    cancelPreviewClose();
    const buttonBox = element.getBoundingClientRect();
    setPreview({
      anchor: anchorOnBar(
        { x: buttonBox.left + buttonBox.width / 2, y: buttonBox.top + buttonBox.height / 2 },
        118,
      ),
      app,
      windows: windowItems,
    });
  };

  /*
   * The preview card is a sibling of the taskbar slot, so moving the pointer
   * from the button onto the card leaves the slot. Closing immediately made the
   * card unreachable — which is why it had to be inert. A short grace period,
   * cancelled when the pointer lands on the card, makes it clickable the way
   * Windows' thumbnails are.
   */
  const previewCloseTimerRef = useRef<number | null>(null);

  const cancelPreviewClose = () => {
    if (previewCloseTimerRef.current === null) return;
    window.clearTimeout(previewCloseTimerRef.current);
    previewCloseTimerRef.current = null;
  };

  const hidePreview = () => {
    cancelPreviewClose();
    previewCloseTimerRef.current = window.setTimeout(() => {
      previewCloseTimerRef.current = null;
      setPreview(null);
    }, 220);
  };

  const hidePreviewNow = () => {
    cancelPreviewClose();
    setPreview(null);
  };

  useEffect(() => cancelPreviewClose, []);

  useEffect(() => {
    if (!trayPanel) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && trayRef.current?.contains(event.target)) return;
      setTrayPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTrayPanel(null);
      }
    };

    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      if (opener?.isConnected) opener.focus();
    };
  }, [trayPanel]);

  useEffect(() => {
    if (!taskbarMenu) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => taskbarMenuButtonRef.current?.focus());
    const closeMenu = () => setTaskbarMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
      if (opener?.isConnected) opener.focus();
    };
  }, [taskbarMenu]);

  useEffect(() => {
    if (!shellMenu) return;
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => shellMenuButtonRef.current?.focus());
    const closeMenu = () => setShellMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
      if (opener?.isConnected) opener.focus();
    };
  }, [shellMenu]);

  const openShellMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setPreview(null);
    setTaskbarMenu(null);
    setShellMenu({ x: event.clientX, y: event.clientY });
  };

  /*
   * What keeps a hidden bar out: anything of the bar's own that is open. The
   * Start menu counts, and so does a window preview — the pointer travels off
   * the bar to reach either of them.
   */
  const revealed =
    startOpen ||
    trayPanel !== null ||
    preview !== null ||
    taskbarMenu !== null ||
    shellMenu !== null ||
    clockMenu !== null;

  const shellMenuItems: Array<{ icon: LucideIcon; label: string; run: () => void }> = [
    { icon: Activity, label: "작업 관리자", run: () => onOpenApp("taskmanager") },
    { icon: SquareTerminal, label: "명령 프롬프트", run: () => onOpenApp("terminal") },
    { icon: FolderOpen, label: "파일 탐색기", run: () => onOpenApp("files") },
    { icon: Play, label: "실행", run: onOpenRunDialog },
    { icon: Settings, label: "설정", run: () => onOpenApp("settings") },
    { icon: Layers, label: "창 계단식 배열", run: () => onArrangeWindows("cascade") },
    { icon: Rows3, label: "창 위아래 정렬", run: () => onArrangeWindows("stack") },
    { icon: Columns3, label: "창 나란히 정렬", run: () => onArrangeWindows("side-by-side") },
    { icon: MonitorDown, label: "바탕 화면 보기", run: onShowDesktop },
    {
      icon: Settings,
      label: "작업 표시줄 설정",
      run: () => onOpenSettingsSection("personalization"),
    },
  ];

  // Resting the pointer on the show-desktop strip peeks at the desktop; a
  // press still toggles. Windows waits a beat so a pass-by does not flash.
  const desktopPeekTimerRef = useRef<number | null>(null);
  const cancelDesktopPeek = () => {
    if (desktopPeekTimerRef.current !== null) {
      window.clearTimeout(desktopPeekTimerRef.current);
      desktopPeekTimerRef.current = null;
    }
    onPeekDesktop(false);
  };
  const armDesktopPeek = () => {
    if (desktopPeekTimerRef.current !== null) return;
    desktopPeekTimerRef.current = window.setTimeout(() => {
      desktopPeekTimerRef.current = null;
      onPeekDesktop(true);
    }, 400);
  };
  // Going away while peeking would leave the desktop dimmed with nothing left
  // to un-dim it, so the last thing the bar does is put the windows back.
  const cancelPeekRef = useRef(cancelDesktopPeek);
  cancelPeekRef.current = cancelDesktopPeek;
  useEffect(
    () => () => {
      cancelPeekRef.current();
    },
    [],
  );

  return (
    /*
     * 자동 숨기기: the bar slides away, and hovering the sliver at the edge
     * brings it back. It must also stay out while something of its own is open
     * — a menu or a panel would otherwise be left hanging over an empty edge
     * the moment the pointer moved off the bar and onto the menu itself.
     */
    <footer
      className={`taskbar${revealed ? " is-revealed" : ""}`}
      onContextMenu={openShellMenu}
      ref={taskbarRef}
    >
      <div className="taskbar-center">
        <button
          aria-expanded={startOpen}
          aria-haspopup="menu"
          aria-label="시작 메뉴"
          className="start-button"
          onClick={onOpenStart}
          onContextMenu={openShellMenu}
          type="button"
        >
          <StartGlyph />
        </button>
        <div className="taskbar-search">
          <Search aria-hidden="true" size={15} />
          <input
            aria-label="검색"
            autoComplete="off"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="검색하려면 여기에 입력하십시오"
            spellCheck={false}
            type="search"
            value={searchQuery}
          />
        </div>
        <button
          aria-label={`작업 보기 (${activeDesktopName}, ${activeDesktopIndex + 1}/${desktopCount})`}
          aria-pressed={taskViewOpen}
          className={`task-view-button${taskViewOpen ? " is-active" : ""}`}
          onClick={onToggleTaskView}
          title="작업 보기 · Win+Tab"
          type="button"
        >
          <LayoutGrid aria-hidden="true" size={17} />
          {desktopCount > 1 && <span>{activeDesktopIndex + 1}</span>}
        </button>
        {/*
         * One tab stop for the whole band, arrows to move within it — the
         * Windows model, and what the desktop icons and the Start menu do.
         * Every button was its own tab stop, so Tab had to walk through all of
         * them to leave the taskbar and the arrow keys did nothing.
         */}
        <div
          aria-label="열린 앱"
          className="taskbar-windows"
          onKeyDown={(event) => {
            // A horizontal toolbar: up and down belong to whatever else wants
            // them, so only the keys that mean something here are claimed.
            if (event.key === "ArrowUp" || event.key === "ArrowDown") return;
            const nextIndex = getNextRovingIndex(
              event.key,
              taskbarApps.findIndex(({ app }) => app.id === rovingAppId),
              taskbarApps.length,
            );
            if (nextIndex === null) return;
            event.preventDefault();
            const nextApp = taskbarApps[nextIndex];
            if (!nextApp) return;
            setRovingAppId(nextApp.app.id);
            const buttons =
              event.currentTarget.querySelectorAll<HTMLButtonElement>(".taskbar-app");
            buttons[nextIndex]?.focus({ preventScroll: true });
          }}
          aria-orientation="horizontal"
          role="toolbar"
        >
          {taskbarApps.map(({ app, windows: appWindows }) => {
            const isPinned = pinnedAppIds.includes(app.id);
            const orderedAppWindows = [...appWindows].sort(
              (first, second) => second.z - first.z,
            );
            const activeAppWindow = orderedAppWindows.find(
              (item) => item.id === activeWindowId,
            );
            const windowItem = activeAppWindow ?? orderedAppWindows[0];
            const allMinimized =
              appWindows.length > 0 && appWindows.every((item) => item.minimized);
            return (
              <div
                className={`taskbar-slot${draggingAppId === app.id ? " is-dragging" : ""}${
                  appDropTargetId === app.id ? " is-drop-target" : ""
                }`}
                draggable={isPinned}
                key={`taskbar-${app.id}`}
                onDragEnd={() => {
                  setDraggingAppId(null);
                  setAppDropTargetId(null);
                }}
                onDragEnter={(event) => {
                  if (!draggingAppId || !isPinned) return;
                  event.preventDefault();
                  setAppDropTargetId(app.id);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setAppDropTargetId((current) => (current === app.id ? null : current));
                }}
                onDragOver={(event) => {
                  if (!draggingAppId || !isPinned) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragStart={(event) => {
                  if (!isPinned) return;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", app.id);
                  setDraggingAppId(app.id);
                }}
                onDrop={(event) => {
                  const movedId = (draggingAppId ??
                    event.dataTransfer.getData("text/plain")) as AppId;
                  setDraggingAppId(null);
                  setAppDropTargetId(null);
                  if (!movedId || movedId === app.id || !isPinned) return;
                  event.preventDefault();
                  onReorderPinnedApp(movedId, app.id);
                }}
                onBlur={hidePreview}
                onFocusCapture={(event) =>
                  showPreview(event.currentTarget, app, orderedAppWindows)
                }
                onPointerEnter={(event) =>
                  showPreview(event.currentTarget, app, orderedAppWindows)
                }
                // Pointer events, like the card's own: the two families dispatch
                // in separate passes, and with mouse events here the card's
                // cancel ran before this leave armed the hide timer — the card
                // closed under the pointer every time it was entered.
                onPointerLeave={hidePreview}
              >
                <button
                  aria-current={
                    appWindows.some((item) => item.id === activeWindowId) ? "true" : undefined
                  }
                  aria-label={`${app.title}${appWindows.length > 1 ? `, ${appWindows.length}개 창` : ""}`}
                  data-app-id={app.id}
                  className={`taskbar-app ${activeAppWindow ? "is-current" : ""} ${
                    allMinimized ? "is-minimized" : ""
                  } ${isPinned ? "is-pinned" : ""} ${windowItem ? "is-open" : ""}`}
                  onClick={() => {
                    if (activeAppWindow && orderedAppWindows.length > 1) {
                      const activeIndex = orderedAppWindows.findIndex(
                        (item) => item.id === activeAppWindow.id,
                      );
                      const nextWindow =
                        orderedAppWindows[(activeIndex + 1) % orderedAppWindows.length];
                      onToggleWindow(nextWindow.id);
                    } else if (windowItem) {
                      onToggleWindow(windowItem.id);
                    } else {
                      onOpenApp(app.id);
                    }
                  }}
                  onAuxClick={(event) => {
                    // Windows opens another instance on a middle click. Offered
                    // only where a second window is safe — see AppMetadata.
                    if (event.button !== 1 || !app.multiInstance) return;
                    event.preventDefault();
                    hidePreviewNow();
                    onOpenNewWindow(app.id);
                  }}
                  onFocus={() => setRovingAppId(app.id)}
                  tabIndex={rovingTabStopId === app.id ? 0 : -1}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    // Keep the taskbar's own shell menu from replacing this one.
                    event.stopPropagation();
                    setPreview(null);
                    setShellMenu(null);
                    setTaskbarMenu({ appId: app.id, x: event.clientX, y: event.clientY });
                  }}
                  title={`${app.title} · 우클릭으로 ${isPinned ? "고정 해제" : "작업표시줄에 고정"}`}
                  type="button"
                >
                  <AppIconTile accent={app.accent} icon={app.icon} size="small" />
                  <span>{app.title}</span>
                  {appWindows.length > 1 && (
                    <span className="taskbar-window-count">{appWindows.length}</span>
                  )}
                  {isPinned ? (
                    <Pin aria-hidden="true" className="taskbar-pin-icon" size={11} />
                  ) : (
                    <PinOff aria-hidden="true" className="taskbar-pin-icon" size={11} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {preview && (
        <TaskbarPreview
          {...preview}
          getDocumentLabel={getDocumentLabel}
          onCloseWindow={(id) => {
            hidePreviewNow();
            onCloseWindow(id);
          }}
          onPeekWindow={onPeekWindow}
          onPointerEnter={cancelPreviewClose}
          onPointerLeave={hidePreview}
          onSelectWindow={(id) => {
            hidePreviewNow();
            onToggleWindow(id);
          }}
        />
      )}
      {taskbarMenu && (
        <div
          aria-label={`${getApp(taskbarMenu.appId).title} 점프 목록`}
          className="taskbar-context-menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={anchorOnBar(taskbarMenu, 112)}
        >
          {/* 최근 항목 — the documents this app would open, newest first. */}
          {(recentDocumentsByApp.get(taskbarMenu.appId) ?? []).length > 0 && (
            <>
              {/* role=menu allows menuitem/group/separator children only, so
                  the caption lives on a group and the <hr> keeps its implicit
                  separator role. */}
              <div aria-label="최근 항목" role="group">
                <strong aria-hidden="true" className="taskbar-menu-caption">
                  최근 항목
                </strong>
                {(recentDocumentsByApp.get(taskbarMenu.appId) ?? []).map((item, index) => {
                  const ItemIcon = getVfsEntryAssociation(item).icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTaskbarMenu(null);
                        onOpenRecentDocument(item);
                      }}
                      ref={index === 0 ? taskbarMenuButtonRef : undefined}
                      role="menuitem"
                      type="button"
                    >
                      {item.kind === "canvas" && item.content ? (
                        <img alt="" className="taskbar-menu-thumbnail" src={item.content} />
                      ) : (
                        <ItemIcon aria-hidden="true" size={15} />
                      )}
                      <span className="taskbar-menu-item-name">{item.name}</span>
                    </button>
                  );
                })}
              </div>
              <hr className="taskbar-menu-separator" />
            </>
          )}
          {/* Windows puts the app itself at the top of a jump list; picking it
              opens a fresh instance rather than raising the running one. Apps
              whose document lives in shell state cannot have a second window,
              so they do not offer one. */}
          {getApp(taskbarMenu.appId).multiInstance && (
            <button
              onClick={() => {
                setTaskbarMenu(null);
                onOpenNewWindow(taskbarMenu.appId);
              }}
              ref={
                (recentDocumentsByApp.get(taskbarMenu.appId) ?? []).length > 0
                  ? undefined
                  : taskbarMenuButtonRef
              }
              role="menuitem"
              type="button"
            >
              <SquarePlus aria-hidden="true" size={15} />새 창
            </button>
          )}
          <button
            onClick={() => {
              onTogglePinnedApp(taskbarMenu.appId);
              setTaskbarMenu(null);
            }}
            ref={
              getApp(taskbarMenu.appId).multiInstance ||
              (recentDocumentsByApp.get(taskbarMenu.appId) ?? []).length > 0
                ? undefined
                : taskbarMenuButtonRef
            }
            role="menuitem"
            type="button"
          >
            {pinnedAppIds.includes(taskbarMenu.appId) ? (
              <PinOff aria-hidden="true" size={15} />
            ) : (
              <Pin aria-hidden="true" size={15} />
            )}
            {pinnedAppIds.includes(taskbarMenu.appId)
              ? "작업 표시줄에서 제거"
              : "작업 표시줄에 고정"}
          </button>
          {windows.some((item) => item.appId === taskbarMenu.appId) && (
            // Closing from the taskbar is a routine Windows action and had no
            // equivalent here. Closes every window of that app, as Windows does.
            <button
              onClick={() => {
                setTaskbarMenu(null);
                windows
                  .filter((item) => item.appId === taskbarMenu.appId)
                  .forEach((item) => onCloseWindow(item.id));
              }}
              role="menuitem"
              type="button"
            >
              <X aria-hidden="true" size={15} />창 닫기
            </button>
          )}
        </div>
      )}
      {shellMenu && (
        <div
          aria-label="작업 표시줄 메뉴"
          className="taskbar-context-menu is-shell-menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={anchorOnBar(shellMenu, 112)}
        >
          {shellMenuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                setShellMenu(null);
                item.run();
              }}
              ref={index === 0 ? shellMenuButtonRef : undefined}
              role="menuitem"
              type="button"
            >
              <item.icon aria-hidden="true" size={15} />
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className="system-tray-wrap" ref={trayRef}>
        <div className="system-tray-buttons">
          <button
            aria-expanded={trayPanel === "quick"}
            aria-haspopup="dialog"
            aria-label="빠른 설정 열기"
            className="system-tray system-tray-status"
            onClick={() => setTrayPanel((current) => (current === "quick" ? null : "quick"))}
            type="button"
          >
            <Wifi aria-hidden="true" size={16} />
            <Volume2 aria-hidden="true" size={16} />
          </button>
          <button
            aria-expanded={trayPanel === "notifications"}
            aria-haspopup="dialog"
            className="system-tray system-tray-clock-button"
            onContextMenu={(event) => {
              // Windows adjusts the clock from the clock's own menu.
              event.preventDefault();
              event.stopPropagation();
              setTrayPanel(null);
              setClockMenu({ x: event.clientX, y: event.clientY });
            }}
            onClick={() =>
              setTrayPanel((current) => {
                const next = current === "notifications" ? null : "notifications";
                if (next === "notifications") {
                  setReadNotificationId(notificationHistory[0]?.id ?? null);
                }
                return next;
              })
            }
            type="button"
          >
            {/* Name from contents, purpose first: an aria-label here hid the
                clock, so a screen reader could not read the time off the
                taskbar at all. */}
            <span className="sr-only">
              {unreadNotificationCount > 0
                ? `알림 센터 열기, 읽지 않은 알림 ${unreadNotificationCount}개, `
                : "알림 센터 열기, "}
              {focusAssist ? "집중 지원 켜짐, " : ""}
            </span>
            {/* Windows puts a moon in the tray while Focus assist is on, so the
                absence of toasts is something you can see rather than guess. */}
            {focusAssist && (
              <Moon
                aria-hidden="true"
                className="tray-focus-assist-mark"
                size={13}
                strokeWidth={2.4}
              />
            )}
            <Clock hour24={clock24h} />
            {/* Windows shows the unread count on the tray; nothing here said a
                notification had arrived unless the panel happened to be open. */}
            {unreadNotificationCount > 0 && (
              <span aria-hidden="true" className="tray-notification-badge">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </button>
        </div>
        {trayPanel === "quick" && (
          <QuickSettingsPanel
            brightness={brightness}
            nightLight={nightLight}
            onSetNightLight={onSetNightLight}
            focusAssist={focusAssist}
            onSetFocusAssist={onSetFocusAssist}
            onOpenSettings={() => {
              setTrayPanel(null);
              onOpenApp("settings");
            }}
            onSetBrightness={onSetBrightness}
            onSetSoundEnabled={onSetSoundEnabled}
            onSetVolume={onSetVolume}
            soundEnabled={soundEnabled}
            volume={volume}
          />
        )}
        {trayPanel === "notifications" && (
          <NotificationCenterPanel
            calendarEvents={calendarEvents}
            clockAlarms={clockAlarms}
            focusAssist={focusAssist}
            onAddCalendarEvent={onAddCalendarEvent}
            onRemoveCalendarEvent={onRemoveCalendarEvent}
            onSetFocusAssist={onSetFocusAssist}
            notifications={notificationHistory}
            onClearNotifications={onClearNotifications}
            onDismissNotification={onDismissNotification}
            onOpenNotificationItem={(itemId) => {
              setTrayPanel(null);
              onOpenNotificationItem(itemId);
            }}
          />
        )}
      </div>
      {clockMenu && (
        <div
          aria-label="시계 메뉴"
          className="taskbar-context-menu is-shell-menu"
          onBlurCapture={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setClockMenu(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setClockMenu(null);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={anchorOnBar(clockMenu, 112)}
        >
          <button
            autoFocus
            onClick={() => {
              setClockMenu(null);
              onOpenSettingsSection("time");
            }}
            role="menuitem"
            type="button"
          >
            <Clock3 aria-hidden="true" size={15} />
            날짜 및 시간 조정
          </button>
        </div>
      )}
      <button
        aria-label="바탕 화면 표시"
        className="show-desktop-button"
        onBlur={cancelDesktopPeek}
        onClick={() => {
          cancelDesktopPeek();
          onShowDesktop();
        }}
        onFocus={armDesktopPeek}
        onPointerEnter={armDesktopPeek}
        onPointerLeave={cancelDesktopPeek}
        title="바탕 화면 표시"
        type="button"
      />
    </footer>
  );
}

export function QuickSettingsPanel({
  brightness,
  nightLight,
  onSetNightLight,
  focusAssist,
  onOpenSettings,
  onSetBrightness,
  onSetFocusAssist,
  onSetSoundEnabled,
  onSetVolume,
  soundEnabled,
  volume,
}: {
  brightness: number;
  nightLight: boolean;
  onSetNightLight: (enabled: boolean) => void;
  focusAssist: boolean;
  onOpenSettings: () => void;
  onSetBrightness: (brightness: number) => void;
  onSetFocusAssist: (enabled: boolean) => void;
  onSetSoundEnabled: (enabled: boolean) => void;
  onSetVolume: (volume: number) => void;
  soundEnabled: boolean;
  volume: number;
}) {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return (
    <section
      aria-label="빠른 설정"
      className="quick-settings-panel"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="quick-toggle-grid">
        <div className={`quick-status-tile ${online ? "is-enabled" : ""}`}>
          <Wifi aria-hidden="true" size={17} />
          <span>네트워크</span>
          <small>{online ? "연결됨" : "오프라인"}</small>
        </div>
        <button
          aria-pressed={soundEnabled}
          className={soundEnabled ? "is-enabled" : ""}
          onClick={() => onSetSoundEnabled(!soundEnabled)}
          type="button"
        >
          <Volume2 aria-hidden="true" size={17} />
          <span>시스템 소리</span>
          <small>{soundEnabled ? "켜짐" : "꺼짐"}</small>
        </button>
        {/* 집중 지원 sits with the other quick toggles, as it does in Windows:
            the notifications keep arriving, they just wait in the centre. */}
        <button
          aria-pressed={focusAssist}
          className={focusAssist ? "is-enabled" : ""}
          onClick={() => onSetFocusAssist(!focusAssist)}
          type="button"
        >
          <Moon aria-hidden="true" size={17} />
          <span>집중 지원</span>
          <small>{focusAssist ? "알림 숨김" : "꺼짐"}</small>
        </button>
        {/* 야간 조명: the same quick toggle Windows puts here, with its strength
            in 설정 → 시스템 → 디스플레이. */}
        <button
          aria-pressed={nightLight}
          className={nightLight ? "is-enabled" : ""}
          onClick={() => onSetNightLight(!nightLight)}
          type="button"
        >
          <SunMoon aria-hidden="true" size={17} />
          <span>야간 조명</span>
          <small>{nightLight ? "켜짐" : "꺼짐"}</small>
        </button>
      </div>
      <label className="quick-slider">
        <Sun aria-hidden="true" size={17} />
        <input
          aria-label="화면 밝기"
          max="100"
          min="30"
          onChange={(event) => onSetBrightness(Number(event.target.value))}
          type="range"
          value={brightness}
        />
      </label>
      <label className="quick-volume">
        <Volume2 aria-hidden="true" size={17} />
        <input
          aria-label="볼륨"
          max="100"
          min="0"
          onChange={(event) => onSetVolume(Number(event.target.value))}
          type="range"
          value={soundEnabled ? volume : 0}
        />
      </label>
      <div className="quick-actions">
        <button aria-label="설정" onClick={onOpenSettings} title="설정" type="button">
          <Settings aria-hidden="true" size={16} />
        </button>
      </div>
    </section>
  );
}

export function NotificationCenterPanel({
  calendarEvents = [],
  clockAlarms = [],
  focusAssist,
  onAddCalendarEvent,
  onRemoveCalendarEvent,
  onSetFocusAssist,
  notifications,
  onClearNotifications,
  onDismissNotification,
  onOpenNotificationItem,
}: {
  /** 캘린더 일정: the entries the picked day's agenda lists, and the grid dots. */
  calendarEvents?: CalendarEvent[];
  /** Alarms mark their days on the calendar, as Windows dots days with events. */
  clockAlarms?: ClockAlarm[];
  focusAssist: boolean;
  /** A time of null is an all-day entry, which carries no reminder. */
  onAddCalendarEvent?: (date: string, time: string | null, title: string) => void;
  onRemoveCalendarEvent?: (eventId: string) => void;
  onSetFocusAssist: (enabled: boolean) => void;
  notifications: ToastMessage[];
  onClearNotifications: () => void;
  /** Drops this one notification; Windows dismisses them one at a time too. */
  onDismissNotification?: (notificationId: string) => void;
  /** A notification that names an entry opens it when clicked. */
  onOpenNotificationItem?: (itemId: string) => void;
}) {
  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const [draftTime, setDraftTime] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const draftTitleRef = useRef<HTMLInputElement | null>(null);
  const calendarDays = createCalendarGrid(visibleMonth);
  const alarmDays = getAlarmDateKeys(clockAlarms, calendarDays);
  const eventDays = getEventDateKeys(calendarEvents, calendarDays);
  const selectedKey = getLocalDateKey(selectedDate);
  const dayEvents = getEventsForDate(calendarEvents, selectedKey);
  /*
   * An alarm belongs to the picked day if it repeats on that weekday, or if it
   * is a one-shot whose next ring lands there — the same rule that dots the day.
   */
  const dayAlarms = clockAlarms
    .filter(
      (alarm) =>
        alarm.enabled &&
        (alarm.repeatDays.includes(selectedDate.getDay()) ||
          (alarm.repeatDays.length === 0 &&
            getLocalDateKey(new Date(alarm.nextFireAt)) === selectedKey)),
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const addEvent = () => {
    const title = draftTitle.trim();
    if (!title || !onAddCalendarEvent) return;
    onAddCalendarEvent(selectedKey, isValidEventTime(draftTime) ? draftTime : null, title);
    setDraftTitle("");
    setDraftTime("");
    // Adding one appointment usually means adding another.
    draftTitleRef.current?.focus();
  };

  return (
    <section
      aria-label="알림 센터"
      className="notification-center-panel"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="notification-center-header">
        <div>
          <strong>
            {now.toLocaleDateString("ko-KR", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </strong>
          <small>{notifications.length}개 알림</small>
        </div>
        {notifications.length > 0 && (
          <button onClick={onClearNotifications} type="button">
            모두 지우기
          </button>
        )}
      </header>
      {focusAssist && (
        /* Windows says so at the top of the centre, with the way out: the
           toasts are being held here, and this is where to stop holding them. */
        <div className="notification-focus-banner">
          <Moon aria-hidden="true" size={15} />
          <span>집중 지원이 켜져 있어 알림이 화면에 뜨지 않습니다.</span>
          <button onClick={() => onSetFocusAssist(false)} type="button">
            끄기
          </button>
        </div>
      )}
      {notifications.length > 0 ? (
        <div className="notification-list">
          {/* The header counts what the panel holds, so the panel shows all of
              it — eight rendered under a header reading 12 was a plain lie. */}
          {notifications.map((notification) => {
            // Windows opens what a notification is about when you click it;
            // one that is only a statement stays a statement.
            const openItemId = notification.openItemId;
            const dismiss = onDismissNotification && (
              <button
                aria-label={`${notification.title} 알림 지우기`}
                className="notification-dismiss"
                onClick={(event) => {
                  // The row may sit under a picture of itself in the toast
                  // stack; dismissing must not travel any further.
                  event.stopPropagation();
                  onDismissNotification(notification.id);
                }}
                title="이 알림 지우기"
                type="button"
              >
                <X aria-hidden="true" size={13} />
              </button>
            );
            const body = (
              <>
                <BrandMark className="notification-app-mark" />
                <div>
                  <strong>{notification.title}</strong>
                  {notification.detail && <p>{notification.detail}</p>}
                  <small>{formatNotificationTime(notification.createdAt)}</small>
                </div>
              </>
            );
            const openable = Boolean(openItemId && onOpenNotificationItem);
            /*
             * The row used to be a <button> with the dismiss ✕ nested inside
             * it. A button's children are presentational, so the ✕ was not a
             * control at all to a screen reader — the only notifications that
             * could be dismissed were the ones nothing could open. The row is
             * an <article>; what opens it is a button beside the ✕, not around
             * it.
             */
            return (
              <article
                className={`notification-item notification-${notification.tone}${
                  openable ? " is-openable" : ""
                }`}
                key={notification.id}
              >
                {openable ? (
                  <button
                    className="notification-open"
                    onClick={() => onOpenNotificationItem?.(openItemId!)}
                    type="button"
                  >
                    {body}
                  </button>
                ) : (
                  body
                )}
                {dismiss}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="notification-empty">
          <Bell aria-hidden="true" size={18} />
          <span>새 알림 없음</span>
        </div>
      )}
      <section className="notification-calendar" aria-label="달력">
        <header>
          <strong>
            {visibleMonth.toLocaleDateString("ko-KR", { month: "long", year: "numeric" })}
          </strong>
          <div>
            <button
              aria-label="이전 달"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              title="이전 달"
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={15} />
            </button>
            <button
              aria-label="다음 달"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              title="다음 달"
              type="button"
            >
              <ChevronRight aria-hidden="true" size={15} />
            </button>
          </div>
        </header>
        <div className="calendar-weekdays" aria-hidden="true">
          {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="calendar-days">
          {calendarDays.map((date) => {
            const dateKey = getLocalDateKey(date);
            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
            const isToday = dateKey === getLocalDateKey(now);
            const isSelected = dateKey === getLocalDateKey(selectedDate);
            return (
              <button
                aria-label={date.toLocaleDateString("ko-KR", {
                  day: "numeric",
                  month: "long",
                  weekday: "short",
                  year: "numeric",
                })}
                aria-pressed={isSelected}
                className={`${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""} ${
                  alarmDays.has(dateKey) ? "has-alarm" : ""
                } ${eventDays.has(dateKey) ? "has-event" : ""}`}
                key={dateKey}
                onClick={() => setSelectedDate(date)}
                type="button"
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
        {/* Windows shows the picked day under the grid, with what is on it and
            a line to add something. */}
        <p className="tray-calendar-selection">
          {selectedDate.toLocaleDateString("ko-KR", {
            day: "numeric",
            month: "long",
            weekday: "long",
          })}
          <span>
            {dayEvents.length === 0 && dayAlarms.length === 0
              ? "일정 없음"
              : [
                  dayEvents.length > 0 ? `일정 ${dayEvents.length}개` : null,
                  dayAlarms.length > 0 ? `알람 ${dayAlarms.length}개` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </p>
        {(dayEvents.length > 0 || dayAlarms.length > 0) && (
          <ul aria-label="이 날의 일정" className="tray-agenda-list">
            {dayAlarms.map((alarm) => (
              <li className="is-alarm" key={alarm.id}>
                <span className="tray-agenda-time">{alarm.time}</span>
                <span className="tray-agenda-title">{alarm.label || "알람"}</span>
                {/* An alarm is 알람 및 시계's; the calendar shows it and does
                    not offer to delete something it does not own. */}
                <AlarmClock aria-label="알람" className="tray-agenda-mark" size={13} />
              </li>
            ))}
            {dayEvents.map((event) => (
              <li key={event.id}>
                <span className="tray-agenda-time">{event.time ?? "종일"}</span>
                <span className="tray-agenda-title">{event.title}</span>
                <button
                  aria-label={`일정 삭제: ${event.title}`}
                  className="tray-agenda-remove"
                  onClick={() => onRemoveCalendarEvent?.(event.id)}
                  title="일정 삭제"
                  type="button"
                >
                  <X aria-hidden="true" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="tray-agenda-form"
          onSubmit={(event) => {
            event.preventDefault();
            addEvent();
          }}
        >
          <input
            aria-label="일정 시간 (선택)"
            onChange={(event) => setDraftTime(event.target.value)}
            type="time"
            value={draftTime}
          />
          <input
            aria-label={`일정 제목 (${formatCalendarEventDay(selectedKey)})`}
            maxLength={MAX_CALENDAR_TITLE_LENGTH}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="일정 추가"
            ref={draftTitleRef}
            type="text"
            value={draftTitle}
          />
          <button
            disabled={
              draftTitle.trim().length === 0 || calendarEvents.length >= CALENDAR_EVENT_LIMIT
            }
            title={
              calendarEvents.length >= CALENDAR_EVENT_LIMIT
                ? `일정은 ${CALENDAR_EVENT_LIMIT}개까지 저장됩니다`
                : "일정 추가"
            }
            type="submit"
          >
            <Plus aria-hidden="true" size={14} />
            <span className="sr-only">일정 추가</span>
          </button>
        </form>
      </section>
    </section>
  );
}

export function TaskbarPreview({
  anchor,
  app,
  getDocumentLabel,
  onCloseWindow,
  onPeekWindow,
  onPointerEnter,
  onPointerLeave,
  onSelectWindow,
  windows,
}: {
  anchor: CSSProperties;
  app: AppDefinition;
  getDocumentLabel: (windowId: string, appId: AppId) => string | undefined;
  onCloseWindow: (windowId: string) => void;
  /** Aero Peek: the window whose thumbnail is under the pointer or focus. */
  onPeekWindow: (windowId: string | null) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onSelectWindow: (windowId: string) => void;
  windows: WindowInstance[];
}) {
  // The card can vanish under the pointer (its hide timer, a click); the peek
  // must end with it, not stay on until the next hover.
  const peekRef = useRef(onPeekWindow);
  peekRef.current = onPeekWindow;
  useEffect(() => () => peekRef.current(null), []);
  /*
   * Windows shows one thumbnail per window here, and each one switches to that
   * window or closes it. This card was aria-hidden and inert — it listed
   * "창 1 · 열림" and there was no way to act on any of it, so picking a
   * specific window of a multi-window app was only possible by cycling the
   * taskbar button.
   */
  return (
    <div
      aria-label={`${app.title} 창 미리보기`}
      className="taskbar-preview-card"
      onBlurCapture={onPointerLeave}
      // Tab reaches these buttons too; without the focus pair, the hide-grace
      // timer unmounted the card 220ms after focus entered and dropped the
      // keyboard user onto <body>.
      onFocusCapture={onPointerEnter}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      role="group"
      style={anchor}
    >
      {windows.length === 0 ? (
        <div className="taskbar-preview-pinned">
          <AppIconTile accent={app.accent} icon={app.icon} size="large" />
          <div className="taskbar-preview-meta">
            <strong>{app.title}</strong>
            <small>고정된 앱</small>
          </div>
        </div>
      ) : (
        windows.map((windowItem) => {
          const windowTitle = formatWindowTitle(
            app.title,
            getDocumentLabel(windowItem.id, app.id),
          );
          return (
            <div className="taskbar-preview-window" key={windowItem.id}>
              <button
                aria-label={`${windowTitle} 전환`}
                className="taskbar-preview-select"
                onBlur={() => onPeekWindow(null)}
                onClick={() => onSelectWindow(windowItem.id)}
                onFocus={() => onPeekWindow(windowItem.id)}
                onPointerEnter={() => onPeekWindow(windowItem.id)}
                onPointerLeave={() => onPeekWindow(null)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="taskbar-preview-thumb"
                  style={{ "--active": app.accent } as React.CSSProperties}
                >
                  {/* Windows shows the window itself here; refreshed while the
                      card is up so a ticking clock or typing stays current. */}
                  <WindowThumbnail
                    accent={app.accent}
                    icon={app.icon}
                    instance={windowItem}
                    refreshMs={1000}
                  />
                </span>
                <span className="taskbar-preview-meta">
                  <strong>{windowTitle}</strong>
                  <small>
                    {windowItem.minimized
                      ? "최소화됨"
                      : windowItem.maximized
                        ? "최대화됨"
                        : "열림"}
                  </small>
                </span>
              </button>
              <button
                aria-label={`${windowTitle} 미리보기에서 닫기`}
                className="taskbar-preview-close"
                onClick={() => onCloseWindow(windowItem.id)}
                type="button"
              >
                <X aria-hidden="true" size={13} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
