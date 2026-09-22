import type React from "react";

/**
 * 파일 탐색기 끌어서 선택. The desktop has drawn a selection band since early
 * on; the list inside a window never did, so a drag over the rows picked
 * nothing at all. The geometry lives here, away from the DOM, so the rules —
 * what the band covers, when it counts as a drag, what Ctrl adds to — can be
 * pinned without a browser.
 *
 * Every coordinate is in the list's own content space: the client point minus
 * the list's box, plus its scroll offset. That is the space the band element
 * is positioned in, so a list scrolled halfway down still marks the rows the
 * pointer is actually over.
 */
export type FileMarqueeState = {
  /** Ctrl/⌘ held: the band adds to what was already selected. */
  additive: boolean;
  /** The selection the drag started from, kept for an additive band. */
  base: string[];
  currentX: number;
  currentY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

export type FileMarqueeRow = {
  bottom: number;
  id: string;
  left: number;
  right: number;
  top: number;
};

export type FileMarqueeBounds = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

/**
 * The same threshold the desktop band uses. Under it the gesture is a click,
 * and a click on empty space clears the selection rather than making one.
 */
export const FILE_MARQUEE_THRESHOLD = 5;

export function getFileMarqueeBounds(state: FileMarqueeState): FileMarqueeBounds {
  const left = Math.min(state.startX, state.currentX);
  const top = Math.min(state.startY, state.currentY);
  const right = Math.max(state.startX, state.currentX);
  const bottom = Math.max(state.startY, state.currentY);
  return { bottom, height: bottom - top, left, right, top, width: right - left };
}

export function isFileMarqueeVisible(state: FileMarqueeState) {
  const bounds = getFileMarqueeBounds(state);
  return bounds.width > FILE_MARQUEE_THRESHOLD || bounds.height > FILE_MARQUEE_THRESHOLD;
}

export function getFileMarqueeStyle(state: FileMarqueeState): React.CSSProperties {
  const bounds = getFileMarqueeBounds(state);
  return {
    height: bounds.height,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
  };
}

/**
 * The rows the band touches, in the order they are listed. A band that has
 * not passed the threshold selects nothing — an additive drag still hands
 * back what was selected before it started, so a stray click keeps it.
 */
export function getFileMarqueeSelection(
  state: FileMarqueeState,
  rows: FileMarqueeRow[],
): string[] {
  const base = state.additive ? state.base : [];
  if (!isFileMarqueeVisible(state)) return [...base];

  const bounds = getFileMarqueeBounds(state);
  const taken = new Set(base);
  const selected = [...base];
  rows.forEach((row) => {
    const touches =
      row.left <= bounds.right &&
      row.right >= bounds.left &&
      row.top <= bounds.bottom &&
      row.bottom >= bounds.top;
    if (touches && !taken.has(row.id)) {
      taken.add(row.id);
      selected.push(row.id);
    }
  });
  return selected;
}
