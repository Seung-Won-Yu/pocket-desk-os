import { clamp } from "../utils/format";
import { SNAP_CORNER_SIZE, SNAP_EDGE_SIZE } from "./constants";
import { getTaskbarPosition, getWorkArea } from "./taskbarPosition";
import { type SnapZone, type WindowInstance } from "./types";

/**
 * Snap zones hug the work area, not the viewport: with the taskbar on the left
 * the left-edge zone starts where the bar ends, so a drag that crosses the bar
 * does not offer a half-screen the window could never occupy.
 */
export function getWindowSnapZone(clientX: number, clientY: number): SnapZone | null {
  if (window.innerWidth < 720 || window.innerHeight < 420) return null;

  const area = getDesktopWorkArea();
  const areaRight = area.x + area.width;
  const areaBottom = area.y + area.height;

  const nearLeft = clientX <= area.x + SNAP_CORNER_SIZE;
  const nearRight = clientX >= areaRight - SNAP_CORNER_SIZE;
  const nearTop = clientY <= area.y + SNAP_CORNER_SIZE;
  const nearBottom = clientY >= areaBottom - SNAP_CORNER_SIZE;

  // Corners win over edges so the quarter layouts stay reachable by drag.
  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";

  if (clientY <= area.y + SNAP_EDGE_SIZE) return "top";
  if (clientX <= area.x + SNAP_EDGE_SIZE) return "left";
  if (clientX >= areaRight - SNAP_EDGE_SIZE) return "right";
  return null;
}

/**
 * The part of the screen the taskbar does not cover — which edge that is comes
 * from 작업 표시줄 위치. Snapped windows tile against each other and against the
 * edges of this rectangle, the way Windows does. The work area used to be inset
 * by a gutter on every side, so two halves floated with a gap between them
 * while a maximized window sat flush — the same gesture produced two different
 * geometries.
 */
export function getDesktopWorkArea() {
  return getWorkArea(
    { height: window.innerHeight, width: window.innerWidth },
    getTaskbarPosition(),
  );
}

/** The column widths 스냅 레이아웃 offers, as a share of the work area. */
const COLUMN_ZONES: Partial<Record<SnapZone, { share: number; start: number }>> = {
  "center-third": { share: 1 / 3, start: 1 / 3 },
  "left-third": { share: 1 / 3, start: 0 },
  "left-two-thirds": { share: 2 / 3, start: 0 },
  "right-third": { share: 1 / 3, start: 2 / 3 },
  "right-two-thirds": { share: 2 / 3, start: 1 / 3 },
};

export function getWindowSnapPatch(zone: SnapZone): Partial<WindowInstance> {
  const area = getDesktopWorkArea();
  if (zone === "top") {
    return { maximized: true, minimized: false };
  }

  const column = COLUMN_ZONES[zone];
  if (column) {
    /*
     * Rounded so the columns of one layout meet exactly: the right edge of a
     * third is the left edge of the next, or a one-pixel strip of wallpaper
     * shows between two windows that are supposed to be flush.
     */
    const start = area.x + Math.round(area.width * column.start);
    const end = area.x + Math.round(area.width * (column.start + column.share));
    return {
      height: area.height,
      maximized: false,
      minimized: false,
      width: Math.max(280, end - start),
      x: start,
      y: area.y,
    };
  }

  /*
   * The minimum size belongs here rather than to the work area: a window has
   * one, the area does not. On a viewport too small to hold two halves the
   * floored half overflows, and the far half starts at the work area's own
   * corner instead of at a negative coordinate off screen.
   */
  const halfWidth = Math.max(320, Math.floor(area.width / 2));
  const halfHeight = Math.max(220, Math.floor(area.height / 2));
  const fullHeight = Math.max(240, area.height);
  const rightX = Math.max(area.x, area.x + area.width - halfWidth);
  const bottomY = Math.max(area.y, area.y + area.height - halfHeight);

  const isQuarter = zone !== "left" && zone !== "right";
  const onRight = zone === "right" || zone === "top-right" || zone === "bottom-right";
  const onBottom = zone === "bottom-left" || zone === "bottom-right";

  return {
    height: isQuarter ? halfHeight : fullHeight,
    maximized: false,
    minimized: false,
    width: halfWidth,
    x: onRight ? rightX : area.x,
    y: onBottom ? bottomY : area.y,
  };
}

export function getSnapPreviewStyle(zone: SnapZone): React.CSSProperties {
  const area = getDesktopWorkArea();
  if (zone === "top") {
    return {
      height: area.height,
      left: area.x,
      top: area.y,
      width: area.width,
    };
  }

  const patch = getWindowSnapPatch(zone);
  return {
    height: patch.height,
    left: patch.x,
    top: patch.y,
    width: patch.width,
  };
}

/**
 * One arrow press against a single edge, the way Windows' 크기 조정 mode works:
 * the edge you picked is the one that moves, and the opposite edge stays put.
 * Sizes stop at the app's own minimum rather than inverting the window.
 */
export function resizeWindowEdge(
  instance: WindowInstance,
  edge: "bottom" | "left" | "right" | "top",
  key: string,
  step: number,
): Partial<WindowInstance> {
  const delta =
    key === "ArrowLeft" || key === "ArrowUp"
      ? -step
      : key === "ArrowRight" || key === "ArrowDown"
        ? step
        : 0;
  if (delta === 0) return {};

  const minWidth = 320;
  const minHeight = 240;
  const area = getDesktopWorkArea();
  const maxRight = Math.max(minWidth, area.x + area.width - 8);
  const maxBottom = Math.max(minHeight, area.y + area.height - 8);

  if (edge === "right") {
    // The ceiling never drops below the floor: with the window hard against
    // the screen edge, clamp(v, 320, <320) returned 320 and one arrow press
    // snapped a wide window to its minimum.
    return {
      width: clamp(instance.width + delta, minWidth, Math.max(minWidth, maxRight - instance.x)),
    };
  }
  if (edge === "bottom") {
    return {
      height: clamp(
        instance.height + delta,
        minHeight,
        Math.max(minHeight, maxBottom - instance.y),
      ),
    };
  }
  if (edge === "left") {
    const right = instance.x + instance.width;
    const x = clamp(instance.x + delta, area.x + 8, right - minWidth);
    return { width: right - x, x };
  }
  const bottom = instance.y + instance.height;
  const y = clamp(instance.y + delta, area.y + 8, bottom - minHeight);
  return { height: bottom - y, y };
}

/**
 * Where a minimizing window flies: from its own centre to the centre of its
 * taskbar button, the way Windows folds a window into its button. Returned as
 * the translation the frame's animation ends on.
 */
export function getMinimizeVector(
  frame: { height: number; left: number; top: number; width: number },
  target: { height: number; left: number; top: number; width: number } | null,
) {
  if (!target) return { dx: 0, dy: 34 };
  return {
    dx: Math.round(target.left + target.width / 2 - (frame.left + frame.width / 2)),
    dy: Math.round(target.top + target.height / 2 - (frame.top + frame.height / 2)),
  };
}
