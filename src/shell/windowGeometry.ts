import { clamp } from "../utils/format";
import { APP_BAR_HEIGHT, SNAP_CORNER_SIZE, SNAP_EDGE_SIZE } from "./constants";
import { type SnapZone, type WindowInstance } from "./types";

export function getWindowSnapZone(clientX: number, clientY: number): SnapZone | null {
  if (window.innerWidth < 720 || window.innerHeight < 420) return null;

  const nearLeft = clientX <= SNAP_CORNER_SIZE;
  const nearRight = clientX >= window.innerWidth - SNAP_CORNER_SIZE;
  const nearTop = clientY <= SNAP_CORNER_SIZE;
  const nearBottom = clientY >= window.innerHeight - APP_BAR_HEIGHT - SNAP_CORNER_SIZE;

  // Corners win over edges so the quarter layouts stay reachable by drag.
  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";

  if (clientY <= SNAP_EDGE_SIZE) return "top";
  if (clientX <= SNAP_EDGE_SIZE) return "left";
  if (clientX >= window.innerWidth - SNAP_EDGE_SIZE) return "right";
  return null;
}

/**
 * Snapped windows tile against each other and against the screen edges, the way
 * Windows does. The work area used to be inset by a gutter on every side, so two
 * halves floated with a gap between them while a maximized window sat flush —
 * the same gesture produced two different geometries.
 */
export function getDesktopWorkArea() {
  return {
    height: Math.max(240, window.innerHeight - APP_BAR_HEIGHT),
    width: Math.max(320, window.innerWidth),
    x: 0,
    y: 0,
  };
}

export function getWindowSnapPatch(zone: SnapZone): Partial<WindowInstance> {
  const area = getDesktopWorkArea();
  if (zone === "top") {
    return { maximized: true, minimized: false };
  }

  const halfWidth = Math.max(320, Math.floor(area.width / 2));
  const halfHeight = Math.max(220, Math.floor(area.height / 2));
  const rightX = area.x + area.width - halfWidth;
  const bottomY = area.y + area.height - halfHeight;

  const isQuarter = zone !== "left" && zone !== "right";
  const onRight = zone === "right" || zone === "top-right" || zone === "bottom-right";
  const onBottom = zone === "bottom-left" || zone === "bottom-right";

  return {
    height: isQuarter ? halfHeight : area.height,
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
  const maxRight = Math.max(minWidth, window.innerWidth - 8);
  const maxBottom = Math.max(minHeight, window.innerHeight - APP_BAR_HEIGHT - 8);

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
    const x = clamp(instance.x + delta, 8, right - minWidth);
    return { width: right - x, x };
  }
  const bottom = instance.y + instance.height;
  const y = clamp(instance.y + delta, 8, bottom - minHeight);
  return { height: bottom - y, y };
}
