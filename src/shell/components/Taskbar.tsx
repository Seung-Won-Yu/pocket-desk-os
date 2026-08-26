import AppIconTile from "../../components/AppIconTile";
import { type AppId } from "../../types";
import { clamp } from "../../utils/format";
import { getApp } from "../appCatalog";
import { createCalendarGrid, formatNotificationTime, getLocalDateKey } from "../startSearch";
import { type AppDefinition, type ToastMessage, type WindowInstance } from "../types";
import { BrandMark, StartGlyph } from "./Branding";
import { Clock } from "./Clock";
import { Bell, ChevronLeft, ChevronRight, Pin, PinOff, Settings, Sun, Volume2, Wifi } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

export function Taskbar({
  activeWindowId,
  availableApps,
  brightness,
  notificationHistory,
  onClearNotifications,
  onOpenStart,
  onOpenApp,
  onSetBrightness,
  onSetSoundEnabled,
  onShowDesktop,
  onTogglePinnedApp,
  onToggleWindow,
  pinnedAppIds,
  soundEnabled,
  startOpen,
  windows,
}: {
  activeWindowId?: string;
  availableApps: AppDefinition[];
  brightness: number;
  notificationHistory: ToastMessage[];
  onClearNotifications: () => void;
  onOpenStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onOpenApp: (appId: AppId) => void;
  onSetBrightness: (brightness: number) => void;
  onSetSoundEnabled: (enabled: boolean) => void;
  onShowDesktop: () => void;
  onTogglePinnedApp: (appId: AppId) => void;
  onToggleWindow: (id: string) => void;
  pinnedAppIds: AppId[];
  soundEnabled: boolean;
  startOpen: boolean;
  windows: WindowInstance[];
}) {
  const taskbarRef = useRef<HTMLElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<{
    app: AppDefinition;
    left: number;
    windows: WindowInstance[];
  } | null>(null);
  const [taskbarMenu, setTaskbarMenu] = useState<{ appId: AppId; left: number } | null>(null);
  const taskbarMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [trayPanel, setTrayPanel] = useState<"notifications" | "quick" | null>(null);
  const availableAppIds = new Set(availableApps.map((app) => app.id));
  const pinnedApps = pinnedAppIds
    .filter((appId) => availableAppIds.has(appId))
    .map((appId) => getApp(appId));
  const unpinnedAppIds = [...new Set(
    windows
      .filter((item) => !pinnedAppIds.includes(item.appId))
      .map((item) => item.appId),
  )];
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

  const showPreview = (
    element: HTMLElement,
    app: AppDefinition,
    windowItems: WindowInstance[],
  ) => {
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

  const hidePreview = () => {
    setPreview(null);
  };

  useEffect(() => {
    if (!trayPanel) return;

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
    };
  }, [trayPanel]);

  useEffect(() => {
    if (!taskbarMenu) return;
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
    };
  }, [taskbarMenu]);

  return (
    <footer className="taskbar" ref={taskbarRef}>
      <div className="taskbar-center">
        <button
          aria-expanded={startOpen}
          aria-label="시작 메뉴"
          className="start-button"
          onPointerDown={onOpenStart}
          type="button"
        >
          <StartGlyph />
        </button>
        <div className="taskbar-windows" aria-label="열린 앱">
          {taskbarApps.map(({ app, windows: appWindows }) => {
            const isPinned = pinnedAppIds.includes(app.id);
            const orderedAppWindows = [...appWindows].sort((first, second) => second.z - first.z);
            const activeAppWindow = orderedAppWindows.find((item) => item.id === activeWindowId);
            const windowItem = activeAppWindow ?? orderedAppWindows[0];
            const allMinimized = appWindows.length > 0 && appWindows.every((item) => item.minimized);
            return (
              <div
                className="taskbar-slot"
                key={`taskbar-${app.id}`}
                onBlur={hidePreview}
                onFocusCapture={(event) => showPreview(event.currentTarget, app, orderedAppWindows)}
                onMouseEnter={(event) => showPreview(event.currentTarget, app, orderedAppWindows)}
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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setPreview(null);
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
      {preview && <TaskbarPreview {...preview} />}
      {taskbarMenu && (
        <div
          className="taskbar-context-menu"
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: clamp(taskbarMenu.left, 112, window.innerWidth - 112) }}
        >
          <button
            onClick={() => {
              onTogglePinnedApp(taskbarMenu.appId);
              setTaskbarMenu(null);
            }}
            ref={taskbarMenuButtonRef}
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
            <Clock />
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
            {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
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
            <article className={`notification-item notification-${notification.tone}`} key={notification.id}>
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
  left,
  windows,
}: {
  app: AppDefinition;
  left: number;
  windows: WindowInstance[];
}) {
  const primaryWindow = windows[0];
  const status = primaryWindow
    ? windows.length > 1
      ? `${windows.length}개 창`
      : primaryWindow.minimized
        ? "최소화됨"
        : primaryWindow.maximized
          ? "최대화됨"
          : "열림"
    : "고정됨";
  const detail = primaryWindow ? app.subtitle : "고정된 앱";

  return (
    <div
      aria-label={`${app.title} 작업표시줄 미리보기`}
      className="taskbar-preview-card"
      role="status"
      style={{ left }}
    >
      <div className="taskbar-preview-thumb" style={{ "--active": app.accent } as React.CSSProperties}>
        <AppIconTile accent={app.accent} icon={app.icon} size="large" />
        <span>{status}</span>
      </div>
      <div className="taskbar-preview-meta">
        <strong>{app.title}</strong>
        <small>{detail}</small>
        {windows.length > 1 && (
          <div className="taskbar-preview-window-list">
            {windows.map((windowItem, index) => (
              <span key={windowItem.id}>
                창 {index + 1} · {windowItem.minimized ? "최소화됨" : "열림"}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
