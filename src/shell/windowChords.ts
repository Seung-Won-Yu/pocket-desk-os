import { type WindowInstance } from "./types";

/**
 * Window chords Windows has and the shell did not: Win+Home, Win+Shift+Up and
 * Down, Alt+Esc. Each one is a decision about which windows move and where;
 * the decisions live here so they can be pinned without a browser.
 */
type WorkArea = { height: number; width: number; x: number; y: number };

/** The windows on this desktop that are on screen, front first. */
function visibleOnDesktop(windows: WindowInstance[], desktopIndex: number) {
  return windows
    .filter((item) => item.desktopIndex === desktopIndex && !item.minimized)
    .sort((first, second) => second.z - first.z);
}

/** Win+Home: every window on this desktop goes to the taskbar except the active one. */
export function getMinimizeOthersIds(
  windows: WindowInstance[],
  activeId: string | null,
  desktopIndex: number,
) {
  if (!activeId) return [];
  return visibleOnDesktop(windows, desktopIndex)
    .filter((item) => item.id !== activeId)
    .map((item) => item.id);
}

/**
 * Win+Home again brings back what the first press put away — only windows
 * that are still open and still minimized, so one the reader restored by hand
 * in between, or closed, is left alone.
 */
export function getRestoreOthersIds(windows: WindowInstance[], rememberedIds: string[]) {
  const minimized = new Set(windows.filter((item) => item.minimized).map((item) => item.id));
  return rememberedIds.filter((id) => minimized.has(id));
}

export type VerticalStretch = { height: number; y: number };

/**
 * Win+Shift+Up: the window runs from the top of the work area to the bottom,
 * keeping its own width and its place left to right. Windows calls it
 * stretching; the shell used to maximize instead.
 */
export function getVerticalStretchPatch(
  window: WindowInstance,
  area: WorkArea,
): VerticalStretch {
  return { height: area.height, y: area.y };
}

/** Whether the window already spans the work area top to bottom. */
export function isVerticallyStretched(window: WindowInstance, area: WorkArea) {
  return window.y === area.y && window.height === area.height;
}

export type AltEscPlan = { activate: string; sendBack: string } | null;

/**
 * Alt+Esc: the window in front goes to the back of the pile and the one
 * behind it comes forward, with no switcher on screen. With one window there
 * is nothing to cycle.
 */
export function getAltEscPlan(
  windows: WindowInstance[],
  activeId: string | null,
  desktopIndex: number,
): AltEscPlan {
  const pile = visibleOnDesktop(windows, desktopIndex);
  if (pile.length < 2) return null;
  const front = pile.find((item) => item.id === activeId) ?? pile[0];
  const next = pile.find((item) => item.id !== front.id);
  return next ? { activate: next.id, sendBack: front.id } : null;
}

/**
 * The pile after Alt+Esc, front to back: the active window moves to the end.
 * The shell restacks by handing out fresh z values in this order rather than
 * pushing one window below the others — a z under 1 slid a frame behind the
 * desktop itself.
 */
export function getAltEscPileOrder(
  windows: WindowInstance[],
  activeId: string | null,
  desktopIndex: number,
) {
  const plan = getAltEscPlan(windows, activeId, desktopIndex);
  if (!plan) return null;
  const pile = visibleOnDesktop(windows, desktopIndex).map((item) => item.id);
  return [...pile.filter((id) => id !== plan.sendBack), plan.sendBack];
}
