import AppIconTile from "../../components/AppIconTile";
import { type AppId } from "../../types";
import { clamp } from "../../utils/format";
import { getApp } from "../appCatalog";
import { formatWindowTitle } from "../windowTitle";
import { createCalendarGrid, formatNotificationTime, getLocalDateKey } from "../startSearch";
import { type AppDefinition, type ToastMessage, type WindowInstance } from "../types";
import { BrandMark, StartGlyph } from "./Branding";
import { Clock } from "./Clock";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  MonitorDown,
  Pin,
  PinOff,
  Search,
  Play,
  Settings,
  SquarePlus,
  SquareTerminal,
  Sun,
  Volume2,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getNextRovingIndex, handleMenuKeyboard } from "../keyboardNav";

export function Taskbar({
  activeDesktopIndex,
  activeWindowId,
  availableApps,
  brightness,
  desktopCount,
  onToggleTaskView,
  taskViewOpen,
  notificationHistory,
  onClearNotifications,
  onOpenStart,
  getDocumentLabel,
  onOpenApp,
  onOpenNewWindow,
  onOpenRunDialog,
  clock24h,
  onSearch,
  searchQuery,
  onSetBrightness,
  onSetSoundEnabled,
  onShowDesktop,
  onTogglePinnedApp,
  onCloseWindow,
  onToggleWindow,
  pinnedAppIds,
  soundEnabled,
  startOpen,
  windows,
}: {
  activeDesktopIndex: number;
  activeWindowId?: string;
  availableApps: AppDefinition[];
  brightness: number;
  desktopCount: number;
  onToggleTaskView: () => void;
  taskViewOpen: boolean;
  notificationHistory: ToastMessage[];
  onClearNotifications: () => void;
  onOpenStart: (event: React.MouseEvent<HTMLButtonElement>) => void;
  getDocumentLabel: (appId: AppId) => string | undefined;
  onOpenApp: (appId: AppId) => void;
  onOpenNewWindow: (appId: AppId) => void;
  onOpenRunDialog: () => void;
  clock24h: boolean;
  onSearch: (query: string) => void;
  searchQuery: string;
  onSetBrightness: (brightness: number) => void;
  onSetSoundEnabled: (enabled: boolean) => void;
  onShowDesktop: () => void;
  onTogglePinnedApp: (appId: AppId) => void;
  onCloseWindow: (id: string) => void;
  onToggleWindow: (id: string) => void;
  pinnedAppIds: AppId[];
  soundEnabled: boolean;
  startOpen: boolean;
  windows: WindowInstance[];
}) {
  const taskbarRef = useRef<HTMLElement | null>(null);
  const [rovingAppId, setRovingAppId] = useState<AppId | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<{
    app: AppDefinition;
    left: number;
    windows: WindowInstance[];
  } | null>(null);
  const [taskbarMenu, setTaskbarMenu] = useState<{ appId: AppId; left: number } | null>(null);
  const [shellMenu, setShellMenu] = useState<{ left: number } | null>(null);
  const taskbarMenuButtonRef = useRef<HTMLButtonElement>(null);
  const shellMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [trayPanel, setTrayPanel] = useState<"notifications" | "quick" | null>(null);
  const availableAppIds = new Set(availableApps.map((app) => app.id));
  const pinnedApps = pinnedAppIds
    .filter((appId) => availableAppIds.has(appId))
    .map((appId) => getApp(appId));
  const unpinnedAppIds = [
    ...new Set(
      windows.filter((item) => !pinnedAppIds.includes(item.appId)).map((item) => item.appId),
    ),
  ];
  const taskbarApps = [
    ...pinnedApps.map((app) => ({
      app,
      windows: windows.filter((item) => item.appId === app.id),
    })),
    ...unpinnedAppIds.map((appId) => ({
      app: getApp(appId),
      windows: windows.filter((item) => item.appId === appId),
    })),
  ];

  /*
   * The roving stop has to name a button that is still on the bar. Closing the
   * last window of an unpinned app, or unpinning one, removed the button the
   * stop pointed at and left the whole band out of the tab order.
   */
  const rovingTabStopId =
    taskbarApps.find(({ app }) => app.id === rovingAppId)?.app.id ??
    taskbarApps[0]?.app.id ??
    null;

  const showPreview = (
    element: HTMLElement,
    app: AppDefinition,
    windowItems: WindowInstance[],
  ) => {
    cancelPreviewClose();
    const taskbarBox = taskbarRef.current?.getBoundingClientRect();
    const buttonBox = element.getBoundingClientRect();
    const rawLeft = buttonBox.left + buttonBox.width / 2 - (taskbarBox?.left ?? 0);
    const maxLeft = Math.max(118, (taskbarBox?.width ?? window.innerWidth) - 118);
    setPreview({
      app,
      left: clamp(rawLeft, 118, maxLeft),
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
    setShellMenu({ left: event.clientX });
  };

  const shellMenuItems: Array<{ icon: LucideIcon; label: string; run: () => void }> = [
    { icon: Activity, label: "작업 관리자", run: () => onOpenApp("taskmanager") },
    { icon: SquareTerminal, label: "명령 프롬프트", run: () => onOpenApp("terminal") },
    { icon: FolderOpen, label: "파일 탐색기", run: () => onOpenApp("files") },
    { icon: Play, label: "실행", run: onOpenRunDialog },
    { icon: Settings, label: "설정", run: () => onOpenApp("settings") },
    { icon: MonitorDown, label: "바탕 화면 보기", run: onShowDesktop },
  ];

  return (
    <footer className="taskbar" onContextMenu={openShellMenu} ref={taskbarRef}>
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
          aria-label={`작업 보기 (데스크톱 ${activeDesktopIndex + 1}/${desktopCount})`}
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
                className="taskbar-slot"
                key={`taskbar-${app.id}`}
                onBlur={hidePreview}
                onFocusCapture={(event) =>
                  showPreview(event.currentTarget, app, orderedAppWindows)
                }
                onMouseEnter={(event) =>
                  showPreview(event.currentTarget, app, orderedAppWindows)
                }
                onMouseLeave={hidePreview}
              >
                <button
                  aria-label={`${app.title}${appWindows.length > 1 ? `, ${appWindows.length}개 창` : ""}`}
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
                    setTaskbarMenu({ appId: app.id, left: event.clientX });
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
          className="taskbar-context-menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: clamp(taskbarMenu.left, 112, window.innerWidth - 112) }}
        >
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
              ref={taskbarMenuButtonRef}
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
            ref={getApp(taskbarMenu.appId).multiInstance ? undefined : taskbarMenuButtonRef}
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
          className="taskbar-context-menu is-shell-menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: clamp(shellMenu.left, 112, window.innerWidth - 112) }}
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
            aria-label="알림 센터 열기"
            className="system-tray system-tray-clock-button"
            onClick={() =>
              setTrayPanel((current) => (current === "notifications" ? null : "notifications"))
            }
            type="button"
          >
            <Clock hour24={clock24h} />
          </button>
        </div>
        {trayPanel === "quick" && (
          <QuickSettingsPanel
            brightness={brightness}
            onOpenSettings={() => {
              setTrayPanel(null);
              onOpenApp("settings");
            }}
            onSetBrightness={onSetBrightness}
            onSetSoundEnabled={onSetSoundEnabled}
            soundEnabled={soundEnabled}
          />
        )}
        {trayPanel === "notifications" && (
          <NotificationCenterPanel
            notifications={notificationHistory}
            onClearNotifications={onClearNotifications}
          />
        )}
      </div>
      <button
        aria-label="바탕 화면 표시"
        className="show-desktop-button"
        onClick={onShowDesktop}
        title="바탕 화면 표시"
        type="button"
      />
    </footer>
  );
}

export function QuickSettingsPanel({
  brightness,
  onOpenSettings,
  onSetBrightness,
  onSetSoundEnabled,
  soundEnabled,
}: {
  brightness: number;
  onOpenSettings: () => void;
  onSetBrightness: (brightness: number) => void;
  onSetSoundEnabled: (enabled: boolean) => void;
  soundEnabled: boolean;
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
          onChange={(event) => onSetSoundEnabled(Number(event.target.value) > 0)}
          type="range"
          value={soundEnabled ? 72 : 0}
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
  notifications,
  onClearNotifications,
}: {
  notifications: ToastMessage[];
  onClearNotifications: () => void;
}) {
  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const calendarDays = createCalendarGrid(visibleMonth);

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
      {notifications.length > 0 ? (
        <div className="notification-list">
          {notifications.slice(0, 8).map((notification) => (
            <article
              className={`notification-item notification-${notification.tone}`}
              key={notification.id}
            >
              <BrandMark className="notification-app-mark" />
              <div>
                <strong>{notification.title}</strong>
                {notification.detail && <p>{notification.detail}</p>}
                <small>{formatNotificationTime(notification.createdAt)}</small>
              </div>
            </article>
          ))}
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
                  year: "numeric",
                })}
                aria-pressed={isSelected}
                className={`${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""}`}
                key={dateKey}
                onClick={() => setSelectedDate(date)}
                type="button"
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export function TaskbarPreview({
  app,
  getDocumentLabel,
  left,
  onCloseWindow,
  onPointerEnter,
  onPointerLeave,
  onSelectWindow,
  windows,
}: {
  app: AppDefinition;
  getDocumentLabel: (appId: AppId) => string | undefined;
  left: number;
  onCloseWindow: (windowId: string) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onSelectWindow: (windowId: string) => void;
  windows: WindowInstance[];
}) {
  const windowTitle = formatWindowTitle(app.title, getDocumentLabel(app.id));

  /*
   * Windows shows one thumbnail per window here, and each one switches to that
   * window or closes it. This card was aria-hidden and inert — it listed
   * "창 1 · 열림" and there was no way to act on any of it, so picking a
   * specific window of a multi-window app was only possible by cycling the
   * taskbar button.
   */
  return (
    <div
      className="taskbar-preview-card"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      role="group"
      style={{ left }}
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
        windows.map((windowItem) => (
          <div className="taskbar-preview-window" key={windowItem.id}>
            <button
              aria-label={`${windowTitle} 전환`}
              className="taskbar-preview-select"
              onClick={() => onSelectWindow(windowItem.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="taskbar-preview-thumb"
                style={{ "--active": app.accent } as React.CSSProperties}
              >
                <AppIconTile accent={app.accent} icon={app.icon} size="large" />
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
        ))
      )}
    </div>
  );
}
