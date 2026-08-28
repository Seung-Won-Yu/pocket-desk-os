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
  PAINT_SAVE_EVENT,
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
import { getWindowSnapPatch } from "./shell/windowGeometry";
import {
  createDefaultWindows,
  fitWindowToViewport,
  getVirtualDesktopCount,
  loadVirtualDesktopCount,
  loadWindowState,
  persistWindowState,
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
  const [altTabWindowId, setAltTabWindowId] = useState<string | null>(null);
  const [pinnedAppIds, setPinnedAppIds] = useState<AppId[]>(() => loadPinnedTaskbarApps());
  const [snapPreview, setSnapPreview] = useState<SnapPreviewState | null>(null);
  const [snapAssistZone, setSnapAssistZone] = useState<SnapZone | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<ToastMessage[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [windows, setWindows] = useState<WindowInstance[]>(() => loadWindowState());
  const [storedDesktopCount, setStoredDesktopCount] = useState(() => loadVirtualDesktopCount());
  const [activeDesktopIndex, setActiveDesktopIndex] = useState(0);
  const [taskViewOpen, setTaskViewOpen] = useState(false);
  const [windowMotions, setWindowMotions] = useState<Record<string, WindowMotion>>({});
  const altTabTimerRef = useRef<number | null>(null);
  const altTabOrderRef = useRef<string[]>([]);
  const altTabSelectionRef = useRef<string | null>(null);
  const desktopRenameGuardRef = useRef(false);
  const desktopSelectionRef = useRef<DesktopSelectionState | null>(null);
  const showDesktopRestoreRef = useRef<string[]>([]);
  const soundEnabledRef = useRef(soundEnabled);
  const vfsSaveErrorShownRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const windowMotionTimersRef = useRef(new Map<string, number>());
  const closeGuardsRef = useRef(new Map<string, () => boolean>());
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
    localStorage.setItem(SOUND_ENABLED_KEY, soundEnabled ? "on" : "off");
  }, [soundEnabled]);

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

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const notify = (toast: ToastInput) => {
    const id = crypto.randomUUID();
    const nextToast: ToastMessage = {
      createdAt: Date.now(),
      detail: toast.detail ?? "",
      id,
      title: toast.title,
      tone: toast.tone ?? "info",
    };

    setToasts((current) => [...current.slice(-3), nextToast]);
    setNotificationHistory((current) => [nextToast, ...current].slice(0, 12));
    window.setTimeout(() => dismissToast(id), 3400);
  };

  const clearNotificationHistory = () => {
    setNotificationHistory([]);
  };

  const playSound = (effect: SoundEffectName) => {
    if (!soundEnabledRef.current) return;

    const audioContext = audioContextRef.current ?? createPocketDeskAudioContext();
    if (!audioContext) return;

    audioContextRef.current = audioContext;
    playPocketDeskSound(audioContext, effect);
  };

  const lockDesktop = () => {
    playSound("close");
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

  const restartDesktop = () => {
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
    setWindows(createDefaultWindows());
    notify({
      detail: "열린 앱과 창 위치를 기본 배치로 되돌렸습니다.",
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

  const moveDesktopIcon = (appId: AppId, nextPosition: IconPosition) => {
    setIconLayout((current) => ({
      ...current,
      [appId]: alignDesktopIcons
        ? snapDesktopIconPosition(nextPosition, desktopViewMode)
        : clampIconPosition(nextPosition.x, nextPosition.y, desktopViewMode),
    }));
  };

  const moveDesktopItem = (itemId: string, nextPosition: IconPosition) => {
    setDesktopItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...(alignDesktopIcons
                ? snapDesktopIconPosition(nextPosition, desktopViewMode)
                : clampIconPosition(nextPosition.x, nextPosition.y, desktopViewMode)),
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
  };

  const openVfsEntry = (item: DesktopItem) => {
    const association = getVfsEntryAssociation(item);
    const override = defaultApps[getVfsEntryExtension(item)];
    const targetAppId = override ?? association.appId;
    if (item.kind === "folder") {
      const windowId = openApp("files");
      setFilesLaunchRequest({ folderId: item.id, id: crypto.randomUUID(), windowId });
      return;
    }
    if (item.kind === "note") {
      setActiveNoteId(item.id);
    }
    if (item.kind === "canvas") {
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

    const position = clampIconPosition(event.clientX - 40, event.clientY - 40, desktopViewMode);
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

  const createDesktopItem = (kind: CreatableDesktopItemKind) => {
    playSound("success");
    const origin = desktopMenu ?? {
      originX: 24,
      originY: 24,
      x: 24,
      y: 24,
    };
    const position = findAvailableDesktopPosition(
      clampIconPosition(origin.originX - 18, origin.originY - 10, desktopViewMode),
      desktopViewMode,
      [
        ...desktopApps.map((app) => iconLayout[app.id] ?? createDefaultIconLayout()[app.id]!),
        ...activeDesktopItems
          .filter((item) => item.showOnDesktop)
          .map((item) => ({ x: item.x, y: item.y })),
      ],
    );
    const name = getUniqueTextFileName(activeDesktopItems, VFS_ROOT_ID);
    const now = Date.now();
    const item: DesktopItem = {
      content: "",
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
      detail: "메모장에서 열어 작성할 수 있습니다.",
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
    arrangeDesktopIcons(desktopSortKey, viewMode);
  };

  const toggleDesktopGrid = () => {
    const next = !alignDesktopIcons;
    setAlignDesktopIcons(next);
    if (next) arrangeDesktopIcons(desktopSortKey);
  };

  const refreshDesktop = () => {
    setIconLayout((current) => ({ ...current }));
    setDesktopItems((current) => [...current]);
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

  const selectDesktopTarget = (
    targetId: string,
    event?: Pick<React.MouseEvent, "ctrlKey" | "metaKey">,
  ) => {
    if (event?.ctrlKey || event?.metaKey) {
      setSelectedDesktopIds((current) =>
        current.includes(targetId)
          ? current.filter((id) => id !== targetId)
          : [...current, targetId],
      );
      return;
    }
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
  ) => {
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
      setActiveNoteId(existing.id);
      notify({
        detail: "기존 문서의 내용을 새 내용으로 바꿨습니다.",
        title: `${name} 저장됨`,
        tone: "success",
      });
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
    setActiveNoteId(item.id);
    notify({
      detail: "선택한 폴더에 새 문서를 저장했습니다.",
      title: `${item.name} 저장됨`,
      tone: "success",
    });
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

  const growWindow = (id: string, delta: { width: number; height: number }) => {
    if (delta.width <= 0 && delta.height <= 0) return;
    setWindows((current) =>
      current.map((item) => {
        if (item.id !== id || item.maximized) return item;
        const maxWidth = Math.max(320, window.innerWidth - 16);
        const maxHeight = Math.max(240, window.innerHeight - APP_BAR_HEIGHT - 16);
        const width = Math.min(maxWidth, item.width + Math.max(0, delta.width));
        const height = Math.min(maxHeight, item.height + Math.max(0, delta.height));
        if (width === item.width && height === item.height) return item;
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
      }),
    );
  };

  const closeWindow = (id: string) => {
    const guard = closeGuardsRef.current.get(id);
    if (guard && !guard()) return;

    closeGuardsRef.current.delete(id);
    setUnsavedWindowIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    playSound("close");
    setWindowMenu(null);
    scheduleWindowMotion(id, "closing", () => {
      setWindows((current) => current.filter((item) => item.id !== id));
    });
  };

  const minimizeWindow = (id: string) => {
    playSound("minimize");
    setWindowMenu(null);
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
        title: getApp(item.appId).title,
      })),
    [windows],
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
      if (altTabTimerRef.current !== null) {
        window.clearTimeout(altTabTimerRef.current);
        altTabTimerRef.current = null;
      }
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

    const scheduleAltTabClose = () => {
      if (altTabTimerRef.current !== null) {
        window.clearTimeout(altTabTimerRef.current);
      }
      // A keyup that never arrives (focus left the page mid-hold) still has to
      // land on the window the user picked.
      altTabTimerRef.current = window.setTimeout(commitAltTab, 1200);
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
      scheduleAltTabClose();
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

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
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
  const desktopTabStopId =
    selectedDesktopIds[0] ??
    (desktopApps[0]
      ? `app:${desktopApps[0].id}`
      : activeDesktopItems.find((item) => item.showOnDesktop)
        ? `item:${activeDesktopItems.find((item) => item.showOnDesktop)!.id}`
        : null);

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
          const icons = [...event.currentTarget.querySelectorAll<HTMLElement>(".desktop-icon")];
          const currentIndex = icons.findIndex(
            (node) => node === document.activeElement || node.contains(document.activeElement),
          );
          const target = getNeighbourByPosition(icons, currentIndex, event.key);
          if (!target) return;
          // Arrow keys and Home/End did nothing here: every icon was its own tab
          // stop and there was no arrow handling at all.
          event.preventDefault();
          target.focus();
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
                deleteVfsEntry={deleteVfsEntry}
                emptyRecycleBin={emptyRecycleBin}
                exportVfsZip={exportVfsZip}
                filesLaunchRequest={filesLaunchRequest}
                importVfsZip={importVfsZip}
                moveVfsEntries={moveVfsEntries}
                openApp={openApp}
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
                saveNoteContent={saveNoteContent}
                setSoundEnabled={setSoundEnabled}
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
          onRestore={() => {
            restoreWindow(windowMenuInstance.id);
            setWindowMenu(null);
          }}
          x={windowMenu.x}
          y={windowMenu.y}
        />
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
        onSetSoundEnabled={setSoundEnabled}
        onShowDesktop={toggleShowDesktop}
        onTogglePinnedApp={togglePinnedApp}
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
        />
      )}

      {runOpen && <RunDialog onClose={() => setRunOpen(false)} onExecute={executeRunCommand} />}

      {desktopMenu && (
        <DesktopContextMenu
          alignToGrid={alignDesktopIcons}
          currentSort={desktopSortKey}
          currentView={desktopViewMode}
          onChangeWallpaper={() => {
            setDesktopMenu(null);
            openApp("settings");
          }}
          onCreateNote={() => createDesktopItem("note")}
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

      <ToastStack onDismiss={dismissToast} toasts={toasts} />
      <PwaUpdatePrompt />
    </main>
  );
}
