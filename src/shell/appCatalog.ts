import { lazy, type ComponentType } from "react";
import { appMetadata, appOrder } from "../apps/metadata";
import { type AppId } from "../types";
import { TASKBAR_PINNED_APPS_KEY } from "./constants";
import { type AppContentProps, type AppDefinition } from "./types";

/*
 * Every app is its own chunk, fetched when a window for it first opens. The
 * shell used to ship all 17 in the initial bundle: 588,323 bytes of JavaScript
 * to parse before the lock screen, of which 280,821 was app code nobody had
 * asked for yet. The service worker precaches every emitted asset from the
 * build's own list, so a deferred app is still there offline.
 */
type AppLoader = () => Promise<{ default: ComponentType<AppContentProps> }>;

const appLoaders: Record<AppId, AppLoader> = {
  browser: () => import("../apps/BrowserApp"),
  calculator: () => import("../apps/CalculatorApp"),
  clock: () => import("../apps/ClockApp"),
  eventviewer: () => import("../apps/EventViewerApp"),
  files: () => import("../apps/FilesApp"),
  minesweeper: () => import("../apps/MinesweeperApp"),
  notepad: () => import("../apps/NotepadApp"),
  paint: () => import("../apps/PaintApp"),
  photos: () => import("../apps/PhotosApp"),
  recycle: () => import("../apps/RecycleBinApp"),
  registry: () => import("../apps/RegistryEditorApp"),
  settings: () => import("../apps/SettingsApp"),
  snip: () => import("../apps/SnipApp"),
  stickynotes: () => import("../apps/StickyNotesApp"),
  taskmanager: () => import("../apps/TaskManagerApp"),
  terminal: () => import("../apps/TerminalApp"),
  thispc: () => import("../apps/ThisPcApp"),
};

export const appComponents = Object.fromEntries(
  appOrder.map((appId) => [appId, lazy(appLoaders[appId])]),
) as unknown as Record<AppId, AppDefinition["component"]>;

export const appCatalog: AppDefinition[] = appOrder.map((appId) => ({
  ...appMetadata[appId],
  component: appComponents[appId],
}));

export const appsById = new Map(appCatalog.map((app) => [app.id, app]));
export const desktopAppIds: AppId[] = ["thispc", "recycle"];
export const desktopApps = desktopAppIds.map((appId) => getApp(appId));
export const defaultPinnedAppIds: AppId[] = ["browser", "files"];

export function getApp(appId: AppId) {
  const app = appsById.get(appId);
  if (!app) {
    throw new Error(`Unknown app: ${appId}`);
  }
  return app;
}

export function isAppId(value: unknown): value is AppId {
  return typeof value === "string" && appsById.has(value as AppId);
}

export function loadPinnedTaskbarApps(): AppId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TASKBAR_PINNED_APPS_KEY) ?? "null");
    if (!Array.isArray(parsed)) return defaultPinnedAppIds;
    const normalized = parsed
      .filter(isAppId)
      .filter((value, index, values) => values.indexOf(value) === index);
    return normalized;
  } catch {
    return defaultPinnedAppIds;
  }
}
