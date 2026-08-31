import BrowserApp from "../apps/BrowserApp";
import CalculatorApp from "../apps/CalculatorApp";
import ClockApp from "../apps/ClockApp";
import EventViewerApp from "../apps/EventViewerApp";
import FilesApp from "../apps/FilesApp";
import MinesweeperApp from "../apps/MinesweeperApp";
import NotepadApp from "../apps/NotepadApp";
import PaintApp from "../apps/PaintApp";
import PhotosApp from "../apps/PhotosApp";
import RecycleBinApp from "../apps/RecycleBinApp";
import RegistryEditorApp from "../apps/RegistryEditorApp";
import SettingsApp from "../apps/SettingsApp";
import TaskManagerApp from "../apps/TaskManagerApp";
import TerminalApp from "../apps/TerminalApp";
import ThisPcApp from "../apps/ThisPcApp";
import { appMetadata, appOrder } from "../apps/metadata";
import { type AppId } from "../types";
import { TASKBAR_PINNED_APPS_KEY } from "./constants";
import { type AppDefinition } from "./types";

export const appComponents: Record<AppId, AppDefinition["component"]> = {
  browser: BrowserApp,
  calculator: CalculatorApp,
  clock: ClockApp,
  eventviewer: EventViewerApp,
  files: FilesApp,
  minesweeper: MinesweeperApp,
  notepad: NotepadApp,
  paint: PaintApp,
  photos: PhotosApp,
  recycle: RecycleBinApp,
  registry: RegistryEditorApp,
  settings: SettingsApp,
  taskmanager: TaskManagerApp,
  terminal: TerminalApp,
  thispc: ThisPcApp,
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
