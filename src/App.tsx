import BrowserApp, { type BrowserLaunchRequest } from "./apps/BrowserApp";
import CalculatorApp from "./apps/CalculatorApp";
import MinesweeperApp from "./apps/MinesweeperApp";
import NotepadApp from "./apps/NotepadApp";
import PaintApp from "./apps/PaintApp";
import ThisPcApp from "./apps/ThisPcApp";
import type {
  AppId,
  DesktopItem,
  IconPosition,
  SoundEffectName,
  ThemeName,
  ToastInput,
  VfsDuplicateOptions,
  VfsEntryKind,
  WallpaperName,
} from "./types";
import {
  clamp,
  formatStorageSize,
  formatVfsEntrySize,
  formatVfsPropertyDate,
  normalizeSearchText,
} from "./utils/format";
import {
  ArrowUpDown,
  Bell,
  Bomb,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  Globe2,
  Grid2X2,
  HardDrive,
  House,
  Info,
  LayoutGrid,
  List,
  Lock,
  LucideIcon,
  Maximize2,
  Minus,
  Monitor,
  Paintbrush,
  Palette,
  Pencil,
  Pin,
  PinOff,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Square,
  SquareTerminal,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
type WindowMotion = "closing" | "minimizing";

type WindowInstance = {
  id: string;
  appId: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

type PersistedWindow = Partial<Omit<WindowInstance, "id">> & {
  id?: unknown;
  appId?: unknown;
};

type DesktopIconLayout = Partial<Record<AppId, IconPosition>>;
type DesktopSortKey = "name" | "type" | "modified";
type DesktopViewMode = "small" | "medium" | "large";
type FileSortDirection = "asc" | "desc";
type FileSortKey = "name" | "type" | "modified";
type FileViewMode = "details" | "list" | "icons";
type FileContextMenuState = {
  fileId: string;
  x: number;
  y: number;
};
type DesktopIconContextMenuState =
  | {
      appId: AppId;
      kind: "app";
      x: number;
      y: number;
    }
  | {
      itemId: string;
      kind: "item";
      x: number;
      y: number;
    };
type PersistedIconPosition = {
  x?: unknown;
  y?: unknown;
};
type CreatableDesktopItemKind = "note";
type PersistedDesktopItem = Partial<Omit<DesktopItem, "kind">> & {
  kind?: unknown;
};
type DesktopContextMenuState = {
  originX: number;
  originY: number;
  x: number;
  y: number;
};
type WindowSystemMenuState = {
  windowId: string;
  x: number;
  y: number;
};
type VfsEntryAssociation = {
  accent: string;
  appId: AppId;
  appTitle: string;
  extension: string;
  icon: LucideIcon;
  typeLabel: string;
};
type StartSearchResult =
  | {
      accent: string;
      appId: AppId;
      icon: LucideIcon;
      id: string;
      kind: "app";
      matchLabel: string;
      score: number;
      sourceLabel: string;
      subtitle: string;
      title: string;
    }
  | {
      accent: string;
      icon: LucideIcon;
      id: string;
      item: DesktopItem;
      kind: "desktopItem";
      matchLabel: string;
      score: number;
      sourceLabel: string;
      subtitle: string;
      title: string;
    };
type ToastMessage = Required<ToastInput> & {
  createdAt: number;
  id: string;
};
type ShellPhase = "booting" | "locked" | "shutdown" | "unlocked";
type SnapZone = "left" | "right" | "top";
type SnapPreviewState = {
  zone: SnapZone;
};
type DesktopSelectionState = {
  currentX: number;
  currentY: number;
  pointerId: number;
  startX: number;
  startY: number;
};
type SoundStep = {
  duration: number;
  frequency: number;
  gain: number;
  offset?: number;
  type?: OscillatorType;
};
type RunCommandResolution =
  | {
      appId: AppId;
      kind: "app";
    }
  | {
      kind: "browser";
      value: string;
    }
  | {
      kind: "unknown";
      value: string;
    };
type AppContentProps = {
  activeCanvasId: string;
  activeCanvasOpenKey: number;
  activeNoteId: string;
  browserLaunchRequest: BrowserLaunchRequest | null;
  canvasEntries: DesktopItem[];
  createVfsTextFile: () => DesktopItem;
  desktopItems: DesktopItem[];
  duplicateVfsEntries: (itemIds: string[], options?: VfsDuplicateOptions) => string[];
  noteEntries: DesktopItem[];
  trashedItems: DesktopItem[];
  notify: (toast: ToastInput) => void;
  deleteVfsEntry: (itemId: string) => void;
  emptyRecycleBin: () => void;
  exportVfsZip: () => void;
  importVfsZip: (file: File) => Promise<void>;
  openApp: (appId: AppId) => void;
  openVfsEntry: (item: DesktopItem) => void;
  permanentlyDeleteVfsEntry: (itemId: string) => void;
  renameVfsEntry: (itemId: string, name: string) => void;
  resetDesktopIconLayout: () => void;
  resetWindowLayout: () => void;
  restoreVfsEntry: (itemId: string) => void;
  playSound: (effect: SoundEffectName) => void;
  savePaintImage: (content: string) => void;
  saveNoteContent: (noteId: string, content: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setWallpaper: (wallpaper: WallpaperName) => void;
  setTheme: (theme: ThemeName) => void;
  soundEnabled: boolean;
  theme: ThemeName;
  wallpaper: WallpaperName;
};

type AppDefinition = {
  id: AppId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  defaultSize: { width: number; height: number };
  component: (props: AppContentProps) => JSX.Element;
};

const APP_BAR_HEIGHT = 48;
const DESKTOP_ICON_WIDTH = 86;
const DESKTOP_ICON_HEIGHT = 94;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_HEIGHT = 260;
const WINDOW_SYSTEM_MENU_WIDTH = 214;
const WINDOW_SYSTEM_MENU_HEIGHT = 220;
const NOTE_KEY = "pocket-desk-note";
const LEGACY_DEFAULT_NOTE_CONTENT =
  "PocketDesk 메모장\n\n여기에 내용을 적고 저장하면 브라우저 로컬 저장소와 IndexedDB 파일 시스템에 남습니다.";
const NOTE_SAVE_EVENT = "pocket-desk-save-note";
const VFS_DB_NAME = "pocket-desk-vfs";
const VFS_DB_VERSION = 1;
const VFS_STORE_NAME = "entries";
const VFS_BACKUP_FILE_NAME = "pocket-desk-vfs.json";
const VFS_ROOT_ID = "desktop";
const VFS_PRIMARY_NOTE_ID = "vfs-notes";
const VFS_PRIMARY_CANVAS_ID = "vfs-sketch";
const WALLPAPER_KEY = "pocket-desk-wallpaper-v2";
const WINDOW_STATE_KEY = "pocket-desk-windows-v1";
const DESKTOP_ICON_LAYOUT_KEY = "pocket-desk-icons-v2";
const DESKTOP_ICON_VIEW_KEY = "pocket-desk-icon-view-v1";
const DESKTOP_ICON_SORT_KEY = "pocket-desk-icon-sort-v1";
const DESKTOP_ICON_GRID_KEY = "pocket-desk-icon-grid-v1";
const FILE_EXPLORER_SORT_KEY = "pocket-desk-explorer-sort-v1";
const FILE_EXPLORER_SORT_DIRECTION_KEY = "pocket-desk-explorer-sort-direction-v1";
const FILE_EXPLORER_VIEW_KEY = "pocket-desk-explorer-view-v1";
const DESKTOP_ITEMS_KEY = "pocket-desk-desktop-items-v1";
const SOUND_ENABLED_KEY = "pocket-desk-sound-enabled-v1";
const DISPLAY_BRIGHTNESS_KEY = "pocket-desk-display-brightness-v1";
const TASKBAR_PINNED_APPS_KEY = "pocket-desk-taskbar-pinned-v2";
const SNAP_EDGE_SIZE = 24;
const SNAP_GUTTER = 10;
const WINDOW_EXIT_MOTION_MS = 170;
const wallpaperGallery: Array<{ id: WallpaperName; label: string; detail: string }> = [
  { id: "meadow", label: "Green Vista", detail: "초록 언덕과 푸른 하늘" },
  { id: "ribbon", label: "Blue Ribbon", detail: "푸른 유리 리본" },
  { id: "aurora", label: "Aurora Lake", detail: "오로라와 밤 호수" },
  { id: "dawn", label: "Dawn Lake", detail: "새벽 호수와 따뜻한 빛" },
  { id: "sunny", label: "Sunny Field", detail: "맑은 초원과 구름" },
  { id: "glass", label: "Glass Wave", detail: "푸른 유리 빛줄기" },
  { id: "mist", label: "Misty Peak", detail: "안개 낀 산과 호수" },
  { id: "coast", label: "Moon Coast", detail: "달빛 해안과 바다" },
];

const wallpaperFiles: Record<WallpaperName, string> = {
  aurora: "wallpapers/aurora-lake.jpg",
  coast: "wallpapers/moon-coast.jpg",
  dawn: "wallpapers/dawn-lake.jpg",
  glass: "wallpapers/glass-wave.jpg",
  meadow: "wallpapers/green-vista.jpg",
  mist: "wallpapers/misty-peak.jpg",
  ribbon: "wallpapers/blue-ribbon.jpg",
  sunny: "wallpapers/sunny-field.jpg",
};

type WallpaperCssVars = React.CSSProperties & {
  "--wallpaper-image": string;
};

function getAssetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function getWallpaperStyle(wallpaper: WallpaperName): WallpaperCssVars {
  return {
    "--wallpaper-image": `url("${getAssetUrl(wallpaperFiles[wallpaper])}")`,
  };
}

function getWallpaperPreviewStyle(wallpaper: WallpaperName): React.CSSProperties {
  return {
    backgroundImage: `url("${getAssetUrl(wallpaperFiles[wallpaper])}")`,
  };
}

const appSearchKeywords: Record<AppId, string[]> = {
  thispc: ["this pc", "my computer", "computer", "pc", "내 pc", "내컴퓨터", "컴퓨터", "드라이브", "disk"],
  browser: ["internet", "web", "edge", "인터넷", "웹", "브라우저", "검색", "google", "url"],
  minesweeper: ["mine", "field", "mines", "지뢰", "지뢰찾기", "게임", "폭탄"],
  calculator: ["calc", "calculator", "계산", "계산기", "수학", "사칙연산"],
  paint: ["paint", "sketch", "draw", "그림", "그림판", "스케치", "드로잉", "캔버스"],
  notepad: ["note", "notes", "memo", "txt", "메모", "메모장", "문서", "글쓰기"],
  files: ["file", "files", "folder", "explorer", "파일", "폴더", "탐색기", "desktop"],
  recycle: ["recycle", "trash", "bin", "deleted", "휴지통", "삭제", "복원", "비우기"],
  settings: ["setting", "settings", "control", "theme", "wallpaper", "설정", "테마", "배경"],
};

const runCommandAliases: Partial<Record<AppId, string[]>> = {
  thispc: ["computer", "this pc", "my computer", "내 pc", "내컴퓨터"],
  browser: ["edge", "iexplore", "msedge", "chrome", "www"],
  calculator: ["calc.exe"],
  files: ["explorer", "explorer.exe"],
  notepad: ["notepad.exe"],
  paint: ["mspaint", "mspaint.exe"],
  recycle: ["recycle bin", "trash", "bin"],
  settings: ["control", "control.exe", "control panel"],
};

const runCommandSuggestions = [
  { command: "computer", label: "computer" },
  { command: "explorer", label: "explorer" },
  { command: "calc", label: "calc" },
  { command: "notepad", label: "notepad" },
  { command: "mspaint", label: "mspaint" },
  { command: "recycle", label: "recycle" },
  { command: "https://example.com", label: "url" },
];

const appCatalog: AppDefinition[] = [
  {
    id: "thispc",
    title: "내 PC",
    subtitle: "드라이브와 기본 폴더",
    icon: Monitor,
    accent: "#8fc9ff",
    defaultSize: { width: 780, height: 560 },
    component: ThisPcApp,
  },
  {
    id: "browser",
    title: "Microsoft Edge",
    subtitle: "웹 검색 및 사이트 열기",
    icon: Globe2,
    accent: "#43b0f1",
    defaultSize: { width: 860, height: 560 },
    component: BrowserApp,
  },
  {
    id: "minesweeper",
    title: "지뢰찾기",
    subtitle: "난이도별 지뢰찾기",
    icon: Bomb,
    accent: "#f6b44b",
    defaultSize: { width: 440, height: 560 },
    component: MinesweeperApp,
  },
  {
    id: "calculator",
    title: "계산기",
    subtitle: "키보드와 공학 모드 계산기",
    icon: Calculator,
    accent: "#7bc96f",
    defaultSize: { width: 400, height: 570 },
    component: CalculatorApp,
  },
  {
    id: "paint",
    title: "그림판",
    subtitle: "캔버스 그림판",
    icon: Paintbrush,
    accent: "#ef6f6c",
    defaultSize: { width: 820, height: 560 },
    component: PaintApp,
  },
  {
    id: "notepad",
    title: "메모장",
    subtitle: "로컬 저장 메모장",
    icon: FileText,
    accent: "#f2d16b",
    defaultSize: { width: 600, height: 520 },
    component: NotepadApp,
  },
  {
    id: "files",
    title: "파일 탐색기",
    subtitle: "가상 파일 탐색기",
    icon: Folder,
    accent: "#f3c64d",
    defaultSize: { width: 900, height: 600 },
    component: FilesApp,
  },
  {
    id: "recycle",
    title: "휴지통",
    subtitle: "삭제 항목 복원과 영구 비우기",
    icon: Trash2,
    accent: "#9bb7c9",
    defaultSize: { width: 720, height: 520 },
    component: RecycleBinApp,
  },
  {
    id: "settings",
    title: "설정",
    subtitle: "테마와 배경",
    icon: Settings,
    accent: "#b99cff",
    defaultSize: { width: 840, height: 610 },
    component: SettingsApp,
  },
];

const appsById = new Map(appCatalog.map((app) => [app.id, app]));
const desktopAppIds: AppId[] = ["thispc", "recycle"];
const desktopApps = desktopAppIds.map((appId) => getApp(appId));
const defaultPinnedAppIds: AppId[] = ["browser", "files"];

function getApp(appId: AppId) {
  const app = appsById.get(appId);
  if (!app) {
    throw new Error(`Unknown app: ${appId}`);
  }
  return app;
}

function isAppId(value: unknown): value is AppId {
  return typeof value === "string" && appsById.has(value as AppId);
}

function loadPinnedTaskbarApps(): AppId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TASKBAR_PINNED_APPS_KEY) ?? "null");
    if (!Array.isArray(parsed)) return defaultPinnedAppIds;
    const normalized = parsed.filter(isAppId).filter((value, index, values) => values.indexOf(value) === index);
    return normalized;
  } catch {
    return defaultPinnedAppIds;
  }
}

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
  const [iconLayout, setIconLayout] = useState<DesktopIconLayout>(() => loadDesktopIconLayout());
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
  const [desktopIconMenu, setDesktopIconMenu] =
    useState<DesktopIconContextMenuState | null>(null);
  const [desktopClipboardIds, setDesktopClipboardIds] = useState<string[]>([]);
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
  const [browserLaunchRequest, setBrowserLaunchRequest] = useState<BrowserLaunchRequest | null>(null);
  const [activeCanvasId, setActiveCanvasId] = useState(VFS_PRIMARY_CANVAS_ID);
  const [activeCanvasOpenKey, setActiveCanvasOpenKey] = useState(0);
  const [activeNoteId, setActiveNoteId] = useState(VFS_PRIMARY_NOTE_ID);
  const [altTabWindowId, setAltTabWindowId] = useState<string | null>(null);
  const [pinnedAppIds, setPinnedAppIds] = useState<AppId[]>(() => loadPinnedTaskbarApps());
  const [snapPreview, setSnapPreview] = useState<SnapPreviewState | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<ToastMessage[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [windows, setWindows] = useState<WindowInstance[]>(() => loadWindowState());
  const [windowMotions, setWindowMotions] = useState<Record<string, WindowMotion>>({});
  const altTabTimerRef = useRef<number | null>(null);
  const desktopRenameGuardRef = useRef(false);
  const desktopSelectionRef = useRef<DesktopSelectionState | null>(null);
  const showDesktopRestoreRef = useRef<string[]>([]);
  const soundEnabledRef = useRef(soundEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);
  const windowMotionTimersRef = useRef(new Map<string, number>());

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
    persistDesktopItems(desktopItems).catch((error) => {
      console.error("Failed to persist PocketDesk VFS", error);
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

  const openApp = (appId: AppId) => {
    const existingWindow = windows.find((item) => item.appId === appId);
    if (existingWindow) cancelWindowMotion(existingWindow.id);
    playSound("open");
    setDesktopIconMenu(null);
    setDesktopMenu(null);
    setWindows((current) => {
      const app = getApp(appId);
      const existing = current.find((item) => item.appId === appId);
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
          id: `${appId}-${crypto.randomUUID()}`,
          appId,
          x: Math.min(52 + offset, maxX),
          y: Math.min(42 + offset, maxY),
          width,
          height,
          z: topZ + 1,
          minimized: false,
          maximized: false,
        },
      ];
    });
    setStartOpen(false);
    setRunOpen(false);
    setQuery("");
  };

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
    if (item.kind === "note") {
      setActiveNoteId(item.id);
    }
    if (item.kind === "canvas") {
      setActiveCanvasId(item.id);
      setActiveCanvasOpenKey((current) => current + 1);
    }
    if (association.appId === "browser" && item.kind === "shortcut") {
      setBrowserLaunchRequest({ id: crypto.randomUUID(), value: getVfsShortcutTarget(item) });
    }
    openApp(association.appId);
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
        ...desktopApps.map(
          (app) => iconLayout[app.id] ?? createDefaultIconLayout()[app.id]!,
        ),
        ...activeDesktopItems
          .filter((item) => item.showOnDesktop)
          .map((item) => ({ x: item.x, y: item.y })),
      ],
    );
    const name = getUniqueTextFileName(activeDesktopItems);
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

  const createVfsTextFile = () => {
    const now = Date.now();
    const item: DesktopItem = {
      content: "",
      createdAt: now,
      id: `note-${crypto.randomUUID()}`,
      kind: "note",
      name: getUniqueTextFileName(activeDesktopItems),
      parentId: VFS_ROOT_ID,
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
    const sourceIds = itemIds.filter((id, index) => itemIds.indexOf(id) === index);
    const copyDescriptors = sourceIds
      .filter((id) => activeDesktopItems.some((item) => item.id === id))
      .map((sourceId) => ({ id: crypto.randomUUID(), sourceId }));
    if (copyDescriptors.length === 0) return [];

    setDesktopItems((current) => {
      const existingNames = new Set(
        current.filter((item) => !item.trashed).map((item) => item.name),
      );
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
      const copies = copyDescriptors.flatMap((descriptor, index) => {
        const source = current.find(
          (item) => item.id === descriptor.sourceId && !item.trashed,
        );
        if (!source) return [];
        const name = getUniqueVfsCopyName(existingNames, source.name);
        existingNames.add(name);
        const preferredPosition =
          options?.showOnDesktop && options.position
            ? clampIconPosition(
                options.position.x + index * 18,
                options.position.y + index * 18,
                desktopViewMode,
              )
            : { x: 0, y: 0 };
        const position =
          options?.showOnDesktop && options.position
            ? findAvailableDesktopPosition(
                preferredPosition,
                desktopViewMode,
                occupiedDesktopPositions,
              )
            : preferredPosition;
        if (options?.showOnDesktop) occupiedDesktopPositions.push(position);
        return [
          {
            ...source,
            createdAt: now + index,
            id: `${source.kind}-${descriptor.id}`,
            name,
            restoreShowOnDesktop: false,
            showOnDesktop: options?.showOnDesktop ?? false,
            trashed: false,
            trashedAt: undefined,
            updatedAt: now + index,
            ...position,
          },
        ];
      });
      return [...current, ...copies];
    });
    playSound("success");
    notify({
      detail: "선택한 항목의 복사본을 만들었습니다.",
      title: `${copyDescriptors.length}개 항목 붙여넣기 완료`,
      tone: "success",
    });
    return copyDescriptors.map((descriptor) => {
      const source = activeDesktopItems.find((item) => item.id === descriptor.sourceId);
      return `${source?.kind ?? "note"}-${descriptor.id}`;
    });
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
        const index = entries.findIndex((entry) => entry.kind === "item" && entry.id === item.id);
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
      .filter((item) => item.trashed)
      .sort((a, b) => (b.trashedAt ?? b.updatedAt) - (a.trashedAt ?? a.updatedAt));
  }, [desktopItems]);

  const noteEntries = useMemo(() => {
    return activeDesktopItems.filter((item) => item.kind === "note");
  }, [activeDesktopItems]);

  const canvasEntries = useMemo(() => {
    return activeDesktopItems.filter((item) => item.kind === "canvas");
  }, [activeDesktopItems]);

  const savePaintImage = (content: string) => {
    playSound("success");
    const now = Date.now();
    const id = `canvas-${crypto.randomUUID()}`;
    const name = getUniqueCanvasItemName(activeDesktopItems);

    setDesktopItems((current) => [
      ...current,
      {
        content,
        createdAt: now,
        id,
        kind: "canvas",
        name,
        parentId: VFS_ROOT_ID,
        showOnDesktop: false,
        updatedAt: now,
        x: 0,
        y: 0,
      },
    ]);
    setActiveCanvasId(id);
    setActiveCanvasOpenKey((current) => current + 1);
    notify({
      detail: "파일 탐색기에서 다시 열어 편집할 수 있습니다.",
      title: `${name} 저장됨`,
      tone: "success",
    });
  };

  const renameVfsEntry = (itemId: string, name: string) => {
    const target = activeDesktopItems.find((item) => item.id === itemId);
    if (!target) return;

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
    if (!target) return;

    playSound("close");
    const now = Date.now();
    const remaining = activeDesktopItems.filter((item) => item.id !== itemId);
    setDesktopItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              restoreShowOnDesktop: item.showOnDesktop,
              showOnDesktop: false,
              trashed: true,
              trashedAt: now,
              updatedAt: now,
            }
          : item,
      ),
    );

    if (target.kind === "note" && activeNoteId === itemId) {
      setActiveNoteId(remaining.find((item) => item.kind === "note")?.id ?? VFS_PRIMARY_NOTE_ID);
    }
    if (target.kind === "canvas" && activeCanvasId === itemId) {
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

  const copyDesktopItems = (fallbackItemId?: string) => {
    const itemIds = getSelectedDesktopItemIds(fallbackItemId);
    if (itemIds.length === 0) return;
    setDesktopClipboardIds(itemIds);
    setDesktopIconMenu(null);
    notify({
      detail: "바탕 화면에서 붙여넣을 수 있습니다.",
      title: `${itemIds.length}개 항목 복사됨`,
      tone: "success",
    });
  };

  const pasteDesktopItems = () => {
    if (desktopClipboardIds.length === 0) return;
    const origin = desktopMenu ?? {
      originX: 120,
      originY: 120,
      x: 120,
      y: 120,
    };
    const copiedIds = duplicateVfsEntries(desktopClipboardIds, {
      position: clampIconPosition(origin.originX - 18, origin.originY - 10, desktopViewMode),
      showOnDesktop: true,
    });
    setSelectedDesktopIds(copiedIds.map((id) => `item:${id}`));
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

    const nextName = getUniqueRenamedVfsItemName(activeDesktopItems, itemId, target.name);
    playSound("success");
    setDesktopItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              name: nextName,
              showOnDesktop: Boolean(item.restoreShowOnDesktop),
              trashed: false,
              trashedAt: undefined,
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
    notify({
      detail: nextName === target.name ? "원래 위치로 되돌렸습니다." : `${nextName} 이름으로 복원했습니다.`,
      title: `${target.name} 복원됨`,
      tone: "success",
    });
  };

  const permanentlyDeleteVfsEntry = (itemId: string) => {
    const target = trashedItems.find((item) => item.id === itemId);
    if (!target) return;

    playSound("close");
    setDesktopItems((current) => current.filter((item) => item.id !== itemId));
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
    const importedItems = await readVfsBackupZip(file);
    const activeImportedItems = importedItems.filter((item) => !item.trashed);
    playSound("success");
    setDesktopItems(importedItems);
    setActiveNoteId(activeImportedItems.find((item) => item.kind === "note")?.id ?? VFS_PRIMARY_NOTE_ID);
    setActiveCanvasId(
      activeImportedItems.find((item) => item.kind === "canvas")?.id ?? VFS_PRIMARY_CANVAS_ID,
    );
    setActiveCanvasOpenKey((current) => current + 1);
    notify({
      detail: `${importedItems.length}개 항목을 가져왔습니다.`,
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
          parentId: VFS_ROOT_ID,
          showOnDesktop: false,
          updatedAt: now,
          x: 0,
          y: 0,
        },
      ];
    });
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
    setWindows((current) => {
      const topZ = Math.max(1, ...current.map((item) => item.z));
      return current.map((item) =>
        item.id === id ? { ...item, minimized: false, z: topZ + 1 } : item,
      );
    });
  };

  const updateWindow = (id: string, patch: Partial<WindowInstance>) => {
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
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

  const scheduleWindowMotion = (
    id: string,
    motion: WindowMotion,
    complete: () => void,
  ) => {
    const activeTimer = windowMotionTimersRef.current.get(id);
    if (activeTimer !== undefined) window.clearTimeout(activeTimer);

    setWindowMotions((current) => ({ ...current, [id]: motion }));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      windowMotionTimersRef.current.delete(id);
      complete();
      setWindowMotions((current) => {
        if (!current[id]) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, reduceMotion ? 0 : WINDOW_EXIT_MOTION_MS);
    windowMotionTimersRef.current.set(id, timer);
  };

  const closeWindow = (id: string) => {
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
    focusWindow(id);
  };

  const snapWindow = (id: string, zone: SnapZone) => {
    playSound("toggle");
    updateWindow(id, getWindowSnapPatch(zone));
  };

  const toggleShowDesktop = () => {
    playSound("toggle");
    setStartOpen(false);
    setRunOpen(false);
    setDesktopIconMenu(null);
    setDesktopMenu(null);
    const visibleIds = windows.filter((item) => !item.minimized).map((item) => item.id);
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
        restoreIds.has(item.id)
          ? { ...item, minimized: false, z: (nextZ += 1) }
          : item,
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
      .filter((item) => item.kind === "note" || item.kind === "canvas" || item.kind === "folder")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);
  }, [activeDesktopItems]);
  const activeWindowId = windows
    .filter((item) => !item.minimized)
    .sort((a, b) => b.z - a.z)[0]?.id;
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
        ".desktop-icon, .desktop-context-menu, .window-system-menu, .window-frame, .start-menu, .taskbar, .shell-gate",
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
        detail: resolution.value ? `"${resolution.value}" 명령을 찾을 수 없습니다.` : "실행할 명령을 입력하세요.",
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
      setAltTabWindowId(null);
    };

    const scheduleAltTabClose = () => {
      if (altTabTimerRef.current !== null) {
        window.clearTimeout(altTabTimerRef.current);
      }
      altTabTimerRef.current = window.setTimeout(() => {
        setAltTabWindowId(null);
        altTabTimerRef.current = null;
      }, 1200);
    };

    const cycleAltTab = (reverse: boolean) => {
      const candidates = [...windows].sort((a, b) => b.z - a.z);
      if (candidates.length === 0) return;

      const currentId = altTabWindowId ?? activeWindowId;
      const currentIndex = currentId ? candidates.findIndex((item) => item.id === currentId) : -1;
      const direction = reverse ? -1 : 1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + candidates.length) % candidates.length;
      const nextWindow = candidates[nextIndex];

      focusWindow(nextWindow.id);
      setAltTabWindowId(nextWindow.id);
      scheduleAltTabClose();
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (shellPhase !== "unlocked") return;
      const target = event.target;
      const editingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.metaKey && !event.ctrlKey && !event.altKey) {
        const key = event.key.toLowerCase();
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

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const activeWindow = windows.find((item) => item.id === activeWindowId);
        if (activeWindow?.appId === "notepad") {
          window.dispatchEvent(new Event(NOTE_SAVE_EVENT));
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
          event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : event.key === "ArrowUp" ? "top" : null;
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
        clearAltTab();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [
    activeDesktopItems,
    activeWindowId,
    altTabWindowId,
    desktopIconMenu,
    desktopMenu,
    desktopPropertiesItemId,
    desktopRenamingItemId,
    runOpen,
    selectedDesktopIds,
    shellPhase,
    startOpen,
    windowMenu,
    windows,
  ]);

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
      <section className="desktop-icons" aria-label="바탕화면 바로가기">
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
          />
        ))}
        {activeDesktopItems.filter((item) => item.showOnDesktop).map((item) => (
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
            onMove={(position) => moveDesktopItem(item.id, position)}
            onOpen={() => openDesktopItem(item)}
            onSelect={(event) => selectDesktopTarget(`item:${item.id}`, event)}
            renaming={desktopRenamingItemId === item.id}
            selected={selectedDesktopIds.includes(`item:${item.id}`)}
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
        {windows.map((item) => {
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
                createVfsTextFile={createVfsTextFile}
                desktopItems={activeDesktopItems}
                duplicateVfsEntries={duplicateVfsEntries}
                noteEntries={noteEntries}
                trashedItems={trashedItems}
                notify={notify}
                deleteVfsEntry={deleteVfsEntry}
                emptyRecycleBin={emptyRecycleBin}
                exportVfsZip={exportVfsZip}
                importVfsZip={importVfsZip}
                openApp={openApp}
                openVfsEntry={openVfsEntry}
                permanentlyDeleteVfsEntry={permanentlyDeleteVfsEntry}
                playSound={playSound}
                renameVfsEntry={renameVfsEntry}
                resetDesktopIconLayout={resetDesktopIconLayout}
                resetWindowLayout={resetWindowLayout}
                restoreVfsEntry={restoreVfsEntry}
                savePaintImage={savePaintImage}
                saveNoteContent={saveNoteContent}
                setSoundEnabled={setSoundEnabled}
                setTheme={changeTheme}
                setWallpaper={changeWallpaper}
                soundEnabled={soundEnabled}
                theme={theme}
                wallpaper={wallpaper}
              />
            </WindowFrame>
          );
        })}
      </section>

      {snapPreview && <SnapPreview zone={snapPreview.zone} />}

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
        activeWindowId={activeWindowId}
        availableApps={availableApps}
        notificationHistory={notificationHistory}
        brightness={displayBrightness}
        onClearNotifications={clearNotificationHistory}
        onOpenStart={(event) => {
          event.stopPropagation();
          setStartOpen((value) => !value);
        }}
        onOpenApp={openApp}
        onSetBrightness={setDisplayBrightness}
        onSetSoundEnabled={setSoundEnabled}
        onShowDesktop={toggleShowDesktop}
        onTogglePinnedApp={togglePinnedApp}
        onToggleWindow={toggleFromTaskbar}
        pinnedAppIds={pinnedAppIds}
        soundEnabled={soundEnabled}
        startOpen={startOpen}
        windows={windows}
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

      {runOpen && (
        <RunDialog
          onClose={() => setRunOpen(false)}
          onExecute={executeRunCommand}
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
          onCreateNote={() => createDesktopItem("note")}
          onPaste={pasteDesktopItems}
          onRefresh={refreshDesktop}
          onSort={arrangeDesktopIcons}
          onToggleGrid={toggleDesktopGrid}
          onViewChange={changeDesktopView}
          pasteEnabled={desktopClipboardIds.length > 0}
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
            desktopContextItem
              ? () => copyDesktopItems(desktopContextItem.id)
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
            desktopContextItem
              ? () => beginDesktopRename(desktopContextItem)
              : undefined
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
        <AltTabSwitcher selectedWindowId={altTabWindowId} windows={windows} />
      )}

      <ToastStack onDismiss={dismissToast} toasts={toasts} />
    </main>
  );
}

function createDefaultWindows(): WindowInstance[] {
  return [];
}

function fitWindowToViewport(item: WindowInstance): WindowInstance {
  if (item.maximized) return item;

  const minWidth = window.innerWidth <= 740 ? 288 : 320;
  const width = clamp(item.width, minWidth, Math.max(minWidth, window.innerWidth - 16));
  const height = clamp(
    item.height,
    240,
    Math.max(240, window.innerHeight - APP_BAR_HEIGHT - 16),
  );
  const x = clamp(item.x, 8, Math.max(8, window.innerWidth - width - 8));
  const y = clamp(item.y, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8));

  if (width === item.width && height === item.height && x === item.x && y === item.y) {
    return item;
  }

  return { ...item, height, width, x, y };
}

function makeWindow(appId: AppId, x: number, y: number, z: number): WindowInstance {
  const app = getApp(appId);
  const width = Math.min(app.defaultSize.width, Math.max(320, window.innerWidth - 28));
  const height = Math.min(
    app.defaultSize.height,
    Math.max(260, window.innerHeight - APP_BAR_HEIGHT - 28),
  );
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8);

  return {
    id: `${appId}-${crypto.randomUUID()}`,
    appId,
    x: clamp(x, 8, maxX),
    y: clamp(y, 8, maxY),
    width,
    height,
    z,
    minimized: false,
    maximized: false,
  };
}

function loadWindowState(): WindowInstance[] {
  const stored = localStorage.getItem(WINDOW_STATE_KEY);
  if (stored === null) {
    return createDefaultWindows();
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return createDefaultWindows();
    }

    const seenApps = new Set<AppId>();
    const restored = parsed
      .map((item, index) => normalizePersistedWindow(item as PersistedWindow, index))
      .filter((item): item is WindowInstance => {
        if (!item || seenApps.has(item.appId)) return false;
        seenApps.add(item.appId);
        return true;
      });

    return restored;
  } catch {
    return createDefaultWindows();
  }
}

function normalizePersistedWindow(item: PersistedWindow, index: number): WindowInstance | null {
  if (typeof item.appId !== "string" || !appsById.has(item.appId as AppId)) {
    return null;
  }

  const appId = item.appId as AppId;
  const app = getApp(appId);
  const width = clamp(
    Number(item.width) || app.defaultSize.width,
    320,
    Math.max(320, window.innerWidth - 16),
  );
  const height = clamp(
    Number(item.height) || app.defaultSize.height,
    240,
    Math.max(240, window.innerHeight - APP_BAR_HEIGHT - 16),
  );
  const x = clamp(Number(item.x) || 8, 8, Math.max(8, window.innerWidth - width - 8));
  const y = clamp(Number(item.y) || 8, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8));
  const z = Number.isFinite(Number(item.z)) ? Number(item.z) : 12 + index;

  return {
    id: typeof item.id === "string" ? item.id : `${appId}-${crypto.randomUUID()}`,
    appId,
    x,
    y,
    width,
    height,
    z,
    minimized: Boolean(item.minimized),
    maximized: Boolean(item.maximized),
  };
}

function persistWindowState(windows: WindowInstance[]) {
  const payload = windows.map(({ appId, height, id, maximized, minimized, width, x, y, z }) => ({
    appId,
    height,
    id,
    maximized,
    minimized,
    width,
    x,
    y,
    z,
  }));
  localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(payload));
}

async function loadDesktopItemsFromVfs(): Promise<DesktopItem[]> {
  const database = await openVfsDatabase();
  const entries = await readAllVfsEntries(database);
  if (entries.length > 0) {
    const migratedEntries = entries
      .filter((entry) => entry.id !== "vfs-pictures")
      .map((entry) =>
        entry.id === VFS_PRIMARY_NOTE_ID && entry.content === LEGACY_DEFAULT_NOTE_CONTENT
          ? { ...entry, content: "" }
          : entry,
      );
    const migrationChanged =
      migratedEntries.length !== entries.length ||
      migratedEntries.some((entry, index) => entry !== entries[index]);
    if (migrationChanged) {
      await writeAllVfsEntries(database, migratedEntries);
    }
    database.close();
    return migratedEntries;
  }

  const seededEntries = [...createDefaultVfsEntries(), ...loadLegacyDesktopItems()];
  await writeAllVfsEntries(database, seededEntries);
  database.close();
  return seededEntries;
}

function openVfsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VFS_DB_NAME, VFS_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VFS_STORE_NAME)) {
        const store = database.createObjectStore(VFS_STORE_NAME, { keyPath: "id" });
        store.createIndex("parentId", "parentId", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllVfsEntries(database: IDBDatabase): Promise<DesktopItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VFS_STORE_NAME, "readonly");
    const store = transaction.objectStore(VFS_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(
        request.result
          .map((item, index) => normalizePersistedDesktopItem(item as PersistedDesktopItem, index))
          .filter((item): item is DesktopItem => Boolean(item))
          .sort((a, b) => a.createdAt - b.createdAt),
      );
    };
    request.onerror = () => reject(request.error);
  });
}

function writeAllVfsEntries(database: IDBDatabase, entries: DesktopItem[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VFS_STORE_NAME, "readwrite");
    const store = transaction.objectStore(VFS_STORE_NAME);
    store.clear();
    entries.forEach((entry) => store.put(entry));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function persistDesktopItems(items: DesktopItem[]) {
  const database = await openVfsDatabase();
  await writeAllVfsEntries(database, items);
  database.close();
}

function createVfsBackup(entries: DesktopItem[]) {
  return {
    app: "PocketDesk OS",
    exportedAt: new Date().toISOString(),
    entries,
    version: 1,
  };
}

function normalizeImportedVfsEntries(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("백업 JSON을 읽을 수 없습니다.");
  }

  const entries = (value as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    throw new Error("백업 안에 파일 목록이 없습니다.");
  }

  const seenIds = new Set<string>();
  const normalized = entries
    .map((item, index) => normalizePersistedDesktopItem(item as PersistedDesktopItem, index))
    .filter((item): item is DesktopItem => Boolean(item))
    .map((item) => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        return item;
      }

      const nextItem = { ...item, id: `${item.kind}-${crypto.randomUUID()}` };
      seenIds.add(nextItem.id);
      return nextItem;
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  if (normalized.length === 0) {
    throw new Error("가져올 수 있는 파일이 없습니다.");
  }

  return normalized;
}

function createVfsBackupZip(entries: DesktopItem[]) {
  const payload = JSON.stringify(createVfsBackup(entries), null, 2);
  const data = new TextEncoder().encode(payload);
  return createStoredZip(VFS_BACKUP_FILE_NAME, data);
}

async function readVfsBackupZip(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const payload = readStoredZipFile(bytes, VFS_BACKUP_FILE_NAME);
  const decoded = new TextDecoder().decode(payload);
  return normalizeImportedVfsEntries(JSON.parse(decoded));
}

function createStoredZip(fileName: string, data: Uint8Array) {
  const fileNameBytes = new TextEncoder().encode(fileName);
  const crc = crc32(data);
  const localHeaderSize = 30 + fileNameBytes.length;
  const centralHeaderSize = 46 + fileNameBytes.length;
  const totalSize = localHeaderSize + data.length + centralHeaderSize + 22;
  const bytes = new Uint8Array(totalSize);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  const writeBytes = (chunk: Uint8Array) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  };
  const writeUint16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const writeUint32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };

  const writeFileHeader = () => {
    writeUint32(0x04034b50);
    writeUint16(20);
    writeUint16(0x0800);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(crc);
    writeUint32(data.length);
    writeUint32(data.length);
    writeUint16(fileNameBytes.length);
    writeUint16(0);
    writeBytes(fileNameBytes);
    writeBytes(data);
  };

  const writeCentralDirectory = () => {
    writeUint32(0x02014b50);
    writeUint16(20);
    writeUint16(20);
    writeUint16(0x0800);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(crc);
    writeUint32(data.length);
    writeUint32(data.length);
    writeUint16(fileNameBytes.length);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint16(0);
    writeUint32(0);
    writeUint32(0);
    writeBytes(fileNameBytes);
  };

  writeFileHeader();
  const centralDirectoryOffset = offset;
  writeCentralDirectory();
  const centralDirectorySize = offset - centralDirectoryOffset;

  writeUint32(0x06054b50);
  writeUint16(0);
  writeUint16(0);
  writeUint16(1);
  writeUint16(1);
  writeUint32(centralDirectorySize);
  writeUint32(centralDirectoryOffset);
  writeUint16(0);

  return bytes;
}

function readStoredZipFile(bytes: Uint8Array, fileName: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameOffset = offset + 30;
    const dataOffset = nameOffset + fileNameLength + extraLength;
    const nextOffset = dataOffset + compressedSize;
    const currentFileName = decoder.decode(bytes.slice(nameOffset, nameOffset + fileNameLength));

    if (flags & 0x0001) {
      throw new Error("암호화된 ZIP은 지원하지 않습니다.");
    }
    if (flags & 0x0008) {
      throw new Error("데이터 디스크립터 ZIP은 지원하지 않습니다.");
    }
    if (compressionMethod !== 0) {
      throw new Error("PocketDesk에서 내보낸 ZIP만 가져올 수 있습니다.");
    }
    if (nextOffset > bytes.length) {
      throw new Error("ZIP 파일이 손상되었습니다.");
    }
    if (currentFileName === fileName) {
      return bytes.slice(dataOffset, nextOffset);
    }

    offset = nextOffset;
  }

  throw new Error(`${fileName} 파일을 찾지 못했습니다.`);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createDefaultVfsEntries(): DesktopItem[] {
  const now = Date.now();
  const storedNoteContent = localStorage.getItem(NOTE_KEY);
  const noteContent =
    storedNoteContent && storedNoteContent !== LEGACY_DEFAULT_NOTE_CONTENT ? storedNoteContent : "";

  return [
    {
      content: noteContent,
      createdAt: now - 5000,
      id: VFS_PRIMARY_NOTE_ID,
      kind: "note",
      name: "notes.txt",
      parentId: VFS_ROOT_ID,
      showOnDesktop: false,
      updatedAt: now - 5000,
      x: 0,
      y: 0,
    },
    {
      createdAt: now - 3000,
      id: VFS_PRIMARY_CANVAS_ID,
      kind: "canvas",
      name: "sketch.canvas",
      parentId: VFS_ROOT_ID,
      showOnDesktop: false,
      updatedAt: now - 3000,
      x: 0,
      y: 0,
    },
    {
      appId: "minesweeper",
      createdAt: now - 2000,
      id: "vfs-minefield",
      kind: "game",
      name: "minefield.game",
      parentId: VFS_ROOT_ID,
      showOnDesktop: false,
      updatedAt: now - 2000,
      x: 0,
      y: 0,
    },
    {
      appId: "browser",
      content: "https://example.com",
      createdAt: now - 1000,
      id: "vfs-web-surf",
      kind: "shortcut",
      name: "web-surf.url",
      parentId: VFS_ROOT_ID,
      showOnDesktop: false,
      updatedAt: now - 1000,
      x: 0,
      y: 0,
    },
  ];
}

function loadLegacyDesktopItems(): DesktopItem[] {
  const stored = localStorage.getItem(DESKTOP_ITEMS_KEY);
  if (stored === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => normalizePersistedDesktopItem(item as PersistedDesktopItem, index))
      .filter((item): item is DesktopItem => Boolean(item))
      .slice(0, 60);
  } catch {
    return [];
  }
}

function normalizePersistedDesktopItem(
  item: PersistedDesktopItem,
  index: number,
): DesktopItem | null {
  if (
    item.kind !== "folder" &&
    item.kind !== "note" &&
    item.kind !== "canvas" &&
    item.kind !== "shortcut" &&
    item.kind !== "game"
  ) {
    return null;
  }

  const position = clampIconPosition(Number(item.x), Number(item.y));
  const createdAt = Number(item.createdAt);
  const updatedAt = Number(item.updatedAt);
  const trashedAt = Number(item.trashedAt);
  const trashed = Boolean(item.trashed);
  const showOnDesktop = Boolean(item.showOnDesktop ?? true);

  return {
    appId: typeof item.appId === "string" && appsById.has(item.appId as AppId) ? (item.appId as AppId) : undefined,
    content: typeof item.content === "string" ? item.content : undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - index * 1000,
    id: typeof item.id === "string" ? item.id : `${item.kind}-${crypto.randomUUID()}`,
    kind: item.kind,
    name:
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, 48)
        : getDefaultVfsEntryName(item.kind),
    parentId: typeof item.parentId === "string" ? item.parentId : VFS_ROOT_ID,
    restoreShowOnDesktop:
      typeof item.restoreShowOnDesktop === "boolean" ? item.restoreShowOnDesktop : showOnDesktop,
    showOnDesktop: trashed ? false : showOnDesktop,
    trashed,
    trashedAt: Number.isFinite(trashedAt) ? trashedAt : undefined,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : Date.now(),
    ...position,
  };
}

function getUniqueTextFileName(items: DesktopItem[]) {
  const existingNames = new Set(items.map((item) => item.name));
  const baseName = "새 텍스트 문서.txt";
  if (!existingNames.has(baseName)) return baseName;

  for (let index = 2; index < 1000; index += 1) {
    const name = `새 텍스트 문서 (${index}).txt`;
    if (!existingNames.has(name)) return name;
  }
  return `새 텍스트 문서 ${Date.now()}.txt`;
}

function getUniqueVfsCopyName(existingNames: Set<string>, sourceName: string) {
  const { base, extension } = getVfsNameParts(sourceName);
  const firstCopyName = `${base} - 복사본${extension}`;
  if (!existingNames.has(firstCopyName)) return firstCopyName;

  for (let index = 2; index < 1000; index += 1) {
    const name = `${base} - 복사본 (${index})${extension}`;
    if (!existingNames.has(name)) return name;
  }
  return `${base} - 복사본 ${Date.now()}${extension}`.slice(0, 48);
}

function getDefaultVfsEntryName(kind: VfsEntryKind) {
  if (kind === "canvas") return "새 그림.canvas";
  if (kind === "folder") return "가져온 폴더";
  if (kind === "game") return "게임.game";
  if (kind === "shortcut") return "바로 가기.url";
  return "새 메모.txt";
}

function getUniqueCanvasItemName(items: DesktopItem[]) {
  const existingNames = new Set(items.map((item) => item.name));

  for (let index = 1; index < 1000; index += 1) {
    const name = `그림 ${index}.png`;
    if (!existingNames.has(name)) {
      return name;
    }
  }

  return `그림 ${Date.now()}.png`;
}

function normalizeVfsEntryName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 48);
}

function getVfsNameParts(name: string) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { base: name, extension: "" };
  }

  return {
    base: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

function getUniqueRenamedVfsItemName(items: DesktopItem[], itemId: string, name: string) {
  const currentName = items.find((item) => item.id === itemId)?.name ?? "untitled";
  const requestedName = normalizeVfsEntryName(name) || currentName;
  const existingNames = new Set(items.filter((item) => item.id !== itemId).map((item) => item.name));

  if (!existingNames.has(requestedName)) {
    return requestedName;
  }

  const { base, extension } = getVfsNameParts(requestedName);
  for (let index = 2; index < 1000; index += 1) {
    const nextName = `${base} ${index}${extension}`;
    if (!existingNames.has(nextName)) {
      return nextName.slice(0, 48);
    }
  }

  return `${base} ${Date.now()}${extension}`.slice(0, 48);
}

function getVfsEntryExtension(item: DesktopItem) {
  const extension = getVfsNameParts(item.name).extension.replace(/^\./, "").toLowerCase();
  if (extension) return extension;
  if (item.kind === "folder") return "folder";
  if (item.kind === "canvas") return "canvas";
  if (item.kind === "game") return "game";
  if (item.kind === "shortcut") return "url";
  return "txt";
}

function getVfsEntryAssociation(item: DesktopItem): VfsEntryAssociation {
  const extension = getVfsEntryExtension(item);

  if (item.kind === "folder" || extension === "folder") {
    return createVfsEntryAssociation("files", "folder", "Folder");
  }

  if (extension === "txt") {
    return createVfsEntryAssociation("notepad", extension, "TXT document");
  }

  if (extension === "md" || extension === "markdown") {
    return createVfsEntryAssociation("notepad", extension, "Markdown document");
  }

  if (extension === "png") {
    return createVfsEntryAssociation("paint", extension, "PNG image");
  }

  if (extension === "canvas") {
    return createVfsEntryAssociation("paint", extension, "Canvas image");
  }

  if (extension === "url") {
    return createVfsEntryAssociation("browser", extension, "URL shortcut");
  }

  if (extension === "game") {
    return createVfsEntryAssociation(item.appId ?? "minesweeper", extension, "Game file");
  }

  return createVfsEntryAssociation(getVfsEntryKindDefaultApp(item), extension, `${extension.toUpperCase()} file`);
}

function createVfsEntryAssociation(appId: AppId, extension: string, typeLabel: string): VfsEntryAssociation {
  const app = getApp(appId);
  return {
    accent: app.accent,
    appId,
    appTitle: app.title,
    extension,
    icon: app.icon,
    typeLabel,
  };
}

function getResultIconTileTone(result: StartSearchResult) {
  return result.kind === "app" ? "app" : "file";
}

function getVfsEntryKindDefaultApp(item: DesktopItem): AppId {
  if (item.appId) return item.appId;
  if (item.kind === "folder") return "files";
  if (item.kind === "canvas") return "paint";
  if (item.kind === "game") return "minesweeper";
  if (item.kind === "shortcut") return "browser";
  return "notepad";
}

function getVfsEntryDetail(item: DesktopItem) {
  const association = getVfsEntryAssociation(item);
  if (item.kind === "folder") {
    return "가져온 ZIP에 포함된 폴더 항목입니다.";
  }
  if (item.kind === "note") {
    return item.content?.trim() || "저장된 메모 내용이 없습니다.";
  }
  if (item.kind === "canvas") {
    return item.content
      ? "저장된 PNG 그림입니다. 그림판에서 다시 열 수 있습니다."
      : "그림판에서 새 그림을 그릴 수 있습니다.";
  }
  if (item.kind === "game") {
    return `${association.appTitle}로 실행되는 게임 파일입니다.`;
  }
  return `${association.appTitle}에서 ${getVfsShortcutTarget(item)} 주소를 엽니다.`;
}

function getVfsShortcutTarget(item: DesktopItem) {
  const content = typeof item.content === "string" ? item.content.trim() : "";
  if (content) return content;
  return "https://example.com";
}

function getThemeLabel(theme: ThemeName) {
  if (theme === "meadow") return "Meadow";
  if (theme === "ember") return "Ember";
  return "Lagoon";
}

function formatDesktopItemTime(createdAt: number) {
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  return "오늘";
}

function formatNotificationTime(createdAt: number) {
  const seconds = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
  if (seconds < 45) return "방금 전";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  return new Date(createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function createCalendarGrid(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildStartSearchResults(
  query: string,
  desktopItems: DesktopItem[],
  apps: AppDefinition[],
): StartSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const appResults = apps
    .map((app): StartSearchResult | null => {
      const rank = rankSearchCandidate(normalizedQuery, [
        app.title,
        app.subtitle,
        ...appSearchKeywords[app.id],
      ]);
      if (!rank) {
        return null;
      }

      return {
        accent: app.accent,
        appId: app.id,
        icon: app.icon,
        id: `app-${app.id}`,
        kind: "app",
        matchLabel: rank.matchLabel,
        score: rank.score,
        sourceLabel: "앱",
        subtitle: app.subtitle,
        title: app.title,
      };
    })
    .filter((result): result is StartSearchResult => Boolean(result));

  const desktopResults = desktopItems
    .map((item): StartSearchResult | null => {
      const association = getVfsEntryAssociation(item);
      const rank = rankSearchCandidate(normalizedQuery, [
        item.name,
        association.typeLabel,
        association.appTitle,
        item.kind,
        "desktop",
        "바탕화면",
      ]);
      if (!rank) {
        return null;
      }

      return {
        accent: association.accent,
        icon: association.icon,
        id: `desktop-${item.id}`,
        item,
        kind: "desktopItem",
        matchLabel: rank.matchLabel,
        score: rank.score,
        sourceLabel: "바탕화면",
        subtitle: `${association.typeLabel} · ${association.appTitle}`,
        title: item.name,
      };
    })
    .filter((result): result is StartSearchResult => Boolean(result));

  return [...appResults, ...desktopResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });
}

function getStartPinnedApps(apps: AppDefinition[]) {
  const priority: AppId[] = [
    "thispc",
    "files",
    "recycle",
    "notepad",
    "paint",
    "calculator",
    "browser",
    "minesweeper",
    "settings",
  ];
  const appMap = new Map(apps.map((app) => [app.id, app]));
  const pinned = priority
    .map((appId) => appMap.get(appId))
    .filter((app): app is AppDefinition => Boolean(app));
  if (pinned.length >= 6) return pinned.slice(0, 9);

  return [
    ...pinned,
    ...apps.filter((app) => !priority.includes(app.id)).slice(0, 9 - pinned.length),
  ];
}

function resolveRunCommand(command: string): RunCommandResolution {
  const trimmed = command.trim();
  if (!trimmed) {
    return { kind: "unknown", value: "" };
  }

  const normalizedCommand = normalizeRunCommand(trimmed);
  const matchedApp = appCatalog.find((app) =>
    getRunCommandCandidates(app).some((candidate) => normalizeRunCommand(candidate) === normalizedCommand),
  );

  if (matchedApp) {
    return { appId: matchedApp.id, kind: "app" };
  }

  if (isBrowserRunTarget(trimmed)) {
    return { kind: "browser", value: trimmed };
  }

  return { kind: "unknown", value: trimmed };
}

function getRunCommandCandidates(app: AppDefinition) {
  return [
    app.id,
    `${app.id}.exe`,
    app.title,
    app.title.replace(/\s+/g, ""),
    app.subtitle,
    ...appSearchKeywords[app.id],
    ...(runCommandAliases[app.id] ?? []),
  ];
}

function normalizeRunCommand(value: string) {
  return normalizeSearchText(value)
    .replace(/\s+/g, " ")
    .replace(/\.exe$/i, "");
}

function isBrowserRunTarget(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return true;
  }
  return /\s/.test(trimmed);
}

function rankSearchCandidate(
  query: string,
  fields: string[],
): { matchLabel: string; score: number } | null {
  const tokens = query.split(" ").filter(Boolean);
  let bestMatch: { matchLabel: string; score: number } | null = null;

  for (const [index, field] of fields.entries()) {
    const normalizedField = normalizeSearchText(field);
    if (!normalizedField) continue;

    let score = 0;
    if (normalizedField === query) {
      score = 130;
    } else if (normalizedField.startsWith(query)) {
      score = 112;
    } else if (normalizedField.split(" ").some((token) => token.startsWith(query))) {
      score = 96;
    } else if (normalizedField.includes(query)) {
      score = 78;
    } else if (tokens.length > 1 && tokens.every((token) => normalizedField.includes(token))) {
      score = 64;
    }

    if (score === 0) continue;

    const adjustedScore = score - index;
    if (!bestMatch || adjustedScore > bestMatch.score) {
      bestMatch = { matchLabel: field, score: adjustedScore };
    }
  }

  return bestMatch;
}

function createDefaultIconLayout(): DesktopIconLayout {
  return desktopApps.reduce<DesktopIconLayout>((layout, app, index) => {
    layout[app.id] = clampIconPosition(18, 18 + index * 110);
    return layout;
  }, {});
}

function loadDesktopViewMode(): DesktopViewMode {
  const stored = localStorage.getItem(DESKTOP_ICON_VIEW_KEY);
  return stored === "small" || stored === "large" ? stored : "medium";
}

function loadDesktopSortKey(): DesktopSortKey {
  const stored = localStorage.getItem(DESKTOP_ICON_SORT_KEY);
  return stored === "type" || stored === "modified" ? stored : "name";
}

function getDesktopIconMetrics(viewMode: DesktopViewMode) {
  if (viewMode === "small") return { height: 76, width: 76 };
  if (viewMode === "large") return { height: 116, width: 110 };
  return { height: DESKTOP_ICON_HEIGHT, width: DESKTOP_ICON_WIDTH };
}

function createDesktopGridPositions(count: number, viewMode: DesktopViewMode): IconPosition[] {
  const metrics = getDesktopIconMetrics(viewMode);
  const gapX = 18;
  const gapY = 10;
  const origin = 18;
  const availableHeight = Math.max(
    metrics.height,
    window.innerHeight - APP_BAR_HEIGHT - origin * 2,
  );
  const rows = Math.max(1, Math.floor((availableHeight + gapY) / (metrics.height + gapY)));

  return Array.from({ length: count }, (_, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    return clampIconPosition(
      origin + column * (metrics.width + gapX),
      origin + row * (metrics.height + gapY),
      viewMode,
    );
  });
}

function findAvailableDesktopPosition(
  preferred: IconPosition,
  viewMode: DesktopViewMode,
  occupiedPositions: IconPosition[],
) {
  const candidates = [
    clampIconPosition(preferred.x, preferred.y, viewMode),
    ...createDesktopGridPositions(160, viewMode),
  ];
  return (
    candidates.find((candidate) =>
      occupiedPositions.every(
        (position) =>
          !rectsIntersect(
            getDesktopIconBounds(candidate, viewMode),
            getDesktopIconBounds(position, viewMode),
          ),
      ),
    ) ?? clampIconPosition(preferred.x, preferred.y, viewMode)
  );
}

function compareDesktopEntries(
  first: { name: string; type: string; updatedAt: number },
  second: { name: string; type: string; updatedAt: number },
  sortKey: DesktopSortKey,
) {
  if (sortKey === "modified" && first.updatedAt !== second.updatedAt) {
    return second.updatedAt - first.updatedAt;
  }
  if (sortKey === "type") {
    const typeOrder = first.type.localeCompare(second.type, "ko", {
      numeric: true,
      sensitivity: "base",
    });
    if (typeOrder !== 0) return typeOrder;
  }
  return first.name.localeCompare(second.name, "ko", { numeric: true, sensitivity: "base" });
}

function loadDesktopIconLayout(): DesktopIconLayout {
  const fallback = createDefaultIconLayout();
  const stored = localStorage.getItem(DESKTOP_ICON_LAYOUT_KEY);
  if (stored === null) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(stored);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }

    return desktopApps.reduce<DesktopIconLayout>((layout, app) => {
      const item = (parsed as Record<string, PersistedIconPosition>)[app.id];
      if (item && typeof item === "object") {
        layout[app.id] = clampIconPosition(Number(item.x), Number(item.y));
      } else {
        layout[app.id] = fallback[app.id];
      }
      return layout;
    }, {});
  } catch {
    return fallback;
  }
}

function persistDesktopIconLayout(layout: DesktopIconLayout) {
  const payload = desktopApps.reduce<DesktopIconLayout>((next, app) => {
    const position = layout[app.id];
    if (position) {
      next[app.id] = position;
    }
    return next;
  }, {});
  localStorage.setItem(DESKTOP_ICON_LAYOUT_KEY, JSON.stringify(payload));
}

function clampIconPosition(
  x: number,
  y: number,
  viewMode: DesktopViewMode = "medium",
): IconPosition {
  const metrics = getDesktopIconMetrics(viewMode);
  const maxX = Math.max(8, window.innerWidth - metrics.width - 8);
  const maxY = Math.max(8, window.innerHeight - APP_BAR_HEIGHT - metrics.height - 8);
  return {
    x: clamp(Number.isFinite(x) ? x : 18, 8, maxX),
    y: clamp(Number.isFinite(y) ? y : 18, 8, maxY),
  };
}

function snapDesktopIconPosition(position: IconPosition, viewMode: DesktopViewMode) {
  const metrics = getDesktopIconMetrics(viewMode);
  const origin = 18;
  const x = origin + Math.round((position.x - origin) / (metrics.width + 18)) * (metrics.width + 18);
  const y = origin + Math.round((position.y - origin) / (metrics.height + 10)) * (metrics.height + 10);
  return clampIconPosition(x, y, viewMode);
}

function clampContextMenuPosition(x: number, y: number): IconPosition {
  const safeX = Number.isFinite(x) ? x : 18;
  const safeY = Number.isFinite(y) ? y : 18;
  return {
    x: clamp(safeX, 8, Math.max(8, window.innerWidth - CONTEXT_MENU_WIDTH - 8)),
    y: clamp(
      safeY,
      8,
      Math.max(8, window.innerHeight - APP_BAR_HEIGHT - CONTEXT_MENU_HEIGHT - 8),
    ),
  };
}

function clampWindowSystemMenuPosition(x: number, y: number): IconPosition {
  return {
    x: clamp(x, 8, Math.max(8, window.innerWidth - WINDOW_SYSTEM_MENU_WIDTH - 8)),
    y: clamp(y, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - WINDOW_SYSTEM_MENU_HEIGHT - 8)),
  };
}

function getDesktopSelectionBounds(selection: DesktopSelectionState) {
  const left = Math.min(selection.startX, selection.currentX);
  const top = Math.min(selection.startY, selection.currentY);
  const right = Math.max(selection.startX, selection.currentX);
  const bottom = Math.max(selection.startY, selection.currentY);
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function getDesktopSelectionStyle(selection: DesktopSelectionState): React.CSSProperties {
  const bounds = getDesktopSelectionBounds(selection);
  return {
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
  };
}

function isDesktopSelectionVisible(selection: DesktopSelectionState) {
  const bounds = getDesktopSelectionBounds(selection);
  return bounds.width > 5 || bounds.height > 5;
}

function getDesktopSelectionIds(
  selection: DesktopSelectionState,
  iconLayout: DesktopIconLayout,
  desktopItems: DesktopItem[],
  viewMode: DesktopViewMode,
) {
  if (!isDesktopSelectionVisible(selection)) return [];

  const selectionBounds = getDesktopSelectionBounds(selection);
  const fallbackLayout = createDefaultIconLayout();
  const selectedIds: string[] = [];

  desktopApps.forEach((app) => {
    const position = iconLayout[app.id] ?? fallbackLayout[app.id];
    if (position && rectsIntersect(selectionBounds, getDesktopIconBounds(position, viewMode))) {
      selectedIds.push(`app:${app.id}`);
    }
  });

  desktopItems
    .filter((item) => item.showOnDesktop)
    .forEach((item) => {
      if (rectsIntersect(selectionBounds, getDesktopIconBounds(item, viewMode))) {
        selectedIds.push(`item:${item.id}`);
      }
    });

  return selectedIds;
}

function getDesktopIconBounds(position: IconPosition, viewMode: DesktopViewMode) {
  const metrics = getDesktopIconMetrics(viewMode);
  return {
    bottom: position.y + metrics.height,
    left: position.x,
    right: position.x + metrics.width,
    top: position.y,
  };
}

function rectsIntersect(
  first: { bottom: number; left: number; right: number; top: number },
  second: { bottom: number; left: number; right: number; top: number },
) {
  return (
    first.left <= second.right &&
    first.right >= second.left &&
    first.top <= second.bottom &&
    first.bottom >= second.top
  );
}

function DesktopIcon({
  app,
  onContextMenu,
  onMove,
  onOpen,
  onSelect,
  position,
  selected,
}: {
  app: AppDefinition;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  position: IconPosition;
  selected: boolean;
}) {
  const Icon = app.icon;
  return (
    <DesktopIconButton
      accent={app.accent}
      icon={Icon}
      onContextMenu={onContextMenu}
      onMove={onMove}
      onOpen={onOpen}
      onSelect={onSelect}
      position={position}
      selected={selected}
      title={app.title}
    />
  );
}

function DesktopItemIcon({
  draftName,
  item,
  onCancelRename,
  onChangeDraftName,
  onCommitRename,
  onContextMenu,
  onMove,
  onOpen,
  onSelect,
  renaming,
  selected,
  viewMode,
}: {
  draftName: string;
  item: DesktopItem;
  onCancelRename: () => void;
  onChangeDraftName: (name: string) => void;
  onCommitRename: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  renaming: boolean;
  selected: boolean;
  viewMode: DesktopViewMode;
}) {
  const association = getVfsEntryAssociation(item);
  return (
    <>
      <DesktopIconButton
        accent={association.accent}
        icon={association.icon}
        onContextMenu={onContextMenu}
        onMove={onMove}
        onOpen={onOpen}
        onSelect={onSelect}
        position={item}
        selected={selected}
        title={item.name}
        tone="file"
      />
      {renaming && (
        <form
          className={`desktop-icon-rename desktop-icon-rename-${viewMode}`}
          onPointerDown={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            onCommitRename();
          }}
          style={{ left: item.x, top: item.y }}
        >
          <input
            aria-label="바탕 화면 파일 이름"
            autoFocus
            onBlur={onCommitRename}
            onChange={(event) => onChangeDraftName(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              onCancelRename();
            }}
            value={draftName}
          />
        </form>
      )}
    </>
  );
}

function AppIconTile({
  accent,
  className = "",
  icon: Icon,
  size = "medium",
  tone = "app",
}: {
  accent: string;
  className?: string;
  icon: LucideIcon;
  size?: "tiny" | "small" | "medium" | "large";
  tone?: "app" | "file";
}) {
  const iconSize = size === "large" ? 26 : size === "medium" ? 22 : size === "small" ? 17 : 14;

  return (
    <span
      aria-hidden="true"
      className={`app-icon-tile app-icon-${size} app-icon-${tone} ${className}`.trim()}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Icon aria-hidden="true" size={iconSize} strokeWidth={2.35} />
    </span>
  );
}

function DesktopIconButton({
  accent,
  icon: Icon,
  onContextMenu,
  onMove,
  onOpen,
  onSelect,
  position,
  selected,
  title,
  tone = "app",
}: {
  accent: string;
  icon: LucideIcon;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  position: IconPosition;
  selected: boolean;
  title: string;
  tone?: "app" | "file";
}) {
  const dragState = useRef<{
    moved: boolean;
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressNextClick = useRef(false);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      moved: false,
      originX: position.x,
      originY: position.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      state.moved = true;
      onMove({ x: state.originX + deltaX, y: state.originY + deltaY });
    }
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;
    if (event.currentTarget.hasPointerCapture(state.pointerId)) {
      event.currentTarget.releasePointerCapture(state.pointerId);
    }
    suppressNextClick.current = state.moved;
    dragState.current = null;
    window.setTimeout(() => {
      suppressNextClick.current = false;
    }, 50);
  };

  const handleClick = () => {
    if (suppressNextClick.current) return;
  };

  return (
    <button
      className={`desktop-icon ${selected ? "is-selected" : ""}`}
      onClick={(event) => {
        handleClick();
        if (!suppressNextClick.current) onSelect(event);
      }}
      onContextMenu={onContextMenu}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!suppressNextClick.current) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      onPointerCancel={endDrag}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      style={{ left: position.x, top: position.y }}
      title={title}
      type="button"
    >
      <AppIconTile accent={accent} icon={Icon} size="large" tone={tone} />
      <span>{title}</span>
    </button>
  );
}

function DesktopContextMenu({
  alignToGrid,
  currentSort,
  currentView,
  onChangeWallpaper,
  onCreateNote,
  onPaste,
  onRefresh,
  onSort,
  onToggleGrid,
  onViewChange,
  pasteEnabled,
  x,
  y,
}: {
  alignToGrid: boolean;
  currentSort: DesktopSortKey;
  currentView: DesktopViewMode;
  onChangeWallpaper: () => void;
  onCreateNote: () => void;
  onPaste: () => void;
  onRefresh: () => void;
  onSort: (sortKey: DesktopSortKey) => void;
  onToggleGrid: () => void;
  onViewChange: (viewMode: DesktopViewMode) => void;
  pasteEnabled: boolean;
  x: number;
  y: number;
}) {
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [submenu, setSubmenu] = useState<"new" | "sort" | "view" | null>(null);
  const opensLeft = x > window.innerWidth - CONTEXT_MENU_WIDTH * 2 - 20;

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  return (
    <div
      aria-label="바탕 화면 메뉴"
      className={`desktop-context-menu ${opensLeft ? "opens-left" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <div className="desktop-menu-row" onMouseEnter={() => setSubmenu("view")}>
        <button
          aria-expanded={submenu === "view"}
          aria-haspopup="menu"
          onClick={() => setSubmenu((current) => (current === "view" ? null : "view"))}
          ref={firstItemRef}
          role="menuitem"
          type="button"
        >
          <LayoutGrid aria-hidden="true" size={16} />
          <span>보기</span>
          <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
        </button>
        {submenu === "view" && (
          <div aria-label="보기" className="desktop-context-submenu" role="menu">
            {(
              [
                ["large", "큰 아이콘"],
                ["medium", "보통 아이콘"],
                ["small", "작은 아이콘"],
              ] as Array<[DesktopViewMode, string]>
            ).map(([viewMode, label]) => (
              <button
                aria-checked={currentView === viewMode}
                key={viewMode}
                onClick={() => onViewChange(viewMode)}
                role="menuitemradio"
                type="button"
              >
                {currentView === viewMode ? <Check aria-hidden="true" size={15} /> : <span />}
                {label}
              </button>
            ))}
            <span aria-hidden="true" className="menu-separator" />
            <button
              aria-checked={alignToGrid}
              onClick={onToggleGrid}
              role="menuitemcheckbox"
              type="button"
            >
              {alignToGrid ? <Check aria-hidden="true" size={15} /> : <span />}
              아이콘을 그리드에 맞춤
            </button>
          </div>
        )}
      </div>
      <div className="desktop-menu-row" onMouseEnter={() => setSubmenu("sort")}>
        <button
          aria-expanded={submenu === "sort"}
          aria-haspopup="menu"
          onClick={() => setSubmenu((current) => (current === "sort" ? null : "sort"))}
          role="menuitem"
          type="button"
        >
          <Grid2X2 aria-hidden="true" size={16} />
          <span>정렬 기준</span>
          <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
        </button>
        {submenu === "sort" && (
          <div aria-label="정렬 기준" className="desktop-context-submenu" role="menu">
            {(
              [
                ["name", "이름"],
                ["type", "항목 유형"],
                ["modified", "수정한 날짜"],
              ] as Array<[DesktopSortKey, string]>
            ).map(([sortKey, label]) => (
              <button
                aria-checked={currentSort === sortKey}
                key={sortKey}
                onClick={() => onSort(sortKey)}
                role="menuitemradio"
                type="button"
              >
                {currentSort === sortKey ? <Check aria-hidden="true" size={15} /> : <span />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onRefresh} onMouseEnter={() => setSubmenu(null)} role="menuitem" type="button">
        <RefreshCw aria-hidden="true" size={16} />
        새로 고침
      </button>
      <span aria-hidden="true" className="menu-separator" />
      <button
        disabled={!pasteEnabled}
        onClick={onPaste}
        onMouseEnter={() => setSubmenu(null)}
        role="menuitem"
        type="button"
      >
        <ClipboardPaste aria-hidden="true" size={16} />
        붙여넣기
      </button>
      <div className="desktop-menu-row" onMouseEnter={() => setSubmenu("new")}>
        <button
          aria-expanded={submenu === "new"}
          aria-haspopup="menu"
          onClick={() => setSubmenu((current) => (current === "new" ? null : "new"))}
          role="menuitem"
          type="button"
        >
          <FilePlus2 aria-hidden="true" size={16} />
          <span>새로 만들기</span>
          <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
        </button>
        {submenu === "new" && (
          <div aria-label="새로 만들기" className="desktop-context-submenu" role="menu">
            <button onClick={onCreateNote} role="menuitem" type="button">
              <FileText aria-hidden="true" size={16} />
              텍스트 문서
            </button>
          </div>
        )}
      </div>
      <span aria-hidden="true" className="menu-separator" />
      <button onClick={onChangeWallpaper} onMouseEnter={() => setSubmenu(null)} role="menuitem" type="button">
        <Palette aria-hidden="true" size={16} />
        개인 설정
      </button>
    </div>
  );
}

function DesktopIconContextMenu({
  appPinned,
  itemSelectionCount,
  onCopy,
  onDelete,
  onOpen,
  onProperties,
  onRename,
  onTogglePin,
  target,
  x,
  y,
}: {
  appPinned?: boolean;
  itemSelectionCount: number;
  onCopy?: () => void;
  onDelete?: () => void;
  onOpen: () => void;
  onProperties?: () => void;
  onRename?: () => void;
  onTogglePin?: () => void;
  target: {
    accent: string;
    icon: LucideIcon;
    kind: "app" | "item";
    title: string;
  };
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
      aria-label="바탕 화면 항목 메뉴"
      className="desktop-context-menu desktop-icon-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <div className="desktop-context-title">
        <AppIconTile accent={target.accent} icon={target.icon} size="tiny" tone={target.kind === "item" ? "file" : "app"} />
        <strong>{target.title}</strong>
      </div>
      <button onClick={onOpen} ref={firstItemRef} role="menuitem" type="button">
        <ExternalLink aria-hidden="true" size={16} />
        열기
      </button>
      {onCopy && (
        <button onClick={onCopy} role="menuitem" type="button">
          <Copy aria-hidden="true" size={16} />
          복사
        </button>
      )}
      {onRename && (
        <button
          disabled={itemSelectionCount > 1}
          onClick={onRename}
          role="menuitem"
          type="button"
        >
          <Pencil aria-hidden="true" size={16} />
          이름 바꾸기
        </button>
      )}
      {onTogglePin && (
        <button onClick={onTogglePin} role="menuitem" type="button">
          {appPinned ? <PinOff aria-hidden="true" size={16} /> : <Pin aria-hidden="true" size={16} />}
          {appPinned ? "작업 표시줄에서 제거" : "작업 표시줄에 고정"}
        </button>
      )}
      {onDelete && (
        <button className="desktop-context-danger" onClick={onDelete} role="menuitem" type="button">
          <Trash2 aria-hidden="true" size={16} />
          삭제
        </button>
      )}
      {onProperties && (
        <>
          <span aria-hidden="true" className="menu-separator" />
          <button onClick={onProperties} role="menuitem" type="button">
            <Info aria-hidden="true" size={16} />
            속성
          </button>
        </>
      )}
    </div>
  );
}

function DesktopItemPropertiesDialog({
  item,
  onClose,
}: {
  item: DesktopItem;
  onClose: () => void;
}) {
  const association = getVfsEntryAssociation(item);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="file-properties-overlay desktop-properties-overlay"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="바탕 화면 파일 속성"
        aria-modal="true"
        className="file-properties-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          trapDialogFocus(event, event.currentTarget);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <AppIconTile accent={association.accent} icon={association.icon} size="medium" tone="file" />
          <div>
            <h2>{item.name}</h2>
            <span>{association.typeLabel}</span>
          </div>
          <button aria-label="파일 속성 닫기" onClick={onClose} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <dl>
          <div>
            <dt>파일 형식</dt>
            <dd>{association.typeLabel}</dd>
          </div>
          <div>
            <dt>연결 프로그램</dt>
            <dd>{association.appTitle}</dd>
          </div>
          <div>
            <dt>위치</dt>
            <dd>바탕 화면</dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>{formatVfsEntrySize(item)}</dd>
          </div>
          <div>
            <dt>만든 날짜</dt>
            <dd>{formatVfsPropertyDate(item.createdAt)}</dd>
          </div>
          <div>
            <dt>수정한 날짜</dt>
            <dd>{formatVfsPropertyDate(item.updatedAt)}</dd>
          </div>
        </dl>
        <footer>
          <button onClick={onClose} ref={confirmRef} type="button">
            확인
          </button>
        </footer>
      </section>
    </div>
  );
}

function WindowSystemMenu({
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
      <button disabled={!instance.maximized} onClick={onRestore} ref={firstItemRef} role="menuitem" type="button">
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

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`brand-mark ${className}`.trim()}
      src={getAssetUrl("brand/pocketdesk-mark.svg")}
    />
  );
}

function StartGlyph() {
  return (
    <span aria-hidden="true" className="start-glyph">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function ToastStack({
  onDismiss,
  toasts,
}: {
  onDismiss: (id: string) => void;
  toasts: ToastMessage[];
}) {
  return (
    <section aria-label="알림" className="toast-stack" role="status">
      {toasts.map((toast) => (
        <article className={`toast toast-${toast.tone}`} key={toast.id}>
          <header className="toast-header">
            <BrandMark className="toast-app-mark" />
            <strong>PocketDesk</strong>
            <time dateTime={new Date(toast.createdAt).toISOString()}>지금</time>
            <button
              aria-label={`${toast.title} 알림 닫기`}
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </header>
          <div className="toast-body">
            <strong>{toast.title}</strong>
            {toast.detail && <small>{toast.detail}</small>}
          </div>
        </article>
      ))}
    </section>
  );
}

function ShellGate({
  onPowerOn,
  onUnlock,
  phase,
  wallpaper,
}: {
  onPowerOn: () => void;
  onUnlock: () => void;
  phase: ShellPhase;
  wallpaper: WallpaperName;
}) {
  if (phase === "booting") {
    return (
      <section className="shell-gate shell-boot" aria-label="부팅 화면">
        <div className="boot-windows-mark">
          <StartGlyph />
        </div>
        <span aria-hidden="true" className="boot-spinner" />
      </section>
    );
  }

  if (phase === "shutdown") {
    return <ShutdownScreen onPowerOn={onPowerOn} />;
  }

  return <LockScreen onUnlock={onUnlock} wallpaper={wallpaper} />;
}

function ShutdownScreen({ onPowerOn }: { onPowerOn: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => buttonRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <section className="shell-gate shutdown-screen" aria-label="PocketDesk 전원 꺼짐">
      <div className="shutdown-panel">
        <BrandMark />
        <strong>PocketDesk OS</strong>
        <small>전원이 꺼져 있습니다</small>
        <button onClick={onPowerOn} ref={buttonRef} type="button">
          <Power aria-hidden="true" size={17} />
          전원 켜기
        </button>
      </div>
    </section>
  );
}

function LockScreen({
  onUnlock,
  wallpaper,
}: {
  onUnlock: () => void;
  wallpaper: WallpaperName;
}) {
  const lockRef = useRef<HTMLElement>(null);
  const signInButtonRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [signInVisible, setSignInVisible] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const unlockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => lockRef.current?.focus());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!signInVisible) return;
    const frameId = window.requestAnimationFrame(() => signInButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [signInVisible]);

  useEffect(
    () => () => {
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    },
    [],
  );

  const beginUnlock = () => {
    if (unlocking) return;
    setUnlocking(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    unlockTimerRef.current = window.setTimeout(onUnlock, reduceMotion ? 0 : 220);
  };

  const unlockFromKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && signInVisible) {
      event.preventDefault();
      setSignInVisible(false);
      lockRef.current?.focus();
      return;
    }

    if (!signInVisible && (event.key === "Enter" || event.key === " " || event.key === "ArrowUp")) {
      event.preventDefault();
      setSignInVisible(true);
    }
  };

  return (
    <section
      aria-label={signInVisible ? "PocketDesk 로그인" : "PocketDesk 잠금 화면"}
      className={`shell-gate lock-screen wallpaper-${wallpaper} ${
        signInVisible ? "is-sign-in" : ""
      } ${unlocking ? "is-unlocking" : ""}`}
      onClick={() => {
        if (!signInVisible) setSignInVisible(true);
      }}
      onKeyDown={unlockFromKey}
      ref={lockRef}
      style={getWallpaperStyle(wallpaper)}
      tabIndex={0}
    >
      {signInVisible ? (
        <>
          <div aria-hidden="true" className="lock-sign-in-backdrop" />
          <div className="sign-in-panel">
            <span className="sign-in-avatar">
              <UserRound aria-hidden="true" size={48} strokeWidth={1.45} />
            </span>
            <strong>Seung-Won</strong>
            <button disabled={unlocking} onClick={beginUnlock} ref={signInButtonRef} type="button">
              로그인
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="lock-time">
            <time dateTime={now.toISOString()}>
              {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </time>
            <span>
              {now.toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </span>
          </div>
          <small className="lock-hint">클릭하거나 위로 밀어 로그인</small>
        </>
      )}
      <div className="lock-system-status" aria-label="네트워크와 소리 상태">
        <Wifi aria-hidden="true" size={17} />
        <Volume2 aria-hidden="true" size={17} />
      </div>
    </section>
  );
}

function AltTabSwitcher({
  selectedWindowId,
  windows,
}: {
  selectedWindowId: string;
  windows: WindowInstance[];
}) {
  const orderedWindows = [...windows].sort((a, b) => b.z - a.z);
  if (orderedWindows.length === 0) {
    return null;
  }

  return (
    <section aria-label="창 전환" className="alt-tab-switcher" role="status">
      <div className="alt-tab-strip">
        {orderedWindows.map((windowItem) => {
          const app = getApp(windowItem.appId);
          return (
            <div
              className={`alt-tab-item ${selectedWindowId === windowItem.id ? "is-selected" : ""}`}
              key={windowItem.id}
            >
              <AppIconTile accent={app.accent} icon={app.icon} size="large" />
              <strong>{app.title}</strong>
              <small>{windowItem.minimized ? "최소화됨" : "열림"}</small>
            </div>
          );
        })}
      </div>
      <small>Alt+Tab</small>
    </section>
  );
}

function WindowFrame({
  active,
  app,
  children,
  instance,
  motion,
  onClose,
  onFocus,
  onMinimize,
  onOpenSystemMenu,
  onSnapPreviewChange,
  onToggleMaximize,
  onUpdate,
}: {
  active: boolean;
  app: AppDefinition;
  children: React.ReactNode;
  instance: WindowInstance;
  motion?: WindowMotion;
  onClose: () => void;
  onFocus: () => void;
  onMinimize: () => void;
  onOpenSystemMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSnapPreviewChange: (preview: SnapPreviewState | null) => void;
  onToggleMaximize: () => void;
  onUpdate: (patch: Partial<WindowInstance>) => void;
}) {
  const [snapFlyoutOpen, setSnapFlyoutOpen] = useState(false);

  if (instance.minimized) {
    return null;
  }

  const frameStyle = instance.maximized
    ? {
        inset: `0 0 ${APP_BAR_HEIGHT}px 0`,
        zIndex: instance.z,
      }
    : {
        left: instance.x,
        top: instance.y,
        width: instance.width,
        height: instance.height,
        zIndex: instance.z,
      };

  const startMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || instance.maximized) return;
    event.preventDefault();
    onFocus();
    const startX = event.clientX;
    const startY = event.clientY;
    const { x, y, width, height } = instance;
    let activeSnapZone: SnapZone | null = null;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const nextX = x + moveEvent.clientX - startX;
      const nextY = y + moveEvent.clientY - startY;
      activeSnapZone = getWindowSnapZone(moveEvent.clientX, moveEvent.clientY);
      onSnapPreviewChange(activeSnapZone ? { zone: activeSnapZone } : null);
      onUpdate({
        x: clamp(nextX, 8, Math.max(8, window.innerWidth - width - 8)),
        y: clamp(nextY, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8)),
      });
    };

    const onPointerUp = () => {
      if (activeSnapZone) {
        onUpdate(getWindowSnapPatch(activeSnapZone));
      }
      onSnapPreviewChange(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || instance.maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    const startX = event.clientX;
    const startY = event.clientY;
    const { width, height, x, y } = instance;

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      onUpdate({
        width: clamp(width + moveEvent.clientX - startX, 320, window.innerWidth - x - 8),
        height: clamp(
          height + moveEvent.clientY - startY,
          240,
          window.innerHeight - APP_BAR_HEIGHT - y - 8,
        ),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleTitlebarDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".window-controls")) return;
    onToggleMaximize();
  };

  const applySnapLayout = (zone: SnapZone) => {
    onFocus();
    onUpdate(getWindowSnapPatch(zone));
    setSnapFlyoutOpen(false);
  };

  return (
    <article
      aria-label={app.title}
      className={`window-frame ${active ? "is-active" : ""} ${
        instance.maximized ? "is-maximized" : ""
      } ${motion ? `is-${motion}` : ""}`}
      onPointerDown={onFocus}
      style={frameStyle}
    >
      <div
        className="window-titlebar"
        onContextMenu={onOpenSystemMenu}
        onDoubleClick={handleTitlebarDoubleClick}
        onPointerDown={startMove}
      >
        <div className="window-title">
          <AppIconTile accent={app.accent} icon={app.icon} size="tiny" />
          <span>{app.title}</span>
        </div>
        <div className="window-controls">
          <button aria-label={`${app.title} 최소화`} onClick={onMinimize} title="최소화" type="button">
            <Minus aria-hidden="true" size={14} />
          </button>
          <div
            className="maximize-control"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setSnapFlyoutOpen(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSnapFlyoutOpen(false);
                event.currentTarget.querySelector<HTMLButtonElement>(":scope > button")?.focus();
              }
            }}
            onMouseEnter={() => !instance.maximized && setSnapFlyoutOpen(true)}
            onMouseLeave={() => setSnapFlyoutOpen(false)}
          >
            <button
              aria-expanded={snapFlyoutOpen}
              aria-haspopup="menu"
              aria-label={`${app.title} 최대화`}
              onClick={onToggleMaximize}
              onFocus={() => !instance.maximized && setSnapFlyoutOpen(true)}
              title="최대화"
              type="button"
            >
              {instance.maximized ? (
                <Copy aria-hidden="true" size={12} />
              ) : (
                <Square aria-hidden="true" size={11} />
              )}
            </button>
            {snapFlyoutOpen && !instance.maximized && (
              <div aria-label="스냅 레이아웃" className="snap-layout-flyout" role="menu">
                <button
                  aria-label="왼쪽 절반에 맞춤"
                  onClick={() => applySnapLayout("left")}
                  role="menuitem"
                  title="왼쪽 절반"
                  type="button"
                >
                  <span className="snap-layout-thumb snap-left" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <button
                  aria-label="오른쪽 절반에 맞춤"
                  onClick={() => applySnapLayout("right")}
                  role="menuitem"
                  title="오른쪽 절반"
                  type="button"
                >
                  <span className="snap-layout-thumb snap-right" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                <button
                  aria-label="화면에 최대화"
                  onClick={() => applySnapLayout("top")}
                  role="menuitem"
                  title="최대화"
                  type="button"
                >
                  <span className="snap-layout-thumb snap-top" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
              </div>
            )}
          </div>
          <button aria-label={`${app.title} 닫기`} onClick={onClose} title="닫기" type="button">
            <X aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
      <div className="window-content">{children}</div>
      {!instance.maximized && (
        <div aria-hidden="true" className="resize-handle" onPointerDown={startResize} />
      )}
    </article>
  );
}

function SnapPreview({ zone }: { zone: SnapZone }) {
  return <div aria-hidden="true" className="snap-preview" style={getSnapPreviewStyle(zone)} />;
}

function Taskbar({
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
    window?: WindowInstance;
  } | null>(null);
  const [taskbarMenu, setTaskbarMenu] = useState<{ appId: AppId; left: number } | null>(null);
  const taskbarMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [trayPanel, setTrayPanel] = useState<"notifications" | "quick" | null>(null);
  const availableAppIds = new Set(availableApps.map((app) => app.id));
  const pinnedApps = pinnedAppIds
    .filter((appId) => availableAppIds.has(appId))
    .map((appId) => getApp(appId));
  const unpinnedWindows = windows.filter((item) => !pinnedAppIds.includes(item.appId));
  const taskbarApps = [
    ...pinnedApps.map((app) => ({ app, window: windows.find((item) => item.appId === app.id) })),
    ...unpinnedWindows.map((windowItem) => ({ app: getApp(windowItem.appId), window: windowItem })),
  ];

  const showPreview = (
    element: HTMLElement,
    app: AppDefinition,
    windowItem?: WindowInstance,
  ) => {
    const taskbarBox = taskbarRef.current?.getBoundingClientRect();
    const buttonBox = element.getBoundingClientRect();
    const rawLeft = buttonBox.left + buttonBox.width / 2 - (taskbarBox?.left ?? 0);
    const maxLeft = Math.max(118, (taskbarBox?.width ?? window.innerWidth) - 118);
    setPreview({
      app,
      left: clamp(rawLeft, 118, maxLeft),
      window: windowItem,
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
          {taskbarApps.map(({ app, window: windowItem }) => {
            const isPinned = pinnedAppIds.includes(app.id);
            return (
              <div
                className="taskbar-slot"
                key={windowItem?.id ?? `pinned-${app.id}`}
                onBlur={hidePreview}
                onFocusCapture={(event) => showPreview(event.currentTarget, app, windowItem)}
                onMouseEnter={(event) => showPreview(event.currentTarget, app, windowItem)}
                onMouseLeave={hidePreview}
              >
                <button
                  className={`taskbar-app ${windowItem && activeWindowId === windowItem.id ? "is-current" : ""} ${
                    windowItem?.minimized ? "is-minimized" : ""
                  } ${isPinned ? "is-pinned" : ""} ${windowItem ? "is-open" : ""}`}
                  onClick={() => {
                    if (windowItem) {
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

function QuickSettingsPanel({
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

function NotificationCenterPanel({
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

function TaskbarPreview({
  app,
  left,
  window,
}: {
  app: AppDefinition;
  left: number;
  window?: WindowInstance;
}) {
  const status = window
    ? window.minimized
      ? "최소화됨"
      : window.maximized
        ? "최대화됨"
        : "열림"
    : "고정됨";
  const detail = window ? app.subtitle : "고정된 앱";

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
      </div>
    </div>
  );
}

function StartMenu({
  apps,
  onClose,
  onLock,
  onOpenApp,
  onRestart,
  onShutdown,
  onPointerDown,
  onRecentItemOpen,
  onResultOpen,
  query,
  recentItems,
  results,
  setQuery,
}: {
  apps: AppDefinition[];
  onClose: () => void;
  onLock: () => void;
  onOpenApp: (appId: AppId) => void;
  onRestart: () => void;
  onShutdown: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onRecentItemOpen: (item: DesktopItem) => void;
  onResultOpen: (result: StartSearchResult) => void;
  query: string;
  recentItems: DesktopItem[];
  results: StartSearchResult[];
  setQuery: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [powerMenuOpen, setPowerMenuOpen] = useState(false);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const hasQuery = query.trim().length > 0;
  const pinnedApps = getStartPinnedApps(apps);
  const allApps = [...apps].sort((a, b) => a.title.localeCompare(b.title));

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && hasQuery && results[0]) {
      event.preventDefault();
      onResultOpen(results[0]);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const runPowerAction = (action: () => void) => {
    setPowerMenuOpen(false);
    action();
  };

  return (
    <aside className="start-menu" onPointerDown={onPointerDown}>
      <label className="start-search">
        <Search aria-hidden="true" size={17} />
        <input
          aria-label="앱과 바탕화면 항목 검색"
          onKeyDown={handleSearchKeyDown}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="앱, 폴더, 메모 검색"
          ref={inputRef}
          value={query}
        />
        {query && (
          <button aria-label="검색어 지우기" onClick={() => setQuery("")} type="button">
            <X aria-hidden="true" size={15} />
          </button>
        )}
      </label>
      <div className="start-section-title">
        <strong>{hasQuery ? "검색 결과" : allAppsOpen ? "모든 앱" : "고정됨"}</strong>
        {hasQuery ? (
          <small>{results.length}개</small>
        ) : (
          <button className="start-all-apps-toggle" onClick={() => setAllAppsOpen((value) => !value)} type="button">
            {allAppsOpen ? <ChevronLeft aria-hidden="true" size={14} /> : null}
            {allAppsOpen ? "뒤로" : "모든 앱"}
            {!allAppsOpen ? <ChevronRight aria-hidden="true" size={14} /> : null}
          </button>
        )}
      </div>
      {hasQuery ? (
        results.length > 0 ? (
          <div className="start-result-list" role="listbox">
            {results.map((result) => {
              const ResultIcon = result.icon;
              return (
                <button key={result.id} onClick={() => onResultOpen(result)} type="button">
                  <AppIconTile
                    accent={result.accent}
                    icon={ResultIcon}
                    size="medium"
                    tone={getResultIconTileTone(result)}
                  />
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <em>{result.sourceLabel}</em>
                  <small className="match-label">일치: {result.matchLabel}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="start-empty-state">
            <Search aria-hidden="true" size={22} />
            <strong>검색 결과가 없습니다</strong>
            <small>앱 이름, 한글 별칭, 바탕화면 폴더나 메모 이름으로 찾아보세요.</small>
          </div>
        )
      ) : (
        <div className="start-dashboard">
          {allAppsOpen ? (
            <section className="start-all-apps start-all-apps-panel">
              <div className="start-app-list">
                {allApps.map((app) => (
                  <button key={app.id} onClick={() => onOpenApp(app.id)} type="button">
                    <AppIconTile accent={app.accent} icon={app.icon} size="small" />
                    <span>
                      <strong>{app.title}</strong>
                      <small>{app.subtitle}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <div className="start-pinned-grid" aria-label="고정된 앱">
                {pinnedApps.map((app) => (
                  <button key={app.id} onClick={() => onOpenApp(app.id)} type="button">
                    <AppIconTile accent={app.accent} icon={app.icon} size="medium" />
                    <strong>{app.title}</strong>
                  </button>
                ))}
              </div>
              <section className="start-recommended">
                <div className="start-section-title start-subsection-title">
                  <strong>추천</strong>
                  <small>{recentItems.length}개</small>
                </div>
                {recentItems.length > 0 ? (
                  <div className="start-recommended-list">
                    {recentItems.map((item) => {
                      const association = getVfsEntryAssociation(item);
                      return (
                        <button key={item.id} onClick={() => onRecentItemOpen(item)} type="button">
                          <AppIconTile
                            accent={association.accent}
                            icon={association.icon}
                            size="small"
                            tone="file"
                          />
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {association.typeLabel} · {association.appTitle}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="start-empty-compact">
                    <FileText aria-hidden="true" size={19} />
                    <span>추천 항목 없음</span>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
      <div className="start-menu-footer">
        <div className="start-account">
          <span className="start-account-avatar">
            <UserRound aria-hidden="true" size={17} />
          </span>
          <span>
            <strong>Seung-Won</strong>
          </span>
        </div>
        <div className="start-footer-actions">
          <div className="power-menu-wrap">
            <button
              aria-expanded={powerMenuOpen}
              aria-haspopup="menu"
              aria-label="전원 옵션"
              onClick={() => setPowerMenuOpen((value) => !value)}
              title="전원"
              type="button"
            >
              <Power aria-hidden="true" size={18} />
            </button>
            {powerMenuOpen && (
              <div className="power-menu" role="menu">
                <button onClick={() => runPowerAction(onLock)} role="menuitem" type="button">
                  <Lock aria-hidden="true" size={15} />
                  잠금
                </button>
                <button onClick={() => runPowerAction(onRestart)} role="menuitem" type="button">
                  <RotateCcw aria-hidden="true" size={15} />
                  다시 시작
                </button>
                <button onClick={() => runPowerAction(onShutdown)} role="menuitem" type="button">
                  <Power aria-hidden="true" size={15} />
                  시스템 종료
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function RunDialog({
  onClose,
  onExecute,
}: {
  onClose: () => void;
  onExecute: (command: string) => void;
}) {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      previousFocus?.focus();
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onExecute(command);
  };

  const chooseSuggestion = (value: string) => {
    setCommand(value);
    inputRef.current?.focus();
  };

  return (
    <div className="run-overlay" onPointerDown={onClose}>
      <form
        aria-labelledby="run-dialog-title"
        aria-modal="true"
        className="run-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <div className="run-dialog-header">
          <AppIconTile accent="#78d6ff" icon={SquareTerminal} size="medium" />
          <div>
            <p>PocketDesk</p>
            <h2 id="run-dialog-title">실행</h2>
          </div>
          <button aria-label="실행 창 닫기" onClick={onClose} title="닫기" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <label className="run-input-row">
          <span>열기</span>
          <input
            aria-label="열기"
            onChange={(event) => setCommand(event.target.value)}
            ref={inputRef}
            spellCheck={false}
            value={command}
          />
        </label>
        <div className="run-suggestions" aria-label="실행 명령어">
          {runCommandSuggestions.map((suggestion) => (
            <button
              key={suggestion.command}
              onClick={() => chooseSuggestion(suggestion.command)}
              type="button"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
        <div className="run-actions">
          <button onClick={onClose} type="button">
            취소
          </button>
          <button disabled={!command.trim()} type="submit">
            확인
          </button>
        </div>
      </form>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time className="tray-clock" dateTime={now.toISOString()}>
      <span>{now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
      <span>{now.toLocaleDateString("ko-KR", { day: "2-digit", month: "2-digit" })}</span>
    </time>
  );
}

function createPocketDeskAudioContext() {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  try {
    return new AudioContextConstructor();
  } catch {
    return null;
  }
}

function playPocketDeskSound(audioContext: AudioContext, effect: SoundEffectName) {
  if (audioContext.state === "closed") return;
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => undefined);
  }

  const steps = getPocketDeskSoundSteps(effect);
  const startTime = audioContext.currentTime + 0.012;

  steps.forEach((step) => {
    const noteStart = startTime + (step.offset ?? 0);
    const noteEnd = noteStart + step.duration;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = step.type ?? "sine";
    oscillator.frequency.setValueAtTime(step.frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(step.gain, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.018);
  });
}

function getPocketDeskSoundSteps(effect: SoundEffectName): SoundStep[] {
  const effects: Record<SoundEffectName, SoundStep[]> = {
    click: [{ duration: 0.045, frequency: 520, gain: 0.014, type: "triangle" }],
    close: [
      { duration: 0.055, frequency: 420, gain: 0.015, type: "triangle" },
      { duration: 0.07, frequency: 260, gain: 0.012, offset: 0.035, type: "sine" },
    ],
    error: [
      { duration: 0.065, frequency: 190, gain: 0.018, type: "sawtooth" },
      { duration: 0.1, frequency: 130, gain: 0.014, offset: 0.045, type: "triangle" },
    ],
    minimize: [
      { duration: 0.045, frequency: 520, gain: 0.012, type: "triangle" },
      { duration: 0.06, frequency: 330, gain: 0.01, offset: 0.03, type: "triangle" },
    ],
    open: [
      { duration: 0.045, frequency: 440, gain: 0.014, type: "sine" },
      { duration: 0.08, frequency: 660, gain: 0.015, offset: 0.035, type: "triangle" },
    ],
    success: [
      { duration: 0.045, frequency: 660, gain: 0.012, type: "sine" },
      { duration: 0.085, frequency: 880, gain: 0.014, offset: 0.04, type: "triangle" },
    ],
    toggle: [{ duration: 0.06, frequency: 610, gain: 0.012, type: "square" }],
    unlock: [
      { duration: 0.045, frequency: 390, gain: 0.014, type: "sine" },
      { duration: 0.055, frequency: 585, gain: 0.014, offset: 0.04, type: "sine" },
      { duration: 0.09, frequency: 780, gain: 0.012, offset: 0.08, type: "triangle" },
    ],
  };

  return effects[effect];
}

function FilesApp({
  createVfsTextFile,
  deleteVfsEntry,
  desktopItems,
  duplicateVfsEntries,
  exportVfsZip,
  importVfsZip,
  notify,
  openApp,
  openVfsEntry,
  renameVfsEntry,
}: AppContentProps) {
  const fileListRef = useRef<HTMLDivElement | null>(null);
  const fileContextMenuRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const newControlRef = useRef<HTMLDivElement | null>(null);
  const cancelRenameRef = useRef(false);
  const propertiesConfirmRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const sortControlRef = useRef<HTMLDivElement | null>(null);
  const [location, setLocation] = useState<"desktop" | "documents" | "games" | "pictures">(
    "desktop",
  );
  const [sortKey, setSortKey] = useState<FileSortKey>(() => {
    const stored = localStorage.getItem(FILE_EXPLORER_SORT_KEY);
    return stored === "type" || stored === "modified" ? stored : "name";
  });
  const [sortDirection, setSortDirection] = useState<FileSortDirection>(() =>
    localStorage.getItem(FILE_EXPLORER_SORT_DIRECTION_KEY) === "desc" ? "desc" : "asc",
  );
  const [viewMode, setViewMode] = useState<FileViewMode>(() => {
    const stored = localStorage.getItem(FILE_EXPLORER_VIEW_KEY);
    return stored === "list" || stored === "icons" ? stored : "details";
  });
  const [sortOpen, setSortOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [detailsPaneOpen, setDetailsPaneOpen] = useState(true);
  const [clipboardIds, setClipboardIds] = useState<string[]>([]);
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [propertiesFileId, setPropertiesFileId] = useState<string | null>(null);
  const locationLabel = {
    desktop: "바탕 화면",
    documents: "문서",
    games: "게임",
    pictures: "사진",
  }[location];
  const locationItems = useMemo(() => {
    if (location === "documents") return desktopItems.filter((item) => item.kind === "note");
    if (location === "pictures") return desktopItems.filter((item) => item.kind === "canvas");
    if (location === "games") return desktopItems.filter((item) => item.kind === "game");
    return desktopItems;
  }, [desktopItems, location]);
  const files = useMemo(
    () =>
      locationItems.map((item) => {
        const association = getVfsEntryAssociation(item);
        return {
          association,
          detail: getVfsEntryDetail(item),
          icon: association.icon,
          id: item.id,
          item,
          name: item.name,
          modified: formatDesktopItemTime(item.updatedAt),
          type: association.typeLabel,
          updatedAt: item.updatedAt,
        };
      }),
    [locationItems],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const filteredFiles = useMemo(() => {
    const normalizedQuery = normalizeSearchText(fileQuery);
    if (!normalizedQuery) return files;
    return files.filter((file) =>
      [file.name, file.type, file.detail, file.association.appTitle]
        .map(normalizeSearchText)
        .some((field) => field.includes(normalizedQuery)),
    );
  }, [fileQuery, files]);
  const visibleFiles = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredFiles].sort((first, second) => {
      let order = 0;
      if (sortKey === "modified") order = first.updatedAt - second.updatedAt;
      if (sortKey === "type") {
        order = first.type.localeCompare(second.type, "ko", { numeric: true, sensitivity: "base" });
      }
      if (sortKey === "name" || order === 0) {
        order = first.name.localeCompare(second.name, "ko", { numeric: true, sensitivity: "base" });
      }
      return order * direction;
    });
  }, [filteredFiles, sortDirection, sortKey]);
  const selectedFile =
    visibleFiles.find((file) => file.id === activeFileId && selectedIds.includes(file.id)) ??
    visibleFiles.find((file) => selectedIds.includes(file.id));
  const propertiesFile = files.find((file) => file.id === propertiesFileId);
  const contextFile = files.find((file) => file.id === fileContextMenu?.fileId);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(selectedFile?.name ?? "");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const visibleIds = new Set(visibleFiles.map((file) => file.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
    setActiveFileId((current) =>
      current && visibleIds.has(current) ? current : (visibleFiles[0]?.id ?? null),
    );
  }, [visibleFiles]);

  useEffect(() => {
    localStorage.setItem(FILE_EXPLORER_SORT_KEY, sortKey);
  }, [sortKey]);

  useEffect(() => {
    localStorage.setItem(FILE_EXPLORER_SORT_DIRECTION_KEY, sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    localStorage.setItem(FILE_EXPLORER_VIEW_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!sortOpen && !newOpen) return;

    const closeOnOutsidePointer = (event: Event) => {
      if (event.target instanceof Node && !sortControlRef.current?.contains(event.target)) {
        setSortOpen(false);
      }
      if (event.target instanceof Node && !newControlRef.current?.contains(event.target)) {
        setNewOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNewOpen(false);
      setSortOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [newOpen, sortOpen]);

  useEffect(() => {
    if (!fileContextMenu && !propertiesFileId) return;
    const closeOnOutsidePointer = (event: Event) => {
      if (
        fileContextMenu &&
        event.target instanceof Node &&
        !fileContextMenuRef.current?.contains(event.target)
      ) {
        setFileContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFileContextMenu(null);
      setPropertiesFileId(null);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [fileContextMenu, propertiesFileId]);

  useEffect(() => {
    if (!propertiesFileId) return;
    const windowContent = propertiesConfirmRef.current?.closest<HTMLElement>(".window-content");
    if (windowContent) {
      windowContent.scrollLeft = 0;
      windowContent.scrollTop = 0;
    }
    const focusFrame = window.requestAnimationFrame(() => {
      propertiesConfirmRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [propertiesFileId]);

  useEffect(() => {
    setDraftName(selectedFile?.name ?? "");
    if (selectedFile?.id === pendingRenameId) {
      setRenaming(true);
      setPendingRenameId(null);
    } else {
      setRenaming(false);
    }
  }, [selectedFile?.id, selectedFile?.name]);

  useEffect(() => {
    if (!renaming) return;
    cancelRenameRef.current = false;
    renameInputRef.current?.select();
  }, [renaming]);

  const focusFileList = () => {
    fileListRef.current?.focus();
    window.requestAnimationFrame(() => fileListRef.current?.focus());
  };

  const getSelectedCommandIds = () =>
    selectedIds.length > 0 ? selectedIds : selectedFile ? [selectedFile.id] : [];

  const copySelectedFiles = (itemIds = getSelectedCommandIds()) => {
    if (itemIds.length === 0) return;
    setClipboardIds(itemIds);
    setFileContextMenu(null);
    notify({
      detail: "이 파일 탐색기 안에서 Ctrl+V로 붙여넣을 수 있습니다.",
      title: `${itemIds.length}개 항목 복사됨`,
      tone: "success",
    });
  };

  const pasteCopiedFiles = () => {
    if (clipboardIds.length === 0) return;
    const copiedIds = duplicateVfsEntries(clipboardIds);
    if (copiedIds.length === 0) return;
    setSelectedIds(copiedIds);
    setActiveFileId(copiedIds[0] ?? null);
    selectionAnchorRef.current = copiedIds[0] ?? null;
    setFileContextMenu(null);
    focusFileList();
  };

  const createTextFile = () => {
    const item = createVfsTextFile();
    setSelectedIds([item.id]);
    setActiveFileId(item.id);
    setPendingRenameId(item.id);
    selectionAnchorRef.current = item.id;
    setNewOpen(false);
    setFileContextMenu(null);
  };

  const showFileContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    fileId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIds.includes(fileId)) {
      setSelectedIds([fileId]);
      selectionAnchorRef.current = fileId;
    }
    setActiveFileId(fileId);
    setRenaming(false);
    setFileContextMenu({
      fileId,
      x: clamp(event.clientX, 8, Math.max(8, window.innerWidth - 212)),
      y: clamp(event.clientY, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - 226)),
    });
  };

  const openFileProperties = (fileId: string) => {
    setFileContextMenu(null);
    setPropertiesFileId(fileId);
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;
    cancelRenameRef.current = false;
    renameVfsEntry(selectedFile.id, draftName);
    setRenaming(false);
    focusFileList();
  };

  const deleteSelectedFiles = () => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedFile ? [selectedFile.id] : [];
    if (ids.length === 0) return;
    ids.forEach(deleteVfsEntry);
    setRenaming(false);
    setFileContextMenu(null);
    setPropertiesFileId(null);
    setSelectedIds([]);
    setActiveFileId(null);
    selectionAnchorRef.current = null;
  };

  const changeLocation = (nextLocation: typeof location) => {
    setLocation(nextLocation);
    setSelectedIds([]);
    setActiveFileId(null);
    setRenaming(false);
    setNewOpen(false);
    setSortOpen(false);
    setFileContextMenu(null);
    setPropertiesFileId(null);
    selectionAnchorRef.current = null;
  };

  const selectFile = (
    fileId: string,
    index: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = visibleFiles.findIndex((file) => file.id === selectionAnchorRef.current);
      if (anchorIndex >= 0) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);
        setSelectedIds(visibleFiles.slice(start, end + 1).map((file) => file.id));
      }
    } else if (event.ctrlKey || event.metaKey) {
      const next = selectedIds.includes(fileId)
        ? selectedIds.filter((id) => id !== fileId)
        : [...selectedIds, fileId];
      setSelectedIds(next);
      setActiveFileId(next.includes(fileId) ? fileId : (next[next.length - 1] ?? null));
      selectionAnchorRef.current = fileId;
      setRenaming(false);
      return;
    } else {
      setSelectedIds([fileId]);
      selectionAnchorRef.current = fileId;
    }
    setActiveFileId(fileId);
    setRenaming(false);
  };

  const handleFileListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        copySelectedFiles();
      } else if (key === "v") {
        event.preventDefault();
        pasteCopiedFiles();
      } else if (key === "a") {
        event.preventDefault();
        const ids = visibleFiles.map((file) => file.id);
        setSelectedIds(ids);
        setActiveFileId(ids[0] ?? null);
        selectionAnchorRef.current = ids[0] ?? null;
      }
      return;
    }

    if (event.key === "F2" && selectedFile && selectedIds.length <= 1) {
      event.preventDefault();
      setSelectedIds([selectedFile.id]);
      setActiveFileId(selectedFile.id);
      setRenaming(true);
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      deleteSelectedFiles();
      return;
    }
    if (event.key === "Enter" && selectedFile) {
      event.preventDefault();
      openVfsEntry(selectedFile.item);
      return;
    }
    if (!["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) return;

    event.preventDefault();
    const currentIndex = Math.max(
      0,
      visibleFiles.findIndex((file) => file.id === activeFileId),
    );
    const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextFile = visibleFiles[clamp(currentIndex + offset, 0, visibleFiles.length - 1)];
    if (!nextFile) return;
    setActiveFileId(nextFile.id);
    setSelectedIds([nextFile.id]);
    selectionAnchorRef.current = nextFile.id;
  };

  const importSelectedZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      await importVfsZip(file);
      setSelectedIds([]);
      setActiveFileId(null);
    } catch (error) {
      notify({
        detail: error instanceof Error ? error.message : "ZIP 파일을 읽을 수 없습니다.",
        title: "ZIP 가져오기 실패",
        tone: "info",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="files-app app-fill">
      <aside>
        <button onClick={() => openApp("thispc")} type="button">
          <Monitor aria-hidden="true" size={16} />
          내 PC
        </button>
        <button
          className={location === "desktop" ? "is-selected" : ""}
          onClick={() => changeLocation("desktop")}
          type="button"
        >
          <Folder aria-hidden="true" size={16} />
          바탕 화면
        </button>
        <button
          className={location === "documents" ? "is-selected" : ""}
          onClick={() => changeLocation("documents")}
          type="button"
        >
          <FileText aria-hidden="true" size={16} />
          문서
        </button>
        <button
          className={location === "pictures" ? "is-selected" : ""}
          onClick={() => changeLocation("pictures")}
          type="button"
        >
          <Paintbrush aria-hidden="true" size={16} />
          사진
        </button>
        <button
          className={location === "games" ? "is-selected" : ""}
          onClick={() => changeLocation("games")}
          type="button"
        >
          <Bomb aria-hidden="true" size={16} />
          게임
        </button>
      </aside>
      <section className="file-main-pane">
        <div className="file-tab-strip">
          <div className="file-tab">
            <Folder aria-hidden="true" size={15} />
            <span>{locationLabel}</span>
          </div>
        </div>
        <div className="file-explorer-top">
          <div className="file-address-row">
            <div className="file-address">
              <House aria-hidden="true" size={15} />
              <span>홈</span>
              <span aria-hidden="true">›</span>
              <strong>{locationLabel}</strong>
            </div>
            <label className="file-search">
              <Search aria-hidden="true" size={15} />
              <input
                aria-label="파일 검색"
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder={`${locationLabel} 검색`}
                value={fileQuery}
              />
            </label>
          </div>
          <div className="file-command-strip">
            <div className="file-new-control" ref={newControlRef}>
              <button
                aria-expanded={newOpen}
                aria-haspopup="menu"
                aria-label="새로 만들기"
                className="file-command-action"
                onClick={() => {
                  setNewOpen((current) => !current);
                  setSortOpen(false);
                }}
                type="button"
              >
                <FilePlus2 aria-hidden="true" size={15} />
                <span>새로 만들기</span>
              </button>
              {newOpen && (
                <div aria-label="새로 만들기" className="file-command-menu file-new-menu" role="menu">
                  <button onClick={createTextFile} role="menuitem" type="button">
                    <FileText aria-hidden="true" size={15} />
                    텍스트 문서
                  </button>
                </div>
              )}
            </div>
            <button
              aria-label="열기"
              className="file-command-action file-command-compact"
              disabled={!selectedFile}
              onClick={() => selectedFile && openVfsEntry(selectedFile.item)}
              type="button"
            >
              <ExternalLink aria-hidden="true" size={15} />
              <span>열기</span>
            </button>
            <button
              aria-label="복사"
              className="file-command-action file-command-compact"
              disabled={!selectedFile}
              onClick={() => copySelectedFiles()}
              type="button"
            >
              <Copy aria-hidden="true" size={15} />
              <span>복사</span>
            </button>
            <button
              aria-label="붙여넣기"
              className="file-command-action file-command-compact"
              disabled={clipboardIds.length === 0}
              onClick={pasteCopiedFiles}
              type="button"
            >
              <ClipboardPaste aria-hidden="true" size={15} />
              <span>붙여넣기</span>
            </button>
            <button
              aria-label="이름 바꾸기"
              className="file-command-action file-command-compact"
              disabled={!selectedFile || selectedIds.length > 1}
              onClick={() => selectedFile && setRenaming(true)}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
              <span>이름 바꾸기</span>
            </button>
            <button
              aria-label="삭제"
              className="file-command-action file-command-compact file-danger"
              disabled={!selectedFile}
              onClick={deleteSelectedFiles}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              <span>삭제</span>
            </button>
            <span aria-hidden="true" className="file-command-separator" />
            <button
              aria-label="ZIP 내보내기"
              className="file-command-action file-command-compact"
              onClick={exportVfsZip}
              title="ZIP 내보내기"
              type="button"
            >
              <Download aria-hidden="true" size={15} />
              <span>내보내기</span>
            </button>
            <button
              aria-busy={importing}
              aria-label="ZIP 가져오기"
              className="file-command-action file-command-compact"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              title="ZIP 가져오기"
              type="button"
            >
              <Upload aria-hidden="true" size={15} />
              <span>{importing ? "가져오는 중" : "가져오기"}</span>
            </button>
            <input
              accept=".zip,application/zip"
              aria-label="ZIP 파일 가져오기"
              className="file-import-input"
              onChange={importSelectedZip}
              ref={importInputRef}
              type="file"
            />
            <span aria-hidden="true" className="file-command-separator" />
            <div className="file-sort-control" ref={sortControlRef}>
              <button
                aria-label="정렬"
                aria-expanded={sortOpen}
                aria-haspopup="menu"
                className="file-command-action"
                onClick={() => {
                  setSortOpen((current) => !current);
                  setNewOpen(false);
                }}
                type="button"
              >
                <ArrowUpDown aria-hidden="true" size={15} />
                <span>정렬</span>
              </button>
              {sortOpen && (
                <div aria-label="파일 정렬" className="file-sort-menu" role="menu">
                  {(
                    [
                      ["name", "이름"],
                      ["type", "항목 유형"],
                      ["modified", "수정한 날짜"],
                    ] as Array<[FileSortKey, string]>
                  ).map(([nextSortKey, label]) => (
                    <button
                      aria-checked={sortKey === nextSortKey}
                      key={nextSortKey}
                      onClick={() => {
                        setSortKey(nextSortKey);
                        setSortOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {sortKey === nextSortKey ? <Check aria-hidden="true" size={15} /> : <span />}
                      {label}
                    </button>
                  ))}
                  <span aria-hidden="true" className="menu-separator" />
                  {(
                    [
                      ["asc", "오름차순"],
                      ["desc", "내림차순"],
                    ] as Array<[FileSortDirection, string]>
                  ).map(([direction, label]) => (
                    <button
                      aria-checked={sortDirection === direction}
                      key={direction}
                      onClick={() => {
                        setSortDirection(direction);
                        setSortOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {sortDirection === direction ? <Check aria-hidden="true" size={15} /> : <span />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div aria-label="보기 방식" className="file-view-control" role="group">
              <button
                aria-label="자세히 보기"
                aria-pressed={viewMode === "details"}
                onClick={() => setViewMode("details")}
                title="자세히 보기"
                type="button"
              >
                <List aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="목록 보기"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                title="목록 보기"
                type="button"
              >
                <LayoutGrid aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="큰 아이콘 보기"
                aria-pressed={viewMode === "icons"}
                onClick={() => setViewMode("icons")}
                title="큰 아이콘 보기"
                type="button"
              >
                <Grid2X2 aria-hidden="true" size={16} />
              </button>
            </div>
            <button
              aria-label="세부 정보 창"
              aria-pressed={detailsPaneOpen}
              className="file-details-toggle"
              onClick={() => setDetailsPaneOpen((current) => !current)}
              title="세부 정보 창"
              type="button"
            >
              <Info aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <div className={`file-workspace${detailsPaneOpen ? " has-details" : ""}`}>
          <div className="file-list-surface">
            {viewMode === "details" && (
              <div aria-hidden="true" className="file-list-header">
                <span>이름</span>
                <span>수정한 날짜</span>
                <span>유형</span>
                <span>크기</span>
              </div>
            )}
            <div
              aria-label={`${locationLabel} 파일`}
              aria-multiselectable="true"
              className={`file-list file-view-${viewMode}`}
              onKeyDown={handleFileListKeyDown}
              onPointerDown={() => setFileContextMenu(null)}
              ref={fileListRef}
              role="listbox"
              tabIndex={0}
            >
              {visibleFiles.map((file, index) => {
                const FileIcon = file.icon;
                return (
                  <div className="file-list-item" key={file.id}>
                    <button
                      aria-selected={selectedIds.includes(file.id)}
                      className={selectedIds.includes(file.id) ? "is-selected" : ""}
                      data-file-id={file.id}
                      onClick={(event) => selectFile(file.id, index, event)}
                      onContextMenu={(event) => showFileContextMenu(event, file.id)}
                      onDoubleClick={() => openVfsEntry(file.item)}
                      role="option"
                      type="button"
                    >
                      <FileIcon aria-hidden="true" size={18} />
                      <span>{file.name}</span>
                      <small>{file.modified}</small>
                      <small>{file.type}</small>
                      <small>{formatVfsEntrySize(file.item)}</small>
                    </button>
                    {renaming && selectedFile?.id === file.id && (
                      <form className="file-inline-rename" onSubmit={submitRename}>
                        <input
                          aria-label="파일 이름"
                          onBlur={() => {
                            if (!cancelRenameRef.current) renameVfsEntry(file.id, draftName);
                            cancelRenameRef.current = false;
                            setRenaming(false);
                          }}
                          onChange={(event) => setDraftName(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key !== "Escape") return;
                            event.preventDefault();
                            event.stopPropagation();
                            cancelRenameRef.current = true;
                            setDraftName(file.name);
                            setRenaming(false);
                            focusFileList();
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          ref={renameInputRef}
                          value={draftName}
                        />
                      </form>
                    )}
                  </div>
                );
              })}
              {visibleFiles.length === 0 && (
                <div className="file-empty-state">
                  <Search aria-hidden="true" size={24} />
                  <strong>검색 결과 없음</strong>
                  <small>다른 이름, 확장자, 앱 이름으로 검색해보세요.</small>
                </div>
              )}
            </div>
          </div>
          {detailsPaneOpen && (
            <section aria-label="세부 정보" className="file-preview">
              {selectedFile ? (
                <>
                  <div className="file-preview-header">
                    <h3>{selectedFile.name}</h3>
                    <small>
                      {selectedFile.type} · {selectedFile.modified}
                    </small>
                  </div>
                  <div className="file-association">
                    <AppIconTile
                      accent={selectedFile.association.accent}
                      icon={selectedFile.association.icon}
                      size="small"
                    />
                    <span>
                      연결 프로그램: <strong>{selectedFile.association.appTitle}</strong>
                    </span>
                  </div>
                  <p>{selectedFile.detail}</p>
                  {selectedFile.item.kind === "canvas" && selectedFile.item.content && (
                    <img
                      alt={`${selectedFile.name} 미리보기`}
                      className="file-image-preview"
                      src={selectedFile.item.content}
                    />
                  )}
                  <div className="file-actions">
                    <button onClick={() => openVfsEntry(selectedFile.item)} type="button">
                      <ExternalLink aria-hidden="true" size={15} />
                      열기
                    </button>
                    <button onClick={() => setRenaming(true)} type="button">
                      <Pencil aria-hidden="true" size={15} />
                      이름 변경
                    </button>
                    <button onClick={() => openFileProperties(selectedFile.id)} type="button">
                      <Info aria-hidden="true" size={15} />
                      속성
                    </button>
                    <button className="file-danger" onClick={deleteSelectedFiles} type="button">
                      <Trash2 aria-hidden="true" size={15} />
                      삭제
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3>{locationLabel}</h3>
                  <p>파일을 선택하면 세부 정보가 표시됩니다.</p>
                </>
              )}
            </section>
          )}
        </div>
        <div className="file-statusbar">
          <span>{visibleFiles.length}개 항목</span>
          <span>{selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : "선택한 항목 없음"}</span>
        </div>
      </section>
      {fileContextMenu && contextFile && (
        <div
          aria-label="파일 메뉴"
          className="file-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          ref={fileContextMenuRef}
          role="menu"
          style={{ left: fileContextMenu.x, top: fileContextMenu.y }}
        >
          <button
            onClick={() => {
              setFileContextMenu(null);
              openVfsEntry(contextFile.item);
            }}
            role="menuitem"
            type="button"
          >
            <ExternalLink aria-hidden="true" size={16} />
            열기
          </button>
          <button onClick={() => copySelectedFiles()} role="menuitem" type="button">
            <Copy aria-hidden="true" size={16} />
            복사
          </button>
          <button
            disabled={selectedIds.length > 1}
            onClick={() => {
              setFileContextMenu(null);
              setRenaming(true);
            }}
            role="menuitem"
            type="button"
          >
            <Pencil aria-hidden="true" size={16} />
            이름 바꾸기
          </button>
          <button onClick={() => deleteSelectedFiles()} role="menuitem" type="button">
            <Trash2 aria-hidden="true" size={16} />
            삭제
          </button>
          <span aria-hidden="true" className="menu-separator" />
          <button
            onClick={() => openFileProperties(contextFile.id)}
            role="menuitem"
            type="button"
          >
            <Info aria-hidden="true" size={16} />
            속성
          </button>
        </div>
      )}
      {propertiesFile && (
        <div
          className="file-properties-overlay"
          onPointerDown={() => setPropertiesFileId(null)}
        >
          <section
            aria-label="파일 속성"
            aria-modal="true"
            className="file-properties-dialog"
            onPointerDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <AppIconTile
                accent={propertiesFile.association.accent}
                icon={propertiesFile.association.icon}
                size="medium"
              />
              <div>
                <h2>{propertiesFile.name}</h2>
                <span>{propertiesFile.type}</span>
              </div>
              <button
                aria-label="파일 속성 닫기"
                onClick={() => setPropertiesFileId(null)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </header>
            <dl>
              <div>
                <dt>파일 형식</dt>
                <dd>{propertiesFile.type}</dd>
              </div>
              <div>
                <dt>연결 프로그램</dt>
                <dd>{propertiesFile.association.appTitle}</dd>
              </div>
              <div>
                <dt>위치</dt>
                <dd>바탕 화면</dd>
              </div>
              <div>
                <dt>크기</dt>
                <dd>{formatVfsEntrySize(propertiesFile.item)}</dd>
              </div>
              <div>
                <dt>만든 날짜</dt>
                <dd>{formatVfsPropertyDate(propertiesFile.item.createdAt)}</dd>
              </div>
              <div>
                <dt>수정한 날짜</dt>
                <dd>{formatVfsPropertyDate(propertiesFile.item.updatedAt)}</dd>
              </div>
            </dl>
            <footer>
              <button
                onClick={() => setPropertiesFileId(null)}
                ref={propertiesConfirmRef}
                type="button"
              >
                확인
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function RecycleBinApp({
  emptyRecycleBin,
  openApp,
  permanentlyDeleteVfsEntry,
  restoreVfsEntry,
  trashedItems,
}: AppContentProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "empty" | null>(null);
  const [query, setQuery] = useState("");
  const files = useMemo(
    () =>
      trashedItems.map((item) => {
        const association = getVfsEntryAssociation(item);
        return {
          association,
          detail: getVfsEntryDetail(item),
          icon: association.icon,
          id: item.id,
          item,
          name: item.name,
          removed: formatDesktopItemTime(item.trashedAt ?? item.updatedAt),
          type: association.typeLabel,
        };
      }),
    [trashedItems],
  );
  const visibleFiles = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return files;
    return files.filter((file) =>
      [file.name, file.type, file.detail].map(normalizeSearchText).some((field) => field.includes(normalizedQuery)),
    );
  }, [files, query]);
  const [selected, setSelected] = useState(0);
  const selectedFile = visibleFiles[Math.min(selected, visibleFiles.length - 1)];

  useEffect(() => {
    setSelected((current) =>
      visibleFiles.length === 0 ? 0 : clamp(current, 0, visibleFiles.length - 1),
    );
  }, [visibleFiles.length]);

  return (
    <div className="recycle-app app-fill">
      <aside className="recycle-sidebar">
        <button onClick={() => openApp("files")} type="button">
          <House aria-hidden="true" size={16} />
          홈
        </button>
        <button onClick={() => openApp("thispc")} type="button">
          <Monitor aria-hidden="true" size={16} />
          내 PC
        </button>
        <button aria-current="page" className="is-selected" type="button">
          <Trash2 aria-hidden="true" size={16} />
          휴지통
        </button>
      </aside>
      <section className="recycle-main">
        <div className="file-tab-strip">
          <div className="file-tab">
            <Trash2 aria-hidden="true" size={15} />
            <span>휴지통</span>
          </div>
        </div>
        <div className="recycle-explorer-top">
          <div className="file-address-row">
            <div className="file-address">
              <House aria-hidden="true" size={15} />
              <span>홈</span>
              <span aria-hidden="true">›</span>
              <strong>휴지통</strong>
            </div>
            <label className="file-search">
              <Search aria-hidden="true" size={15} />
              <input
                aria-label="휴지통 검색"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="휴지통 검색"
                value={query}
              />
            </label>
          </div>
          <div className="file-command-strip recycle-command-strip">
            <button
              className="file-command-action"
              disabled={!selectedFile}
              onClick={() => selectedFile && restoreVfsEntry(selectedFile.id)}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={15} />
              <span>복원</span>
            </button>
            <button
              className="file-command-action file-danger"
              disabled={!selectedFile}
              onClick={() => setConfirmAction("delete")}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              <span>영구 삭제</span>
            </button>
            <span aria-hidden="true" className="file-command-separator" />
            <button
              className="file-command-action"
              disabled={files.length === 0}
              onClick={() => setConfirmAction("empty")}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              <span>휴지통 비우기</span>
            </button>
          </div>
        </div>
        <div className="recycle-workspace">
          {visibleFiles.length > 0 && (
            <div aria-hidden="true" className="recycle-list-header">
              <span>이름</span>
              <span>삭제한 날짜</span>
              <span>유형</span>
              <span>크기</span>
            </div>
          )}
          <div className="file-list recycle-list file-view-details" role="list">
            {visibleFiles.map((file, index) => {
              const FileIcon = file.icon;
              return (
                <button
                  aria-selected={selected === index}
                  className={selected === index ? "is-selected" : ""}
                  key={file.id}
                  onClick={() => setSelected(index)}
                  onDoubleClick={() => restoreVfsEntry(file.id)}
                  type="button"
                >
                  <FileIcon aria-hidden="true" size={18} />
                  <span>{file.name}</span>
                  <small>{file.removed}</small>
                  <small>{file.type}</small>
                  <small>{formatVfsEntrySize(file.item)}</small>
                </button>
              );
            })}
            {visibleFiles.length === 0 && (
              <div className="recycle-empty">
                {files.length === 0 ? (
                  <>
                    <Trash2 aria-hidden="true" size={30} />
                    <strong>휴지통이 비어 있습니다</strong>
                  </>
                ) : (
                  <>
                    <Search aria-hidden="true" size={24} />
                    <strong>검색 결과 없음</strong>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="file-statusbar">
          <span>{visibleFiles.length}개 항목</span>
          <span>{selectedFile ? "1개 선택됨" : "선택한 항목 없음"}</span>
        </div>
      </section>
      {confirmAction && (
        <ConfirmDialog
          confirmLabel={confirmAction === "empty" ? "모두 삭제" : "삭제"}
          detail={
            confirmAction === "empty"
              ? `${files.length}개 항목이 영구적으로 삭제됩니다.`
              : `"${selectedFile?.name ?? "선택한 항목"}" 항목이 영구적으로 삭제됩니다.`
          }
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction === "empty") {
              emptyRecycleBin();
            } else if (selectedFile) {
              permanentlyDeleteVfsEntry(selectedFile.id);
            }
            setConfirmAction(null);
          }}
          title={confirmAction === "empty" ? "휴지통을 비울까요?" : "이 항목을 삭제할까요?"}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  confirmLabel,
  detail,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  detail: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  return (
    <div className="confirm-overlay" onPointerDown={onCancel}>
      <section
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{detail}</p>
        <div>
          <button onClick={onCancel} ref={cancelRef} type="button">
            취소
          </button>
          <button className="is-danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsApp({
  playSound,
  resetDesktopIconLayout,
  resetWindowLayout,
  setSoundEnabled,
  setTheme,
  setWallpaper,
  soundEnabled,
  theme,
  wallpaper,
}: AppContentProps) {
  const [section, setSection] = useState<"personalization" | "sound" | "system">(
    "personalization",
  );
  const [settingsQuery, setSettingsQuery] = useState("");
  const themes: Array<{ id: ThemeName; label: string; detail: string }> = [
    { id: "lagoon", label: "Windows 기본", detail: "파란색 강조색" },
    { id: "meadow", label: "녹색", detail: "녹색 강조색" },
    { id: "ember", label: "회색", detail: "청록색 강조색" },
  ];
  const settingsSections = [
    { id: "system" as const, icon: Monitor, label: "시스템", keywords: "창 바탕 화면 배치" },
    { id: "personalization" as const, icon: Palette, label: "개인 설정", keywords: "테마 배경 화면" },
    { id: "sound" as const, icon: Volume2, label: "소리", keywords: "시스템 소리" },
  ];
  const filteredSettingsSections = settingsSections.filter((item) =>
    normalizeSearchText(`${item.label} ${item.keywords}`).includes(normalizeSearchText(settingsQuery)),
  );

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-profile">
          <Monitor aria-hidden="true" size={24} />
          <span>
            <strong>Seung-Won</strong>
            <small>로컬 계정</small>
          </span>
        </div>
        <label className="settings-search">
          <Search aria-hidden="true" size={15} />
          <input
            aria-label="설정 찾기"
            onChange={(event) => setSettingsQuery(event.target.value)}
            placeholder="설정 찾기"
            value={settingsQuery}
          />
        </label>
        <nav aria-label="설정 범주">
          {filteredSettingsSections.map((item) => {
            const SectionIcon = item.icon;
            return (
              <button
                className={section === item.id ? "is-selected" : ""}
                key={item.id}
                onClick={() => setSection(item.id)}
                type="button"
              >
                <SectionIcon aria-hidden="true" size={16} />
                {item.label}
              </button>
            );
          })}
          {filteredSettingsSections.length === 0 && <span className="settings-no-results">결과 없음</span>}
        </nav>
      </aside>
      <section className="settings-content">
        <header className="settings-hero">
          <h2>
            {section === "personalization" ? "개인 설정" : section === "system" ? "시스템" : "소리"}
          </h2>
        </header>
        {section === "personalization" && (
          <>
            <section className="settings-section">
              <h3>테마</h3>
              <div className="theme-options">
                {themes.map((option) => (
                  <button
                    className={theme === option.id ? "is-selected" : ""}
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    type="button"
                  >
                    <span className={`theme-swatch theme-swatch-${option.id}`} />
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-section">
              <h3>배경</h3>
              <div className="wallpaper-options">
                {wallpaperGallery.map((option) => (
                  <button
                    className={wallpaper === option.id ? "is-selected" : ""}
                    key={option.id}
                    onClick={() => setWallpaper(option.id)}
                    type="button"
                  >
                    <span className="wallpaper-preview" style={getWallpaperPreviewStyle(option.id)} />
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
        {section === "system" && (
          <section className="settings-section">
            <h3>창과 바탕 화면</h3>
            <p>창 위치와 크기, 아이콘 위치를 기본값으로 되돌립니다.</p>
            <div className="settings-action-row">
              <button className="settings-action" onClick={resetWindowLayout} type="button">
                <RotateCcw aria-hidden="true" size={16} />
                창 배치 초기화
              </button>
              <button className="settings-action" onClick={resetDesktopIconLayout} type="button">
                <RotateCcw aria-hidden="true" size={16} />
                아이콘 배치 초기화
              </button>
            </div>
          </section>
        )}
        {section === "sound" && (
          <section className="settings-section">
            <h3>시스템 소리</h3>
            <label className="settings-toggle">
              <input
                checked={soundEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  if (!enabled) playSound("toggle");
                  setSoundEnabled(enabled);
                  if (enabled) window.setTimeout(() => playSound("success"), 0);
                }}
                type="checkbox"
              />
              <span>
                <strong>시스템 소리 재생</strong>
                <small>{soundEnabled ? "켜짐" : "꺼짐"}</small>
              </span>
            </label>
          </section>
        )}
      </section>
    </div>
  );
}

function getWindowSnapZone(clientX: number, clientY: number): SnapZone | null {
  if (window.innerWidth < 720 || window.innerHeight < 420) return null;
  if (clientY <= SNAP_EDGE_SIZE) return "top";
  if (clientX <= SNAP_EDGE_SIZE) return "left";
  if (clientX >= window.innerWidth - SNAP_EDGE_SIZE) return "right";
  return null;
}

function getDesktopWorkArea() {
  return {
    height: Math.max(240, window.innerHeight - APP_BAR_HEIGHT - SNAP_GUTTER * 2),
    width: Math.max(320, window.innerWidth - SNAP_GUTTER * 2),
    x: SNAP_GUTTER,
    y: SNAP_GUTTER,
  };
}

function getWindowSnapPatch(zone: SnapZone): Partial<WindowInstance> {
  const area = getDesktopWorkArea();
  if (zone === "top") {
    return { maximized: true, minimized: false };
  }

  const width = Math.max(320, Math.floor((area.width - SNAP_GUTTER) / 2));
  return {
    height: area.height,
    maximized: false,
    minimized: false,
    width,
    x: zone === "left" ? area.x : area.x + area.width - width,
    y: area.y,
  };
}

function getSnapPreviewStyle(zone: SnapZone): React.CSSProperties {
  const area = getDesktopWorkArea();
  if (zone === "top") {
    return {
      height: area.height,
      left: area.x,
      top: area.y,
      width: area.width,
    };
  }

  const patch = getWindowSnapPatch(zone);
  return {
    height: patch.height,
    left: patch.x,
    top: patch.y,
    width: patch.width,
  };
}

function trapDialogFocus(event: React.KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    ),
  );
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
