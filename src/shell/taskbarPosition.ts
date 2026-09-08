import { APP_BAR_HEIGHT, TASKBAR_POSITION_KEY } from "./constants";

/**
 * 작업 표시줄 위치 — Windows' 개인 설정 → 작업 표시줄 → 작업 표시줄 위치.
 * The bar can sit against any screen edge, and everything the shell measures
 * against it moves too: the work area a window maximizes into, the snap zones,
 * the desktop icon grid, and where every flyout opens.
 *
 * The position lives on `<html data-taskbar>`, so the stylesheet and the
 * geometry read the same value. Anything that needs to know where the bar is
 * asks `getWorkArea` — nothing subtracts the bar's own thickness by hand, which
 * is how the bottom edge got baked into eight files in the first place.
 */

export const TASKBAR_POSITIONS = ["left", "top", "right", "bottom"] as const;
export type TaskbarPosition = (typeof TASKBAR_POSITIONS)[number];
export const DEFAULT_TASKBAR_POSITION: TaskbarPosition = "bottom";

export const TASKBAR_POSITION_LABELS: Record<TaskbarPosition, string> = {
  bottom: "아래쪽",
  left: "왼쪽",
  right: "오른쪽",
  top: "위쪽",
};

/**
 * A vertical bar is wider than a horizontal one is tall: the tray has to stack
 * the clock's two lines into the thickness rather than along it. Windows does
 * the same — its side taskbar is visibly wider than the bottom one.
 */
export const TASKBAR_VERTICAL_WIDTH = 68;

export type WorkAreaInsets = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type WorkArea = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function isTaskbarPosition(value: unknown): value is TaskbarPosition {
  return typeof value === "string" && (TASKBAR_POSITIONS as readonly string[]).includes(value);
}

export function isVerticalTaskbar(position: TaskbarPosition) {
  return position === "left" || position === "right";
}

/** How thick the bar is along the axis it eats into. */
export function getTaskbarThickness(position: TaskbarPosition) {
  return isVerticalTaskbar(position) ? TASKBAR_VERTICAL_WIDTH : APP_BAR_HEIGHT;
}

export function getWorkAreaInsets(position: TaskbarPosition): WorkAreaInsets {
  const thickness = getTaskbarThickness(position);
  return {
    bottom: position === "bottom" ? thickness : 0,
    left: position === "left" ? thickness : 0,
    right: position === "right" ? thickness : 0,
    top: position === "top" ? thickness : 0,
  };
}

/**
 * The rectangle windows live in: the screen minus whatever the bar covers.
 *
 * Reported honestly, with no floor at some minimum window size. The floor used
 * to live here and made the area *larger* than the screen on a small viewport,
 * which pushed desktop icons off the bottom right — the minimum belongs to the
 * thing being placed (a window has a minimum size, an icon does not), and every
 * caller already applies its own.
 */
export function getWorkArea(
  viewport: { height: number; width: number },
  position: TaskbarPosition,
): WorkArea {
  const insets = getWorkAreaInsets(position);
  return {
    height: viewport.height - insets.top - insets.bottom,
    width: viewport.width - insets.left - insets.right,
    x: insets.left,
    y: insets.top,
  };
}

/** The position the shell is actually painting, read off the element CSS reads. */
export function getTaskbarPosition(): TaskbarPosition {
  if (typeof document === "undefined") return DEFAULT_TASKBAR_POSITION;
  const value = document.documentElement.dataset.taskbar;
  return isTaskbarPosition(value) ? value : DEFAULT_TASKBAR_POSITION;
}

/**
 * One attribute, and the stylesheet does the rest: `--taskbar-height` and
 * `--work-area-inset` are redefined per position, so no component needs to know
 * which edge the bar is on to clear it.
 */
export function applyTaskbarPosition(position: TaskbarPosition) {
  document.documentElement.dataset.taskbar = position;
}

export function loadTaskbarPosition(): TaskbarPosition {
  try {
    const stored = localStorage.getItem(TASKBAR_POSITION_KEY);
    return isTaskbarPosition(stored) ? stored : DEFAULT_TASKBAR_POSITION;
  } catch {
    return DEFAULT_TASKBAR_POSITION;
  }
}

export function persistTaskbarPosition(position: TaskbarPosition) {
  try {
    localStorage.setItem(TASKBAR_POSITION_KEY, position);
  } catch {
    // A private-mode storage failure must not stop the bar from moving now.
  }
}
