export type AppId =
  | "thispc"
  | "browser"
  | "minesweeper"
  | "calculator"
  | "paint"
  | "notepad"
  | "files"
  | "terminal"
  | "taskmanager"
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
  | "ribbon"
  | "meadow"
  | "aurora"
  | "dawn"
  | "sunny"
  | "glass"
  | "mist"
  | "coast";

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

export type VfsDuplicateOptions = {
  parentId?: string;
  position?: IconPosition;
  showOnDesktop?: boolean;
};

export type ToastTone = "info" | "success";

export type ToastInput = {
  detail?: string;
  title: string;
  tone?: ToastTone;
};

export type SoundEffectName =
  | "click"
  | "close"
  | "error"
  | "minimize"
  | "open"
  | "success"
  | "toggle"
  | "unlock";
