import { type WindowInstance } from "./types";

/**
 * The taskbar menu's window arrangements — 창 계단식 배열, 창 위아래 정렬, 창
 * 나란히 정렬 — over the visible windows of one desktop. Minimized windows
 * and windows on other desktops are left exactly as they are, as Windows
 * leaves them.
 */
export type ArrangeMode = "cascade" | "side-by-side" | "stack";

export interface WorkArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** One title bar per stair, the offset Windows cascades by. */
export const CASCADE_STEP = 28;
const CASCADE_WIDTH_RATIO = 0.62;
const CASCADE_HEIGHT_RATIO = 0.66;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Columns × rows for `count` tiles: a strip up to three, a grid beyond. */
export function getTileGrid(count: number, mode: Exclude<ArrangeMode, "cascade">) {
  if (mode === "side-by-side") {
    const columns = count <= 3 ? count : Math.ceil(count / 2);
    return { columns, rows: Math.ceil(count / columns) };
  }
  const columns = count <= 3 ? 1 : 2;
  return { columns, rows: Math.ceil(count / columns) };
}

export interface MinSize {
  height: number;
  width: number;
}

const FALLBACK_MIN_SIZE: MinSize = { height: MIN_HEIGHT, width: MIN_WIDTH };

/**
 * Column widths (or row heights) for a strip of tiles: every tile gets at
 * least the largest minimum in its column, and whatever width is left over is
 * shared equally, so the strip covers the area edge to edge. When the minimums
 * alone exceed the area the tiles keep them and must overlap — a window cannot
 * be made smaller than its app allows.
 */
export function distributeTileSizes(total: number, minimums: number[]): number[] {
  const required = minimums.reduce((sum, minimum) => sum + minimum, 0);
  if (required >= total) return [...minimums];
  const extra = total - required;
  const share = Math.floor(extra / minimums.length);
  const sizes = minimums.map((minimum) => minimum + share);
  // The last tile absorbs the rounding so the strip ends exactly at the edge.
  sizes[sizes.length - 1] += extra - share * minimums.length;
  return sizes;
}

/** Tile origins along one axis; an overflowing strip is pulled back inside. */
function tileOffsets(sizes: number[], start: number, total: number): number[] {
  let cursor = start;
  return sizes.map((size) => {
    const offset = clamp(cursor, start, Math.max(start, start + total - size));
    cursor += size;
    return offset;
  });
}

export function arrangeWindows(
  windows: WindowInstance[],
  desktopIndex: number,
  area: WorkArea,
  mode: ArrangeMode,
  getMinSize: (item: WindowInstance) => MinSize | undefined = () => undefined,
): WindowInstance[] {
  // Bottom first, so the window that was in front ends up in front again.
  const targets = windows
    .filter((item) => item.desktopIndex === desktopIndex && !item.minimized)
    .sort((first, second) => first.z - second.z);
  if (targets.length === 0) return windows;

  const topZ = Math.max(1, ...windows.map((item) => item.z));
  const patches = new Map<string, Partial<WindowInstance>>();

  if (mode === "cascade") {
    const width = clamp(Math.round(area.width * CASCADE_WIDTH_RATIO), MIN_WIDTH, area.width);
    const height = clamp(
      Math.round(area.height * CASCADE_HEIGHT_RATIO),
      MIN_HEIGHT,
      area.height,
    );
    // How many stairs fit before the stack would leave the work area; the
    // next run starts back at the top, shifted right.
    const stairs = Math.max(
      1,
      Math.floor(Math.min(area.width - width, area.height - height) / CASCADE_STEP) + 1,
    );
    targets.forEach((item, index) => {
      const stair = index % stairs;
      const run = Math.floor(index / stairs);
      patches.set(item.id, {
        height,
        maximized: false,
        width,
        x: clamp(
          area.x + stair * CASCADE_STEP + run * CASCADE_STEP * 2,
          area.x,
          area.x + area.width - width,
        ),
        y: area.y + stair * CASCADE_STEP,
        z: topZ + 1 + index,
      });
    });
  } else {
    const { columns, rows } = getTileGrid(targets.length, mode);
    const minSizes = targets.map((item) => getMinSize(item) ?? FALLBACK_MIN_SIZE);
    const columnMinimums = Array.from({ length: columns }, (_, column) =>
      Math.max(
        1,
        ...minSizes.filter((_, index) => index % columns === column).map((s) => s.width),
      ),
    );
    const rowMinimums = Array.from({ length: rows }, (_, row) =>
      Math.max(
        1,
        ...minSizes
          .filter((_, index) => Math.floor(index / columns) === row)
          .map((s) => s.height),
      ),
    );
    const widths = distributeTileSizes(area.width, columnMinimums);
    const heights = distributeTileSizes(area.height, rowMinimums);
    const xs = tileOffsets(widths, area.x, area.width);
    const ys = tileOffsets(heights, area.y, area.height);
    targets.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      patches.set(item.id, {
        height: heights[row],
        maximized: false,
        width: widths[column],
        x: xs[column],
        y: ys[row],
        z: topZ + 1 + index,
      });
    });
  }

  return windows.map((item) => {
    const patch = patches.get(item.id);
    return patch ? { ...item, ...patch } : item;
  });
}
