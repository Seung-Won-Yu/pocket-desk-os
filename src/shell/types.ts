import { type BrowserLaunchRequest } from "../apps/BrowserApp";
import { type FilesLaunchRequest } from "../apps/FilesApp";
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
} from "../types";
import { type LucideIcon } from "lucide-react";
import { type DefaultAppMap } from "./preferences";
import { type ClockAlarm, type ClockTimer } from "./clock";
import { type ShellLogEvent } from "./eventLog";

export type WindowMotion = "closing" | "minimizing";

export type WindowInstance = {
  id: string;
  appId: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Virtual desktop this window lives on. Index 0 is the first desktop. */
  desktopIndex: number;
  /** Last snap layout applied, so Win+Arrow can step between half and quarter. */
  snapZone?: SnapZone;
};

export type PersistedWindow = Partial<Omit<WindowInstance, "id">> & {
  id?: unknown;
  appId?: unknown;
};

export type DesktopIconLayout = Partial<Record<AppId, IconPosition>>;
export type DesktopSortKey = "name" | "type" | "modified";
export type DesktopViewMode = "small" | "medium" | "large";
export type DesktopIconContextMenuState =
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
export type PersistedIconPosition = {
  x?: unknown;
  y?: unknown;
};
/** Windows puts 폴더 first in this submenu; only 텍스트 문서 was offered. */
export type CreatableDesktopItemKind = "folder" | "note";
export type PersistedDesktopItem = Partial<Omit<DesktopItem, "kind">> & {
  kind?: unknown;
};
export type DesktopContextMenuState = {
  originX: number;
  originY: number;
  x: number;
  y: number;
};
export type WindowSystemMenuState = {
  windowId: string;
  x: number;
  y: number;
};
export type StartSearchResult =
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
export type ToastMessage = Required<ToastInput> & {
  createdAt: number;
  id: string;
};
export type ShellPhase = "booting" | "locked" | "shutdown" | "unlocked";
export type SnapZone =
  "bottom-left" | "bottom-right" | "left" | "right" | "top" | "top-left" | "top-right";
export type SnapPreviewState = {
  zone: SnapZone;
};
export type DesktopSelectionState = {
  currentX: number;
  currentY: number;
  pointerId: number;
  startX: number;
  startY: number;
};
export type SoundStep = {
  duration: number;
  frequency: number;
  gain: number;
  offset?: number;
  type?: OscillatorType;
};
export type RunCommandResolution =
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
export type AppContentProps = {
  activeCanvasId: string;
  activeCanvasOpenKey: number;
  activeNoteId: string;
  browserLaunchRequest: BrowserLaunchRequest | null;
  canvasEntries: DesktopItem[];
  clipboard: SystemClipboard;
  copyToClipboard: (itemIds: string[], mode?: ClipboardMode) => void;
  pasteFromClipboard: (parentId: string) => string[];
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  openWindows: OpenWindowInfo[];
  /**
   * Lets an app veto its own close so it can ask the user first. Returning false
   * cancels the close; the app calls closeWindow again once the user answers.
   * Pass null to clear the guard.
   */
  registerCloseGuard: (windowId: string, guard: (() => boolean) | null) => void;
  /**
   * Lets an app grow its own window to fit content it cannot shrink, the way
   * Windows resizes Minesweeper when the difficulty changes. Deltas only: the
   * app knows how much room it is missing, the shell knows the frame chrome and
   * the work area.
   */
  growWindow: (windowId: string, delta: { width: number; height: number }) => void;
  /**
   * The document an app is actually showing. The shell used to infer it from
   * the id it had handed the app, which is only right until the app moves on by
   * itself — the photo viewer's next/previous left the title bar naming the
   * first image indefinitely.
   */
  reportDocument: (appId: AppId, itemId: string | undefined) => void;
  /** The shell's append-only event log; see src/shell/eventLog.ts. */
  shellEvents: ShellLogEvent[];
  createVfsFolder: (parentId?: string, name?: string) => DesktopItem;
  onImportLocalEntries: (entries: DesktopItem[]) => void;
  createVfsTextFile: (parentId?: string) => DesktopItem;
  desktopItems: DesktopItem[];
  duplicateVfsEntries: (itemIds: string[], options?: VfsDuplicateOptions) => string[];
  noteEntries: DesktopItem[];
  trashedItems: DesktopItem[];
  notify: (toast: ToastInput) => void;
  /**
   * 알람 및 시계's shared state. It lives at the shell so the scheduler can
   * ring with the app window closed; the app edits it through these setters.
   */
  clockAlarms: ClockAlarm[];
  clockTimer: ClockTimer;
  updateClockAlarms: (alarms: ClockAlarm[]) => void;
  updateClockTimer: (timer: ClockTimer) => void;
  deleteVfsEntry: (itemId: string) => void;
  emptyRecycleBin: () => void;
  exportVfsZip: () => void;
  filesLaunchRequest: FilesLaunchRequest | null;
  importVfsZip: (file: File) => Promise<void>;
  moveVfsEntries: (itemIds: string[], parentId: string) => boolean;
  openApp: (appId: AppId) => void;
  openNewAppWindow: (appId: AppId) => string;
  activateVfsEntry: (item: DesktopItem) => void;
  openVfsEntry: (item: DesktopItem) => void;
  permanentlyDeleteVfsEntry: (itemId: string) => void;
  renameVfsEntry: (itemId: string, name: string) => void;
  resetDesktopIconLayout: () => void;
  resetWindowLayout: () => void;
  restoreVfsEntry: (itemId: string) => void;
  playSound: (effect: SoundEffectName) => void;
  savePaintImage: (
    content: string,
    options?: { existingItemId?: string; name?: string; parentId?: string },
  ) => DesktopItem;
  saveNoteAs: (
    parentId: string,
    name: string,
    content: string,
    existingItemId?: string,
    options?: { activate?: boolean },
  ) => DesktopItem;
  /** Creates a .url internet shortcut entry; null when the target is not http(s). */
  createVfsShortcut: (parentId: string, name: string, target: string) => DesktopItem | null;
  saveNoteContent: (noteId: string, content: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setWallpaper: (wallpaper: WallpaperName) => void;
  setTheme: (theme: ThemeName) => void;
  soundEnabled: boolean;
  clock24h: boolean;
  defaultApps: DefaultAppMap;
  setClock24h: (enabled: boolean) => void;
  setDefaultApp: (extension: string, appId: AppId) => void;
  setUserName: (name: string) => void;
  theme: ThemeName;
  userName: string;
  wallpaper: WallpaperName;
  windowId: string;
};

export type AppDefinition = {
  id: AppId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  multiInstance?: boolean;
  component: (props: AppContentProps) => JSX.Element;
};
