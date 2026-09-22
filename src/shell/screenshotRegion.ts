/**
 * 사각형 캡처. The tool could picture the whole screen or one window and
 * nothing in between, where Windows' own 캡처 도구 opens with a rectangle.
 * The geometry — what the band covers, whether it is big enough to be a
 * capture, and where that lands in the picture's own pixels — lives here.
 */
export type RegionPoint = { x: number; y: number };

export type RegionBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
};

/** Under this the drag is a click, and a one-pixel capture is nobody's intent. */
export const REGION_MIN_SIZE = 8;

export function getRegionSelectionBounds(
  start: RegionPoint,
  current: RegionPoint,
): RegionBounds {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  return {
    height: Math.abs(start.y - current.y),
    left,
    top,
    width: Math.abs(start.x - current.x),
  };
}

export function isRegionSelectionUsable(bounds: RegionBounds) {
  return bounds.width >= REGION_MIN_SIZE && bounds.height >= REGION_MIN_SIZE;
}

/**
 * The same rectangle in the capture's pixels. The picture is drawn at the
 * screen's own scale, so a band measured in CSS pixels has to be scaled by
 * what came back — and clamped, because a drag can end past the edge.
 */
export function getRegionCropRect(
  bounds: RegionBounds,
  capture: { height: number; width: number },
  viewport: { height: number; width: number },
) {
  const scaleX = viewport.width > 0 ? capture.width / viewport.width : 1;
  const scaleY = viewport.height > 0 ? capture.height / viewport.height : 1;
  const left = Math.max(0, Math.round(bounds.left * scaleX));
  const top = Math.max(0, Math.round(bounds.top * scaleY));
  const width = Math.max(1, Math.min(Math.round(bounds.width * scaleX), capture.width - left));
  const height = Math.max(
    1,
    Math.min(Math.round(bounds.height * scaleY), capture.height - top),
  );
  return { height, left, top, width };
}
