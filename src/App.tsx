import {
  Bell,
  Bomb,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  Flag,
  Folder,
  Globe2,
  Grid2X2,
  History,
  House,
  LayoutGrid,
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
  Redo2,
  Save,
  Search,
  Settings,
  Square,
  SquareTerminal,
  Star,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type AppId =
  | "thispc"
  | "browser"
  | "minesweeper"
  | "calculator"
  | "paint"
  | "notepad"
  | "files"
  | "recycle"
  | "settings";

type ThemeName = "lagoon" | "meadow" | "ember";
type WallpaperName =
  | "ribbon"
  | "meadow"
  | "aurora"
  | "dawn"
  | "sunny"
  | "glass"
  | "mist"
  | "coast";
type BrowserSearchEngineId = "duckduckgo" | "google" | "bing";

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

type IconPosition = {
  x: number;
  y: number;
};

type DesktopIconLayout = Partial<Record<AppId, IconPosition>>;
type DesktopSortKey = "name" | "type" | "modified";
type DesktopViewMode = "small" | "medium" | "large";
type PersistedIconPosition = {
  x?: unknown;
  y?: unknown;
};
type VfsEntryKind = "folder" | "note" | "canvas" | "shortcut" | "game";
type CreatableDesktopItemKind = "note";
type DesktopItem = {
  appId?: AppId;
  content?: string;
  createdAt: number;
  id: string;
  kind: VfsEntryKind;
  name: string;
  parentId: string;
  restoreShowOnDesktop?: boolean;
  showOnDesktop: boolean;
  trashed?: boolean;
  trashedAt?: number;
  updatedAt: number;
  x: number;
  y: number;
};
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
type ToastTone = "info" | "success";
type ToastInput = {
  detail?: string;
  title: string;
  tone?: ToastTone;
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
type BrowserBookmark = {
  createdAt: number;
  id: string;
  title: string;
  url: string;
};
type BrowserHistoryEntry = {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
};
type BrowserLaunchRequest = {
  id: string;
  value: string;
};
type PaintTool = "brush" | "line" | "rect" | "ellipse";
type CalculatorMode = "standard" | "scientific";
type CalculatorAction =
  | "clear"
  | "delete"
  | "equals"
  | "toggle-sign"
  | "percent"
  | "pi"
  | "sqrt"
  | "square"
  | "reciprocal"
  | "sin"
  | "cos"
  | "tan"
  | "log"
  | "ln";
type CalculatorButton = {
  action?: CalculatorAction;
  className?: string;
  label: string;
  value?: string;
};
type NoteViewMode = "edit" | "preview";
type NoteSaveStatus = "saved" | "dirty" | "saving";
type SoundEffectName = "click" | "close" | "minimize" | "open" | "success" | "toggle" | "unlock";
type SoundStep = {
  duration: number;
  frequency: number;
  gain: number;
  offset?: number;
  type?: OscillatorType;
};
type MinesDifficultyId = "easy" | "medium" | "hard";
type MinesDifficulty = {
  cols: number;
  id: MinesDifficultyId;
  label: string;
  mines: number;
  rows: number;
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
  desktopItems: DesktopItem[];
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
const DESKTOP_ICON_LAYOUT_KEY = "pocket-desk-icons-v1";
const DESKTOP_ICON_VIEW_KEY = "pocket-desk-icon-view-v1";
const DESKTOP_ICON_SORT_KEY = "pocket-desk-icon-sort-v1";
const DESKTOP_ICON_GRID_KEY = "pocket-desk-icon-grid-v1";
const DESKTOP_ITEMS_KEY = "pocket-desk-desktop-items-v1";
const BROWSER_BOOKMARKS_KEY = "pocket-desk-browser-bookmarks-v1";
const BROWSER_HISTORY_KEY = "pocket-desk-browser-history-v1";
const BROWSER_SEARCH_ENGINE_KEY = "pocket-desk-browser-search-engine-v1";
const MINES_BEST_RECORDS_KEY = "pocket-desk-mines-best-records-v1";
const SOUND_ENABLED_KEY = "pocket-desk-sound-enabled-v1";
const TASKBAR_PINNED_APPS_KEY = "pocket-desk-taskbar-pinned-v2";
const SNAP_EDGE_SIZE = 24;
const SNAP_GUTTER = 10;

const minesDifficulties: MinesDifficulty[] = [
  { cols: 9, id: "easy", label: "초급", mines: 10, rows: 9 },
  { cols: 12, id: "medium", label: "중급", mines: 24, rows: 12 },
  { cols: 16, id: "hard", label: "고급", mines: 40, rows: 16 },
];

const browserSearchEngines: Array<{
  id: BrowserSearchEngineId;
  label: string;
  searchUrl: (query: string) => string;
}> = [
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  },
  {
    id: "google",
    label: "Google",
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "bing",
    label: "Bing",
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
];

const paintPalette = [
  "#0f6c81",
  "#111827",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#2563eb",
  "#7c3aed",
  "#ffffff",
];

const paintTools: Array<{ id: PaintTool; label: string }> = [
  { id: "brush", label: "브러시" },
  { id: "line", label: "선" },
  { id: "rect", label: "사각형" },
  { id: "ellipse", label: "타원" },
];

const calculatorStandardButtons: CalculatorButton[] = [
  { action: "clear", className: "is-utility", label: "C" },
  { action: "delete", className: "is-utility", label: "DEL" },
  { action: "percent", className: "is-utility", label: "%" },
  { label: "÷", value: "/" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "*" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "-", value: "-" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+" },
  { action: "toggle-sign", className: "is-utility", label: "±" },
  { label: "0", value: "0" },
  { label: ".", value: "." },
  { action: "equals", className: "is-equals", label: "=" },
];

const calculatorScientificButtons: CalculatorButton[] = [
  { action: "sin", label: "sin" },
  { action: "cos", label: "cos" },
  { action: "tan", label: "tan" },
  { action: "sqrt", label: "√" },
  { action: "square", label: "x²" },
  { action: "reciprocal", label: "1/x" },
  { action: "log", label: "log" },
  { action: "ln", label: "ln" },
  { action: "pi", label: "π" },
];

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
    title: "웹 브라우저",
    subtitle: "웹 검색 및 주소 열기",
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
    accent: "#62c1a0",
    defaultSize: { width: 720, height: 520 },
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
    defaultSize: { width: 620, height: 610 },
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
  const altTabTimerRef = useRef<number | null>(null);
  const desktopSelectionRef = useRef<DesktopSelectionState | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (shellPhase !== "booting") return;
    const timer = window.setTimeout(() => setShellPhase("locked"), 1150);
    return () => window.clearTimeout(timer);
  }, [shellPhase]);

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
    if (!desktopMenu) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDesktopMenu(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [desktopMenu]);

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
    notify({
      detail: "이전 창과 바탕화면 상태를 그대로 복원했습니다.",
      title: "PocketDesk 잠금 해제",
      tone: "success",
    });
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
    playSound("open");
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
    const position = clampIconPosition(origin.originX - 18, origin.originY - 10);
    const name = getUniqueDesktopItemName(activeDesktopItems);
    const now = Date.now();

    setDesktopItems((current) => [
      ...current,
      {
        content: "",
        createdAt: now,
        id: `${kind}-${crypto.randomUUID()}`,
        kind,
        name,
        parentId: VFS_ROOT_ID,
        showOnDesktop: true,
        updatedAt: now,
        ...position,
      },
    ]);
    setDesktopMenu(null);
    notify({
      detail: "메모장에서 열어 작성할 수 있습니다.",
      title: `${name} 생성됨`,
      tone: "success",
    });
  };

  const activeDesktopItems = useMemo(() => {
    return desktopItems.filter((item) => !item.trashed);
  }, [desktopItems]);

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
      detail: "바탕화면과 IndexedDB 파일 시스템에도 반영됩니다.",
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
      detail: "IndexedDB 파일 시스템에서 완전히 제거했습니다.",
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
      detail: `${deletedCount}개 항목을 IndexedDB 파일 시스템에서 완전히 제거했습니다.`,
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
      title: "VFS ZIP 내보내기 완료",
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
      detail: `${importedItems.length}개 항목을 IndexedDB 파일 시스템에 복원했습니다.`,
      title: "VFS ZIP 가져오기 완료",
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
    setStartOpen(false);
    setWindowMenu(null);
    setDesktopMenu({
      ...clampContextMenuPosition(event.clientX, event.clientY),
      originX: event.clientX,
      originY: event.clientY,
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
    updateWindow(id, { maximized: false, minimized: false });
  };

  const closeWindow = (id: string) => {
    playSound("close");
    setWindowMenu(null);
    setWindows((current) => current.filter((item) => item.id !== id));
  };

  const minimizeWindow = (id: string) => {
    playSound("minimize");
    setWindowMenu(null);
    updateWindow(id, { minimized: true });
  };

  const toggleMaximize = (id: string) => {
    playSound("toggle");
    setWindowMenu(null);
    setWindows((current) =>
      current.map((item) => (item.id === id ? { ...item, maximized: !item.maximized } : item)),
    );
  };

  const toggleFromTaskbar = (id: string) => {
    playSound("click");
    setWindows((current) => {
      const active = current.find((item) => item.id === id);
      const topVisible = current
        .filter((item) => !item.minimized)
        .sort((a, b) => b.z - a.z)[0]?.id;
      const topZ = Math.max(1, ...current.map((item) => item.z));

      return current.map((item) => {
        if (item.id !== id) return item;
        if (active && !active.minimized && topVisible === id) {
          return { ...item, minimized: true };
        }
        return { ...item, minimized: false, z: topZ + 1 };
      });
    });
  };

  const snapWindow = (id: string, zone: SnapZone) => {
    playSound("toggle");
    updateWindow(id, getWindowSnapPatch(zone));
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
        title: "웹 브라우저에서 열기",
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

      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        openRunDialog();
        return;
      }

      if (event.altKey && event.key === "Tab") {
        event.preventDefault();
        cycleAltTab(event.shiftKey);
        return;
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
  }, [activeWindowId, altTabWindowId, desktopMenu, runOpen, shellPhase, startOpen, windowMenu, windows]);

  const openStartSearchResult = (result: StartSearchResult) => {
    if (result.kind === "app") {
      openApp(result.appId);
    } else {
      openDesktopItem(result.item);
    }
  };

  return (
    <main
      className={`desktop desktop-view-${desktopViewMode} theme-${theme} wallpaper-${wallpaper}`}
      onContextMenu={showDesktopContextMenu}
      onPointerCancel={finishDesktopSelection}
      onPointerDown={beginDesktopPointerAction}
      onPointerMove={updateDesktopSelection}
      onPointerUp={finishDesktopSelection}
      style={getWallpaperStyle(wallpaper)}
    >
      <section className="desktop-icons" aria-label="바탕화면 바로가기">
        {desktopApps.map((app) => (
          <DesktopIcon
            key={app.id}
            app={app}
            onMove={(position) => moveDesktopIcon(app.id, position)}
            onOpen={() => openApp(app.id)}
            position={iconLayout[app.id] ?? createDefaultIconLayout()[app.id]!}
            selected={selectedDesktopIds.includes(`app:${app.id}`)}
          />
        ))}
        {activeDesktopItems.filter((item) => item.showOnDesktop).map((item) => (
          <DesktopItemIcon
            item={item}
            key={item.id}
            onMove={(position) => moveDesktopItem(item.id, position)}
            onOpen={() => openDesktopItem(item)}
            selected={selectedDesktopIds.includes(`item:${item.id}`)}
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
                desktopItems={activeDesktopItems}
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
        onClearNotifications={clearNotificationHistory}
        onOpenStart={(event) => {
          event.stopPropagation();
          setStartOpen((value) => !value);
        }}
        onOpenApp={openApp}
        onSetSoundEnabled={setSoundEnabled}
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
          onRefresh={refreshDesktop}
          onSort={arrangeDesktopIcons}
          onToggleGrid={toggleDesktopGrid}
          onViewChange={changeDesktopView}
          x={desktopMenu.x}
          y={desktopMenu.y}
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
    const migratedEntries = entries.filter((entry) => entry.id !== "vfs-pictures");
    if (migratedEntries.length !== entries.length) {
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
  const noteContent =
    localStorage.getItem(NOTE_KEY) ??
    "PocketDesk 메모장\n\n여기에 내용을 적고 저장하면 브라우저 로컬 저장소와 IndexedDB 파일 시스템에 남습니다.";

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

function getUniqueDesktopItemName(items: DesktopItem[]) {
  const baseName = "새 메모.txt";
  const existingNames = new Set(items.map((item) => item.name));
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  for (let index = 2; index < 100; index += 1) {
    const name = `새 메모 ${index}.txt`;
    if (!existingNames.has(name)) {
      return name;
    }
  }

  return `새 메모 ${Date.now()}.txt`;
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

function formatStorageSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
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

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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
    const column = index % 2;
    const row = Math.floor(index / 2);
    layout[app.id] = clampIconPosition(18 + column * 104, 18 + row * 110);
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
  return {
    x: clamp(x, 8, Math.max(8, window.innerWidth - CONTEXT_MENU_WIDTH - 8)),
    y: clamp(y, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - CONTEXT_MENU_HEIGHT - 8)),
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
  onMove,
  onOpen,
  position,
  selected,
}: {
  app: AppDefinition;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  position: IconPosition;
  selected: boolean;
}) {
  const Icon = app.icon;
  return (
    <DesktopIconButton
      accent={app.accent}
      icon={Icon}
      onMove={onMove}
      onOpen={onOpen}
      position={position}
      selected={selected}
      title={app.title}
    />
  );
}

function DesktopItemIcon({
  item,
  onMove,
  onOpen,
  selected,
}: {
  item: DesktopItem;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
  selected: boolean;
}) {
  const association = getVfsEntryAssociation(item);
  return (
    <DesktopIconButton
      accent={association.accent}
      icon={association.icon}
      onMove={onMove}
      onOpen={onOpen}
      position={item}
      selected={selected}
      title={item.name}
      tone="file"
    />
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
  onMove,
  onOpen,
  position,
  selected,
  title,
  tone = "app",
}: {
  accent: string;
  icon: LucideIcon;
  onMove: (position: IconPosition) => void;
  onOpen: () => void;
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
    onOpen();
  };

  return (
    <button
      className={`desktop-icon ${selected ? "is-selected" : ""}`}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
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
  onRefresh,
  onSort,
  onToggleGrid,
  onViewChange,
  x,
  y,
}: {
  alignToGrid: boolean;
  currentSort: DesktopSortKey;
  currentView: DesktopViewMode;
  onChangeWallpaper: () => void;
  onCreateNote: () => void;
  onRefresh: () => void;
  onSort: (sortKey: DesktopSortKey) => void;
  onToggleGrid: () => void;
  onViewChange: (viewMode: DesktopViewMode) => void;
  x: number;
  y: number;
}) {
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const [submenu, setSubmenu] = useState<"sort" | "view" | null>(null);
  const opensLeft = x > window.innerWidth - CONTEXT_MENU_WIDTH * 2 - 20;

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  return (
    <div
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
      <button
        aria-checked={alignToGrid}
        onClick={onToggleGrid}
        onMouseEnter={() => setSubmenu(null)}
        role="menuitemcheckbox"
        type="button"
      >
        {alignToGrid ? <Check aria-hidden="true" size={16} /> : <span />}
        아이콘을 그리드에 맞춤
      </button>
      <span aria-hidden="true" className="menu-separator" />
      <button onClick={onCreateNote} onMouseEnter={() => setSubmenu(null)} role="menuitem" type="button">
        <FileText aria-hidden="true" size={16} />
        새 메모
      </button>
      <span aria-hidden="true" className="menu-separator" />
      <button onClick={onChangeWallpaper} onMouseEnter={() => setSubmenu(null)} role="menuitem" type="button">
        <Palette aria-hidden="true" size={16} />
        개인 설정
      </button>
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
          <span className="toast-icon">
            {toast.tone === "success" ? (
              <Check aria-hidden="true" size={16} />
            ) : (
              <Bell aria-hidden="true" size={16} />
            )}
          </span>
          <div>
            <strong>{toast.title}</strong>
            {toast.detail && <small>{toast.detail}</small>}
          </div>
          <button aria-label={`${toast.title} 알림 닫기`} onClick={() => onDismiss(toast.id)} type="button">
            <X aria-hidden="true" size={15} />
          </button>
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
        <div className="boot-mark">
          <BrandMark />
        </div>
        <strong>PocketDesk OS</strong>
        <div className="boot-progress" aria-hidden="true">
          <span />
        </div>
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => lockRef.current?.focus());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(timer);
    };
  }, []);

  const unlockFromKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onUnlock();
    }
  };

  return (
    <section
      aria-label="PocketDesk 잠금 해제"
      className={`shell-gate lock-screen wallpaper-${wallpaper}`}
      onClick={onUnlock}
      onKeyDown={unlockFromKey}
      ref={lockRef}
      role="button"
      style={getWallpaperStyle(wallpaper)}
      tabIndex={0}
    >
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
      <div className="lock-panel">
        <BrandMark />
        <strong>PocketDesk</strong>
        <small>클릭하거나 Enter를 눌러 시작</small>
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
        inset: `10px 10px ${APP_BAR_HEIGHT + 10}px 10px`,
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
      }`}
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
                <Square aria-hidden="true" size={12} />
              ) : (
                <Maximize2 aria-hidden="true" size={13} />
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
  notificationHistory,
  onClearNotifications,
  onOpenStart,
  onOpenApp,
  onSetSoundEnabled,
  onTogglePinnedApp,
  onToggleWindow,
  pinnedAppIds,
  soundEnabled,
  startOpen,
  windows,
}: {
  activeWindowId?: string;
  availableApps: AppDefinition[];
  notificationHistory: ToastMessage[];
  onClearNotifications: () => void;
  onOpenStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onOpenApp: (appId: AppId) => void;
  onSetSoundEnabled: (enabled: boolean) => void;
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
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
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
    if (!quickSettingsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && trayRef.current?.contains(event.target)) return;
      setQuickSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickSettingsOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [quickSettingsOpen]);

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
                  className={`taskbar-app ${activeWindowId === windowItem?.id ? "is-current" : ""} ${
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
        <button
          aria-expanded={quickSettingsOpen}
          aria-label="시스템 트레이 열기"
          className="system-tray"
          onClick={() => setQuickSettingsOpen((value) => !value)}
          type="button"
        >
          <Wifi aria-hidden="true" size={16} />
          <Volume2 aria-hidden="true" size={16} />
          <Clock />
        </button>
        {quickSettingsOpen && (
          <QuickSettingsPanel
            notifications={notificationHistory}
            onClearNotifications={onClearNotifications}
            onClose={() => setQuickSettingsOpen(false)}
            onOpenSettings={() => {
              setQuickSettingsOpen(false);
              onOpenApp("settings");
            }}
            onSetSoundEnabled={onSetSoundEnabled}
            soundEnabled={soundEnabled}
          />
        )}
      </div>
    </footer>
  );
}

function QuickSettingsPanel({
  notifications,
  onClearNotifications,
  onClose,
  onOpenSettings,
  onSetSoundEnabled,
  soundEnabled,
}: {
  notifications: ToastMessage[];
  onClearNotifications: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
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
      <div className="quick-settings-header">
        <div>
          <strong>빠른 설정</strong>
          <small>PocketDesk 상태</small>
        </div>
        <button aria-label="빠른 설정 닫기" onClick={onClose} type="button">
          <X aria-hidden="true" size={15} />
        </button>
      </div>
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
      <section className="notification-center" aria-label="알림">
        <div className="notification-center-header">
          <div>
            <strong>알림</strong>
            <small>{notifications.length}개</small>
          </div>
          {notifications.length > 0 && (
            <button onClick={onClearNotifications} type="button">
              모두 지우기
            </button>
          )}
        </div>
        {notifications.length > 0 ? (
          <div className="notification-list">
            {notifications.slice(0, 5).map((notification) => (
              <article className={`notification-item notification-${notification.tone}`} key={notification.id}>
                <span className="notification-icon">
                  {notification.tone === "success" ? (
                    <Check aria-hidden="true" size={14} />
                  ) : (
                    <Bell aria-hidden="true" size={14} />
                  )}
                </span>
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
            <span>최근 알림 없음</span>
          </div>
        )}
      </section>
      <div className="quick-actions">
        <button onClick={onOpenSettings} type="button">
          <Settings aria-hidden="true" size={16} />
          설정
        </button>
      </div>
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
            <small>로컬 계정</small>
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
                  <Power aria-hidden="true" size={15} />
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

function BrowserApp({ browserLaunchRequest, notify }: AppContentProps) {
  const [searchEngine, setSearchEngine] = useState<BrowserSearchEngineId>(() => loadBrowserSearchEngine());
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(() => loadBrowserBookmarks());
  const [history, setHistory] = useState<BrowserHistoryEntry[]>(() => loadBrowserHistory());
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("홈 화면에서 검색하거나 즐겨찾기와 방문 기록을 열어보세요.");
  const isBookmarked = Boolean(url && bookmarks.some((bookmark) => bookmark.url === url));

  useEffect(() => {
    localStorage.setItem(BROWSER_SEARCH_ENGINE_KEY, searchEngine);
  }, [searchEngine]);

  useEffect(() => {
    localStorage.setItem(BROWSER_BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(BROWSER_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const recordNavigation = (value: string) => {
    const nextUrl = normalizeUrl(value, searchEngine);
    const title = getBrowserPageTitle(nextUrl);
    const now = Date.now();
    setUrl(nextUrl);
    setDraft(nextUrl);
    setHistory((current) => [
      { id: `history-${crypto.randomUUID()}`, title, url: nextUrl, visitedAt: now },
      ...current.filter((entry) => entry.url !== nextUrl),
    ].slice(0, 20));
    return nextUrl;
  };

  const openExternal = (value: string) => {
    const nextUrl = recordNavigation(value);
    window.open(nextUrl, "_blank", "noopener,noreferrer");
    setNotice("새 브라우저 탭에서 열었습니다.");
  };

  useEffect(() => {
    if (!browserLaunchRequest) return;
    recordNavigation(browserLaunchRequest.value);
    setNotice("주소를 준비했습니다. 새 탭 열기를 누르세요.");
  }, [browserLaunchRequest?.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    openExternal(draft || "PocketDesk");
  };

  const openHome = () => {
    setUrl(null);
    setDraft("");
    setNotice("홈 화면에서 검색하거나 즐겨찾기와 방문 기록을 열어보세요.");
  };

  const toggleBookmark = () => {
    if (!url) return;

    if (isBookmarked) {
      setBookmarks((current) => current.filter((bookmark) => bookmark.url !== url));
      notify({
        detail: getBrowserPageTitle(url),
        title: "즐겨찾기 제거됨",
        tone: "success",
      });
      return;
    }

    const bookmark = {
      createdAt: Date.now(),
      id: `bookmark-${crypto.randomUUID()}`,
      title: getBrowserPageTitle(url),
      url,
    };
    setBookmarks((current) => [bookmark, ...current.filter((item) => item.url !== url)].slice(0, 16));
    notify({
      detail: bookmark.url,
      title: "즐겨찾기 추가됨",
      tone: "success",
    });
  };

  const clearHistory = () => {
    setHistory([]);
    notify({
      detail: "웹 브라우저 방문 기록을 비웠습니다.",
      title: "방문 기록 삭제됨",
      tone: "success",
    });
  };

  return (
    <div className="browser-app app-fill">
      <form className="browser-toolbar" onSubmit={submit}>
        <button aria-label="홈" onClick={openHome} title="홈" type="button">
          <House aria-hidden="true" size={16} />
        </button>
        <button aria-label={url ? "새로고침" : "검색"} title={url ? "새로고침" : "검색"} type="submit">
          {url ? <RotateCcw aria-hidden="true" size={16} /> : <Search aria-hidden="true" size={16} />}
        </button>
        <input
          aria-label="웹 주소 또는 검색어"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="주소 또는 검색어"
          spellCheck={false}
          value={draft}
        />
        <select
          aria-label="검색 엔진"
          onChange={(event) => setSearchEngine(event.target.value as BrowserSearchEngineId)}
          value={searchEngine}
        >
          {browserSearchEngines.map((engine) => (
            <option key={engine.id} value={engine.id}>
              {engine.label}
            </option>
          ))}
        </select>
        <button
          aria-label={isBookmarked ? "즐겨찾기 제거" : "즐겨찾기 추가"}
          disabled={!url}
          onClick={toggleBookmark}
          title={isBookmarked ? "즐겨찾기 제거" : "즐겨찾기 추가"}
          type="button"
        >
          <Star aria-hidden="true" fill={isBookmarked ? "currentColor" : "none"} size={16} />
        </button>
        {url ? (
          <a className="icon-link" href={url} rel="noreferrer" target="_blank" title="새 탭에서 열기">
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        ) : (
          <span aria-hidden="true" className="icon-link is-disabled">
            <ExternalLink aria-hidden="true" size={16} />
          </span>
        )}
      </form>
      <p className="browser-notice">{notice}</p>
      {url ? (
        <section className="browser-external-page">
          <Globe2 aria-hidden="true" size={42} />
          <strong>{getBrowserPageTitle(url)}</strong>
          <small>{url}</small>
          <a href={url} rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" size={17} />
            새 탭에서 열기
          </a>
        </section>
      ) : (
        <BrowserHome
          bookmarks={bookmarks}
          history={history}
          onClearHistory={clearHistory}
          onNavigate={openExternal}
          searchEngine={getBrowserSearchEngine(searchEngine).label}
        />
      )}
    </div>
  );
}

function BrowserHome({
  bookmarks,
  history,
  onClearHistory,
  onNavigate,
  searchEngine,
}: {
  bookmarks: BrowserBookmark[];
  history: BrowserHistoryEntry[];
  onClearHistory: () => void;
  onNavigate: (value: string) => void;
  searchEngine: string;
}) {
  const quickLinks = [
    { label: "Example", url: "https://example.com" },
    { label: "MDN", url: "https://developer.mozilla.org" },
    { label: "Wikipedia", url: "https://wikipedia.org" },
  ];

  return (
    <div className="browser-home">
      <section className="browser-home-search">
        <Globe2 aria-hidden="true" size={30} />
        <h2>웹 브라우저</h2>
        <p>{searchEngine}로 검색하거나 주소를 입력하세요.</p>
        <div className="browser-quick-links" aria-label="빠른 링크">
          {quickLinks.map((link) => (
            <button key={link.url} onClick={() => onNavigate(link.url)} type="button">
              {link.label}
            </button>
          ))}
        </div>
      </section>
      <section className="browser-home-panel">
        <div className="browser-panel-title">
          <Star aria-hidden="true" size={16} />
          <strong>즐겨찾기</strong>
        </div>
        {bookmarks.length > 0 ? (
          <div className="browser-link-list">
            {bookmarks.map((bookmark) => (
              <button key={bookmark.id} onClick={() => onNavigate(bookmark.url)} type="button">
                <strong>{bookmark.title}</strong>
                <small>{bookmark.url}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="browser-empty">열린 페이지에서 별표를 눌러 저장하세요.</p>
        )}
      </section>
      <section className="browser-home-panel">
        <div className="browser-panel-title">
          <History aria-hidden="true" size={16} />
          <strong>방문 기록</strong>
          {history.length > 0 && (
            <button onClick={onClearHistory} type="button">
              지우기
            </button>
          )}
        </div>
        {history.length > 0 ? (
          <div className="browser-link-list">
            {history.map((entry) => (
              <button key={entry.id} onClick={() => onNavigate(entry.url)} type="button">
                <strong>{entry.title}</strong>
                <small>{new Date(entry.visitedAt).toLocaleString("ko-KR")}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="browser-empty">아직 방문한 페이지가 없습니다.</p>
        )}
      </section>
    </div>
  );
}

function MinesweeperApp() {
  const [difficultyId, setDifficultyId] = useState<MinesDifficultyId>("easy");
  const difficulty = getMinesDifficulty(difficultyId);
  const [board, setBoard] = useState(() => createMineBoard(difficulty));
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [started, setStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestRecords, setBestRecords] = useState<Record<MinesDifficultyId, number | null>>(() =>
    loadMinesBestRecords(),
  );

  useEffect(() => {
    if (!started || status !== "playing") return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [started, status]);

  useEffect(() => {
    localStorage.setItem(MINES_BEST_RECORDS_KEY, JSON.stringify(bestRecords));
  }, [bestRecords]);

  const reset = () => {
    setBoard(createMineBoard(difficulty));
    setStatus("playing");
    setStarted(false);
    setElapsedSeconds(0);
  };

  const changeDifficulty = (nextDifficultyId: MinesDifficultyId) => {
    const nextDifficulty = getMinesDifficulty(nextDifficultyId);
    setDifficultyId(nextDifficulty.id);
    setBoard(createMineBoard(nextDifficulty));
    setStatus("playing");
    setStarted(false);
    setElapsedSeconds(0);
  };

  const reveal = (index: number) => {
    if (status !== "playing") return;
    const target = board[index];
    if (!target || target.flagged || target.revealed) return;
    setStarted(true);

    if (target.mine) {
      setBoard(board.map((cell) => ({ ...cell, revealed: true })));
      setStatus("lost");
      return;
    }

    const next = revealSafeCells(board, index, difficulty);
    setBoard(next);

    if (next.every((cell) => cell.mine || cell.revealed)) {
      setStatus("won");
      const completedTime = Math.max(elapsedSeconds, 1);
      setElapsedSeconds(completedTime);
      setBestRecords((current) => {
        const currentBest = current[difficulty.id];
        if (currentBest !== null && currentBest <= completedTime) return current;
        return { ...current, [difficulty.id]: completedTime };
      });
    }
  };

  const toggleFlag = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    if (status !== "playing") return;
    setStarted(true);
    setBoard((current) =>
      current.map((cell, cellIndex) =>
        cellIndex === index && !cell.revealed ? { ...cell, flagged: !cell.flagged } : cell,
      ),
    );
  };

  const flagCount = board.filter((cell) => cell.flagged).length;
  const bestRecord = bestRecords[difficulty.id];

  return (
    <div className="mines-app">
      <div className="app-toolbar">
        <div>
          <strong>{status === "won" ? "승리!" : status === "lost" ? "폭발!" : "진행 중"}</strong>
          <span>
            {difficulty.rows}x{difficulty.cols} · 지뢰 {difficulty.mines}개 · 깃발 {flagCount}개
          </span>
        </div>
        <label>
          난이도
          <select
            aria-label="지뢰찾기 난이도"
            onChange={(event) => changeDifficulty(event.target.value as MinesDifficultyId)}
            value={difficulty.id}
          >
            {minesDifficulties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mines-stat">
          <span>시간</span>
          <strong>{formatDuration(elapsedSeconds)}</strong>
        </div>
        <div className="mines-stat">
          <span>최고</span>
          <strong>{bestRecord === null ? "--" : formatDuration(bestRecord)}</strong>
        </div>
        <button onClick={reset} type="button">
          <RotateCcw aria-hidden="true" size={16} />
          새 게임
        </button>
      </div>
      <div
        className="mine-grid"
        role="grid"
        style={{ "--mine-cols": difficulty.cols } as React.CSSProperties}
      >
        {board.map((cell, index) => (
          <button
            aria-label={`${index + 1}번 칸`}
            className={`mine-cell ${cell.revealed ? "is-open" : ""}`}
            key={cell.id}
            onClick={() => reveal(index)}
            onContextMenu={(event) => toggleFlag(event, index)}
            type="button"
          >
            {cell.flagged && !cell.revealed ? (
              <Flag aria-hidden="true" size={14} />
            ) : cell.revealed && cell.mine ? (
              <Bomb aria-hidden="true" size={15} />
            ) : cell.revealed && cell.adjacent > 0 ? (
              cell.adjacent
            ) : null}
          </button>
        ))}
      </div>
      <p className="hint">좌클릭으로 열고, 우클릭으로 깃발을 세웁니다.</p>
    </div>
  );
}

function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [mode, setMode] = useState<CalculatorMode>("standard");
  const calculatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    calculatorRef.current?.focus();
  }, []);

  const appendValue = (value: string) => {
    setDisplay((current) => appendCalculatorValue(current, value));
  };

  const applyUnary = (operation: (value: number) => number) => {
    setDisplay((current) => applyCalculatorUnary(current, operation));
  };

  const runAction = (action: CalculatorAction) => {
    if (action === "clear") {
      setDisplay("0");
      return;
    }

    if (action === "delete") {
      setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
      return;
    }

    if (action === "equals") {
      setDisplay((current) => {
        const result = evaluateExpression(current);
        return formatCalculatorResult(result);
      });
      return;
    }

    if (action === "toggle-sign") {
      setDisplay((current) => toggleCalculatorSign(current));
      return;
    }

    if (action === "percent") {
      applyUnary((value) => value / 100);
      return;
    }

    if (action === "pi") {
      setDisplay((current) => insertCalculatorPi(current));
      return;
    }

    if (action === "sqrt") applyUnary(Math.sqrt);
    if (action === "square") applyUnary((value) => value * value);
    if (action === "reciprocal") applyUnary((value) => 1 / value);
    if (action === "sin") applyUnary((value) => Math.sin(degreesToRadians(value)));
    if (action === "cos") applyUnary((value) => Math.cos(degreesToRadians(value)));
    if (action === "tan") applyUnary((value) => Math.tan(degreesToRadians(value)));
    if (action === "log") applyUnary(Math.log10);
    if (action === "ln") applyUnary(Math.log);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const key = event.key;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (/^\d$/.test(key) || ["+", "-", "*", "/", "."].includes(key)) {
      handled();
      appendValue(key);
      return;
    }

    if (key === "Enter" || key === "=") {
      handled();
      runAction("equals");
      return;
    }

    if (key === "Backspace") {
      handled();
      runAction("delete");
      return;
    }

    if (key === "Delete" || key === "Escape" || key.toLowerCase() === "c") {
      handled();
      runAction("clear");
      return;
    }

    if (key === "%") {
      handled();
      runAction("percent");
      return;
    }

    if (key.toLowerCase() === "p") {
      handled();
      runAction("pi");
    }
  };

  const renderCalculatorButton = (button: CalculatorButton) => (
    <button
      className={button.className ?? ""}
      key={button.label}
      onClick={() => (button.action ? runAction(button.action) : appendValue(button.value ?? ""))}
      type="button"
    >
      {button.label}
    </button>
  );

  return (
    <div
      className={`calculator-app calc-mode-${mode}`}
      onKeyDown={handleKeyDown}
      onPointerDown={() => calculatorRef.current?.focus()}
      ref={calculatorRef}
      tabIndex={0}
    >
      <div className="calc-mode-row" role="group" aria-label="계산기 모드">
        {(["standard", "scientific"] as CalculatorMode[]).map((option) => (
          <button
            aria-pressed={mode === option}
            className={mode === option ? "is-selected" : ""}
            key={option}
            onClick={() => setMode(option)}
            type="button"
          >
            {option === "standard" ? "일반" : "공학"}
          </button>
        ))}
      </div>
      <output aria-label="계산기 표시창">{display}</output>
      {mode === "scientific" && (
        <div className="calc-grid calc-scientific-grid" aria-label="공학용 함수">
          {calculatorScientificButtons.map(renderCalculatorButton)}
        </div>
      )}
      <div className="calc-grid calc-standard-grid" aria-label="계산기 버튼">
        {calculatorStandardButtons.map(renderCalculatorButton)}
      </div>
    </div>
  );
}

function PaintApp({
  activeCanvasId,
  activeCanvasOpenKey,
  canvasEntries,
  savePaintImage,
}: AppContentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const shapeSnapshot = useRef<ImageData | null>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const activeCanvas = canvasEntries.find((item) => item.id === activeCanvasId) ?? canvasEntries[0];
  const [tool, setTool] = useState<PaintTool>("brush");
  const [color, setColor] = useState("#0f6c81");
  const [size, setSize] = useState(5);
  const [saved, setSaved] = useState(false);
  const [historyState, setHistoryState] = useState({ redo: 0, undo: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryState({ redo: 0, undo: 0 });

    if (!activeCanvas?.content) return;

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = activeCanvas.content;
  }, [activeCanvas?.content, activeCanvas?.id, activeCanvasOpenKey]);

  const updateHistoryState = () => {
    setHistoryState({ redo: redoStack.current.length, undo: undoStack.current.length });
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current = [...undoStack.current.slice(-29), canvas.toDataURL("image/png")];
    redoStack.current = [];
    updateHistoryState();
  };

  const restoreSnapshot = (snapshot: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = snapshot;
  };

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawShape = (
    context: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();

    if (tool === "line") {
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    } else if (tool === "rect") {
      context.rect(from.x, from.y, to.x - from.x, to.y - from.y);
    } else if (tool === "ellipse") {
      const centerX = (from.x + to.x) / 2;
      const centerY = (from.y + to.y) / 2;
      const radiusX = Math.max(Math.abs(to.x - from.x) / 2, 1);
      const radiusY = Math.max(Math.abs(to.y - from.y) / 2, 1);
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    }

    context.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);

    if (tool !== "brush") {
      const from = shapeStart.current;
      const snapshot = shapeSnapshot.current;
      if (!from || !snapshot) return;
      context.putImageData(snapshot, 0, 0);
      drawShape(context, from, point);
      return;
    }

    const from = lastPoint.current ?? point;
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    pushUndoSnapshot();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSaved(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    savePaintImage(canvas.toDataURL("image/png"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1300);
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${activeCanvas?.name?.replace(/\.[^.]+$/, "") || "pocket-desk-sketch"}.png`;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current = [...redoStack.current, canvas.toDataURL("image/png")].slice(-30);
    restoreSnapshot(previous);
    updateHistoryState();
  };

  const redo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current = [...undoStack.current, canvas.toDataURL("image/png")].slice(-30);
    restoreSnapshot(next);
    updateHistoryState();
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    pushUndoSnapshot();
    drawing.current = true;
    const point = getPoint(event);
    lastPoint.current = point;
    shapeStart.current = point;
    shapeSnapshot.current = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current && tool !== "brush") {
      draw(event);
    }
    drawing.current = false;
    lastPoint.current = null;
    shapeStart.current = null;
    shapeSnapshot.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="paint-app app-fill">
      <div className="app-toolbar">
        <span className="canvas-file-label">
          <FileText aria-hidden="true" size={15} />
          {activeCanvas?.name ?? "새 그림"}
        </span>
        <div className="paint-tool-group" aria-label="그림 도구">
          {paintTools.map((option) => (
            <button
              aria-pressed={tool === option.id}
              className={tool === option.id ? "is-selected" : ""}
              key={option.id}
              onClick={() => setTool(option.id)}
              title={option.label}
              type="button"
            >
              {option.id === "brush" && <Paintbrush aria-hidden="true" size={16} />}
              {option.id === "line" && <Minus aria-hidden="true" size={16} />}
              {option.id === "rect" && <Square aria-hidden="true" size={16} />}
              {option.id === "ellipse" && <span aria-hidden="true" className="ellipse-tool-icon" />}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <label>
          <Palette aria-hidden="true" size={16} />
          <input
            aria-label="붓 색상"
            onChange={(event) => setColor(event.target.value)}
            type="color"
            value={color}
          />
        </label>
        <label>
          굵기
          <input
            aria-label="붓 굵기"
            max="22"
            min="1"
            onChange={(event) => setSize(Number(event.target.value))}
            type="range"
            value={size}
          />
        </label>
        <div className="paint-palette" aria-label="색상 팔레트">
          {paintPalette.map((swatch) => (
            <button
              aria-label={`${swatch} 색상 선택`}
              aria-pressed={color.toLowerCase() === swatch}
              className={color.toLowerCase() === swatch ? "is-selected" : ""}
              key={swatch}
              onClick={() => setColor(swatch)}
              style={{ "--swatch": swatch } as React.CSSProperties}
              type="button"
            />
          ))}
        </div>
        <button disabled={historyState.undo === 0} onClick={undo} type="button">
          <Undo2 aria-hidden="true" size={16} />
          실행 취소
        </button>
        <button disabled={historyState.redo === 0} onClick={redo} type="button">
          <Redo2 aria-hidden="true" size={16} />
          다시 실행
        </button>
        <button onClick={clear} type="button">
          <Eraser aria-hidden="true" size={16} />
          지우기
        </button>
        <button onClick={save} type="button">
          <Save aria-hidden="true" size={16} />
          PNG 저장
        </button>
        <button onClick={downloadPng} type="button">
          <Download aria-hidden="true" size={16} />
          다운로드
        </button>
        {saved && (
          <span className="saved-indicator">
            <Check aria-hidden="true" size={15} />
            저장됨
          </span>
        )}
      </div>
      <canvas
        aria-label="그림판 캔버스"
        className="paint-canvas"
        height="720"
        onPointerDown={startDrawing}
        onPointerLeave={() => {
          drawing.current = false;
          lastPoint.current = null;
          shapeStart.current = null;
          shapeSnapshot.current = null;
        }}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        ref={canvasRef}
        width="1120"
      />
    </div>
  );
}

function NotepadApp({
  activeNoteId,
  noteEntries,
  notify,
  openVfsEntry,
  saveNoteContent,
}: AppContentProps) {
  const activeNote = noteEntries.find((item) => item.id === activeNoteId) ?? noteEntries[0];
  const [text, setText] = useState(activeNote?.content ?? "");
  const [viewMode, setViewMode] = useState<NoteViewMode>("edit");
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>("saved");
  const saveStatusLabel =
    saveStatus === "saved" ? "저장됨" : saveStatus === "saving" ? "저장 중" : "자동 저장 대기";

  const save = (source: "manual" | "auto" = "manual") => {
    if (!activeNote) return;
    setSaveStatus("saving");
    saveNoteContent(activeNote.id, text);
    window.setTimeout(() => setSaveStatus("saved"), 220);

    if (source === "manual") {
      notify({
        detail: `IndexedDB 파일 시스템에 ${activeNote.name} 내용을 저장했습니다.`,
        title: "메모 저장됨",
        tone: "success",
      });
    }
  };

  useEffect(() => {
    setText(activeNote?.content ?? "");
    setSaveStatus("saved");
  }, [activeNote?.content, activeNote?.id]);

  useEffect(() => {
    if (!activeNote) return;
    if (text === (activeNote.content ?? "")) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("dirty");
    const timer = window.setTimeout(() => {
      save("auto");
    }, 850);

    return () => window.clearTimeout(timer);
  }, [activeNote?.content, activeNote?.id, text]);

  useEffect(() => {
    const saveFromShortcut = () => save();
    window.addEventListener(NOTE_SAVE_EVENT, saveFromShortcut);
    return () => window.removeEventListener(NOTE_SAVE_EVENT, saveFromShortcut);
  }, [activeNote?.id, text, notify]);

  return (
    <div className="notepad-app app-fill">
      <div className="app-toolbar">
        <div className="note-tabs" role="tablist">
          {noteEntries.map((note) => (
            <button
              aria-selected={note.id === activeNote?.id}
              className={note.id === activeNote?.id ? "is-selected" : ""}
              key={note.id}
              onClick={() => openVfsEntry(note)}
              role="tab"
              type="button"
            >
              <FileText aria-hidden="true" size={14} />
              {note.name}
            </button>
          ))}
        </div>
        <div className="note-mode-toggle" role="group" aria-label="메모 보기 모드">
          {(["edit", "preview"] as NoteViewMode[]).map((mode) => (
            <button
              aria-pressed={viewMode === mode}
              className={viewMode === mode ? "is-selected" : ""}
              key={mode}
              onClick={() => setViewMode(mode)}
              type="button"
            >
              {mode === "edit" ? "작성" : "미리보기"}
            </button>
          ))}
        </div>
        <button onClick={() => save()} type="button">
          <Save aria-hidden="true" size={16} />
          저장
        </button>
        <span className={`saved-indicator note-save-${saveStatus}`}>
          <Check aria-hidden="true" size={15} />
          {saveStatusLabel}
        </span>
      </div>
      <div className="note-workspace">
        {viewMode === "edit" ? (
          <textarea
            aria-label="메모 내용"
            className="note-editor"
            disabled={!activeNote}
            onChange={(event) => setText(event.target.value)}
            placeholder="Markdown으로 메모를 작성하세요. 예: # 제목, - 목록, **강조**"
            spellCheck
            value={text}
          />
        ) : (
          <MarkdownPreview text={text} />
        )}
      </div>
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  const blocks = useMemo(() => renderMarkdownBlocks(text), [text]);

  return (
    <div className="markdown-preview" aria-label="Markdown 미리보기">
      {blocks.length > 0 ? blocks : <p className="markdown-empty">미리볼 Markdown 내용이 없습니다.</p>}
    </div>
  );
}

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: JSX.Element[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const content = renderMarkdownInline(heading[2], `heading-${index}`);
      if (level === 1) blocks.push(<h2 key={`heading-${index}`}>{content}</h2>);
      if (level === 2) blocks.push(<h3 key={`heading-${index}`}>{content}</h3>);
      if (level === 3) blocks.push(<h4 key={`heading-${index}`}>{content}</h4>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: JSX.Element[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(
          <li key={`ul-${index}`}>{renderMarkdownInline(lines[index].trim().replace(/^[-*]\s+/, ""), `ul-${index}`)}</li>,
        );
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: JSX.Element[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(
          <li key={`ol-${index}`}>
            {renderMarkdownInline(lines[index].trim().replace(/^\d+\.\s+/, ""), `ol-${index}`)}
          </li>,
        );
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderMarkdownInline(quoteLines.join(" "), `quote-${index}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith(">") &&
      !lines[index].trim().startsWith("```")
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`}>{renderMarkdownInline(paragraphLines.join(" "), `p-${index}`)}</p>,
    );
  }

  return blocks;
}

function renderMarkdownInline(value: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push(value.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a href={link[2]} key={key} rel="noreferrer" target="_blank">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    cursor = match.index + token.length;
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes;
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

function ThisPcApp({
  desktopItems,
  openApp,
  trashedItems,
}: AppContentProps) {
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);
  const folderCount = desktopItems.filter((item) => item.kind === "folder").length;
  const totalItems = desktopItems.length;

  useEffect(() => {
    let cancelled = false;
    if (!navigator.storage?.estimate) {
      setStorageEstimate({});
      return;
    }

    navigator.storage.estimate().then((estimate) => {
      if (!cancelled) setStorageEstimate(estimate);
    }).catch(() => {
      if (!cancelled) setStorageEstimate({});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const folders = [
    {
      detail: `${desktopItems.filter((item) => item.showOnDesktop).length}개 항목`,
      icon: Monitor,
      label: "바탕 화면",
      open: () => openApp("files"),
    },
    {
      detail: `${trashedItems.length}개 항목`,
      icon: Trash2,
      label: "휴지통",
      open: () => openApp("recycle"),
    },
  ];
  const quota = storageEstimate?.quota ?? 0;
  const used = storageEstimate?.usage ?? 0;
  const free = Math.max(0, quota - used);
  const drives = [
    {
      free:
        quota > 0
          ? `${formatStorageSize(free)} 사용 가능 / ${formatStorageSize(quota)}`
          : storageEstimate === null
            ? "용량 확인 중"
            : "사용량 정보 없음",
      icon: Monitor,
      label: "로컬 디스크 (C:)",
      usage: quota > 0 ? clamp((used / quota) * 100, 1, 100) : 0,
    },
  ];

  return (
    <div className="this-pc-app app-fill">
      <aside className="this-pc-sidebar">
        <strong>Quick access</strong>
        <button onClick={() => openApp("files")} type="button">
          <Folder aria-hidden="true" size={16} />
          Desktop
        </button>
        <button onClick={() => openApp("recycle")} type="button">
          <Trash2 aria-hidden="true" size={16} />
          휴지통
        </button>
        <button onClick={() => openApp("settings")} type="button">
          <Settings aria-hidden="true" size={16} />
          설정
        </button>
      </aside>
      <section className="this-pc-main">
        <div className="file-address this-pc-address">
          <House aria-hidden="true" size={15} />
          <span>홈</span>
          <span aria-hidden="true">›</span>
          <strong>내 PC</strong>
        </div>
        <section className="this-pc-section">
          <h2>폴더</h2>
          <div className="this-pc-folder-grid">
            {folders.map((folder) => {
              const FolderIcon = folder.icon;
              return (
                <button key={folder.label} onClick={folder.open} type="button">
                  <FolderIcon aria-hidden="true" size={24} />
                  <span>
                    <strong>{folder.label}</strong>
                    <small>{folder.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="this-pc-section">
          <h2>장치 및 드라이브</h2>
          <div className="this-pc-drive-list">
            {drives.map((drive) => {
              const DriveIcon = drive.icon;
              return (
                <button key={drive.label} onClick={() => openApp("files")} type="button">
                  <DriveIcon aria-hidden="true" size={26} />
                  <span>
                    <strong>{drive.label}</strong>
                    <span className="drive-meter" aria-hidden="true">
                      <span style={{ width: `${drive.usage}%` }} />
                    </span>
                    <small>{drive.free}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="this-pc-section this-pc-system">
          <h2>시스템</h2>
          <div>
            <span>
              <strong>장치 이름</strong>
              <small>PocketDesk-PC</small>
            </span>
            <span>
              <strong>항목</strong>
              <small>
                사용 중 {totalItems}개 · 휴지통 {trashedItems.length}개
              </small>
            </span>
            <span>
              <strong>폴더</strong>
              <small>{folderCount}개</small>
            </span>
          </div>
        </section>
      </section>
    </div>
  );
}

function FilesApp({
  deleteVfsEntry,
  desktopItems,
  exportVfsZip,
  importVfsZip,
  notify,
  openApp,
  openVfsEntry,
  renameVfsEntry,
}: AppContentProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [location, setLocation] = useState<"desktop" | "documents" | "games" | "pictures">(
    "desktop",
  );
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
        };
      }),
    [locationItems],
  );
  const [selected, setSelected] = useState(0);
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
  const selectedFile = filteredFiles[Math.min(selected, filteredFiles.length - 1)];
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(selectedFile?.name ?? "");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setSelected((current) =>
      filteredFiles.length === 0 ? 0 : clamp(current, 0, filteredFiles.length - 1),
    );
  }, [filteredFiles.length]);

  useEffect(() => {
    setDraftName(selectedFile?.name ?? "");
    setRenaming(false);
  }, [selectedFile?.id, selectedFile?.name]);

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;
    renameVfsEntry(selectedFile.id, draftName);
    setRenaming(false);
  };

  const deleteSelectedFile = () => {
    if (!selectedFile) return;
    deleteVfsEntry(selectedFile.id);
    setRenaming(false);
    setSelected((current) =>
      filteredFiles.length <= 1 ? 0 : clamp(current, 0, filteredFiles.length - 2),
    );
  };

  const importSelectedZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      await importVfsZip(file);
      setSelected(0);
    } catch (error) {
      notify({
        detail: error instanceof Error ? error.message : "ZIP 파일을 읽을 수 없습니다.",
        title: "VFS ZIP 가져오기 실패",
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
          onClick={() => {
            setLocation("desktop");
            setSelected(0);
          }}
          type="button"
        >
          <Folder aria-hidden="true" size={16} />
          바탕 화면
        </button>
        <button
          className={location === "documents" ? "is-selected" : ""}
          onClick={() => {
            setLocation("documents");
            setSelected(0);
          }}
          type="button"
        >
          문서
        </button>
        <button
          className={location === "pictures" ? "is-selected" : ""}
          onClick={() => {
            setLocation("pictures");
            setSelected(0);
          }}
          type="button"
        >
          사진
        </button>
        <button
          className={location === "games" ? "is-selected" : ""}
          onClick={() => {
            setLocation("games");
            setSelected(0);
          }}
          type="button"
        >
          게임
        </button>
        <div className="file-backup-actions">
          <button onClick={exportVfsZip} type="button">
            <Download aria-hidden="true" size={16} />
            ZIP 내보내기
          </button>
          <button
            aria-busy={importing}
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            <Upload aria-hidden="true" size={16} />
            {importing ? "가져오는 중" : "ZIP 가져오기"}
          </button>
          <input
            accept=".zip,application/zip"
            aria-label="VFS ZIP 파일 가져오기"
            className="file-import-input"
            onChange={importSelectedZip}
            ref={importInputRef}
            type="file"
          />
        </div>
      </aside>
      <section className="file-main-pane">
        <div className="file-explorer-top">
          <div className="file-command-strip">
            <button
              disabled={!selectedFile}
              onClick={() => selectedFile && openVfsEntry(selectedFile.item)}
              type="button"
            >
              <ExternalLink aria-hidden="true" size={15} />
              열기
            </button>
            <button
              disabled={!selectedFile}
              onClick={() => selectedFile && setRenaming(true)}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
              이름 바꾸기
            </button>
            <button
              className="file-danger"
              disabled={!selectedFile}
              onClick={deleteSelectedFile}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              삭제
            </button>
          </div>
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
        </div>
        <div className="file-list" role="list">
          {filteredFiles.map((file, index) => {
            const FileIcon = file.icon;
            return (
              <button
                className={selected === index ? "is-selected" : ""}
                key={file.id}
                onClick={() => setSelected(index)}
                type="button"
              >
                <FileIcon aria-hidden="true" size={18} />
                <span>{file.name}</span>
                <small>{file.type}</small>
                <small>{file.modified}</small>
              </button>
            );
          })}
          {filteredFiles.length === 0 && (
            <div className="file-empty-state">
              <Search aria-hidden="true" size={24} />
              <strong>검색 결과 없음</strong>
              <small>다른 이름, 확장자, 앱 이름으로 검색해보세요.</small>
            </div>
          )}
        </div>
        <div className="file-preview">
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
              {renaming ? (
                <form className="file-rename-form" onSubmit={submitRename}>
                  <input
                    aria-label="파일 이름"
                    onChange={(event) => setDraftName(event.target.value)}
                    value={draftName}
                  />
                  <button type="submit">
                    <Save aria-hidden="true" size={15} />
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setDraftName(selectedFile.name);
                      setRenaming(false);
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" size={15} />
                    취소
                  </button>
                </form>
              ) : (
                <div className="file-actions">
                  <button onClick={() => openVfsEntry(selectedFile.item)} type="button">
                    <ExternalLink aria-hidden="true" size={15} />
                    열기
                  </button>
                  <button onClick={() => setRenaming(true)} type="button">
                    <Pencil aria-hidden="true" size={15} />
                    이름 변경
                  </button>
                  <button className="file-danger" onClick={deleteSelectedFile} type="button">
                    <Trash2 aria-hidden="true" size={15} />
                    삭제
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h3>{locationLabel}</h3>
              <p>표시할 파일이 없습니다.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function RecycleBinApp({
  emptyRecycleBin,
  permanentlyDeleteVfsEntry,
  restoreVfsEntry,
  trashedItems,
}: AppContentProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "empty" | null>(null);
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
  const [selected, setSelected] = useState(0);
  const selectedFile = files[Math.min(selected, files.length - 1)];

  useEffect(() => {
    setSelected((current) => (files.length === 0 ? 0 : clamp(current, 0, files.length - 1)));
  }, [files.length]);

  return (
    <div className="recycle-app app-fill">
      <div className="app-toolbar recycle-toolbar">
        <div>
          <strong>휴지통</strong>
          <span>{files.length}개 항목</span>
        </div>
        <button disabled={files.length === 0} onClick={() => setConfirmAction("empty")} type="button">
          <Trash2 aria-hidden="true" size={16} />
          휴지통 비우기
        </button>
      </div>
      <section>
        <div className="file-list recycle-list" role="list">
          {files.map((file, index) => {
            const FileIcon = file.icon;
            return (
              <button
                className={selected === index ? "is-selected" : ""}
                key={file.id}
                onClick={() => setSelected(index)}
                type="button"
              >
                <FileIcon aria-hidden="true" size={18} />
                <span>{file.name}</span>
                <small>{file.type}</small>
                <small>{file.removed}</small>
              </button>
            );
          })}
          {files.length === 0 && (
            <div className="recycle-empty">
              <Trash2 aria-hidden="true" size={30} />
              <strong>휴지통이 비어 있습니다</strong>
              <small>파일 탐색기에서 삭제한 항목은 여기서 복원하거나 영구 삭제할 수 있습니다.</small>
            </div>
          )}
        </div>
        <div className="file-preview">
          {selectedFile ? (
            <>
              <div className="file-preview-header">
                <h3>{selectedFile.name}</h3>
                <small>
                  {selectedFile.type} · 삭제 {selectedFile.removed}
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
                <button onClick={() => restoreVfsEntry(selectedFile.id)} type="button">
                  <RotateCcw aria-hidden="true" size={15} />
                  복원
                </button>
                <button
                  className="file-danger"
                  onClick={() => setConfirmAction("delete")}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                  영구 삭제
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>휴지통</h3>
              <p>삭제된 파일이 없습니다.</p>
            </>
          )}
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
  const themes: Array<{ id: ThemeName; label: string; detail: string }> = [
    { id: "lagoon", label: "Lagoon", detail: "청록, 감청, 노란 포인트" },
    { id: "meadow", label: "Meadow", detail: "초록, 회색, 코랄 포인트" },
    { id: "ember", label: "Ember", detail: "먹색, 적갈, 민트 포인트" },
  ];

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-profile">
          <Monitor aria-hidden="true" size={24} />
          <span>
            <strong>PocketDesk</strong>
            <small>로컬 장치</small>
          </span>
        </div>
        <button
          className={section === "personalization" ? "is-selected" : ""}
          onClick={() => setSection("personalization")}
          type="button"
        >
          <Palette aria-hidden="true" size={16} />
          개인 설정
        </button>
        <button
          className={section === "system" ? "is-selected" : ""}
          onClick={() => setSection("system")}
          type="button"
        >
          <Monitor aria-hidden="true" size={16} />
          시스템
        </button>
        <button
          className={section === "sound" ? "is-selected" : ""}
          onClick={() => setSection("sound")}
          type="button"
        >
          <Volume2 aria-hidden="true" size={16} />
          소리
        </button>
      </aside>
      <section className="settings-content">
        <header className="settings-hero">
          <div>
            <p>설정</p>
            <h2>
              {section === "personalization" ? "개인 설정" : section === "system" ? "시스템" : "소리"}
            </h2>
          </div>
          <span className="settings-device-pill">PocketDesk OS</span>
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

type MineCell = {
  adjacent: number;
  flagged: boolean;
  id: string;
  mine: boolean;
  revealed: boolean;
};

function getMinesDifficulty(difficultyId: MinesDifficultyId) {
  return minesDifficulties.find((difficulty) => difficulty.id === difficultyId) ?? minesDifficulties[0];
}

function loadMinesBestRecords(): Record<MinesDifficultyId, number | null> {
  const fallback: Record<MinesDifficultyId, number | null> = {
    easy: null,
    hard: null,
    medium: null,
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(MINES_BEST_RECORDS_KEY) ?? "{}") as Partial<
      Record<MinesDifficultyId, unknown>
    >;

    return {
      easy: normalizeBestRecord(parsed.easy),
      hard: normalizeBestRecord(parsed.hard),
      medium: normalizeBestRecord(parsed.medium),
    };
  } catch {
    return fallback;
  }
}

function normalizeBestRecord(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function createMineBoard(difficulty: MinesDifficulty): MineCell[] {
  const size = difficulty.rows * difficulty.cols;
  const minePositions = new Set<number>();

  while (minePositions.size < difficulty.mines) {
    minePositions.add(Math.floor(Math.random() * size));
  }

  return Array.from({ length: size }, (_, index) => ({
    adjacent: getNeighbors(index, difficulty).filter((neighbor) => minePositions.has(neighbor)).length,
    flagged: false,
    id: `cell-${index}`,
    mine: minePositions.has(index),
    revealed: false,
  }));
}

function revealSafeCells(board: MineCell[], startIndex: number, difficulty: MinesDifficulty): MineCell[] {
  const next = board.map((cell) => ({ ...cell }));
  const stack = [startIndex];
  const seen = new Set<number>();

  while (stack.length) {
    const index = stack.pop()!;
    if (seen.has(index)) continue;
    seen.add(index);
    const cell = next[index];
    if (!cell || cell.mine || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) {
      getNeighbors(index, difficulty).forEach((neighbor) => stack.push(neighbor));
    }
  }

  return next;
}

function getNeighbors(index: number, difficulty: MinesDifficulty) {
  const row = Math.floor(index / difficulty.cols);
  const column = index % difficulty.cols;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + colOffset;
      if (
        nextRow >= 0 &&
        nextRow < difficulty.rows &&
        nextColumn >= 0 &&
        nextColumn < difficulty.cols
      ) {
        neighbors.push(nextRow * difficulty.cols + nextColumn);
      }
    }
  }

  return neighbors;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function normalizeUrl(value: string, searchEngine: BrowserSearchEngineId = "duckduckgo") {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "https://example.com";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return getBrowserSearchEngine(searchEngine).searchUrl(trimmed);
}

function getBrowserSearchEngine(searchEngineId: BrowserSearchEngineId) {
  return browserSearchEngines.find((engine) => engine.id === searchEngineId) ?? browserSearchEngines[0];
}

function loadBrowserSearchEngine() {
  const stored = localStorage.getItem(BROWSER_SEARCH_ENGINE_KEY) as BrowserSearchEngineId | null;
  return browserSearchEngines.some((engine) => engine.id === stored) ? stored! : "duckduckgo";
}

function getBrowserPageTitle(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("duckduckgo.com") || parsed.hostname.includes("google.com") || parsed.hostname.includes("bing.com")) {
      return parsed.searchParams.get("q") || parsed.hostname.replace(/^www\./, "");
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeBrowserBookmark(item: unknown): BrowserBookmark | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<BrowserBookmark>;
  if (typeof value.url !== "string" || typeof value.title !== "string") return null;
  const createdAt = Number(value.createdAt);
  return {
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    id: typeof value.id === "string" ? value.id : `bookmark-${crypto.randomUUID()}`,
    title: value.title.slice(0, 80),
    url: value.url,
  };
}

function normalizeBrowserHistoryEntry(item: unknown): BrowserHistoryEntry | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<BrowserHistoryEntry>;
  if (typeof value.url !== "string" || typeof value.title !== "string") return null;
  const visitedAt = Number(value.visitedAt);
  return {
    id: typeof value.id === "string" ? value.id : `history-${crypto.randomUUID()}`,
    title: value.title.slice(0, 80),
    url: value.url,
    visitedAt: Number.isFinite(visitedAt) ? visitedAt : Date.now(),
  };
}

function loadBrowserBookmarks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_BOOKMARKS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeBrowserBookmark)
          .filter((item): item is BrowserBookmark => Boolean(item))
          .slice(0, 16)
      : [];
  } catch {
    return [];
  }
}

function loadBrowserHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeBrowserHistoryEntry)
          .filter((item): item is BrowserHistoryEntry => Boolean(item))
          .sort((a, b) => b.visitedAt - a.visitedAt)
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function evaluateExpression(expression: string) {
  const tokens = tokenizeExpression(expression);
  if (tokens.length === 0) return Number.NaN;

  const firstPass: Array<number | string> = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "*" || token === "/") {
      const previous = Number(firstPass.pop());
      const next = Number(tokens[index + 1]);
      firstPass.push(token === "*" ? previous * next : previous / next);
      index += 1;
    } else {
      firstPass.push(token);
    }
  }

  let total = Number(firstPass[0]);
  for (let index = 1; index < firstPass.length; index += 2) {
    const operator = firstPass[index];
    const next = Number(firstPass[index + 1]);
    total = operator === "+" ? total + next : total - next;
  }

  return total;
}

function tokenizeExpression(expression: string): string[] {
  if (!/^[\d+\-*/. ]+$/.test(expression)) return [];
  const tokens: string[] = [];
  let current = "";

  for (const char of expression.replace(/\s/g, "")) {
    const previousToken = tokens[tokens.length - 1];
    const unaryMinus =
      char === "-" && (tokens.length === 0 || ["+", "-", "*", "/"].includes(previousToken));
    if (/\d|\./.test(char) || unaryMinus) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
    tokens.push(char);
  }
  if (current) tokens.push(current);

  return tokens;
}

function appendCalculatorValue(current: string, value: string) {
  const operators = ["+", "-", "*", "/"];

  if (current === "Error") {
    return operators.includes(value) ? `0${value}` : value === "." ? "0." : value;
  }

  if (operators.includes(value)) {
    const last = current[current.length - 1];
    if (current === "0" && value === "-") return "-";
    if (last && operators.includes(last)) {
      if (value === "-" && last !== "-") return `${current}${value}`;
      return `${current.slice(0, -1)}${value}`;
    }
    return `${current}${value}`;
  }

  if (value === ".") {
    const last = current[current.length - 1];
    if (last && operators.includes(last)) return `${current}0.`;
    if (getCurrentCalculatorFragment(current).includes(".")) return current;
    return current === "0" ? "0." : `${current}.`;
  }

  if (/^\d$/.test(value)) {
    if (current === "0") return value;
    return `${current}${value}`;
  }

  return current;
}

function applyCalculatorUnary(expression: string, operation: (value: number) => number) {
  const input = evaluateExpression(expression);
  if (!Number.isFinite(input)) return "Error";
  return formatCalculatorResult(operation(input));
}

function toggleCalculatorSign(expression: string) {
  if (expression === "Error" || expression === "0") return "-";
  const fragment = getCurrentCalculatorFragment(expression);
  if (!fragment || fragment === "-") return expression;

  const start = expression.length - fragment.length;
  const nextFragment = fragment.startsWith("-") ? fragment.slice(1) : `-${fragment}`;
  return `${expression.slice(0, start)}${nextFragment}`;
}

function insertCalculatorPi(expression: string) {
  const pi = trimNumber(Math.PI);
  if (expression === "Error" || expression === "0") return pi;
  const last = expression[expression.length - 1];
  if (!last || ["+", "-", "*", "/"].includes(last)) return `${expression}${pi}`;
  return `${expression}*${pi}`;
}

function getCurrentCalculatorFragment(expression: string) {
  let start = expression.length;

  while (start > 0) {
    const char = expression[start - 1];
    if (char === "+" || char === "*" || char === "/") break;
    if (char === "-") {
      const before = expression[start - 2];
      if (start - 1 === 0 || ["+", "-", "*", "/"].includes(before)) {
        start -= 1;
        continue;
      }
      break;
    }
    start -= 1;
  }

  return expression.slice(start);
}

function formatCalculatorResult(value: number) {
  return Number.isFinite(value) ? trimNumber(value) : "Error";
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
