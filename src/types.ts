export type AppId =
  | "thispc"
  | "browser"
  | "minesweeper"
  | "calculator"
  | "clock"
  | "stickynotes"
  | "snip"
  | "paint"
  | "notepad"
  | "files"
  | "photos"
  | "terminal"
  | "taskmanager"
  | "eventviewer"
  | "registry"
  | "recycle"
  | "settings";

/** Window facts an app needs to reason about other running windows. */
export type OpenWindowInfo = {
  appId: AppId;
  id: string;
  maximized: boolean;
  minimized: boolean;
  title: string;
};

export type ThemeName = "lagoon" | "meadow" | "ember";

export type WallpaperName =
  "ribbon" | "meadow" | "aurora" | "dawn" | "sunny" | "glass" | "mist" | "coast";

export type IconPosition = {
  x: number;
  y: number;
};

export type VfsEntryKind = "folder" | "note" | "canvas" | "shortcut" | "game";

export type DesktopItem = {
  appId?: AppId;
  content?: string;
  createdAt: number;
  id: string;
  kind: VfsEntryKind;
  name: string;
  parentId: string;
  restoreParentId?: string;
  restoreShowOnDesktop?: boolean;
  showOnDesktop: boolean;
  trashed?: boolean;
  trashedAt?: number;
  trashedRootId?: string;
  updatedAt: number;
  x: number;
  y: number;
};

export type ClipboardMode = "copy" | "cut";

/** One shared clipboard, the way Windows has one — not one per window. */
export type SystemClipboard = {
  itemIds: string[];
  mode: ClipboardMode;
};

export type VfsDuplicateOptions = {
  parentId?: string;
  position?: IconPosition;
  showOnDesktop?: boolean;
};

export type ToastTone = "info" | "success";

/** A button on a toast, the way Windows notifications carry actions. */
export type ToastAction = {
  id: string;
  label: string;
};

export type ToastInput = {
  /** Buttons rendered on the toast; clicking one also dismisses it. */
  actions?: ToastAction[];
  detail?: string;
  /** A picture shown on the toast and kept in the notification centre. */
  image?: string;
  /** A VFS entry this notification is about; the centre opens it on click. */
  openItemId?: string;
  /** Called with the clicked action's id. Lives only on the live toast. */
  onAction?: (actionId: string) => void;
  title: string;
  tone?: ToastTone;
};

export type SoundEffectName =
  "click" | "close" | "error" | "minimize" | "open" | "success" | "toggle" | "unlock";
