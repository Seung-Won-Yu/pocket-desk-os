import {
  APP_BAR_HEIGHT,
  TASKBAR_AUTOHIDE_KEY,
  TASKBAR_POSITION_KEY,
  TASKBAR_SMALL_KEY,
} from "./constants";

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
/** 작은 작업 표시줄 단추: the bar Windows draws when the buttons shrink. */
export const TASKBAR_SMALL_HEIGHT = 32;
export const TASKBAR_SMALL_VERTICAL_WIDTH = 48;

/**
 * Everything about the bar that changes what the work area is. Carried as one
 * value because the three settings only mean anything together: a hidden bar
 * takes no space whatever its thickness, and its thickness depends on both the
 * edge it is on and whether its buttons are small.
 */
export type TaskbarLayout = {
  autoHide: boolean;
  position: TaskbarPosition;
  smallButtons: boolean;
};

export const DEFAULT_TASKBAR_LAYOUT: TaskbarLayout = {
  autoHide: false,
  position: DEFAULT_TASKBAR_POSITION,
  smallButtons: false,
};

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
export function getTaskbarThickness(layout: TaskbarLayout) {
  if (isVerticalTaskbar(layout.position)) {
    return layout.smallButtons ? TASKBAR_SMALL_VERTICAL_WIDTH : TASKBAR_VERTICAL_WIDTH;
  }
  return layout.smallButtons ? TASKBAR_SMALL_HEIGHT : APP_BAR_HEIGHT;
}

export function getWorkAreaInsets(layout: TaskbarLayout): WorkAreaInsets {
  // 자동 숨기기 gives the whole screen to the windows, as Windows does: the bar
  // is not on top of anything, it is off screen until it is asked for.
  if (layout.autoHide) return { bottom: 0, left: 0, right: 0, top: 0 };

  const thickness = getTaskbarThickness(layout);
  const { position } = layout;
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
  layout: TaskbarLayout,
): WorkArea {
  const insets = getWorkAreaInsets(layout);
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

/** The layout the shell is actually painting, read off the elements CSS reads. */
export function getTaskbarLayout(): TaskbarLayout {
  if (typeof document === "undefined") return DEFAULT_TASKBAR_LAYOUT;
  const { dataset } = document.documentElement;
  return {
    autoHide: dataset.taskbarAutohide === "on",
    position: getTaskbarPosition(),
    smallButtons: dataset.taskbarSmall === "on",
  };
}

/**
 * Three attributes, and the stylesheet does the rest: `--taskbar-height` and
 * `--work-area-inset` are redefined against them, so no component needs to know
 * which edge the bar is on, how thick it is, or whether it is hidden.
 */
export function applyTaskbarLayout(layout: TaskbarLayout) {
  const { dataset } = document.documentElement;
  dataset.taskbar = layout.position;
  dataset.taskbarAutohide = layout.autoHide ? "on" : "off";
  dataset.taskbarSmall = layout.smallButtons ? "on" : "off";
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

export function loadAutoHideTaskbar() {
  try {
    return localStorage.getItem(TASKBAR_AUTOHIDE_KEY) === "on";
  } catch {
    return false;
  }
}

export function persistAutoHideTaskbar(autoHide: boolean) {
  try {
    localStorage.setItem(TASKBAR_AUTOHIDE_KEY, autoHide ? "on" : "off");
  } catch {
    // The setting is lost, the session is not.
  }
}

export function loadSmallTaskbarButtons() {
  try {
    return localStorage.getItem(TASKBAR_SMALL_KEY) === "on";
  } catch {
    return false;
  }
}

export function persistSmallTaskbarButtons(small: boolean) {
  try {
    localStorage.setItem(TASKBAR_SMALL_KEY, small ? "on" : "off");
  } catch {
    // Same.
  }
}

export function loadTaskbarLayout(): TaskbarLayout {
  return {
    autoHide: loadAutoHideTaskbar(),
    position: loadTaskbarPosition(),
    smallButtons: loadSmallTaskbarButtons(),
  };
}
