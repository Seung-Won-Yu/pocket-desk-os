import { type AppId } from "../types";
import { clamp } from "../utils/format";
import { appsById, getApp } from "./appCatalog";
import {
  APP_BAR_HEIGHT,
  MAX_VIRTUAL_DESKTOPS,
  VIRTUAL_DESKTOPS_KEY,
  WINDOW_STATE_KEY,
} from "./constants";
import { type PersistedWindow, type SnapZone, type WindowInstance } from "./types";

export function createDefaultWindows(): WindowInstance[] {
  return [];
}

export function fitWindowToViewport(item: WindowInstance): WindowInstance {
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

export function makeWindow(
  appId: AppId,
  x: number,
  y: number,
  z: number,
  desktopIndex = 0,
): WindowInstance {
  const safeDesktopIndex = clamp(
    Number.isInteger(desktopIndex) ? desktopIndex : 0,
    0,
    MAX_VIRTUAL_DESKTOPS - 1,
  );
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
    desktopIndex: safeDesktopIndex,
  };
}

export function loadWindowState(): WindowInstance[] {
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
        if (!item || (item.appId !== "files" && seenApps.has(item.appId))) return false;
        seenApps.add(item.appId);
        return true;
      });

    return restored;
  } catch {
    return createDefaultWindows();
  }
}

export function normalizePersistedWindow(
  item: PersistedWindow | null | undefined,
  index: number,
): WindowInstance | null {
  // One unusable element must not cost the whole restored session.
  if (!item || typeof item !== "object") return null;
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
    desktopIndex: clamp(
      Number.isInteger(Number(item.desktopIndex)) ? Number(item.desktopIndex) : 0,
      0,
      MAX_VIRTUAL_DESKTOPS - 1,
    ),
    snapZone: isSnapZone(item.snapZone) ? item.snapZone : undefined,
  };
}

/** Desktops always cover index 0 through the highest one still holding a window. */
export function getVirtualDesktopCount(windows: WindowInstance[], stored: number) {
  const highest = windows.reduce((max, item) => Math.max(max, item.desktopIndex), 0);
  return clamp(Math.max(stored, highest + 1), 1, MAX_VIRTUAL_DESKTOPS);
}

export function loadVirtualDesktopCount() {
  const stored = Number(localStorage.getItem(VIRTUAL_DESKTOPS_KEY));
  return Number.isInteger(stored) ? clamp(stored, 1, MAX_VIRTUAL_DESKTOPS) : 1;
}

const SNAP_ZONES: SnapZone[] = [
  "bottom-left",
  "bottom-right",
  "left",
  "right",
  "top",
  "top-left",
  "top-right",
];

export function isSnapZone(value: unknown): value is SnapZone {
  return typeof value === "string" && SNAP_ZONES.includes(value as SnapZone);
}

export function persistWindowState(windows: WindowInstance[]) {
  const payload = windows.map(
    ({ appId, desktopIndex, height, id, maximized, minimized, snapZone, width, x, y, z }) => ({
      appId,
      desktopIndex,
      height,
      id,
      maximized,
      minimized,
      snapZone,
      width,
      x,
      y,
      z,
    }),
  );
  localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(payload));
}
