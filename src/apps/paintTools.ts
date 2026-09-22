/**
 * 그림판's 스포이드 and 크기 조정 — the two Paint tools this had no answer
 * for: a colour could only come from the eight swatches, and the canvas was
 * whatever size the file arrived at.
 */

export const PAINT_MIN_DIMENSION = 1;
export const PAINT_MAX_DIMENSION = 4096;

/**
 * The colour under the eyedropper. A fully transparent pixel reads as the
 * paper rather than as black: the canvas starts transparent and paints onto
 * white, so picking an untouched spot should give you white, not #000000.
 */
export function toHexColor(red: number, green: number, blue: number, alpha = 255) {
  if (alpha === 0) return "#ffffff";
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(red)}${part(green)}${part(blue)}`;
}

export type PaintDimensions = { height: number; width: number };

function clampDimension(value: number) {
  if (!Number.isFinite(value)) return PAINT_MIN_DIMENSION;
  return Math.min(PAINT_MAX_DIMENSION, Math.max(PAINT_MIN_DIMENSION, Math.round(value)));
}

/**
 * What 크기 조정 will actually apply. With 비율 유지 on, the side you did not
 * type follows the one you did — Paint keeps the aspect of the image you
 * started from, not of whatever the boxes happen to hold.
 */
export function getResizedDimensions(
  original: PaintDimensions,
  requested: PaintDimensions,
  keepAspect: boolean,
  edited: "height" | "width",
): PaintDimensions {
  const width = clampDimension(requested.width);
  const height = clampDimension(requested.height);
  if (!keepAspect || original.width < 1 || original.height < 1) return { height, width };

  if (edited === "width") {
    return { height: clampDimension((width * original.height) / original.width), width };
  }
  return { height, width: clampDimension((height * original.width) / original.height) };
}
