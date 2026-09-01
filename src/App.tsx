import { type BrowserLaunchRequest } from "./apps/BrowserApp";
import { type FilesLaunchRequest } from "./apps/FilesApp";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import {
  appCatalog,
  desktopApps,
  getApp,
  isAppId,
  loadPinnedTaskbarApps,
} from "./shell/appCatalog";
import { AltTabSwitcher } from "./shell/components/AltTabSwitcher";
import {
  DesktopContextMenu,
  DesktopIconContextMenu,
  DesktopItemPropertiesDialog,
} from "./shell/components/ContextMenus";
import { DesktopIcon, DesktopItemIcon } from "./shell/components/DesktopIcons";
import { RunDialog } from "./shell/components/RunDialog";
import { ShortcutDialog } from "./shell/components/ShortcutDialog";
import { resolveShortcutTarget } from "./utils/safeUrl";
import { ShellGate } from "./shell/components/ShellScreens";
import { StartMenu } from "./shell/components/StartMenu";
import { Taskbar } from "./shell/components/Taskbar";
import { ToastStack } from "./shell/components/ToastStack";
import { SnapPreview, WindowFrame } from "./shell/components/WindowFrame";
import { WindowSystemMenu } from "./shell/components/WindowSystemMenu";
import {
  APP_BAR_HEIGHT,
  DESKTOP_ICON_GRID_KEY,
  DESKTOP_ICON_LAYOUT_KEY,
  DESKTOP_ICON_SORT_KEY,
  DESKTOP_ICON_VIEW_KEY,
  DISPLAY_BRIGHTNESS_KEY,
  MAX_VIRTUAL_DESKTOPS,
  NOTE_KEY,
  NOTE_OPEN_EVENT,
  NOTE_SAVE_AS_EVENT,
  NOTE_SAVE_EVENT,
  PAINT_OPEN_EVENT,
  PAINT_SAVE_AS_EVENT,
  PAINT_REDO_EVENT,
  PAINT_SAVE_EVENT,
  PAINT_UNDO_EVENT,
  SOUND_ENABLED_KEY,
  TASKBAR_PINNED_APPS_KEY,
  VFS_PRIMARY_CANVAS_ID,
  VFS_PRIMARY_NOTE_ID,
  CLOCK_24H_KEY,
  USER_NAME_KEY,
  VFS_DRAG_MIME,
  VIRTUAL_DESKTOPS_KEY,
  WALLPAPER_KEY,
  WINDOW_EXIT_MOTION_MS,
  WINDOW_STATE_KEY,
  WINDOW_KEYBOARD_STEP,
  NOTIFICATION_HISTORY_LIMIT,
  SOUND_VOLUME_KEY,
} from "./shell/constants";
import {
  clampContextMenuPosition,
  clampIconPosition,
  clampWindowSystemMenuPosition,
  compareDesktopEntries,
  createDefaultIconLayout,
  createDesktopGridPositions,
  findAvailableDesktopPosition,
  getDesktopSelectionIds,
  getDesktopSelectionStyle,
  isDesktopSelectionVisible,
  loadDesktopIconLayout,
  loadDesktopSortKey,
  loadDesktopViewMode,
  persistDesktopIconLayout,
  snapDesktopIconPosition,
} from "./shell/desktopLayout";
import { createPocketDeskAudioContext, playPocketDeskSound } from "./shell/sound";
import { buildStartSearchResults, getThemeLabel, resolveRunCommand } from "./shell/startSearch";
import {
  type CreatableDesktopItemKind,
  type DesktopContextMenuState,
  type DesktopIconContextMenuState,
  type DesktopIconLayout,
  type DesktopSelectionState,
  type DesktopSortKey,
  type DesktopViewMode,
  type PersistedDesktopItem,
  type ShellPhase,
  type SnapPreviewState,
  type SnapZone,
  type StartSearchResult,
  type ToastMessage,
  type WindowInstance,
  type WindowMotion,
  type WindowSystemMenuState,
} from "./shell/types";
import {
  createDefaultVfsEntries,
  loadDesktopItemsFromVfs,
  migrateVfsHierarchy,
  normalizePersistedDesktopItem,
} from "./shell/vfsBootstrap";
import { getWindowSnapPatch, resizeWindowEdge } from "./shell/windowGeometry";
import {
  fitWindowToViewport,
  getVirtualDesktopCount,
  loadVirtualDesktopCount,
  loadWindowState,
  persistWindowState,
  makeWindow,
  loadActiveDesktopIndex,
  persistActiveDesktopIndex,
  loadNotificationHistory,
  persistNotificationHistory,
} from "./shell/windowState";
import { SnapAssist } from "./shell/components/SnapAssist";
import { TaskView } from "./shell/components/TaskView";
import {
  loadClock24h,
  loadDefaultApps,
  loadUserName,
  persistDefaultApps,
  type DefaultAppMap,
} from "./shell/preferences";
import { getNeighbourByPosition } from "./shell/keyboardNav";
import { formatWindowTitle } from "./shell/windowTitle";
import {
  collectDueClockAlarms,
  formatClockDuration,
  snoozeClockAlarm,
  isMissedAlarmFire,
  loadClockAlarms,
  loadClockTimer,
  persistClockAlarms,
  persistClockTimer,
  tickClockTimer,
  type ClockAlarm,
  type ClockTimer,
} from "./shell/clock";
import {
  SHELL_EVENT_LOGON,
  SHELL_EVENT_POWER_OFF,
  SHELL_EVENT_PROCESS_ENDED,
  SHELL_EVENT_PROCESS_STARTED,
  SHELL_EVENT_WORKSTATION_LOCKED,
  appendShellEvent,
  createShellEvent,
  loadShellEventLog,
  persistShellEventLog,
} from "./shell/eventLog";
import {
  buildRecentDocumentsByApp,
  loadRecentOpens,
  persistRecentOpens,
  recordRecentOpen,
} from "./shell/jumpList";
import { clamp } from "./utils/format";
import {
  type AppId,
  type ClipboardMode,
  type DesktopItem,
  type IconPosition,
  type OpenWindowInfo,
  type SoundEffectName,
  type SystemClipboard,
  type ThemeName,
  type ToastInput,
  type VfsDuplicateOptions,
  type WallpaperName,
} from "./types";
import { createVfsBackupZip, readVfsBackupZip } from "./vfs/backup";
import {
  VFS_DOCUMENTS_ID,
  VFS_PICTURES_ID,
  VFS_ROOT_ID,
  canMoveVfsEntries,
  getUniqueCanvasItemName,
  getUniqueRenamedVfsItemName,
  getUniqueTextFileName,
  getUniqueVfsCopyName,
  getUniqueVfsEntryName,
  getVfsDescendantIds,
  getVfsEntryAssociation,
  getVfsEntryExtension,
  getVfsShortcutTarget,
  sanitizeVfsFileName,
  getVfsTopLevelIds,
  isVfsSystemFolderId,
} from "./vfs/model";
import { persistVfsEntries } from "./vfs/storage";
import { getWallpaperStyle, wallpaperGallery, type WallpaperCssVars } from "./wallpapers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DESKTOP_ICON_NAV_KEYS = [
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
];

export default function App() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    return (localStorage.getItem("pocket-desk-theme") as ThemeName | null) ?? "lagoon";
  });
  const [wallpaper, setWallpaper] = useState<WallpaperName>(() => {
    return (localStorage.getItem(WALLPAPER_KEY) as WallpaperName | null) ?? "ribbon";
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== "off";
  });
  /*
   * A real volume, kept apart from the on/off state and remembered. The tray
   * slider reported only `> 0` back, so 35 and 60 both sprang back to 72 and
   * nothing was stored.
   */
  const [clockAlarms, setClockAlarms] = useState<ClockAlarm[]>(() => loadClockAlarms());
  const [clockTimer, setClockTimer] = useState<ClockTimer>(() => loadClockTimer());

  useEffect(() => {
    persistClockAlarms(clockAlarms);
  }, [clockAlarms]);

  useEffect(() => {
    persistClockTimer(clockTimer);
  }, [clockTimer]);

  const [soundVolume, setSoundVolume] = useState(() => {
    const raw = localStorage.getItem(SOUND_VOLUME_KEY);
    // Number(null) is 0, which passed the >= 0 check — so a fresh profile
    // booted muted and then wrote that 0 back as if it were a choice.
    if (raw === null) return 72;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : 72;
  });

  const [displayBrightness, setDisplayBrightness] = useState(() => {
    const stored = Number(localStorage.getItem(DISPLAY_BRIGHTNESS_KEY));
    return Number.isFinite(stored) && stored >= 30 && stored <= 100 ? stored : 100;
  });
  const [desktopItems, setDesktopItems] = useState<DesktopItem[]>([]);
  const [vfsReady, setVfsReady] = useState(false);
  const [iconLayout, setIconLayout] = useState<DesktopIconLayout>(() =>
    loadDesktopIconLayout(),
  );
  const [desktopViewMode, setDesktopViewMode] = useState<DesktopViewMode>(() =>
    loadDesktopViewMode(),
  );
  const [desktopSortKey, setDesktopSortKey] = useState<DesktopSortKey>(() =>
    loadDesktopSortKey(),
  );
  const [alignDesktopIcons, setAlignDesktopIcons] = useState(
    () => localStorage.getItem(DESKTOP_ICON_GRID_KEY) !== "off",
  );
  const [desktopMenu, setDesktopMenu] = useState<DesktopContextMenuState | null>(null);
  const [shortcutDialogOrigin, setShortcutDialogOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [desktopIconMenu, setDesktopIconMenu] = useState<DesktopIconContextMenuState | null>(
    null,
  );
  const [clipboard, setClipboard] = useState<SystemClipboard>({ itemIds: [], mode: "copy" });
  const [userName, setUserName] = useState(() => loadUserName());
  const [clock24h, setClock24h] = useState(() => loadClock24h());
  const [defaultApps, setDefaultApps] = useState<DefaultAppMap>(() => loadDefaultApps());
  const [desktopRenamingItemId, setDesktopRenamingItemId] = useState<string | null>(null);
  const [desktopRenameDraft, setDesktopRenameDraft] = useState("");
  const [desktopPropertiesItemId, setDesktopPropertiesItemId] = useState<string | null>(null);
  const [windowMenu, setWindowMenu] = useState<WindowSystemMenuState | null>(null);
  const [windowKeyboardDrag, setWindowKeyboardDrag] = useState<{
    edge: "bottom" | "left" | "right" | "top" | null;
    mode: "move" | "resize";
    origin: { height: number; width: number; x: number; y: number };
    windowId: string;
  } | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [desktopSelection, setDesktopSelection] = useState<DesktopSelectionState | null>(null);
  const [selectedDesktopIds, setSelectedDesktopIds] = useState<string[]>([]);
  const [shellPhase, setShellPhase] = useState<ShellPhase>("booting");
  const [browserLaunchRequest, setBrowserLaunchRequest] = useState<BrowserLaunchRequest | null>(
    null,
  );
  const [filesLaunchRequest, setFilesLaunchRequest] = useState<FilesLaunchRequest | null>(null);
  const [activeCanvasId, setActiveCanvasId] = useState(VFS_PRIMARY_CANVAS_ID);
  const [activeCanvasOpenKey, setActiveCanvasOpenKey] = useState(0);
  const [activeNoteId, setActiveNoteId] = useState(VFS_PRIMARY_NOTE_ID);
  const [reportedDocuments, setReportedDocuments] = useState<
    Partial<Record<AppId, string | undefined>>
  >({});

  const reportDocument = useCallback((appId: AppId, itemId: string | undefined) => {
    setReportedDocuments((current) =>
      current[appId] === itemId ? current : { ...current, [appId]: itemId },
    );
  }, []);
  const [altTabWindowId, setAltTabWindowId] = useState<string | null>(null);
  const [pinnedAppIds, setPinnedAppIds] = useState<AppId[]>(() => loadPinnedTaskbarApps());
  const [snapPreview, setSnapPreview] = useState<SnapPreviewState | null>(null);
  const [snapAssistZone, setSnapAssistZone] = useState<SnapZone | null>(null);
  const [shellEventLog, setShellEventLog] = useState(() => loadShellEventLog());
  const [notificationHistory, setNotificationHistory] = useState<ToastMessage[]>(() =>
    loadNotificationHistory(),
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [windows, setWindows] = useState<WindowInstance[]>(() => loadWindowState());
  const [storedDesktopCount, setStoredDesktopCount] = useState(() => loadVirtualDesktopCount());
  const [activeDesktopIndex, setActiveDesktopIndex] = useState(() =>
    loadActiveDesktopIndex(loadVirtualDesktopCount()),
  );
  const [taskViewOpen, setTaskViewOpen] = useState(false);
  const [windowMotions, setWindowMotions] = useState<Record<string, WindowMotion>>({});
  const altTabOrderRef = useRef<string[]>([]);
  const altTabSelectionRef = useRef<string | null>(null);
  const desktopRenameGuardRef = useRef(false);
  const desktopSelectionRef = useRef<DesktopSelectionState | null>(null);
  const showDesktopRestoreRef = useRef<string[]>([]);
  const soundEnabledRef = useRef(soundEnabled);
  const soundVolumeRef = useRef(100);
  const vfsSaveErrorShownRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const windowMotionTimersRef = useRef(new Map<string, number>());
  const closeGuardsRef = useRef(new Map<string, () => boolean>());
  const closingLoggedRef = useRef(new Set<string>());
  const [unsavedWindowIds, setUnsavedWindowIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (shellPhase !== "booting") return;
    const timer = window.setTimeout(() => setShellPhase("locked"), 1150);
    return () => window.clearTimeout(timer);
  }, [shellPhase]);

  useEffect(
    () => () => {
      windowMotionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      windowMotionTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    loadDesktopItemsFromVfs()
      .then((items) => {
        if (cancelled) return;
        setDesktopItems(items);
        setVfsReady(true);
      })
      .catch((error) => {
        console.error("Failed to load PocketDesk VFS", error);
        if (!cancelled) {
          setDesktopItems(createDefaultVfsEntries());
          setVfsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pocket-desk-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(WALLPAPER_KEY, wallpaper);
  }, [wallpaper]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    // Keyed on soundEnabled alone, dragging the slider never reached this ref
    // and playback stayed at the mount volume until a mute toggle flushed it.
    soundVolumeRef.current = soundVolume;
    localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled ? "on" : "off");
  }, [soundEnabled, soundVolume]);

  useEffect(() => {
    localStorage.setItem(DISPLAY_BRIGHTNESS_KEY, String(displayBrightness));
  }, [displayBrightness]);

  useEffect(() => {
    localStorage.setItem(TASKBAR_PINNED_APPS_KEY, JSON.stringify(pinnedAppIds));
  }, [pinnedAppIds]);

  useEffect(() => {
    persistWindowState(windows);
  }, [windows]);

  useEffect(() => {
    localStorage.setItem(VIRTUAL_DESKTOPS_KEY, String(storedDesktopCount));
  }, [storedDesktopCount]);

  useEffect(() => {
    localStorage.setItem(USER_NAME_KEY, userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem(CLOCK_24H_KEY, clock24h ? "on" : "off");
  }, [clock24h]);

  useEffect(() => {
    persistDefaultApps(defaultApps);
  }, [defaultApps]);

  useEffect(() => {
    const fitWindowsToViewport = () => {
      setWindows((current) => current.map(fitWindowToViewport));
    };

    fitWindowsToViewport();
    window.addEventListener("resize", fitWindowsToViewport);
    return () => window.removeEventListener("resize", fitWindowsToViewport);
  }, []);

  // Windows comes back to the desktop you were on, with the notifications you
  // had not read. Neither survived a reload.
  useEffect(() => {
    localStorage.setItem(SOUND_VOLUME_KEY, String(soundVolume));
  }, [soundVolume]);

  useEffect(() => {
    persistActiveDesktopIndex(activeDesktopIndex);
  }, [activeDesktopIndex]);

  useEffect(() => {
    persistNotificationHistory(notificationHistory);
  }, [notificationHistory]);

  useEffect(() => {
    persistShellEventLog(shellEventLog);
  }, [shellEventLog]);

  useEffect(() => {
    persistDesktopIconLayout(iconLayout);
  }, [iconLayout]);

  useEffect(() => {
    localStorage.setItem(DESKTOP_ICON_VIEW_KEY, desktopViewMode);
  }, [desktopViewMode]);

  useEffect(() => {
    localStorage.setItem(DESKTOP_ICON_SORT_KEY, desktopSortKey);
  }, [desktopSortKey]);

  useEffect(() => {
    localStorage.setItem(DESKTOP_ICON_GRID_KEY, alignDesktopIcons ? "on" : "off");
  }, [alignDesktopIcons]);

  useEffect(() => {
    if (!vfsReady) return;
    persistVfsEntries(desktopItems)
      .then(() => {
        vfsSaveErrorShownRef.current = false;
      })
      .catch((error) => {
        console.error("Failed to persist PocketDesk VFS", error);
        if (vfsSaveErrorShownRef.current) return;
        vfsSaveErrorShownRef.current = true;
        notify({
          detail: error instanceof Error ? error.message : "브라우저 저장소를 확인하세요.",
          title: "파일 저장 실패",
        });
      });
  }, [desktopItems, vfsReady]);

  useEffect(() => {
    if (!desktopMenu && !desktopIconMenu) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDesktopMenu(null);
        setDesktopIconMenu(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [desktopIconMenu, desktopMenu]);

  /*
   * One always-mounted polite live region for shell narration. A region that
   * mounts together with its content (the old pattern for Alt+Tab and the
   * keyboard-move hint) is ignored by most screen readers — the region must
   * exist first, then its text must change. The zero-width toggle forces a
   * change even when the same message repeats.
   */
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const announceNonceRef = useRef(false);
  const announce = (message: string) => {
    announceNonceRef.current = !announceNonceRef.current;
    setSrAnnouncement(message + (announceNonceRef.current ? "\u200b" : ""));
  };

  const heldToastsRef = useRef(new Set<string>());

  const setToastHeld = (id: string, held: boolean) => {
    if (held) {
      heldToastsRef.current.add(id);
    } else {
      heldToastsRef.current.delete(id);
    }
  };

  const dismissToast = (id: string) => {
    heldToastsRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const notify = (toast: ToastInput) => {
    const id = crypto.randomUUID();
    const nextToast: ToastMessage = {
      actions: toast.actions ?? [],
      createdAt: Date.now(),
      detail: toast.detail ?? "",
      id,
      onAction: toast.onAction,
      title: toast.title,
      tone: toast.tone ?? "info",
    };

    setToasts((current) => [...current.slice(-3), nextToast]);
    const scheduleToastDismiss = (delay: number) => {
      window.setTimeout(() => {
        // Reading or reaching for a button must not race the timer: while the
        // pointer or focus is on the toast, check again later instead.
        if (heldToastsRef.current.has(id)) {
          scheduleToastDismiss(1500);
          return;
        }
        dismissToast(id);
      }, delay);
    };
    // The history is a record, not a control surface: its entries persist to
    // storage, where a callback cannot follow.
    setNotificationHistory((current) =>
      [{ ...nextToast, actions: [], onAction: undefined }, ...current].slice(
        0,
        NOTIFICATION_HISTORY_LIMIT,
      ),
    );
    // A toast asking a question needs longer on screen than one stating a fact.
    scheduleToastDismiss(nextToast.actions.length > 0 ? 9000 : 3400);
  };

  const clearNotificationHistory = () => {
    setNotificationHistory([]);
  };

  const playSound = (effect: SoundEffectName) => {
    if (!soundEnabledRef.current) return;

    const audioContext = audioContextRef.current ?? createPocketDeskAudioContext();
    if (!audioContext) return;

    audioContextRef.current = audioContext;
    playPocketDeskSound(audioContext, effect, soundVolumeRef.current);
  };

  /*
   * 알람 및 시계 fires from the shell, not from its app window — an alarm that
   * only rings while its window is open is a countdown display, not an alarm.
   * The tick body lives in a ref so one interval survives every re-render yet
   * always reads current state; the first tick after boot also delivers
   * anything that came due while the tab was closed, flagged as missed.
   */
  const clockTickRef = useRef<() => void>(() => {});
  // Assigned after commit, not during render, so a discarded concurrent render
  // can never leave its closure driving the interval.
  useEffect(() => {
    clockTickRef.current = () => {
      /*
       * Nothing rings while the shell cannot show it: on the lock screen and
       * with the power off, the toast stack sits under the gate, so firing
       * there played a sound over a black screen and silently consumed the
       * alarm. Leaving it due means the first tick after unlock delivers it —
       * as 놓친 알람 when enough time has passed.
       */
      if (shellPhase !== "unlocked") return;
      const timestamp = Date.now();
      const { due, next } = collectDueClockAlarms(clockAlarms, timestamp);
      if (due.length > 0) {
        setClockAlarms(next);
        for (const alarm of due) {
          notify({
            // 해제 just closes the toast — a one-shot is already off and a
            // repeating alarm already re-armed for its next day.
            actions: [
              { id: "snooze", label: "다시 알림 (5분)" },
              { id: "dismiss", label: "해제" },
            ],
            detail: `${alarm.time}${alarm.label ? ` · ${alarm.label}` : ""}`,
            onAction: (actionId) => {
              if (actionId !== "snooze") return;
              setClockAlarms((current) =>
                current.map((item) =>
                  item.id === alarm.id ? snoozeClockAlarm(item, Date.now()) : item,
                ),
              );
            },
            title: isMissedAlarmFire(alarm, timestamp) ? "놓친 알람" : "알람",
            tone: "info",
          });
        }
        playSound("success");
      }

      const timerTick = tickClockTimer(clockTimer, timestamp);
      if (timerTick.fired) {
        setClockTimer(timerTick.next);
        notify({
          detail: `${formatClockDuration(clockTimer.durationMs)} 타이머가 끝났습니다.`,
          title: "타이머 완료",
          tone: "success",
        });
        playSound("success");
      }
    };
  });

  useEffect(() => {
    const interval = window.setInterval(() => clockTickRef.current(), 500);
    return () => window.clearInterval(interval);
  }, []);

  // Alt+Tab moves aria-current between items, which changes no text — so the
  // cycling was silent. Say the selected window's title through the shared
  // live region instead.
  useEffect(() => {
    if (!altTabWindowId) return;
    const target = windows.find((item) => item.id === altTabWindowId);
    if (!target) return;
    const app = getApp(target.appId);
    announce(
      `${formatWindowTitle(app.title, getWindowDocumentLabel(target.appId))}${
        target.minimized ? ", 최소화됨" : ""
      }`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrate on selection change only
  }, [altTabWindowId]);

  // The keyboard move/resize hint used to be a conditionally-rendered
  // role=status, which mounts with its content and stays silent.
  useEffect(() => {
    if (!windowKeyboardDrag) return;
    announce(
      windowKeyboardDrag.mode === "move"
        ? "창 이동 모드. 화살표로 이동, Enter 확정, Esc 취소"
        : "창 크기 조정 모드. 화살표로 조정, Enter 확정, Esc 취소",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrate on mode change only
  }, [windowKeyboardDrag?.mode, windowKeyboardDrag?.windowId]);

  /*
   * Long-press is the touch world's right click. Every context menu here
   * hangs off onContextMenu, and mobile browsers are inconsistent about
   * synthesizing that event from a touch hold — so the shell does it itself:
   * hold a primary touch still for half a second and the element under the
   * finger receives a real contextmenu event. The click that follows the
   * finger lifting is swallowed once, or it would activate the very thing
   * the menu just opened over. Text fields keep their native selection hold.
   */
  const longPressSuppressClickRef = useRef(false);
  useEffect(() => {
    let timer = 0;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let pressTarget: Element | null = null;

    const cancelTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
    };

    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "touch" || !event.isPrimary) return;
      // Element, not HTMLElement: a press frequently lands on an SVG glyph
      // (icons, window controls), and SVGElement is no HTMLElement — the
      // narrower check silently dropped exactly those presses.
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target ||
        target.closest("input, textarea, select, [contenteditable], .paint-canvas")
      ) {
        return;
      }
      cancelTimer();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      pressTarget = target;
      timer = window.setTimeout(() => {
        timer = 0;
        longPressSuppressClickRef.current = true;
        /*
         * Re-resolve the element under the finger at fire time. The press
         * itself often re-renders its target (selecting an icon swaps its
         * SVG), and dispatching on a detached node never reaches React's
         * root listener — the menu silently failed to open.
         */
        const liveTarget = document.elementFromPoint(startX, startY) ?? pressTarget;
        liveTarget?.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: startX,
            clientY: startY,
            view: window,
          }),
        );
      }, 550);
    };

    const onPointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) cancelTimer();
    };

    const onPointerEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerId === pointerId) cancelTimer();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!longPressSuppressClickRef.current) return;
      longPressSuppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("click", onClickCapture, true);
    return () => {
      cancelTimer();
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerEnd, true);
      window.removeEventListener("pointercancel", onPointerEnd, true);
      window.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  const lockDesktop = () => {
    playSound("close");
    logShellEvent(
      "security",
      SHELL_EVENT_WORKSTATION_LOCKED,
      "PocketDesk 보안",
      "워크스테이션 잠금",
      `워크스테이션이 잠겼습니다.\n계정: ${userName}`,
    );
    setShellPhase("locked");
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setDesktopPropertiesItemId(null);
    setWindowMenu(null);
    setQuery("");
    setToasts([]);
  };

  /*
   * Windows closes every app when the machine goes down, and asks first when a
   * document has unsaved work. Both power actions used to leave the whole
   * session standing, so the same windows were still there on the other side.
   * A guard returning false means an app has put a question on screen, so the
   * power action waits for the answer instead of overruling it.
   */
  /*
   * One rule for every sound toggle: switching sound on with the volume parked
   * at 0 would report "on" and stay silent, so the toggle brings the volume
   * back the way the Windows one does.
   */
  const toggleSoundEnabled = (enabled: boolean) => {
    setSoundEnabled(enabled);
    if (enabled) setSoundVolume((current) => (current === 0 ? 72 : current));
  };

  /*
   * Calling every guard at once stacked one save prompt per dirty document on
   * top of each other, and a blocked power action simply evaporated — the
   * reader answered the prompt and nothing resumed. Only the first blocking
   * guard fires now, so one question is on screen at a time, and the shell
   * says the restart was cancelled instead of forgetting it was asked for.
   * Windows queues the shutdown behind the prompts; a spoken cancellation is
   * the honest version of that without a resume that could fire by surprise.
   */
  const surfaceWindowForPrompt = (id: string) => {
    const target = windows.find((item) => item.id === id);
    if (!target) return;
    if (target.desktopIndex !== activeDesktopIndex) {
      setActiveDesktopIndex(target.desktopIndex);
    }
    cancelWindowMotion(id);
    if (target.minimized) updateWindow(id, { minimized: false });
    focusWindow(id);
  };

  /**
   * cmd's shutdown command, routed through the exact same paths the Start
   * menu's power buttons take — guards ask their questions first.
   */
  const requestPowerAction = (action: "lock" | "off" | "restart") => {
    if (action === "lock") {
      lockDesktop();
      return;
    }
    if (action === "restart") {
      restartDesktop();
      return;
    }
    shutdownDesktop();
  };

  const closeAllWindowsForPowerAction = (actionLabel: string) => {
    for (const item of windows) {
      const guard = closeGuardsRef.current.get(item.id);
      if (!guard) continue;
      surfaceWindowForPrompt(item.id);
      if (!guard()) {
        notify({
          detail: `저장하지 않은 작업이 있어 ${actionLabel}이(가) 취소되었습니다. 저장 후 다시 시도하세요.`,
          title: `${actionLabel} 취소됨`,
        });
        return false;
      }
    }

    // Every window closed by the power action gets its ended record; wiping
    // the array silently left the log with starts and no ends.
    for (const item of windows) {
      const app = getApp(item.appId);
      logShellEvent(
        "system",
        SHELL_EVENT_PROCESS_ENDED,
        app.title,
        "프로세스 종료",
        `"${formatWindowTitle(app.title, getWindowDocumentLabel(item.appId))}" 창이 닫혔습니다.\n앱: ${app.title}\n창 ID: ${item.id}`,
      );
    }
    closeGuardsRef.current.clear();
    setUnsavedWindowIds(new Set());
    setWindows([]);
    return true;
  };

  const restartDesktop = () => {
    // The menu closes either way: when a save prompt blocks the action, the
    // question has to be on top, not under the Start menu that asked for it.
    setStartOpen(false);
    if (!closeAllWindowsForPowerAction("다시 시작")) return;
    // Shutdown wrote its 1074; a restart left no trace at all.
    logShellEvent(
      "system",
      SHELL_EVENT_POWER_OFF,
      "PocketDesk 셸",
      "시스템 종료",
      `사용자가 다시 시작을 시작했습니다.\n계정: ${userName}`,
    );
    playSound("toggle");
    setShellPhase("booting");
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setDesktopPropertiesItemId(null);
    setWindowMenu(null);
    setQuery("");
    setToasts([]);
  };

  const shutdownDesktop = () => {
    setStartOpen(false);
    if (!closeAllWindowsForPowerAction("시스템 종료")) return;
    logShellEvent(
      "system",
      SHELL_EVENT_POWER_OFF,
      "PocketDesk 셸",
      "시스템 종료",
      `사용자가 시스템 종료를 시작했습니다.\n계정: ${userName}`,
    );
    playSound("close");
    setShellPhase("shutdown");
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setDesktopPropertiesItemId(null);
    setWindowMenu(null);
    setQuery("");
    setAltTabWindowId(null);
    setSnapPreview(null);
    setToasts([]);
  };

  const powerOnDesktop = () => {
    playSound("unlock");
    setShellPhase("booting");
  };

  const unlockDesktop = () => {
    logShellEvent(
      "security",
      SHELL_EVENT_LOGON,
      "PocketDesk 보안",
      "로그온",
      `계정이 로그온했습니다.\n계정: ${userName}\n로그온 유형: 대화형`,
    );
    playSound("unlock");
    setShellPhase("unlocked");
  };

  const resetDesktopIconLayout = () => {
    playSound("success");
    localStorage.removeItem(DESKTOP_ICON_LAYOUT_KEY);
    setIconLayout(createDefaultIconLayout());
    notify({
      detail: "바탕화면 바로가기 위치를 기본값으로 되돌렸습니다.",
      title: "아이콘 배치 초기화",
      tone: "success",
    });
  };

  const resetWindowLayout = () => {
    playSound("success");
    localStorage.removeItem(WINDOW_STATE_KEY);
    /*
     * The default layout is no windows at all, so this used to close every
     * running app without a word — a memo with unsaved text included, while its
     * title bar showed the asterisk. It restores positions and sizes now and
     * leaves the windows themselves alone, which is what the button says it
     * does.
     */
    setWindows((current) =>
      current.map((item, index) => {
        // Identity, stacking and desktop stay; only the geometry is replaced.
        const fresh = makeWindow(item.appId, 52 + index * 26, 42 + index * 24, item.z);
        return {
          ...item,
          height: fresh.height,
          maximized: false,
          minimized: false,
          snapZone: undefined,
          width: fresh.width,
          x: fresh.x,
          y: fresh.y,
        };
      }),
    );
    notify({
      detail: "열린 창의 위치와 크기를 기본값으로 되돌렸습니다.",
      title: "창 배치 초기화",
      tone: "success",
    });
  };

  const changeWallpaper = (nextWallpaper: WallpaperName) => {
    playSound("success");
    setWallpaper(nextWallpaper);
    const selected = wallpaperGallery.find((item) => item.id === nextWallpaper);
    notify({
      detail: selected?.detail ?? "새 배경화면을 적용했습니다.",
      title: `${selected?.label ?? "배경화면"} 적용`,
      tone: "success",
    });
  };

  const changeTheme = (nextTheme: ThemeName) => {
    playSound("success");
    setTheme(nextTheme);
    notify({
      detail: "창, 메뉴, 포인트 컬러가 업데이트되었습니다.",
      title: `${getThemeLabel(nextTheme)} 테마 적용`,
      tone: "success",
    });
  };

  const openApp = (appId: AppId, options?: { forceNew?: boolean }) => {
    // A second window is only safe where the app's state is window-local.
    const forceNew = Boolean(options?.forceNew) && Boolean(getApp(appId).multiInstance);
    // Prefer a window already on this desktop; otherwise follow one to its own.
    const candidates = windows
      .filter((item) => item.appId === appId)
      .sort((first, second) => second.z - first.z);
    const existingWindow = forceNew
      ? undefined
      : (candidates.find((item) => item.desktopIndex === activeDesktopIndex) ?? candidates[0]);
    const nextWindowId = existingWindow?.id ?? `${appId}-${crypto.randomUUID()}`;
    if (existingWindow) {
      cancelWindowMotion(existingWindow.id);
      if (existingWindow.desktopIndex !== activeDesktopIndex) {
        setActiveDesktopIndex(existingWindow.desktopIndex);
      }
    }
    playSound("open");
    if (!existingWindow) {
      const app = getApp(appId);
      logShellEvent(
        "system",
        SHELL_EVENT_PROCESS_STARTED,
        app.title,
        "프로세스 생성",
        `"${app.title}" 창이 열렸습니다.\n앱: ${app.title}\n창 ID: ${nextWindowId}`,
      );
    }
    setTaskViewOpen(false);
    setDesktopIconMenu(null);
    setDesktopMenu(null);
    setWindows((current) => {
      const app = getApp(appId);
      const ordered = current
        .filter((item) => item.appId === appId)
        .sort((first, second) => second.z - first.z);
      const existing = forceNew
        ? undefined
        : (ordered.find((item) => item.desktopIndex === activeDesktopIndex) ?? ordered[0]);
      const topZ = Math.max(12, ...current.map((item) => item.z));

      if (existing) {
        return current.map((item) =>
          item.id === existing.id ? { ...item, minimized: false, z: topZ + 1 } : item,
        );
      }

      const offset = current.length * 24;
      const width = Math.min(app.defaultSize.width, Math.max(320, window.innerWidth - 28));
      const height = Math.min(
        app.defaultSize.height,
        Math.max(260, window.innerHeight - APP_BAR_HEIGHT - 28),
      );
      const maxX = Math.max(12, window.innerWidth - width - 18);
      const maxY = Math.max(12, window.innerHeight - APP_BAR_HEIGHT - height - 18);

      return [
        ...current,
        {
          id: nextWindowId,
          appId,
          x: Math.min(52 + offset, maxX),
          y: Math.min(42 + offset, maxY),
          width,
          height,
          z: topZ + 1,
          minimized: false,
          maximized: false,
          desktopIndex: activeDesktopIndex,
        },
      ];
    });
    setStartOpen(false);
    setRunOpen(false);
    setQuery("");
    return nextWindowId;
  };

  const openNewAppWindow = (appId: AppId) => openApp(appId, { forceNew: true });

  const togglePinnedApp = (appId: AppId) => {
    const app = getApp(appId);
    const wasPinned = pinnedAppIds.includes(appId);
    setPinnedAppIds((current) =>
      current.includes(appId) ? current.filter((item) => item !== appId) : [...current, appId],
    );
    playSound("toggle");
    notify({
      detail: wasPinned ? "작업표시줄 고정을 해제했습니다." : "작업표시줄에 고정했습니다.",
      title: `${app.title} ${wasPinned ? "고정 해제" : "고정됨"}`,
      tone: "success",
    });
  };

  const fitIconPosition = (position: IconPosition) =>
    alignDesktopIcons
      ? snapDesktopIconPosition(position, desktopViewMode)
      : clampIconPosition(position.x, position.y, desktopViewMode);

  /*
   * Dragging one icon of a multi-selection moves the whole selection on
   * Windows. Only the dragged one moved here, so a selection of five was really
   * a selection of one as soon as the pointer went down.
   */
  const shiftSelectedIcons = (draggedId: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    if (!selectedDesktopIds.includes(draggedId) || selectedDesktopIds.length < 2) return;

    setIconLayout((current) => {
      const next = { ...current };
      for (const app of desktopApps) {
        const id = `app:${app.id}`;
        const position = current[app.id];
        if (!position || id === draggedId || !selectedDesktopIds.includes(id)) continue;
        next[app.id] = fitIconPosition({ x: position.x + dx, y: position.y + dy });
      }
      return next;
    });
    setDesktopItems((current) =>
      current.map((item) => {
        const id = `item:${item.id}`;
        if (!item.showOnDesktop || id === draggedId || !selectedDesktopIds.includes(id)) {
          return item;
        }
        return { ...item, ...fitIconPosition({ x: item.x + dx, y: item.y + dy }) };
      }),
    );
  };

  const moveDesktopIcon = (appId: AppId, nextPosition: IconPosition) => {
    const fitted = fitIconPosition(nextPosition);
    const previous = iconLayout[appId];
    if (previous) {
      shiftSelectedIcons(`app:${appId}`, fitted.x - previous.x, fitted.y - previous.y);
    }
    setIconLayout((current) => ({ ...current, [appId]: fitted }));
  };

  const moveDesktopItem = (itemId: string, nextPosition: IconPosition) => {
    const fitted = fitIconPosition(nextPosition);
    const previous = desktopItems.find((item) => item.id === itemId);
    if (previous) {
      shiftSelectedIcons(`item:${itemId}`, fitted.x - previous.x, fitted.y - previous.y);
    }
    setDesktopItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...fitted,
              // Where an icon sits is shell layout, not a change to the file:
              // stamping it here made dragging an icon log a "contents changed"
              // event and reorder the Start menu's recent list.
            }
          : item,
      ),
    );
  };

  const openVfsEntry = (item: DesktopItem) => {
    const association = getVfsEntryAssociation(item);
    const override = defaultApps[getVfsEntryExtension(item)];
    const targetAppId = override ?? association.appId;
    // Shell-level opens only, on purpose: Explorer's own in-window navigation
    // is browsing, not "opening a document", and must not churn the jump list.
    setRecentOpens((current) => recordRecentOpen(current, item.id, Date.now()));
    if (item.kind === "folder") {
      const windowId = openApp("files");
      setFilesLaunchRequest({ folderId: item.id, id: crypto.randomUUID(), windowId });
      return;
    }
    // Only the app that will actually open moves its document pointer. With a
    // txt default of 명령 프롬프트, opening a note used to silently swap
    // Notepad's active file while the terminal came up empty.
    if (item.kind === "note" && targetAppId === "notepad") {
      setActiveNoteId(item.id);
    }
    if (item.kind === "canvas" && (targetAppId === "paint" || targetAppId === "photos")) {
      setActiveCanvasId(item.id);
      setActiveCanvasOpenKey((current) => current + 1);
    }
    if (targetAppId === "browser" && item.kind === "shortcut") {
      setBrowserLaunchRequest({ id: crypto.randomUUID(), value: getVfsShortcutTarget(item) });
    }
    openApp(targetAppId);
  };

  /**
   * Makes an entry current inside the app that is already showing it. Saving in
   * Paint must not bounce the user to whichever app owns the file type.
   */
  const activateVfsEntry = (item: DesktopItem) => {
    if (item.kind === "note") setActiveNoteId(item.id);
    if (item.kind === "canvas") {
      setActiveCanvasId(item.id);
      setActiveCanvasOpenKey((current) => current + 1);
    }
  };

  /** Accepts a drag out of an Explorer window and files it onto the desktop. */
  const dropEntriesOntoDesktop = (event: React.DragEvent<HTMLElement>) => {
    const payload = event.dataTransfer.getData(VFS_DRAG_MIME);
    if (!payload) return;
    event.preventDefault();

    let itemIds: string[];
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!Array.isArray(parsed)) return;
      itemIds = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      return;
    }
    if (itemIds.length === 0) return;

    // An entry already in the desktop folder is not moved, only surfaced: living
    // in that folder and having an icon on the desktop are separate states here.
    const needsMove = itemIds.filter((id) =>
      activeDesktopItems.some((item) => item.id === id && item.parentId !== VFS_ROOT_ID),
    );
    if (needsMove.length > 0 && !moveVfsEntries(needsMove, VFS_ROOT_ID)) return;

    // The one placement path that skipped the grid: with 그리드 맞춤 on, a file
    // dropped out of Explorer landed wherever the pointer was while every other
    // placement snapped.
    const position = alignDesktopIcons
      ? snapDesktopIconPosition(
          { x: event.clientX - 40, y: event.clientY - 40 },
          desktopViewMode,
        )
      : clampIconPosition(event.clientX - 40, event.clientY - 40, desktopViewMode);
    // moveVfsEntries clears showOnDesktop, so a desktop drop has to restore it.
    setDesktopItems((current) =>
      current.map((item) =>
        itemIds.includes(item.id) ? { ...item, showOnDesktop: true, ...position } : item,
      ),
    );
    setSelectedDesktopIds(itemIds.map((id) => `item:${id}`));
  };

  const openDesktopItem = (item: DesktopItem) => {
    openVfsEntry(item);
  };

  /** The first free desktop slot near where the context menu was opened. */
  const nextDesktopIconPosition = (originX: number, originY: number) =>
    findAvailableDesktopPosition(
      clampIconPosition(originX - 18, originY - 10, desktopViewMode),
      desktopViewMode,
      [
        ...desktopApps.map((app) => iconLayout[app.id] ?? createDefaultIconLayout()[app.id]!),
        ...activeDesktopItems
          .filter((item) => item.showOnDesktop)
          .map((item) => ({ x: item.x, y: item.y })),
      ],
    );

  const createDesktopItem = (kind: CreatableDesktopItemKind) => {
    playSound("success");
    const origin = desktopMenu ?? {
      originX: 24,
      originY: 24,
      x: 24,
      y: 24,
    };
    const position = nextDesktopIconPosition(origin.originX, origin.originY);
    const isFolder = kind === "folder";
    const name = isFolder
      ? getUniqueVfsEntryName(activeDesktopItems, VFS_ROOT_ID, "새 폴더")
      : getUniqueTextFileName(activeDesktopItems, VFS_ROOT_ID);
    const now = Date.now();
    const item: DesktopItem = {
      ...(isFolder ? {} : { content: "" }),
      createdAt: now,
      id: `${kind}-${crypto.randomUUID()}`,
      kind,
      name,
      parentId: VFS_ROOT_ID,
      showOnDesktop: true,
      updatedAt: now,
      ...position,
    };

    setDesktopItems((current) => [...current, item]);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setSelectedDesktopIds([`item:${item.id}`]);
    setDesktopRenameDraft(item.name);
    setDesktopRenamingItemId(item.id);
    notify({
      detail: isFolder
        ? "파일 탐색기에서 열어 항목을 담을 수 있습니다."
        : "메모장에서 열어 작성할 수 있습니다.",
      title: `${name} 생성됨`,
      tone: "success",
    });
  };

  const activeDesktopItems = useMemo(() => {
    return desktopItems.filter((item) => !item.trashed);
  }, [desktopItems]);
  const desktopContextItem =
    desktopIconMenu?.kind === "item"
      ? activeDesktopItems.find((item) => item.id === desktopIconMenu.itemId)
      : undefined;
  const desktopContextApp =
    desktopIconMenu?.kind === "app" ? getApp(desktopIconMenu.appId) : undefined;
  const desktopPropertiesItem = activeDesktopItems.find(
    (item) => item.id === desktopPropertiesItemId,
  );

  const createVfsFolder = (parentId = VFS_ROOT_ID, requestedName = "새 폴더") => {
    const now = Date.now();
    const item: DesktopItem = {
      createdAt: now,
      id: `folder-${crypto.randomUUID()}`,
      kind: "folder",
      name: getUniqueVfsEntryName(activeDesktopItems, parentId, requestedName),
      parentId,
      showOnDesktop: false,
      updatedAt: now,
      x: 0,
      y: 0,
    };

    setDesktopItems((current) => [...current, item]);
    playSound("success");
    notify({
      detail: "현재 위치에 새 폴더를 만들었습니다.",
      title: `${item.name} 생성됨`,
      tone: "success",
    });
    return item;
  };

  const createVfsTextFile = (parentId = VFS_DOCUMENTS_ID) => {
    const now = Date.now();
    const item: DesktopItem = {
      content: "",
      createdAt: now,
      id: `note-${crypto.randomUUID()}`,
      kind: "note",
      name: getUniqueTextFileName(activeDesktopItems, parentId),
      parentId,
      showOnDesktop: false,
      updatedAt: now,
      x: 0,
      y: 0,
    };

    setDesktopItems((current) => [...current, item]);
    playSound("success");
    notify({
      detail: "이름을 정한 뒤 메모장에서 바로 열 수 있습니다.",
      title: `${item.name} 생성됨`,
      tone: "success",
    });
    return item;
  };

  const duplicateVfsEntries = (itemIds: string[], options?: VfsDuplicateOptions) => {
    const sourceIds = getVfsTopLevelIds(activeDesktopItems, itemIds).filter(
      (id) => activeDesktopItems.some((item) => item.id === id) && !isVfsSystemFolderId(id),
    );
    if (sourceIds.length === 0) return [];

    const treeIds = getVfsDescendantIds(activeDesktopItems, sourceIds);
    const idMap = new Map(
      [...treeIds].map((sourceId) => {
        const source = activeDesktopItems.find((item) => item.id === sourceId);
        return [sourceId, `${source?.kind ?? "note"}-${crypto.randomUUID()}`] as const;
      }),
    );
    const copiedRootIds = sourceIds.map((sourceId) => idMap.get(sourceId)!);

    setDesktopItems((current) => {
      const existingNamesByParent = new Map<string, Set<string>>();
      const getExistingNames = (parentId: string) => {
        const existing = existingNamesByParent.get(parentId);
        if (existing) return existing;
        const names = new Set(
          current
            .filter((item) => !item.trashed && item.parentId === parentId)
            .map((item) => item.name),
        );
        existingNamesByParent.set(parentId, names);
        return names;
      };
      const occupiedDesktopPositions = options?.showOnDesktop
        ? [
            ...desktopApps.map(
              (app) => iconLayout[app.id] ?? createDefaultIconLayout()[app.id]!,
            ),
            ...current
              .filter((item) => !item.trashed && item.showOnDesktop)
              .map((item) => ({ x: item.x, y: item.y })),
          ]
        : [];
      const now = Date.now();
      let copyIndex = 0;
      const copies = current.flatMap((source) => {
        if (!treeIds.has(source.id) || source.trashed) return [];
        const rootIndex = sourceIds.indexOf(source.id);
        const isRootCopy = rootIndex >= 0;
        const parentId = isRootCopy
          ? (options?.parentId ?? source.parentId)
          : (idMap.get(source.parentId) ?? options?.parentId ?? source.parentId);
        const existingNames = getExistingNames(parentId);
        const name = isRootCopy
          ? getUniqueVfsCopyName(existingNames, source.name)
          : source.name;
        existingNames.add(name);
        const preferredPosition =
          isRootCopy && options?.showOnDesktop && options.position
            ? clampIconPosition(
                options.position.x + rootIndex * 18,
                options.position.y + rootIndex * 18,
                desktopViewMode,
              )
            : { x: 0, y: 0 };
        const position =
          isRootCopy && options?.showOnDesktop && options.position
            ? findAvailableDesktopPosition(
                preferredPosition,
                desktopViewMode,
                occupiedDesktopPositions,
              )
            : preferredPosition;
        if (isRootCopy && options?.showOnDesktop) occupiedDesktopPositions.push(position);
        const timestamp = now + copyIndex;
        copyIndex += 1;
        return [
          {
            ...source,
            createdAt: timestamp,
            id: idMap.get(source.id)!,
            name,
            parentId,
            restoreParentId: undefined,
            restoreShowOnDesktop: false,
            showOnDesktop: isRootCopy ? (options?.showOnDesktop ?? false) : false,
            trashed: false,
            trashedAt: undefined,
            trashedRootId: undefined,
            updatedAt: timestamp,
            ...position,
          },
        ];
      });
      return [...current, ...copies];
    });
    playSound("success");
    notify({
      detail: "선택한 항목의 복사본을 만들었습니다.",
      title: `${sourceIds.length}개 항목 붙여넣기 완료`,
      tone: "success",
    });
    return copiedRootIds;
  };

  const moveVfsEntries = (itemIds: string[], parentId: string) => {
    const roots = getVfsTopLevelIds(activeDesktopItems, itemIds);
    if (!canMoveVfsEntries(activeDesktopItems, roots, parentId)) {
      playSound("error");
      notify({
        detail: "폴더 자신이나 하위 폴더 안으로는 이동할 수 없습니다.",
        title: "항목을 이동할 수 없음",
      });
      return false;
    }

    const moving = roots.filter((id) => {
      const item = activeDesktopItems.find((entry) => entry.id === id);
      return item && item.parentId !== parentId;
    });
    if (moving.length === 0) return false;

    const existingNames = new Set(
      activeDesktopItems
        .filter((item) => item.parentId === parentId && !moving.includes(item.id))
        .map((item) => item.name),
    );
    const nextNames = new Map<string, string>();
    moving.forEach((itemId) => {
      const item = activeDesktopItems.find((entry) => entry.id === itemId);
      if (!item) return;
      const name = existingNames.has(item.name)
        ? getUniqueVfsCopyName(existingNames, item.name)
        : item.name;
      existingNames.add(name);
      nextNames.set(itemId, name);
    });

    const now = Date.now();
    setDesktopItems((current) =>
      current.map((item) =>
        moving.includes(item.id)
          ? {
              ...item,
              name: nextNames.get(item.id) ?? item.name,
              parentId,
              showOnDesktop: false,
              updatedAt: now,
            }
          : item,
      ),
    );
    playSound("success");
    notify({
      detail: "선택한 항목을 새 위치로 옮겼습니다.",
      title: `${moving.length}개 항목 이동됨`,
      tone: "success",
    });
    return true;
  };

  const arrangeDesktopIcons = (
    sortKey: DesktopSortKey,
    viewMode: DesktopViewMode = desktopViewMode,
  ) => {
    const entries = [
      ...desktopApps.map((app) => ({
        id: app.id,
        kind: "app" as const,
        name: app.title,
        type: "시스템",
        updatedAt: 0,
      })),
      ...activeDesktopItems
        .filter((item) => item.showOnDesktop)
        .map((item) => ({
          id: item.id,
          kind: "item" as const,
          name: item.name,
          type: getVfsEntryAssociation(item).typeLabel,
          updatedAt: item.updatedAt,
        })),
    ].sort((first, second) => compareDesktopEntries(first, second, sortKey));
    const positions = createDesktopGridPositions(entries.length, viewMode);

    setDesktopSortKey(sortKey);
    setIconLayout((current) => {
      const next = { ...current };
      entries.forEach((entry, index) => {
        if (entry.kind === "app") next[entry.id] = positions[index];
      });
      return next;
    });
    setDesktopItems((current) =>
      current.map((item) => {
        const index = entries.findIndex(
          (entry) => entry.kind === "item" && entry.id === item.id,
        );
        return index >= 0 ? { ...item, ...positions[index] } : item;
      }),
    );
    setDesktopMenu(null);
  };

  const changeDesktopView = (viewMode: DesktopViewMode) => {
    setDesktopViewMode(viewMode);
    /*
     * Windows changes the icon size and leaves hand-placed icons where they
     * are. Re-arranging threw the whole layout away — an icon dragged to
     * 330,226 went back to 18,18 — so each icon is only re-fitted to the new
     * size where it already sits.
     */
    const refit = (position: IconPosition) =>
      alignDesktopIcons
        ? snapDesktopIconPosition(position, viewMode)
        : clampIconPosition(position.x, position.y, viewMode);

    setIconLayout((current) => {
      const next = { ...current };
      for (const app of desktopApps) {
        const position = current[app.id];
        if (position) next[app.id] = refit(position);
      }
      return next;
    });
    setDesktopItems((current) =>
      current.map((item) => (item.showOnDesktop ? { ...item, ...refit(item) } : item)),
    );
  };

  const toggleDesktopGrid = () => {
    const next = !alignDesktopIcons;
    setAlignDesktopIcons(next);
    if (next) arrangeDesktopIcons(desktopSortKey);
  };

  const refreshDesktop = () => {
    /*
     * Windows' refresh re-applies the current arrangement. Copying the arrays
     * into new ones repainted nothing anyone could measure — with 그리드 맞춤
     * on, an icon nudged off the grid now snaps back to it.
     */
    if (alignDesktopIcons) {
      setIconLayout((current) => {
        const next = { ...current };
        for (const app of desktopApps) {
          const position = current[app.id];
          if (position) next[app.id] = snapDesktopIconPosition(position, desktopViewMode);
        }
        return next;
      });
      setDesktopItems((current) =>
        current.map((item) =>
          item.showOnDesktop
            ? { ...item, ...snapDesktopIconPosition(item, desktopViewMode) }
            : item,
        ),
      );
    }
    setDesktopMenu(null);
    playSound("toggle");
  };

  const trashedItems = useMemo(() => {
    return desktopItems
      .filter((item) => item.trashed && (!item.trashedRootId || item.trashedRootId === item.id))
      .sort((a, b) => (b.trashedAt ?? b.updatedAt) - (a.trashedAt ?? a.updatedAt));
  }, [desktopItems]);

  const noteEntries = useMemo(() => {
    return activeDesktopItems.filter((item) => item.kind === "note");
  }, [activeDesktopItems]);

  const [recentOpens, setRecentOpens] = useState(() => loadRecentOpens());

  useEffect(() => {
    persistRecentOpens(recentOpens);
  }, [recentOpens]);

  const recentDocumentsByApp = useMemo(
    () => buildRecentDocumentsByApp(activeDesktopItems, defaultApps, recentOpens),
    [activeDesktopItems, defaultApps, recentOpens],
  );

  const canvasEntries = useMemo(() => {
    return activeDesktopItems.filter((item) => item.kind === "canvas");
  }, [activeDesktopItems]);

  const savePaintImage = (
    content: string,
    options?: { existingItemId?: string; name?: string; parentId?: string },
  ) => {
    playSound("success");
    const now = Date.now();
    const existingId = options?.existingItemId ?? (!options ? activeCanvasId : undefined);
    const existing = existingId
      ? activeDesktopItems.find((item) => item.id === existingId && item.kind === "canvas")
      : undefined;
    if (existing) {
      const updatedItem: DesktopItem = {
        ...existing,
        content,
        name: options?.name ?? existing.name,
        parentId: options?.parentId ?? existing.parentId,
        updatedAt: now,
      };
      setDesktopItems((current) =>
        current.map((item) => (item.id === existing.id ? updatedItem : item)),
      );
      setActiveCanvasId(existing.id);
      notify({
        detail: "그림판 파일에 변경 내용을 저장했습니다.",
        title: `${updatedItem.name} 저장됨`,
        tone: "success",
      });
      return updatedItem;
    }

    const id = `canvas-${crypto.randomUUID()}`;
    const parentId = options?.parentId ?? VFS_PICTURES_ID;
    const name = options?.name
      ? getUniqueVfsEntryName(activeDesktopItems, parentId, options.name)
      : getUniqueCanvasItemName(activeDesktopItems, parentId);
    const item: DesktopItem = {
      content,
      createdAt: now,
      id,
      kind: "canvas",
      name,
      parentId,
      showOnDesktop: false,
      updatedAt: now,
      x: 0,
      y: 0,
    };

    setDesktopItems((current) => [...current, item]);
    setActiveCanvasId(id);
    setActiveCanvasOpenKey((current) => current + 1);
    notify({
      detail: "파일 탐색기에서 다시 열어 편집할 수 있습니다.",
      title: `${name} 저장됨`,
      tone: "success",
    });
    return item;
  };

  const renameVfsEntry = (itemId: string, name: string) => {
    const target = activeDesktopItems.find((item) => item.id === itemId);
    if (!target || isVfsSystemFolderId(itemId)) return;

    const nextName = getUniqueRenamedVfsItemName(activeDesktopItems, itemId, name);
    if (nextName === target.name) return;

    playSound("success");
    setDesktopItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, name: nextName, updatedAt: Date.now() } : item,
      ),
    );
    notify({
      detail: "새 이름으로 변경했습니다.",
      title: `${nextName} 이름 변경됨`,
      tone: "success",
    });
  };

  const deleteVfsEntry = (itemId: string) => {
    const target = activeDesktopItems.find((item) => item.id === itemId);
    if (!target || isVfsSystemFolderId(itemId)) return;

    playSound("close");
    const now = Date.now();
    const deletedIds = getVfsDescendantIds(activeDesktopItems, [itemId]);
    const remaining = activeDesktopItems.filter((item) => !deletedIds.has(item.id));
    setDesktopItems((current) =>
      current.map((item) =>
        deletedIds.has(item.id)
          ? {
              ...item,
              restoreParentId: item.id === itemId ? item.parentId : item.restoreParentId,
              restoreShowOnDesktop: item.showOnDesktop,
              showOnDesktop: false,
              trashed: true,
              trashedAt: now,
              trashedRootId: itemId,
              updatedAt: now,
            }
          : item,
      ),
    );

    if (deletedIds.has(activeNoteId)) {
      setActiveNoteId(
        remaining.find((item) => item.kind === "note")?.id ?? VFS_PRIMARY_NOTE_ID,
      );
    }
    if (deletedIds.has(activeCanvasId)) {
      setActiveCanvasId(
        remaining.find((item) => item.kind === "canvas")?.id ?? VFS_PRIMARY_CANVAS_ID,
      );
      setActiveCanvasOpenKey((current) => current + 1);
    }

    notify({
      detail: "휴지통에서 복원하거나 영구 삭제할 수 있습니다.",
      title: `${target.name} 휴지통으로 이동`,
      tone: "success",
    });
  };

  const desktopSelectionAnchorRef = useRef<string | null>(null);

  const selectDesktopTarget = (
    targetId: string,
    event?: Pick<React.MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">,
  ) => {
    if (event?.ctrlKey || event?.metaKey) {
      desktopSelectionAnchorRef.current = targetId;
      setSelectedDesktopIds((current) =>
        current.includes(targetId)
          ? current.filter((id) => id !== targetId)
          : [...current, targetId],
      );
      return;
    }

    // Shift picks the run between the anchor and here, as it does in Explorer
    // and on the Windows desktop; it used to behave like a plain click.
    if (event?.shiftKey && desktopSelectionAnchorRef.current) {
      const order = desktopIconIds;
      const from = order.indexOf(desktopSelectionAnchorRef.current);
      const to = order.indexOf(targetId);
      if (from !== -1 && to !== -1) {
        const [start, end] = from <= to ? [from, to] : [to, from];
        setSelectedDesktopIds(order.slice(start, end + 1));
        return;
      }
    }

    desktopSelectionAnchorRef.current = targetId;
    setSelectedDesktopIds([targetId]);
  };

  const showDesktopIconContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    target: { appId: AppId; kind: "app" } | { itemId: string; kind: "item" },
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const targetId = target.kind === "app" ? `app:${target.appId}` : `item:${target.itemId}`;
    if (!selectedDesktopIds.includes(targetId)) {
      setSelectedDesktopIds([targetId]);
    }
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setWindowMenu(null);
    setDesktopIconMenu({
      ...target,
      ...clampContextMenuPosition(event.clientX, event.clientY),
    });
  };

  const beginDesktopRename = (item: DesktopItem) => {
    desktopRenameGuardRef.current = false;
    setDesktopIconMenu(null);
    setSelectedDesktopIds([`item:${item.id}`]);
    setDesktopRenameDraft(item.name);
    setDesktopRenamingItemId(item.id);
  };

  const commitDesktopRename = () => {
    if (desktopRenameGuardRef.current) {
      desktopRenameGuardRef.current = false;
      return;
    }
    if (!desktopRenamingItemId) return;
    desktopRenameGuardRef.current = true;
    renameVfsEntry(desktopRenamingItemId, desktopRenameDraft);
    setDesktopRenamingItemId(null);
    window.requestAnimationFrame(() => {
      desktopRenameGuardRef.current = false;
    });
  };

  const cancelDesktopRename = () => {
    desktopRenameGuardRef.current = true;
    setDesktopRenamingItemId(null);
    setDesktopRenameDraft("");
    window.requestAnimationFrame(() => {
      desktopRenameGuardRef.current = false;
    });
  };

  const getSelectedDesktopItemIds = (fallbackItemId?: string) => {
    const selectedItemIds = selectedDesktopIds
      .filter((id) => id.startsWith("item:"))
      .map((id) => id.slice(5))
      .filter((id) => activeDesktopItems.some((item) => item.id === id));
    if (fallbackItemId && !selectedItemIds.includes(fallbackItemId)) return [fallbackItemId];
    return selectedItemIds;
  };

  /** Every window shares this clipboard, so a copy in Explorer pastes on the desktop. */
  const copyToClipboard = (itemIds: string[], mode: ClipboardMode = "copy") => {
    const roots = getVfsTopLevelIds(activeDesktopItems, itemIds).filter(
      (id) => !isVfsSystemFolderId(id),
    );
    if (roots.length === 0) return;

    setClipboard({ itemIds: roots, mode });
    playSound("click");
    notify({
      detail:
        mode === "cut"
          ? "붙여넣으면 이 위치에서 사라집니다."
          : "다른 창이나 바탕 화면에도 붙여넣을 수 있습니다.",
      title: `${roots.length}개 항목 ${mode === "cut" ? "잘라내기" : "복사"}됨`,
      tone: "success",
    });
  };

  const pasteFromClipboard = (parentId: string) => {
    if (clipboard.itemIds.length === 0) return [];

    if (clipboard.mode === "cut") {
      const moved = moveVfsEntries(clipboard.itemIds, parentId);
      if (!moved) return [];
      const movedIds = clipboard.itemIds;
      setClipboard({ itemIds: [], mode: "copy" });
      return movedIds;
    }

    return duplicateVfsEntries(clipboard.itemIds, { parentId });
  };

  const selectAllDesktopItems = () => {
    setSelectedDesktopIds([
      ...desktopApps.map((app) => `app:${app.id}`),
      ...activeDesktopItems
        .filter((item) => item.showOnDesktop)
        .map((item) => `item:${item.id}`),
    ]);
  };

  /** Win+M minimizes every window on this desktop without toggling back. */
  const minimizeAllWindows = () => {
    const visibleIds = desktopWindows.filter((item) => !item.minimized).map((item) => item.id);
    if (visibleIds.length === 0) return;
    playSound("minimize");
    showDesktopRestoreRef.current = visibleIds;
    visibleIds.forEach((id) => {
      moveFocusOutOfWindow(id);
      scheduleWindowMotion(id, "minimizing", () => updateWindow(id, { minimized: true }));
    });
  };

  const copyDesktopItems = (fallbackItemId?: string, mode: ClipboardMode = "copy") => {
    const itemIds = getSelectedDesktopItemIds(fallbackItemId);
    if (itemIds.length === 0) return;
    copyToClipboard(itemIds, mode);
    setDesktopIconMenu(null);
  };

  const pasteDesktopItems = () => {
    if (clipboard.itemIds.length === 0) return;
    const origin = desktopMenu ?? {
      originX: 120,
      originY: 120,
      x: 120,
      y: 120,
    };
    const position = clampIconPosition(
      origin.originX - 18,
      origin.originY - 10,
      desktopViewMode,
    );

    if (clipboard.mode === "cut") {
      const movedIds = clipboard.itemIds;
      if (!moveVfsEntries(movedIds, VFS_ROOT_ID)) return;
      // moveVfsEntries clears showOnDesktop; a desktop paste has to put it back.
      setDesktopItems((current) =>
        current.map((item) =>
          movedIds.includes(item.id) ? { ...item, showOnDesktop: true, ...position } : item,
        ),
      );
      setSelectedDesktopIds(movedIds.map((id) => `item:${id}`));
      setClipboard({ itemIds: [], mode: "copy" });
    } else {
      const copiedIds = duplicateVfsEntries(clipboard.itemIds, {
        parentId: VFS_ROOT_ID,
        position,
        showOnDesktop: true,
      });
      setSelectedDesktopIds(copiedIds.map((id) => `item:${id}`));
    }

    setDesktopMenu(null);
    setDesktopIconMenu(null);
  };

  const deleteSelectedDesktopItems = (fallbackItemId?: string) => {
    const itemIds = getSelectedDesktopItemIds(fallbackItemId);
    itemIds.forEach(deleteVfsEntry);
    setSelectedDesktopIds([]);
    setDesktopIconMenu(null);
    setDesktopRenamingItemId(null);
  };

  const openSelectedDesktopTarget = () => {
    const targetId = selectedDesktopIds[0];
    if (!targetId) return;
    if (targetId.startsWith("app:")) {
      const appId = targetId.slice(4);
      if (isAppId(appId)) openApp(appId);
      return;
    }
    if (targetId.startsWith("item:")) {
      const item = activeDesktopItems.find((entry) => entry.id === targetId.slice(5));
      if (item) openDesktopItem(item);
    }
  };

  const restoreVfsEntry = (itemId: string) => {
    const target = trashedItems.find((item) => item.id === itemId);
    if (!target) return;

    const requestedParentId = target.restoreParentId ?? target.parentId;
    const parentId =
      requestedParentId === VFS_ROOT_ID ||
      activeDesktopItems.some((item) => item.id === requestedParentId && item.kind === "folder")
        ? requestedParentId
        : VFS_ROOT_ID;
    const nextName = getUniqueVfsEntryName(activeDesktopItems, parentId, target.name);
    const restoredIds = new Set(
      desktopItems
        .filter((item) => item.id === itemId || item.trashedRootId === itemId)
        .map((item) => item.id),
    );
    const now = Date.now();
    playSound("success");
    setDesktopItems((current) =>
      current.map((item) =>
        restoredIds.has(item.id)
          ? {
              ...item,
              name: item.id === itemId ? nextName : item.name,
              parentId: item.id === itemId ? parentId : item.parentId,
              restoreParentId: undefined,
              showOnDesktop: item.id === itemId ? Boolean(item.restoreShowOnDesktop) : false,
              trashed: false,
              trashedAt: undefined,
              trashedRootId: undefined,
              updatedAt: now,
            }
          : item,
      ),
    );
    notify({
      detail:
        nextName === target.name
          ? "원래 위치로 되돌렸습니다."
          : `${nextName} 이름으로 복원했습니다.`,
      title: `${target.name} 복원됨`,
      tone: "success",
    });
  };

  const permanentlyDeleteVfsEntry = (itemId: string) => {
    const target = trashedItems.find((item) => item.id === itemId);
    if (!target) return;

    const deletedIds = new Set(
      desktopItems
        .filter((item) => item.id === itemId || item.trashedRootId === itemId)
        .map((item) => item.id),
    );
    playSound("close");
    setDesktopItems((current) => current.filter((item) => !deletedIds.has(item.id)));
    notify({
      detail: "이 항목을 완전히 삭제했습니다.",
      title: `${target.name} 영구 삭제됨`,
      tone: "success",
    });
  };

  const emptyRecycleBin = () => {
    if (trashedItems.length === 0) {
      notify({
        detail: "삭제된 항목이 없습니다.",
        title: "휴지통이 비어 있음",
      });
      return;
    }

    const deletedCount = trashedItems.length;
    playSound("close");
    setDesktopItems((current) => current.filter((item) => !item.trashed));
    notify({
      detail: `${deletedCount}개 항목을 완전히 삭제했습니다.`,
      title: "휴지통 비움",
      tone: "success",
    });
  };

  const exportVfsZip = () => {
    playSound("success");
    const zip = createVfsBackupZip(desktopItems);
    const blob = new Blob([zip], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pocket-desk-vfs-${dateStamp}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify({
      detail: `${desktopItems.length}개 항목을 ZIP 백업으로 내보냈습니다.`,
      title: "ZIP 내보내기 완료",
      tone: "success",
    });
  };

  const importVfsZip = async (file: File) => {
    const importedItems = await readVfsBackupZip(file, (item, index) =>
      normalizePersistedDesktopItem(item as PersistedDesktopItem, index),
    );
    const migratedItems = migrateVfsHierarchy(importedItems);
    const activeImportedItems = migratedItems.filter((item) => !item.trashed);
    playSound("success");
    setDesktopItems(migratedItems);
    setActiveNoteId(
      activeImportedItems.find((item) => item.kind === "note")?.id ?? VFS_PRIMARY_NOTE_ID,
    );
    setActiveCanvasId(
      activeImportedItems.find((item) => item.kind === "canvas")?.id ?? VFS_PRIMARY_CANVAS_ID,
    );
    setActiveCanvasOpenKey((current) => current + 1);
    notify({
      detail: `${migratedItems.length}개 항목을 가져왔습니다.`,
      title: "ZIP 가져오기 완료",
      tone: "success",
    });
  };

  const saveNoteContent = (noteId: string, content: string) => {
    const now = Date.now();
    if (noteId === VFS_PRIMARY_NOTE_ID) {
      localStorage.setItem(NOTE_KEY, content);
    }
    setDesktopItems((current) => {
      const exists = current.some((item) => item.id === noteId);
      if (exists) {
        return current.map((item) =>
          item.id === noteId ? { ...item, content, updatedAt: now } : item,
        );
      }

      return [
        ...current,
        {
          content,
          createdAt: now,
          id: noteId,
          kind: "note",
          name: noteId === VFS_PRIMARY_NOTE_ID ? "notes.txt" : "새 메모.txt",
          parentId: VFS_DOCUMENTS_ID,
          showOnDesktop: false,
          updatedAt: now,
          x: 0,
          y: 0,
        },
      ];
    });
  };

  const saveNoteAs = (
    parentId: string,
    name: string,
    content: string,
    existingItemId?: string,
    options?: { activate?: boolean },
  ) => {
    /*
     * activate=false is the terminal's path: `echo x > 파일.txt` must write the
     * file the way cmd does — silently — not switch Notepad's open document to
     * it and raise a toast per redirect.
     */
    const activate = options?.activate ?? true;
    const now = Date.now();
    const existing = existingItemId
      ? activeDesktopItems.find((item) => item.id === existingItemId && item.kind === "note")
      : undefined;
    if (existing) {
      const updatedItem: DesktopItem = {
        ...existing,
        content,
        name,
        parentId,
        updatedAt: now,
      };
      setDesktopItems((current) =>
        current.map((item) => (item.id === existing.id ? updatedItem : item)),
      );
      if (activate) {
        setActiveNoteId(existing.id);
        notify({
          detail: "기존 문서의 내용을 새 내용으로 바꿨습니다.",
          title: `${name} 저장됨`,
          tone: "success",
        });
      }
      return updatedItem;
    }

    const item: DesktopItem = {
      content,
      createdAt: now,
      id: `note-${crypto.randomUUID()}`,
      kind: "note",
      name: getUniqueVfsEntryName(activeDesktopItems, parentId, name),
      parentId,
      showOnDesktop: false,
      updatedAt: now,
      x: 0,
      y: 0,
    };
    setDesktopItems((current) => [...current, item]);
    if (activate) {
      setActiveNoteId(item.id);
      notify({
        detail: "선택한 폴더에 새 문서를 저장했습니다.",
        title: `${item.name} 저장됨`,
        tone: "success",
      });
    }
    return item;
  };

  /** The wizard's confirm: an already-validated http(s) target becomes a desktop icon. */
  const createDesktopShortcut = (rawName: string, target: string) => {
    const origin = shortcutDialogOrigin ?? { x: 24, y: 24 };
    const position = nextDesktopIconPosition(origin.x, origin.y);
    const fallbackName = (() => {
      try {
        return new URL(target).hostname;
      } catch {
        return "바로 가기";
      }
    })();
    const cleanName = sanitizeVfsFileName(rawName, fallbackName);
    const now = Date.now();
    const item: DesktopItem = {
      content: target,
      createdAt: now,
      id: `shortcut-${crypto.randomUUID()}`,
      kind: "shortcut",
      name: getUniqueVfsEntryName(activeDesktopItems, VFS_ROOT_ID, `${cleanName}.url`),
      parentId: VFS_ROOT_ID,
      showOnDesktop: true,
      updatedAt: now,
      ...position,
    };
    setDesktopItems((current) => [...current, item]);
    setShortcutDialogOrigin(null);
    setSelectedDesktopIds([`item:${item.id}`]);
    playSound("success");
    notify({
      detail: `${item.name} — 바탕 화면에 만들었습니다.`,
      title: "바로 가기 생성됨",
      tone: "success",
    });
  };

  /**
   * Creates a .url internet shortcut, the way Edge's 다운로드 saves a page's
   * address. The write side enforces the same http(s) rule the browser's read
   * side does — a shortcut the shell would refuse to open is refused here.
   */
  const createVfsShortcut = (parentId: string, name: string, target: string) => {
    const safeTarget = resolveShortcutTarget(target);
    if (!safeTarget) return null;
    const now = Date.now();
    const item: DesktopItem = {
      content: safeTarget,
      createdAt: now,
      id: `shortcut-${crypto.randomUUID()}`,
      kind: "shortcut",
      name: getUniqueVfsEntryName(activeDesktopItems, parentId, name),
      parentId,
      showOnDesktop: false,
      updatedAt: now,
      x: 0,
      y: 0,
    };
    setDesktopItems((current) => [...current, item]);
    return item;
  };

  const showDesktopContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".desktop-icon, .desktop-context-menu, .window-system-menu, .window-frame, .start-menu, .taskbar",
      )
    ) {
      return;
    }

    event.preventDefault();
    const originX = Number.isFinite(event.clientX) ? event.clientX : 18;
    const originY = Number.isFinite(event.clientY) ? event.clientY : 18;
    setStartOpen(false);
    setDesktopIconMenu(null);
    setWindowMenu(null);
    setDesktopMenu({
      ...clampContextMenuPosition(originX, originY),
      originX,
      originY,
    });
  };

  const focusWindow = (id: string) => {
    // Focusing a window on another virtual desktop follows it there.
    const target = windows.find((item) => item.id === id);
    if (target && target.desktopIndex !== activeDesktopIndex) {
      setActiveDesktopIndex(target.desktopIndex);
    }
    setWindows((current) => {
      const topZ = Math.max(1, ...current.map((item) => item.z));
      return current.map((item) =>
        item.id === id ? { ...item, minimized: false, z: topZ + 1 } : item,
      );
    });
  };

  const updateWindow = (id: string, patch: Partial<WindowInstance>) => {
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const openWindowSystemMenu = (event: React.MouseEvent<HTMLDivElement>, windowId: string) => {
    event.preventDefault();
    event.stopPropagation();
    focusWindow(windowId);
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setWindowMenu({
      windowId,
      ...clampWindowSystemMenuPosition(event.clientX, event.clientY),
    });
  };

  /*
   * Alt+Space is how Windows opens the system menu without a mouse. There was
   * no binding at all, and the ContextMenu key opened the desktop's menu, so
   * the menu — and 이동 / 크기 조정 with it — was unreachable from the keyboard.
   */
  const openWindowSystemMenuForKeyboard = (windowId: string) => {
    const target = windows.find((item) => item.id === windowId);
    if (!target) return;
    focusWindow(windowId);
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setWindowMenu({
      windowId,
      // Windows drops it at the top-left corner of the window, under the icon.
      ...clampWindowSystemMenuPosition(
        target.maximized ? 8 : target.x + 8,
        target.maximized ? 8 : target.y + 32,
      ),
    });
  };

  /*
   * Windows' 이동 / 크기 조정: the window enters a keyboard mode where the arrow
   * keys move it or one of its edges, Enter commits and Escape puts it back
   * where it was. With the eight resize handles hidden from assistive
   * technology, this was the only route left for a keyboard user — and it did
   * not exist, so a window could not be moved or resized without a mouse.
   */
  const beginWindowKeyboardDrag = (windowId: string, mode: "move" | "resize") => {
    const target = windows.find((item) => item.id === windowId);
    if (!target || target.maximized) return;
    setWindowMenu(null);
    focusWindow(windowId);
    setWindowKeyboardDrag({
      edge: null,
      mode,
      origin: {
        height: target.height,
        width: target.width,
        x: target.x,
        y: target.y,
      },
      windowId,
    });
  };

  const endWindowKeyboardDrag = (commit: boolean) => {
    // Read the state, then update — restoring inside the updater made the
    // updater impure and double-ran the restore under StrictMode.
    if (windowKeyboardDrag && !commit) {
      updateWindow(windowKeyboardDrag.windowId, windowKeyboardDrag.origin);
    }
    setWindowKeyboardDrag(null);
  };

  const restoreWindow = (id: string) => {
    playSound("toggle");
    cancelWindowMotion(id);
    updateWindow(id, { maximized: false, minimized: false });
  };

  const cancelWindowMotion = (id: string) => {
    const timer = windowMotionTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      windowMotionTimersRef.current.delete(id);
    }
    setWindowMotions((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const scheduleWindowMotion = (id: string, motion: WindowMotion, complete: () => void) => {
    const activeTimer = windowMotionTimersRef.current.get(id);
    if (activeTimer !== undefined) window.clearTimeout(activeTimer);

    setWindowMotions((current) => ({ ...current, [id]: motion }));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        windowMotionTimersRef.current.delete(id);
        complete();
        setWindowMotions((current) => {
          if (!current[id]) return current;
          const next = { ...current };
          delete next[id];
          return next;
        });
      },
      reduceMotion ? 0 : WINDOW_EXIT_MOTION_MS,
    );
    windowMotionTimersRef.current.set(id, timer);
  };

  /**
   * Apps that can lose work register a guard here. Every close path goes through
   * closeWindow — the title bar, Alt+F4, the system menu, the taskbar, Task
   * Manager's 작업 끝내기 — so one check covers all of them. An app that wants to
   * ask the user first returns false and calls closeWindow again once answered.
   */
  const registerCloseGuard = useCallback((windowId: string, guard: (() => boolean) | null) => {
    if (guard) closeGuardsRef.current.set(windowId, guard);
    else closeGuardsRef.current.delete(windowId);

    // An app only guards a close when it has work to lose, so the same signal
    // drives the title bar's unsaved marker. Callers pass this to an effect's
    // dependency list, so the identity has to stay stable.
    setUnsavedWindowIds((current) => {
      if (current.has(windowId) === Boolean(guard)) return current;
      const next = new Set(current);
      if (guard) next.add(windowId);
      else next.delete(windowId);
      return next;
    });
  }, []);

  /*
   * Both halves of this have to be stable or the caller loops: apps put it in an
   * effect's dependency list, so a fresh function every render re-runs the
   * effect, and `map` handing back a new array even when nothing changed
   * re-renders App. Together they crashed the shell with React's maximum update
   * depth as soon as a window that could not grow asked to — a maximized
   * Minesweeper, for one.
   */
  const growWindow = useCallback((id: string, delta: { width: number; height: number }) => {
    if (delta.width <= 0 && delta.height <= 0) return;
    setWindows((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (item.id !== id || item.maximized) return item;
        const maxWidth = Math.max(320, window.innerWidth - 16);
        const maxHeight = Math.max(240, window.innerHeight - APP_BAR_HEIGHT - 16);
        const width = Math.min(maxWidth, item.width + Math.max(0, delta.width));
        const height = Math.min(maxHeight, item.height + Math.max(0, delta.height));
        if (width === item.width && height === item.height) return item;
        changed = true;
        return {
          ...item,
          height,
          snapZone: undefined,
          width,
          // Growing off the right or bottom edge would push the window out of
          // reach, so it slides back inside the work area instead.
          x: clamp(item.x, 8, Math.max(8, window.innerWidth - width - 8)),
          y: clamp(item.y, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8)),
        };
      });
      return changed ? next : current;
    });
  }, []);

  /*
   * A reload or a closed tab takes the whole desktop with it, and React never
   * runs the unmount flush that saves a pending draft — so a drawing that had
   * not been saved was simply gone, with the title bar still showing its
   * asterisk. Windows cannot warn when a process is killed; a browser can, so
   * the same unsaved-work signal that guards the ✕ guards the page too.
   */
  useEffect(() => {
    if (unsavedWindowIds.size === 0) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [unsavedWindowIds]);

  /*
   * The Event Viewer reads this log instead of mirroring the open-window list,
   * so a record outlives the window it describes and its text stays what it
   * said when it was written.
   */
  const logShellEvent = (
    channel: "security" | "system",
    eventId: number,
    source: string,
    taskCategory: string,
    detail: string,
  ) => {
    const record = createShellEvent({
      channel,
      detail,
      eventId,
      level: "information",
      source,
      taskCategory,
    });
    setShellEventLog((current) => appendShellEvent(current, record));
  };

  const closeWindow = (id: string) => {
    const guard = closeGuardsRef.current.get(id);
    if (guard) {
      // The save prompt renders inside the window it guards. Asking a
      // minimized window — or one on another desktop — put the question in a
      // visibility:hidden subtree: nothing on screen, the close silently
      // refused, Task Manager appearing to do nothing.
      surfaceWindowForPrompt(id);
      if (!guard()) return;
    }

    closeGuardsRef.current.delete(id);
    setUnsavedWindowIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    const closing = windows.find((item) => item.id === id);
    // The window stays listed for its 150ms closing animation, so holding
    // Alt+F4 logged the same window's end once per key repeat.
    if (closing && !closingLoggedRef.current.has(id)) {
      closingLoggedRef.current.add(id);
      const app = getApp(closing.appId);
      logShellEvent(
        "system",
        SHELL_EVENT_PROCESS_ENDED,
        app.title,
        "프로세스 종료",
        `"${formatWindowTitle(app.title, getWindowDocumentLabel(closing.appId))}" 창이 닫혔습니다.\n앱: ${app.title}\n창 ID: ${closing.id}`,
      );
    }
    playSound("close");
    setWindowMenu(null);
    scheduleWindowMotion(id, "closing", () => {
      setWindows((current) => current.filter((item) => item.id !== id));
    });
  };

  /**
   * Minimizing hides a visibility:hidden subtree; focus left inside it falls
   * to <body> and the next Tab restarts from the top of the page. Hand focus
   * to the app's own taskbar button — but only when focus was actually inside
   * the window being hidden, so a pointer user's focus is never stolen.
   */
  const moveFocusOutOfWindow = (windowId: string, appId?: AppId) => {
    const frame = document.querySelector(`[data-window-id="${windowId}"]`);
    const active = document.activeElement;
    if (!frame || !active || !frame.contains(active)) return;
    const fallback =
      (appId && document.querySelector<HTMLElement>(`.taskbar-app[data-app-id="${appId}"]`)) ||
      document.querySelector<HTMLElement>(".desktop-icon[tabindex='0']");
    fallback?.focus();
  };

  const minimizeWindow = (id: string) => {
    playSound("minimize");
    setWindowMenu(null);
    moveFocusOutOfWindow(id, windows.find((item) => item.id === id)?.appId);
    scheduleWindowMotion(id, "minimizing", () => {
      updateWindow(id, { minimized: true });
    });
  };

  const toggleMaximize = (id: string) => {
    playSound("toggle");
    setWindowMenu(null);
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, maximized: !item.maximized } : item)),
    );
  };

  const toggleFromTaskbar = (id: string) => {
    const target = windows.find((item) => item.id === id);
    const topVisibleId = windows
      .filter((item) => !item.minimized)
      .sort((a, b) => b.z - a.z)[0]?.id;

    if (target && !target.minimized && topVisibleId === id) {
      minimizeWindow(id);
      return;
    }

    playSound("click");
    cancelWindowMotion(id);
    // Task View no longer covers the taskbar, so a click here used to focus a
    // window that stayed hidden behind the overlay.
    setTaskViewOpen(false);
    focusWindow(id);
  };

  const switchDesktop = (index: number) => {
    const next = clamp(index, 0, desktopCount - 1);
    if (next === activeDesktopIndex) return;
    playSound("toggle");
    setActiveDesktopIndex(next);
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setWindowMenu(null);
    setAltTabWindowId(null);
  };

  const addDesktop = () => {
    if (desktopCount >= MAX_VIRTUAL_DESKTOPS) {
      notify({
        detail: `데스크톱은 최대 ${MAX_VIRTUAL_DESKTOPS}개까지 만들 수 있습니다.`,
        title: "데스크톱을 더 만들 수 없음",
      });
      return;
    }
    playSound("success");
    setStoredDesktopCount(desktopCount + 1);
    setActiveDesktopIndex(desktopCount);
  };

  /** Closing a desktop hands its windows to the desktop on its left, like Windows. */
  const closeDesktop = (index: number) => {
    if (desktopCount <= 1) return;
    playSound("close");
    const fallback = Math.max(0, index - 1);
    setWindows((current) =>
      current.map((item) => {
        if (item.desktopIndex === index) return { ...item, desktopIndex: fallback };
        return item.desktopIndex > index
          ? { ...item, desktopIndex: item.desktopIndex - 1 }
          : item;
      }),
    );
    setStoredDesktopCount(desktopCount - 1);
    setActiveDesktopIndex((current) =>
      clamp(current > index ? current - 1 : current, 0, desktopCount - 2),
    );
  };

  const moveWindowToDesktop = (windowId: string, index: number) => {
    const target = clamp(index, 0, desktopCount - 1);
    playSound("toggle");
    updateWindow(windowId, { desktopIndex: target });
  };

  /** The half opposite a left/right snap, where Snap Assist offers the rest. */
  const getOppositeSnapZone = (zone: SnapZone): SnapZone | null => {
    if (zone === "left") return "right";
    if (zone === "right") return "left";
    return null;
  };

  const snapWindow = (id: string, zone: SnapZone) => {
    playSound("toggle");
    updateWindow(id, { ...getWindowSnapPatch(zone), snapZone: zone });

    const opposite = getOppositeSnapZone(zone);
    const hasCandidate = desktopWindows.some(
      (item) => item.id !== id && !item.maximized && item.snapZone !== opposite,
    );
    setSnapAssistZone(opposite && hasCandidate ? opposite : null);
  };

  const getSnapAssistCandidates = (zone: SnapZone) =>
    desktopWindows
      .filter((item) => !item.maximized && item.snapZone !== getOppositeSnapZone(zone))
      .sort((first, second) => second.z - first.z);

  /**
   * Windows-style Win+Arrow stepping: a half-snapped window narrows to a
   * quarter, an unsnapped one snaps or maximizes, and Down unwinds the chain.
   */
  const stepWindowSnap = (id: string, key: string) => {
    const target = windows.find((item) => item.id === id);
    if (!target) return;
    const zone = target.snapZone;
    const onLeft = zone === "left" || zone === "top-left" || zone === "bottom-left";
    const onRight = zone === "right" || zone === "top-right" || zone === "bottom-right";

    if (key === "ArrowLeft") {
      if (zone === "top-right") return snapWindow(id, "top-left");
      if (zone === "bottom-right") return snapWindow(id, "bottom-left");
      return snapWindow(id, "left");
    }

    if (key === "ArrowRight") {
      if (zone === "top-left") return snapWindow(id, "top-right");
      if (zone === "bottom-left") return snapWindow(id, "bottom-right");
      return snapWindow(id, "right");
    }

    if (key === "ArrowUp") {
      if (zone === "bottom-left") return snapWindow(id, "left");
      if (zone === "bottom-right") return snapWindow(id, "right");
      if (onLeft) return snapWindow(id, "top-left");
      if (onRight) return snapWindow(id, "top-right");
      if (!target.maximized) {
        playSound("toggle");
        updateWindow(id, { maximized: true, minimized: false, snapZone: "top" });
      }
      return;
    }

    if (key !== "ArrowDown") return;

    if (target.maximized) {
      playSound("toggle");
      updateWindow(id, { maximized: false, snapZone: undefined });
      return;
    }
    if (zone === "top-left") return snapWindow(id, "bottom-left");
    if (zone === "top-right") return snapWindow(id, "bottom-right");
    if (onLeft || onRight) {
      playSound("toggle");
      updateWindow(id, { snapZone: undefined });
      return;
    }
    minimizeWindow(id);
  };

  const toggleShowDesktop = () => {
    playSound("toggle");
    setStartOpen(false);
    setRunOpen(false);
    setDesktopIconMenu(null);
    setDesktopMenu(null);
    const visibleIds = desktopWindows.filter((item) => !item.minimized).map((item) => item.id);
    if (visibleIds.length > 0) {
      showDesktopRestoreRef.current = visibleIds;
      visibleIds.forEach((id) => {
        moveFocusOutOfWindow(id);
        scheduleWindowMotion(id, "minimizing", () => updateWindow(id, { minimized: true }));
      });
      return;
    }

    const restoreIds = new Set(showDesktopRestoreRef.current);
    if (restoreIds.size === 0) return;
    restoreIds.forEach(cancelWindowMotion);
    setWindows((current) => {
      let nextZ = Math.max(12, ...current.map((item) => item.z));
      return current.map((item) =>
        restoreIds.has(item.id) ? { ...item, minimized: false, z: (nextZ += 1) } : item,
      );
    });
    showDesktopRestoreRef.current = [];
  };

  const availableApps = appCatalog;
  const startSearchResults = useMemo(
    () => buildStartSearchResults(query, activeDesktopItems, availableApps),
    [activeDesktopItems, availableApps, query],
  );
  const recentStartItems = useMemo(() => {
    return activeDesktopItems
      .filter(
        (item) => item.kind === "note" || item.kind === "canvas" || item.kind === "folder",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);
  }, [activeDesktopItems]);
  const desktopCount = getVirtualDesktopCount(windows, storedDesktopCount);
  const desktopWindows = useMemo(
    () => windows.filter((item) => item.desktopIndex === activeDesktopIndex),
    [activeDesktopIndex, windows],
  );
  const activeWindowId = desktopWindows
    .filter((item) => !item.minimized)
    .sort((a, b) => b.z - a.z)[0]?.id;
  /**
   * Windows titles a window after the document, not the program: `notes.txt -
   * 메모장`. The same string is what Alt+Tab and the taskbar preview show, so it
   * is resolved once here and handed to all three.
   */
  const getWindowDocumentLabel = (appId: AppId) => {
    // What the app says it is showing wins; the ids below are only the shell's
    // opening guess, and an app that navigates on its own leaves them behind.
    const reported = reportedDocuments[appId];
    if (reported) {
      const match = activeDesktopItems.find((item) => item.id === reported);
      if (match) return match.name;
    }
    if (appId === "notepad") {
      return activeDesktopItems.find((item) => item.id === activeNoteId)?.name;
    }
    if (appId === "paint" || appId === "photos") {
      return activeDesktopItems.find((item) => item.id === activeCanvasId)?.name;
    }
    return undefined;
  };

  const openWindows = useMemo<OpenWindowInfo[]>(
    () =>
      windows.map((item) => ({
        appId: item.appId,
        id: item.id,
        maximized: item.maximized,
        minimized: item.minimized,
        // Windows' Task Manager lists window titles, so two windows of one app
        // can be told apart before one of them is ended. This listed the app
        // name, leaving two identical rows.
        title: formatWindowTitle(getApp(item.appId).title, getWindowDocumentLabel(item.appId)),
      })),
    // getWindowDocumentLabel closes over the item list and the reported ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCanvasId, activeDesktopItems, activeNoteId, reportedDocuments, windows],
  );
  const windowMenuInstance = windowMenu
    ? windows.find((item) => item.id === windowMenu.windowId)
    : null;

  const beginDesktopPointerAction = (event: React.PointerEvent<HTMLElement>) => {
    setStartOpen(false);
    setRunOpen(false);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setWindowMenu(null);

    if (shellPhase !== "unlocked" || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".desktop-icon, .desktop-context-menu, .window-system-menu, .window-frame, .start-menu, .taskbar, .shell-gate, .toast-stack, .pwa-update-prompt, .task-view, .alt-tab-switcher, .snap-assist",
      )
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const nextSelection = {
      currentX: event.clientX,
      currentY: event.clientY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setSelectedDesktopIds([]);
    desktopSelectionRef.current = nextSelection;
    setDesktopSelection(nextSelection);
  };

  const updateDesktopSelection = (event: React.PointerEvent<HTMLElement>) => {
    const current = desktopSelectionRef.current;
    if (!current || current.pointerId !== event.pointerId) return;

    const nextSelection = {
      ...current,
      currentX: event.clientX,
      currentY: event.clientY,
    };
    desktopSelectionRef.current = nextSelection;
    setDesktopSelection(nextSelection);
    setSelectedDesktopIds(
      getDesktopSelectionIds(nextSelection, iconLayout, activeDesktopItems, desktopViewMode),
    );
  };

  const finishDesktopSelection = (event: React.PointerEvent<HTMLElement>) => {
    const surface = event.currentTarget;
    if (surface.hasPointerCapture(event.pointerId)) {
      surface.releasePointerCapture(event.pointerId);
    }

    const current = desktopSelectionRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!isDesktopSelectionVisible(current)) setSelectedDesktopIds([]);
    desktopSelectionRef.current = null;
    setDesktopSelection(null);
  };

  const openRunDialog = () => {
    playSound("toggle");
    setStartOpen(false);
    setDesktopMenu(null);
    setDesktopIconMenu(null);
    setWindowMenu(null);
    setRunOpen(true);
  };

  const executeRunCommand = (command: string) => {
    const resolution = resolveRunCommand(command);

    if (resolution.kind === "unknown") {
      playSound("close");
      notify({
        detail: resolution.value
          ? `"${resolution.value}" 명령을 찾을 수 없습니다.`
          : "실행할 명령을 입력하세요.",
        title: "Run 명령 실패",
      });
      return;
    }

    setRunOpen(false);

    if (resolution.kind === "browser") {
      setBrowserLaunchRequest({ id: crypto.randomUUID(), value: resolution.value });
      openApp("browser");
      notify({
        detail: resolution.value,
        title: "Microsoft Edge에서 열기",
        tone: "success",
      });
      return;
    }

    openApp(resolution.appId);
  };

  useEffect(() => {
    const clearAltTab = () => {
      altTabOrderRef.current = [];
      altTabSelectionRef.current = null;
      setAltTabWindowId(null);
    };

    /** Releasing Alt is what switches windows; Escape abandons the selection. */
    const commitAltTab = () => {
      const selectedId = altTabSelectionRef.current;
      clearAltTab();
      if (selectedId) focusWindow(selectedId);
    };

    /*
     * Windows freezes the window list while Alt is held and moves a selection
     * through it, switching only on release. Focusing on every press instead
     * raised the selected window to the top of the z-order, so re-sorting by z
     * put it back at index 0 and Tab bounced between the two newest windows —
     * with four open, eight presses reached two of them.
     */
    const cycleAltTab = (reverse: boolean) => {
      const liveIds = new Set(desktopWindows.map((item) => item.id));
      const heldOrder = altTabOrderRef.current.filter((id) => liveIds.has(id));
      const order =
        heldOrder.length > 0
          ? heldOrder
          : [...desktopWindows].sort((a, b) => b.z - a.z).map((item) => item.id);
      if (order.length === 0) return;
      altTabOrderRef.current = order;

      const currentId = altTabSelectionRef.current ?? activeWindowId;
      const currentIndex = currentId ? order.indexOf(currentId) : -1;
      const direction = reverse ? -1 : 1;
      const nextIndex =
        currentIndex === -1 ? 0 : (currentIndex + direction + order.length) % order.length;

      altTabSelectionRef.current = order[nextIndex];
      setAltTabWindowId(order[nextIndex]);
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (shellPhase !== "unlocked") return;
      const target = event.target;
      const editingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.metaKey && event.ctrlKey && event.key.startsWith("Arrow")) {
        const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (step !== 0) {
          event.preventDefault();
          switchDesktop(activeDesktopIndex + step);
          return;
        }
      }

      if (event.metaKey && !event.ctrlKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (event.key === "Tab") {
          event.preventDefault();
          setTaskViewOpen((current) => !current);
          return;
        }
        if (key === "e") {
          event.preventDefault();
          openApp("files");
          return;
        }
        if (key === "r") {
          event.preventDefault();
          openRunDialog();
          return;
        }
        if (key === "d") {
          event.preventDefault();
          toggleShowDesktop();
          return;
        }
        if (key === "i") {
          event.preventDefault();
          openApp("settings");
          return;
        }
        if (key === "m") {
          event.preventDefault();
          minimizeAllWindows();
          return;
        }
        if (key === "l") {
          event.preventDefault();
          lockDesktop();
          return;
        }
        if (event.key.startsWith("Arrow") && activeWindowId) {
          event.preventDefault();
          stepWindowSnap(activeWindowId, event.key);
          return;
        }
      }

      if (event.ctrlKey && event.shiftKey && event.key === "Escape") {
        event.preventDefault();
        openApp("taskmanager");
        return;
      }

      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        openRunDialog();
        return;
      }

      if (event.altKey && event.key === "F4" && activeWindowId) {
        event.preventDefault();
        closeWindow(activeWindowId);
        return;
      }

      if (event.altKey && event.key === "Tab") {
        event.preventDefault();
        cycleAltTab(event.shiftKey);
        return;
      }

      if (event.altKey && event.key === " " && activeWindowId) {
        event.preventDefault();
        openWindowSystemMenuForKeyboard(activeWindowId);
        return;
      }

      if (
        !editingText &&
        !activeWindowId &&
        !startOpen &&
        !runOpen &&
        !desktopPropertiesItemId
      ) {
        if (event.key === "Enter" && selectedDesktopIds.length > 0) {
          event.preventDefault();
          openSelectedDesktopTarget();
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          const key = event.key.toLowerCase();
          if (key === "c" || key === "x") {
            const itemIds = getSelectedDesktopItemIds();
            if (itemIds.length > 0) {
              event.preventDefault();
              copyDesktopItems(undefined, key === "x" ? "cut" : "copy");
              return;
            }
          }
          if (key === "v" && clipboard.itemIds.length > 0) {
            event.preventDefault();
            pasteDesktopItems();
            return;
          }
          if (key === "a") {
            event.preventDefault();
            selectAllDesktopItems();
            return;
          }
        }
        if (event.key === "Delete") {
          const itemIds = getSelectedDesktopItemIds();
          if (itemIds.length > 0) {
            event.preventDefault();
            deleteSelectedDesktopItems();
            return;
          }
        }
        if (event.key === "F2") {
          const itemIds = getSelectedDesktopItemIds();
          const item =
            itemIds.length === 1
              ? activeDesktopItems.find((entry) => entry.id === itemIds[0])
              : undefined;
          if (item) {
            event.preventDefault();
            beginDesktopRename(item);
            return;
          }
        }
      }

      /*
       * Undo and redo in the drawing app. The window frame holds focus, so a
       * handler inside the app never saw these — Ctrl+Z left the bitmap
       * untouched and the toolbar buttons were the only way back.
       */
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        const paintWindow = windows.find((item) => item.id === activeWindowId);
        if (paintWindow?.appId === "paint" && (key === "z" || key === "y")) {
          event.preventDefault();
          const redo = key === "y" || (key === "z" && event.shiftKey);
          window.dispatchEvent(new Event(redo ? PAINT_REDO_EVENT : PAINT_UNDO_EVENT));
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        const activeWindow = windows.find((item) => item.id === activeWindowId);
        if (activeWindow?.appId === "notepad" || activeWindow?.appId === "paint") {
          event.preventDefault();
          window.dispatchEvent(
            new Event(activeWindow.appId === "notepad" ? NOTE_OPEN_EVENT : PAINT_OPEN_EVENT),
          );
        }
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        const activeWindow = windows.find((item) => item.id === activeWindowId);
        if (activeWindow?.appId === "notepad" || activeWindow?.appId === "paint") {
          event.preventDefault();
          window.dispatchEvent(
            new Event(
              activeWindow.appId === "notepad" ? NOTE_SAVE_AS_EVENT : PAINT_SAVE_AS_EVENT,
            ),
          );
        }
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        const activeWindow = windows.find((item) => item.id === activeWindowId);
        if (activeWindow?.appId === "notepad") {
          window.dispatchEvent(new Event(NOTE_SAVE_EVENT));
        } else if (activeWindow?.appId === "paint") {
          window.dispatchEvent(new Event(PAINT_SAVE_EVENT));
        } else if (activeWindow) {
          notify({
            detail: `${getApp(activeWindow.appId).title}는 아직 단축키 저장을 지원하지 않습니다.`,
            title: "저장할 수 없음",
          });
        }
        return;
      }

      if (event.ctrlKey && event.altKey && activeWindowId) {
        const snapZone =
          event.key === "ArrowLeft"
            ? "left"
            : event.key === "ArrowRight"
              ? "right"
              : event.key === "ArrowUp"
                ? "top"
                : null;
        if (snapZone) {
          event.preventDefault();
          snapWindow(activeWindowId, snapZone);
          return;
        }
      }

      if (event.key === "Escape") {
        if (desktopPropertiesItemId) {
          event.preventDefault();
          setDesktopPropertiesItemId(null);
          return;
        }
        if (desktopRenamingItemId) {
          event.preventDefault();
          cancelDesktopRename();
          return;
        }
        if (desktopIconMenu) {
          event.preventDefault();
          setDesktopIconMenu(null);
          return;
        }
        if (runOpen) {
          event.preventDefault();
          setRunOpen(false);
          return;
        }
        if (windowMenu) {
          event.preventDefault();
          setWindowMenu(null);
          return;
        }
        if (taskViewOpen) {
          event.preventDefault();
          setTaskViewOpen(false);
          return;
        }
        if (snapAssistZone) {
          event.preventDefault();
          setSnapAssistZone(null);
          return;
        }
        if (altTabWindowId) {
          event.preventDefault();
          clearAltTab();
          return;
        }
        if (desktopMenu) {
          event.preventDefault();
          setDesktopMenu(null);
          return;
        }
        if (startOpen) {
          event.preventDefault();
          setStartOpen(false);
          setQuery("");
        }
      }
    };

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        commitAltTab();
      }
    };

    /*
     * The keyup is what commits Alt+Tab — but it never arrives when focus
     * leaves the page mid-hold. An idle timer used to stand in for it, which
     * meant holding Alt for 1.2 seconds committed by itself, threw the frozen
     * window order away, and brought the two-window bounce back for the rest
     * of the hold. Losing the page is the only real signal a keyup was lost.
     */
    const commitAltTabOnLostFocus = () => {
      if (altTabSelectionRef.current) commitAltTab();
    };
    const commitAltTabOnHide = () => {
      if (document.visibilityState === "hidden") commitAltTabOnLostFocus();
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    window.addEventListener("blur", commitAltTabOnLostFocus);
    document.addEventListener("visibilitychange", commitAltTabOnHide);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
      window.removeEventListener("blur", commitAltTabOnLostFocus);
      document.removeEventListener("visibilitychange", commitAltTabOnHide);
    };
  }, [
    // Missing from this list, the handler kept the values it closed over on
    // mount: Ctrl+V on the desktop always saw an empty clipboard and did
    // nothing, and Win+Ctrl+Right always tried to switch away from desktop 1.
    activeDesktopIndex,
    activeDesktopItems,
    activeWindowId,
    altTabWindowId,
    clipboard,
    windowKeyboardDrag,
    desktopIconMenu,
    desktopMenu,
    desktopPropertiesItemId,
    desktopRenamingItemId,
    runOpen,
    selectedDesktopIds,
    snapAssistZone,
    taskViewOpen,
    shellPhase,
    startOpen,
    windowMenu,
    windows,
  ]);

  /*
   * One tab stop for the whole icon field, the way Windows treats it: the
   * selected icon when there is one, otherwise the first. Every icon carried
   * tabindex 0 before, so Tab had to walk all of them to leave the desktop.
   */
  const desktopIconIds = [
    ...desktopApps.map((app) => `app:${app.id}`),
    ...activeDesktopItems.filter((item) => item.showOnDesktop).map((item) => `item:${item.id}`),
  ];
  // A selection can outlive the icon it names — the file is deleted, or moved
  // into a folder — and pointing the only tab stop at it took the whole icon
  // field out of the tab order.
  const desktopTabStopId =
    desktopIconIds.find((id) => selectedDesktopIds.includes(id)) ?? desktopIconIds[0] ?? null;

  /*
   * Windows' 이동 / 크기 조정 is modal: while it runs, the arrow keys belong to
   * the move loop and the app underneath never sees them. Handling this in the
   * bubbling shortcut handler let a focused app eat the keys first — the
   * calculator binds Escape to clear and stops propagation, so the mode could
   * neither be cancelled nor committed while its window held focus. A
   * capture-phase listener runs before any app handler and stops the event
   * there.
   */
  /*
   * The mode's target can vanish under it — Alt+F4, Task Manager's 작업
   * 끝내기, a desktop switch. The capture listener kept eating every arrow key
   * for a window that no longer existed, with the hint still on screen.
   */
  useEffect(() => {
    if (!windowKeyboardDrag) return;
    const target = windows.find((item) => item.id === windowKeyboardDrag.windowId);
    if (!target || target.desktopIndex !== activeDesktopIndex || target.minimized) {
      setWindowKeyboardDrag(null);
    }
  }, [activeDesktopIndex, windowKeyboardDrag, windows]);

  useEffect(() => {
    if (!windowKeyboardDrag) return;

    const handleDragKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        endWindowKeyboardDrag(false);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        endWindowKeyboardDrag(true);
        return;
      }
      if (!event.key.startsWith("Arrow")) return;

      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 1 : WINDOW_KEYBOARD_STEP;
      const target = windows.find((item) => item.id === windowKeyboardDrag.windowId);
      if (!target) return;

      if (windowKeyboardDrag.mode === "move") {
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        updateWindow(target.id, {
          snapZone: undefined,
          x: clamp(target.x + dx, 8, Math.max(8, window.innerWidth - target.width - 8)),
          y: clamp(
            target.y + dy,
            8,
            Math.max(8, window.innerHeight - APP_BAR_HEIGHT - target.height - 8),
          ),
        });
        return;
      }

      // Windows picks the edge with the first arrow, then moves that edge.
      const edge =
        windowKeyboardDrag.edge ??
        (event.key === "ArrowUp"
          ? "top"
          : event.key === "ArrowDown"
            ? "bottom"
            : event.key === "ArrowLeft"
              ? "left"
              : "right");
      if (!windowKeyboardDrag.edge) {
        setWindowKeyboardDrag((current) => (current ? { ...current, edge } : current));
        return;
      }
      updateWindow(target.id, {
        ...resizeWindowEdge(target, edge, event.key, step),
        snapZone: undefined,
      });
    };

    window.addEventListener("keydown", handleDragKey, true);
    return () => window.removeEventListener("keydown", handleDragKey, true);
    // updateWindow and endWindowKeyboardDrag are stable enough per render; the
    // listener re-binds whenever the drag state or window list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKeyboardDrag, windows]);

  const openStartSearchResult = (result: StartSearchResult) => {
    if (result.kind === "app") {
      openApp(result.appId);
    } else {
      openDesktopItem(result.item);
    }
  };

  return (
    <main
      className={`desktop desktop-view-${desktopViewMode} theme-${theme} wallpaper-${wallpaper} ${
        shellPhase === "unlocked" ? "is-unlocked" : ""
      }`}
      onContextMenu={showDesktopContextMenu}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(VFS_DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={dropEntriesOntoDesktop}
      onPointerCancel={finishDesktopSelection}
      onPointerDown={beginDesktopPointerAction}
      onPointerMove={updateDesktopSelection}
      onPointerUp={finishDesktopSelection}
      style={
        {
          ...getWallpaperStyle(wallpaper),
          "--display-dim": ((100 - displayBrightness) / 100) * 0.7,
        } as WallpaperCssVars
      }
    >
      <section
        aria-label="바탕화면 바로가기"
        className="desktop-icons"
        onKeyDown={(event) => {
          if (!DESKTOP_ICON_NAV_KEYS.includes(event.key)) return;
          /*
           * The rename field sits inside this grid but is not an icon, so an
           * arrow press while renaming moved focus to an icon instead of the
           * caret — and the blur committed the half-typed name.
           */
          const editing = event.target;
          if (
            editing instanceof HTMLInputElement ||
            editing instanceof HTMLTextAreaElement ||
            (editing instanceof HTMLElement && editing.isContentEditable)
          ) {
            return;
          }
          const icons = [...event.currentTarget.querySelectorAll<HTMLElement>(".desktop-icon")];
          const currentIndex = icons.findIndex(
            (node) => node === document.activeElement || node.contains(document.activeElement),
          );
          const target = getNeighbourByPosition(icons, currentIndex, event.key);
          if (!target) return;
          // Arrow keys and Home/End did nothing here: every icon was its own tab
          // stop and there was no arrow handling at all.
          event.preventDefault();
          target.focus({ preventScroll: true });
        }}
      >
        {desktopApps.map((app) => (
          <DesktopIcon
            key={app.id}
            app={app}
            onContextMenu={(event) =>
              showDesktopIconContextMenu(event, { appId: app.id, kind: "app" })
            }
            onMove={(position) => moveDesktopIcon(app.id, position)}
            onOpen={() => openApp(app.id)}
            onSelect={(event) => selectDesktopTarget(`app:${app.id}`, event)}
            position={iconLayout[app.id] ?? createDefaultIconLayout()[app.id]!}
            selected={selectedDesktopIds.includes(`app:${app.id}`)}
            tabStop={desktopTabStopId === `app:${app.id}`}
          />
        ))}
        {activeDesktopItems
          .filter((item) => item.showOnDesktop)
          .map((item) => (
            <DesktopItemIcon
              draftName={desktopRenameDraft}
              item={item}
              key={item.id}
              onCancelRename={cancelDesktopRename}
              onChangeDraftName={setDesktopRenameDraft}
              onCommitRename={commitDesktopRename}
              onContextMenu={(event) =>
                showDesktopIconContextMenu(event, { itemId: item.id, kind: "item" })
              }
              onDropIntoFolder={(folderId) => {
                if (folderId === VFS_ROOT_ID) return;
                moveVfsEntries([item.id], folderId);
              }}
              onMove={(position) => moveDesktopItem(item.id, position)}
              onOpen={() => openDesktopItem(item)}
              onSelect={(event) => selectDesktopTarget(`item:${item.id}`, event)}
              renaming={desktopRenamingItemId === item.id}
              selected={selectedDesktopIds.includes(`item:${item.id}`)}
              tabStop={desktopTabStopId === `item:${item.id}`}
              viewMode={desktopViewMode}
            />
          ))}
      </section>

      {desktopSelection && isDesktopSelectionVisible(desktopSelection) && (
        <div
          aria-hidden="true"
          className="desktop-selection"
          style={getDesktopSelectionStyle(desktopSelection)}
        />
      )}

      <section className="window-layer" aria-label="열린 창">
        {desktopWindows.map((item) => {
          const app = getApp(item.appId);
          const AppContent = app.component;

          return (
            <WindowFrame
              key={item.id}
              app={app}
              active={activeWindowId === item.id}
              instance={item}
              motion={windowMotions[item.id]}
              onClose={() => closeWindow(item.id)}
              onFocus={() => focusWindow(item.id)}
              onMinimize={() => minimizeWindow(item.id)}
              onOpenSystemMenu={(event) => openWindowSystemMenu(event, item.id)}
              documentLabel={getWindowDocumentLabel(item.appId)}
              hasUnsavedChanges={unsavedWindowIds.has(item.id)}
              onSnapPreviewChange={setSnapPreview}
              onToggleMaximize={() => toggleMaximize(item.id)}
              onUpdate={(patch) => updateWindow(item.id, patch)}
            >
              <AppContent
                activeCanvasId={activeCanvasId}
                activeCanvasOpenKey={activeCanvasOpenKey}
                activeNoteId={activeNoteId}
                browserLaunchRequest={browserLaunchRequest}
                canvasEntries={canvasEntries}
                clipboard={clipboard}
                copyToClipboard={copyToClipboard}
                pasteFromClipboard={pasteFromClipboard}
                closeWindow={closeWindow}
                focusWindow={focusWindow}
                openWindows={openWindows}
                growWindow={growWindow}
                reportDocument={reportDocument}
                shellEvents={shellEventLog}
                registerCloseGuard={registerCloseGuard}
                createVfsFolder={createVfsFolder}
                onImportLocalEntries={(imported) =>
                  setDesktopItems((current) => [...current, ...imported])
                }
                createVfsTextFile={createVfsTextFile}
                desktopItems={activeDesktopItems}
                duplicateVfsEntries={duplicateVfsEntries}
                noteEntries={noteEntries}
                trashedItems={trashedItems}
                notify={notify}
                clockAlarms={clockAlarms}
                clockTimer={clockTimer}
                updateClockAlarms={setClockAlarms}
                updateClockTimer={setClockTimer}
                deleteVfsEntry={deleteVfsEntry}
                emptyRecycleBin={emptyRecycleBin}
                exportVfsZip={exportVfsZip}
                filesLaunchRequest={filesLaunchRequest}
                importVfsZip={importVfsZip}
                moveVfsEntries={moveVfsEntries}
                openApp={openApp}
                requestPowerAction={requestPowerAction}
                openNewAppWindow={openNewAppWindow}
                activateVfsEntry={activateVfsEntry}
                openVfsEntry={openVfsEntry}
                permanentlyDeleteVfsEntry={permanentlyDeleteVfsEntry}
                playSound={playSound}
                renameVfsEntry={renameVfsEntry}
                resetDesktopIconLayout={resetDesktopIconLayout}
                resetWindowLayout={resetWindowLayout}
                restoreVfsEntry={restoreVfsEntry}
                savePaintImage={savePaintImage}
                saveNoteAs={saveNoteAs}
                createVfsShortcut={createVfsShortcut}
                saveNoteContent={saveNoteContent}
                setSoundEnabled={toggleSoundEnabled}
                setTheme={changeTheme}
                setWallpaper={changeWallpaper}
                soundEnabled={soundEnabled}
                clock24h={clock24h}
                defaultApps={defaultApps}
                setClock24h={setClock24h}
                setDefaultApp={(extension, appId) =>
                  setDefaultApps((current) => ({ ...current, [extension]: appId }))
                }
                setUserName={setUserName}
                theme={theme}
                userName={userName}
                wallpaper={wallpaper}
                windowId={item.id}
              />
            </WindowFrame>
          );
        })}
      </section>

      {snapPreview && <SnapPreview zone={snapPreview.zone} />}

      {shellPhase === "unlocked" && snapAssistZone && (
        <SnapAssist
          candidates={getSnapAssistCandidates(snapAssistZone)}
          onDismiss={() => setSnapAssistZone(null)}
          onPick={(windowId) => {
            snapWindow(windowId, snapAssistZone);
            setSnapAssistZone(null);
          }}
          zone={snapAssistZone}
        />
      )}

      {windowMenu && windowMenuInstance && (
        <WindowSystemMenu
          app={getApp(windowMenuInstance.appId)}
          instance={windowMenuInstance}
          onClose={() => closeWindow(windowMenuInstance.id)}
          onDismiss={() => setWindowMenu(null)}
          onMaximize={() => {
            if (windowMenuInstance.maximized) {
              restoreWindow(windowMenuInstance.id);
              setWindowMenu(null);
            } else {
              toggleMaximize(windowMenuInstance.id);
            }
          }}
          onMinimize={() => minimizeWindow(windowMenuInstance.id)}
          onMove={() => beginWindowKeyboardDrag(windowMenuInstance.id, "move")}
          onResize={() => beginWindowKeyboardDrag(windowMenuInstance.id, "resize")}
          onRestore={() => {
            restoreWindow(windowMenuInstance.id);
            setWindowMenu(null);
          }}
          x={windowMenu.x}
          y={windowMenu.y}
        />
      )}

      {/*
       * Windows signals this mode by swapping the mouse cursor, which a web
       * page cannot do for the OS pointer. A status line says the same thing
       * and, being role=status, reaches a screen reader too.
       */}
      <div aria-live="polite" className="sr-only">
        {srAnnouncement}
      </div>
      {windowKeyboardDrag && (
        <p className="window-keyboard-drag-hint">
          {windowKeyboardDrag.mode === "move"
            ? "화살표로 창 이동 · Enter 확정 · Esc 취소"
            : windowKeyboardDrag.edge
              ? "화살표로 가장자리 이동 · Enter 확정 · Esc 취소"
              : "화살표로 조정할 가장자리 선택 · Esc 취소"}
        </p>
      )}

      <Taskbar
        activeDesktopIndex={activeDesktopIndex}
        activeWindowId={activeWindowId}
        availableApps={availableApps}
        desktopCount={desktopCount}
        onToggleTaskView={() => setTaskViewOpen((current) => !current)}
        taskViewOpen={taskViewOpen}
        notificationHistory={notificationHistory}
        brightness={displayBrightness}
        onClearNotifications={clearNotificationHistory}
        onOpenStart={(event) => {
          event.stopPropagation();
          setStartOpen((value) => !value);
        }}
        getDocumentLabel={getWindowDocumentLabel}
        onOpenApp={openApp}
        onOpenNewWindow={openNewAppWindow}
        onOpenRunDialog={openRunDialog}
        clock24h={clock24h}
        onSearch={(nextQuery) => {
          // The taskbar field and the Start menu field drive one search.
          setQuery(nextQuery);
          setStartOpen(true);
        }}
        searchQuery={query}
        onSetBrightness={setDisplayBrightness}
        onSetSoundEnabled={toggleSoundEnabled}
        onSetVolume={(volume) => {
          setSoundVolume(volume);
          // Dragging to zero mutes, and dragging away from zero unmutes — the
          // slider and the toggle describe one thing.
          setSoundEnabled(volume > 0);
        }}
        volume={soundVolume}
        onShowDesktop={toggleShowDesktop}
        onTogglePinnedApp={togglePinnedApp}
        onOpenRecentDocument={openVfsEntry}
        recentDocumentsByApp={recentDocumentsByApp}
        onCloseWindow={closeWindow}
        onToggleWindow={toggleFromTaskbar}
        pinnedAppIds={pinnedAppIds}
        soundEnabled={soundEnabled}
        startOpen={startOpen}
        windows={desktopWindows}
      />

      {startOpen && (
        <StartMenu
          apps={availableApps}
          onClose={() => {
            setStartOpen(false);
            setQuery("");
          }}
          onLock={lockDesktop}
          onOpenApp={openApp}
          onRestart={restartDesktop}
          onShutdown={shutdownDesktop}
          onPointerDown={(event) => event.stopPropagation()}
          onRecentItemOpen={openDesktopItem}
          onResultOpen={openStartSearchResult}
          query={query}
          recentItems={recentStartItems}
          results={startSearchResults}
          setQuery={setQuery}
          userName={userName}
        />
      )}

      {runOpen && <RunDialog onClose={() => setRunOpen(false)} onExecute={executeRunCommand} />}

      {shortcutDialogOrigin && (
        <ShortcutDialog
          onClose={() => setShortcutDialogOrigin(null)}
          onCreate={createDesktopShortcut}
        />
      )}

      {desktopMenu && (
        <DesktopContextMenu
          alignToGrid={alignDesktopIcons}
          currentSort={desktopSortKey}
          currentView={desktopViewMode}
          onChangeWallpaper={() => {
            setDesktopMenu(null);
            openApp("settings");
          }}
          onCreateFolder={() => createDesktopItem("folder")}
          onCreateNote={() => createDesktopItem("note")}
          onCreateShortcut={() => {
            const origin = desktopMenu ?? { originX: 24, originY: 24 };
            setShortcutDialogOrigin({ x: origin.originX, y: origin.originY });
            setDesktopMenu(null);
          }}
          onPaste={pasteDesktopItems}
          onRefresh={refreshDesktop}
          onSort={arrangeDesktopIcons}
          onToggleGrid={toggleDesktopGrid}
          onViewChange={changeDesktopView}
          pasteEnabled={clipboard.itemIds.length > 0}
          x={desktopMenu.x}
          y={desktopMenu.y}
        />
      )}

      {desktopIconMenu && (desktopContextItem || desktopContextApp) && (
        <DesktopIconContextMenu
          appPinned={
            desktopContextApp ? pinnedAppIds.includes(desktopContextApp.id) : undefined
          }
          itemSelectionCount={getSelectedDesktopItemIds(desktopContextItem?.id).length}
          onCopy={
            desktopContextItem ? () => copyDesktopItems(desktopContextItem.id) : undefined
          }
          onCut={
            desktopContextItem
              ? () => copyDesktopItems(desktopContextItem.id, "cut")
              : undefined
          }
          onMoveTo={
            desktopContextItem
              ? (folderId) => {
                  moveVfsEntries([desktopContextItem.id], folderId);
                  setDesktopIconMenu(null);
                }
              : undefined
          }
          onDelete={
            desktopContextItem
              ? () => deleteSelectedDesktopItems(desktopContextItem.id)
              : undefined
          }
          onOpen={() => {
            setDesktopIconMenu(null);
            if (desktopContextItem) openDesktopItem(desktopContextItem);
            if (desktopContextApp) openApp(desktopContextApp.id);
          }}
          onProperties={
            desktopContextItem
              ? () => {
                  setDesktopIconMenu(null);
                  setDesktopPropertiesItemId(desktopContextItem.id);
                }
              : undefined
          }
          onRename={
            desktopContextItem ? () => beginDesktopRename(desktopContextItem) : undefined
          }
          onTogglePin={
            desktopContextApp
              ? () => {
                  togglePinnedApp(desktopContextApp.id);
                  setDesktopIconMenu(null);
                }
              : undefined
          }
          target={
            desktopContextItem
              ? {
                  accent: getVfsEntryAssociation(desktopContextItem).accent,
                  icon: getVfsEntryAssociation(desktopContextItem).icon,
                  kind: "item",
                  title: desktopContextItem.name,
                }
              : {
                  accent: desktopContextApp!.accent,
                  icon: desktopContextApp!.icon,
                  kind: "app",
                  title: desktopContextApp!.title,
                }
          }
          x={desktopIconMenu.x}
          y={desktopIconMenu.y}
        />
      )}

      {desktopPropertiesItem && (
        <DesktopItemPropertiesDialog
          item={desktopPropertiesItem}
          onClose={() => setDesktopPropertiesItemId(null)}
        />
      )}

      {shellPhase !== "unlocked" && (
        <ShellGate
          clock24h={clock24h}
          userName={userName}
          onPowerOn={powerOnDesktop}
          onUnlock={unlockDesktop}
          phase={shellPhase}
          wallpaper={wallpaper}
        />
      )}

      {shellPhase === "unlocked" && altTabWindowId && (
        <AltTabSwitcher
          getDocumentLabel={getWindowDocumentLabel}
          selectedWindowId={altTabWindowId}
          windows={desktopWindows}
        />
      )}

      {shellPhase === "unlocked" && taskViewOpen && (
        <TaskView
          activeDesktopIndex={activeDesktopIndex}
          desktopCount={desktopCount}
          getDocumentLabel={getWindowDocumentLabel}
          onAddDesktop={addDesktop}
          onCloseDesktop={closeDesktop}
          onCloseWindow={closeWindow}
          onDismiss={() => setTaskViewOpen(false)}
          onMoveWindowToDesktop={moveWindowToDesktop}
          onSelectDesktop={(index) => {
            switchDesktop(index);
            setTaskViewOpen(false);
          }}
          onSelectWindow={(id) => {
            focusWindow(id);
            setTaskViewOpen(false);
          }}
          windows={windows}
        />
      )}

      <ToastStack onDismiss={dismissToast} onHoldChange={setToastHeld} toasts={toasts} />
      <PwaUpdatePrompt />
    </main>
  );
}
