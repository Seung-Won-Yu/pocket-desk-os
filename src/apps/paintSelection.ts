/**
 * 그림판 선택·자르기·회전. Paint had eight drawing tools and no way to take
 * hold of what was already drawn: nothing could be selected, moved, cropped
 * or turned. The geometry lives here, away from the canvas, so the rules —
 * what a drag selects, where a turned picture lands — can be pinned exactly.
 */
export type PaintPoint = { x: number; y: number };
export type PaintRect = { height: number; width: number; x: number; y: number };
export type PaintSize = { height: number; width: number };

/** Under this on either axis the drag was a click, and a click deselects. */
export const PAINT_SELECTION_MIN = 2;

/** The rectangle a drag covers, in whole bitmap pixels, kept on the canvas. */
export function getSelectionRect(start: PaintPoint, current: PaintPoint, bounds: PaintSize) {
  const clampX = (value: number) => Math.min(bounds.width, Math.max(0, value));
  const clampY = (value: number) => Math.min(bounds.height, Math.max(0, value));
  const left = Math.floor(clampX(Math.min(start.x, current.x)));
  const top = Math.floor(clampY(Math.min(start.y, current.y)));
  const right = Math.ceil(clampX(Math.max(start.x, current.x)));
  const bottom = Math.ceil(clampY(Math.max(start.y, current.y)));
  return { height: bottom - top, width: right - left, x: left, y: top };
}

export function isSelectionUsable(rect: PaintRect | null): rect is PaintRect {
  return Boolean(
    rect && rect.width >= PAINT_SELECTION_MIN && rect.height >= PAINT_SELECTION_MIN,
  );
}

export function isPointInRect(point: PaintPoint, rect: PaintRect) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

/**
 * A moved selection. It is not kept on the canvas: Paint lets a selection be
 * dragged partly past the edge, and what falls off is lost when it is put down.
 */
export function offsetRect(rect: PaintRect, dx: number, dy: number): PaintRect {
  return { ...rect, x: Math.round(rect.x + dx), y: Math.round(rect.y + dy) };
}

export type PaintTransformKind =
  "rotateRight" | "rotateLeft" | "rotate180" | "flipVertical" | "flipHorizontal";

/** The 회전 menu, in Paint's own order and words. */
export const PAINT_TRANSFORMS: Array<{ id: PaintTransformKind; label: string }> = [
  { id: "rotateRight", label: "오른쪽으로 90도 회전" },
  { id: "rotateLeft", label: "왼쪽으로 90도 회전" },
  { id: "rotate180", label: "180도 회전" },
  { id: "flipVertical", label: "세로 대칭" },
  { id: "flipHorizontal", label: "가로 대칭" },
];

export type PaintTransformPlan = {
  height: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  width: number;
};

/**
 * How to draw a picture of `width`×`height` turned or flipped: the size of
 * the result and the canvas transform that puts the source into it, applied
 * as translate, then rotate, then scale. A quarter turn swaps the sides.
 */
export function describePaintTransform(
  kind: PaintTransformKind,
  width: number,
  height: number,
): PaintTransformPlan {
  const base = { rotate: 0, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
  switch (kind) {
    case "rotateRight":
      return { ...base, height: width, rotate: Math.PI / 2, translateX: height, width: height };
    case "rotateLeft":
      return { ...base, height: width, rotate: -Math.PI / 2, translateY: width, width: height };
    case "rotate180":
      return { ...base, height, rotate: Math.PI, translateX: width, translateY: height, width };
    case "flipHorizontal":
      return { ...base, height, scaleX: -1, translateX: width, width };
    case "flipVertical":
      return { ...base, height, scaleY: -1, translateY: height, width };
  }
}

/** Where a source point lands under a plan — the same order the canvas applies. */
export function applyPaintTransform(plan: PaintTransformPlan, point: PaintPoint): PaintPoint {
  const scaledX = point.x * plan.scaleX;
  const scaledY = point.y * plan.scaleY;
  const cos = Math.round(Math.cos(plan.rotate));
  const sin = Math.round(Math.sin(plan.rotate));
  return {
    x: scaledX * cos - scaledY * sin + plan.translateX,
    y: scaledX * sin + scaledY * cos + plan.translateY,
  };
}
