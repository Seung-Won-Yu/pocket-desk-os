export type AppId =
  | "thispc"
  | "browser"
  | "minesweeper"
  | "calculator"
  | "paint"
  | "notepad"
  | "files"
  | "recycle"
  | "settings";

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
  restoreShowOnDesktop?: boolean;
  showOnDesktop: boolean;
  trashed?: boolean;
  trashedAt?: number;
  updatedAt: number;
  x: number;
  y: number;
};

export type VfsDuplicateOptions = {
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
