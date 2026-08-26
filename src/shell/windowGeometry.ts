import { APP_BAR_HEIGHT, SNAP_CORNER_SIZE, SNAP_EDGE_SIZE, SNAP_GUTTER } from "./constants";
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

export function getDesktopWorkArea() {
  return {
    height: Math.max(240, window.innerHeight - APP_BAR_HEIGHT - SNAP_GUTTER * 2),
    width: Math.max(320, window.innerWidth - SNAP_GUTTER * 2),
    x: SNAP_GUTTER,
    y: SNAP_GUTTER,
  };
}

export function getWindowSnapPatch(zone: SnapZone): Partial<WindowInstance> {
  const area = getDesktopWorkArea();
  if (zone === "top") {
    return { maximized: true, minimized: false };
  }

  const halfWidth = Math.max(320, Math.floor((area.width - SNAP_GUTTER) / 2));
  const halfHeight = Math.max(220, Math.floor((area.height - SNAP_GUTTER) / 2));
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
