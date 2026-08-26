import { type DesktopItem, type IconPosition } from "../types";
import { clamp } from "../utils/format";
import { desktopApps } from "./appCatalog";
import { APP_BAR_HEIGHT, CONTEXT_MENU_HEIGHT, CONTEXT_MENU_WIDTH, DESKTOP_ICON_HEIGHT, DESKTOP_ICON_LAYOUT_KEY, DESKTOP_ICON_SORT_KEY, DESKTOP_ICON_VIEW_KEY, DESKTOP_ICON_WIDTH, WINDOW_SYSTEM_MENU_HEIGHT, WINDOW_SYSTEM_MENU_WIDTH } from "./constants";
import { type DesktopIconLayout, type DesktopSelectionState, type DesktopSortKey, type DesktopViewMode, type PersistedIconPosition } from "./types";

export function createDefaultIconLayout(): DesktopIconLayout {
  return desktopApps.reduce<DesktopIconLayout>((layout, app, index) => {
    layout[app.id] = clampIconPosition(18, 18 + index * 110);
    return layout;
  }, {});
}

export function loadDesktopViewMode(): DesktopViewMode {
  const stored = localStorage.getItem(DESKTOP_ICON_VIEW_KEY);
  return stored === "small" || stored === "large" ? stored : "medium";
}

export function loadDesktopSortKey(): DesktopSortKey {
  const stored = localStorage.getItem(DESKTOP_ICON_SORT_KEY);
  return stored === "type" || stored === "modified" ? stored : "name";
}

export function getDesktopIconMetrics(viewMode: DesktopViewMode) {
  if (viewMode === "small") return { height: 76, width: 76 };
  if (viewMode === "large") return { height: 116, width: 110 };
  return { height: DESKTOP_ICON_HEIGHT, width: DESKTOP_ICON_WIDTH };
}

export function createDesktopGridPositions(count: number, viewMode: DesktopViewMode): IconPosition[] {
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

export function findAvailableDesktopPosition(
  preferred: IconPosition,
  viewMode: DesktopViewMode,
  occupiedPositions: IconPosition[],
) {
  const candidates = [
    clampIconPosition(preferred.x, preferred.y, viewMode),
    ...createDesktopGridPositions(160, viewMode),
  ];
  return (
    candidates.find((candidate) =>
      occupiedPositions.every(
        (position) =>
          !rectsIntersect(
            getDesktopIconBounds(candidate, viewMode),
            getDesktopIconBounds(position, viewMode),
          ),
      ),
    ) ?? clampIconPosition(preferred.x, preferred.y, viewMode)
  );
}

export function compareDesktopEntries(
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

export function loadDesktopIconLayout(): DesktopIconLayout {
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

export function persistDesktopIconLayout(layout: DesktopIconLayout) {
  const payload = desktopApps.reduce<DesktopIconLayout>((next, app) => {
    const position = layout[app.id];
    if (position) {
      next[app.id] = position;
    }
    return next;
  }, {});
  localStorage.setItem(DESKTOP_ICON_LAYOUT_KEY, JSON.stringify(payload));
}

export function clampIconPosition(
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

export function snapDesktopIconPosition(position: IconPosition, viewMode: DesktopViewMode) {
  const metrics = getDesktopIconMetrics(viewMode);
  const origin = 18;
  const x = origin + Math.round((position.x - origin) / (metrics.width + 18)) * (metrics.width + 18);
  const y = origin + Math.round((position.y - origin) / (metrics.height + 10)) * (metrics.height + 10);
  return clampIconPosition(x, y, viewMode);
}

export function clampContextMenuPosition(x: number, y: number): IconPosition {
  const safeX = Number.isFinite(x) ? x : 18;
  const safeY = Number.isFinite(y) ? y : 18;
  return {
    x: clamp(safeX, 8, Math.max(8, window.innerWidth - CONTEXT_MENU_WIDTH - 8)),
    y: clamp(
      safeY,
      8,
      Math.max(8, window.innerHeight - APP_BAR_HEIGHT - CONTEXT_MENU_HEIGHT - 8),
    ),
  };
}

export function clampWindowSystemMenuPosition(x: number, y: number): IconPosition {
  return {
    x: clamp(x, 8, Math.max(8, window.innerWidth - WINDOW_SYSTEM_MENU_WIDTH - 8)),
    y: clamp(y, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - WINDOW_SYSTEM_MENU_HEIGHT - 8)),
  };
}

export function getDesktopSelectionBounds(selection: DesktopSelectionState) {
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

export function getDesktopSelectionStyle(selection: DesktopSelectionState): React.CSSProperties {
  const bounds = getDesktopSelectionBounds(selection);
  return {
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
  };
}

export function isDesktopSelectionVisible(selection: DesktopSelectionState) {
  const bounds = getDesktopSelectionBounds(selection);
  return bounds.width > 5 || bounds.height > 5;
}

export function getDesktopSelectionIds(
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

export function getDesktopIconBounds(position: IconPosition, viewMode: DesktopViewMode) {
  const metrics = getDesktopIconMetrics(viewMode);
  return {
    bottom: position.y + metrics.height,
    left: position.x,
    right: position.x + metrics.width,
    top: position.y,
  };
}

export function rectsIntersect(
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
