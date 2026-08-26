import { APP_BAR_HEIGHT, SNAP_EDGE_SIZE, SNAP_GUTTER } from "./constants";
import { type SnapZone, type WindowInstance } from "./types";

export function getWindowSnapZone(clientX: number, clientY: number): SnapZone | null {
  if (window.innerWidth < 720 || window.innerHeight < 420) return null;
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

  const width = Math.max(320, Math.floor((area.width - SNAP_GUTTER) / 2));
  return {
    height: area.height,
    maximized: false,
    minimized: false,
    width,
    x: zone === "left" ? area.x : area.x + area.width - width,
    y: area.y,
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
