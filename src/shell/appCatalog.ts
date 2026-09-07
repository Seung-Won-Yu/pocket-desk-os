import { lazy } from "react";
import { appMetadata, appOrder } from "../apps/metadata";
import { type AppId } from "../types";
import { TASKBAR_PINNED_APPS_KEY } from "./constants";
import { type AppDefinition } from "./types";

/*
 * Every app is its own chunk, fetched when a window for it first opens. The
 * shell used to ship all 17 in the initial bundle: 588,323 bytes of JavaScript
 * to parse before the lock screen, of which 280,821 was app code nobody had
 * asked for yet. The service worker precaches every emitted asset from the
 * build's own list, so a deferred app is still there offline.
 */
export const appComponents: Record<AppId, AppDefinition["component"]> = {
  browser: lazy(() => import("../apps/BrowserApp")),
  calculator: lazy(() => import("../apps/CalculatorApp")),
  clock: lazy(() => import("../apps/ClockApp")),
  eventviewer: lazy(() => import("../apps/EventViewerApp")),
  files: lazy(() => import("../apps/FilesApp")),
  minesweeper: lazy(() => import("../apps/MinesweeperApp")),
  notepad: lazy(() => import("../apps/NotepadApp")),
  paint: lazy(() => import("../apps/PaintApp")),
  photos: lazy(() => import("../apps/PhotosApp")),
  recycle: lazy(() => import("../apps/RecycleBinApp")),
  registry: lazy(() => import("../apps/RegistryEditorApp")),
  settings: lazy(() => import("../apps/SettingsApp")),
  snip: lazy(() => import("../apps/SnipApp")),
  stickynotes: lazy(() => import("../apps/StickyNotesApp")),
  taskmanager: lazy(() => import("../apps/TaskManagerApp")),
  terminal: lazy(() => import("../apps/TerminalApp")),
  thispc: lazy(() => import("../apps/ThisPcApp")),
};

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
