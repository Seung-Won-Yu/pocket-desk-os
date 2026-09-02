import { type AppId } from "../types";
import { clamp } from "../utils/format";
import { appsById, getApp } from "./appCatalog";
import {
  ACTIVE_DESKTOP_KEY,
  APP_BAR_HEIGHT,
  NOTIFICATION_HISTORY_KEY,
  NOTIFICATION_HISTORY_LIMIT,
  MAX_VIRTUAL_DESKTOPS,
  VIRTUAL_DESKTOPS_KEY,
  WINDOW_STATE_KEY,
} from "./constants";
import {
  type PersistedWindow,
  type SnapZone,
  type ToastMessage,
  type WindowInstance,
} from "./types";
import { getWindowSnapPatch } from "./windowGeometry";

export function createDefaultWindows(): WindowInstance[] {
  return [];
}

/**
 * The geometry a snap zone implies, and nothing else. The snap patch also flips
 * `minimized` and `maximized`, which is right when the user snaps a window but
 * wrong when a resize or a session restore merely re-tiles one — that would
 * un-minimize a window nobody asked to see. The `top` zone is maximize, which
 * carries no box of its own.
 */
function getSnapBox(zone: SnapZone | undefined) {
  if (!zone) return null;
  const { height, width, x, y } = getWindowSnapPatch(zone);
  if (width === undefined || height === undefined || x === undefined || y === undefined) {
    return null;
  }
  return { height, width, x, y };
}

export function fitWindowToViewport(item: WindowInstance): WindowInstance {
  if (item.maximized) return item;

  /*
   * A snapped window re-tiles to the new work area, the way Windows re-tiles on
   * a resolution change. Running it through the 8px float margin below instead
   * pushed two flush halves to x=8 and x=632, overlapping by 16px and leaving a
   * gap under them — the seam reappeared on the first resize after snapping.
   */
  const snapBox = getSnapBox(item.snapZone);
  if (snapBox) return { ...item, ...snapBox };

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
        // Same rule as openApp: only a multi-instance app may restore twice.
        if (!item || (!getApp(item.appId).multiInstance && seenApps.has(item.appId))) {
          return false;
        }
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
  const persistedX = Number(item.x);
  const persistedY = Number(item.y);
  const x = clamp(
    Number.isFinite(persistedX) ? persistedX : 8,
    8,
    Math.max(8, window.innerWidth - width - 8),
  );
  const y = clamp(
    Number.isFinite(persistedY) ? persistedY : 8,
    8,
    Math.max(8, window.innerHeight - APP_BAR_HEIGHT - height - 8),
  );
  const z = Number.isFinite(Number(item.z)) ? Number(item.z) : 12 + index;

  const restored: WindowInstance = {
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

  // Restoring a snapped window through the float margin above would land it
  // 8px inside its own edge, so it re-tiles from the zone it was snapped to.
  const restoredSnapBox = restored.maximized ? null : getSnapBox(restored.snapZone);
  return restoredSnapBox ? { ...restored, ...restoredSnapBox } : restored;
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

/**
 * Which desktop the session was left on. Only the count and each window's
 * desktop were stored, so a reload always landed on desktop 1 — and every
 * window that lived on another one looked as though it had been closed.
 */
export function loadActiveDesktopIndex(desktopCount: number) {
  const stored = Number(localStorage.getItem(ACTIVE_DESKTOP_KEY));
  return Number.isInteger(stored) ? clamp(stored, 0, Math.max(0, desktopCount - 1)) : 0;
}

export function persistActiveDesktopIndex(index: number) {
  localStorage.setItem(ACTIVE_DESKTOP_KEY, String(index));
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

/**
 * The action centre's backlog. Windows keeps unread notifications across a
 * restart; these lived only in memory, so a reload emptied the panel and the
 * header went back to "0개 알림" with nothing said.
 */
export function loadNotificationHistory(): ToastMessage[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(NOTIFICATION_HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ToastMessage =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ToastMessage).id === "string" &&
          typeof (item as ToastMessage).title === "string",
      )
      .slice(0, NOTIFICATION_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function persistNotificationHistory(history: ToastMessage[]) {
  localStorage.setItem(
    NOTIFICATION_HISTORY_KEY,
    JSON.stringify(history.slice(0, NOTIFICATION_HISTORY_LIMIT)),
  );
}

/**
 * True when two VFS snapshots differ only in icon geometry (x/y and desktop
 * visibility) — the one kind of change a persist debounce may sit on. Any
 * structural difference (ids, names, parents, content, trash state, order)
 * must be written immediately: a reload inside the debounce window would
 * otherwise lose real work, not just a few pixels of icon position.
 */
export function isGeometryOnlyVfsChange(
  previous: import("../types").DesktopItem[],
  next: import("../types").DesktopItem[],
) {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (before === after) continue;
    // Fail closed: only the named geometry fields may differ. Any other field —
    // including one added to DesktopItem after this was written — counts as
    // structure and writes immediately.
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      if (VFS_GEOMETRY_KEYS.has(key)) continue;
      if (before[key as keyof typeof before] !== after[key as keyof typeof after]) return false;
    }
  }
  return true;
}

/** The fields an icon drag changes; nothing else is ever geometry. */
const VFS_GEOMETRY_KEYS = new Set<string>(["x", "y", "showOnDesktop"]);
