/**
 * Explorer's column widths. The details view had a fixed grid, so a long name
 * was cut off with no way to widen the column it was cut off in.
 *
 * Every column carries its own width and the remainder of the row is left
 * blank, which is what Windows does — the last column does not stretch to
 * swallow the space.
 */
export type FileColumnKey = "modified" | "name" | "size" | "type";

export const FILE_COLUMN_KEYS: FileColumnKey[] = ["name", "modified", "type", "size"];

export const DEFAULT_FILE_COLUMN_WIDTHS: Record<FileColumnKey, number> = {
  modified: 116,
  name: 240,
  size: 72,
  type: 106,
};

/** Below this a heading cannot show its own name, which is Windows' floor too. */
export const MIN_FILE_COLUMN_WIDTH = 56;
export const MAX_FILE_COLUMN_WIDTH = 640;

export const FILE_COLUMN_WIDTH_KEY = "pocket-desk-file-columns-v1";

export type FileColumnWidths = Record<FileColumnKey, number>;

export function clampFileColumnWidth(width: number) {
  if (!Number.isFinite(width)) return MIN_FILE_COLUMN_WIDTH;
  return Math.min(MAX_FILE_COLUMN_WIDTH, Math.max(MIN_FILE_COLUMN_WIDTH, Math.round(width)));
}

export function resizeFileColumn(
  widths: FileColumnWidths,
  key: FileColumnKey,
  nextWidth: number,
): FileColumnWidths {
  const clamped = clampFileColumnWidth(nextWidth);
  if (widths[key] === clamped) return widths;
  return { ...widths, [key]: clamped };
}

/** `26px` for the icon, then one track per column. Rows and heading share it. */
export function getFileColumnTemplate(widths: FileColumnWidths) {
  return FILE_COLUMN_KEYS.map((key) => `${widths[key]}px`).join(" ");
}

export function loadFileColumnWidths(): FileColumnWidths {
  try {
    const stored = localStorage.getItem(FILE_COLUMN_WIDTH_KEY);
    if (!stored) return { ...DEFAULT_FILE_COLUMN_WIDTHS };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_FILE_COLUMN_WIDTHS };
    const record = parsed as Partial<Record<FileColumnKey, unknown>>;
    const widths = { ...DEFAULT_FILE_COLUMN_WIDTHS };
    for (const key of FILE_COLUMN_KEYS) {
      const value = record[key];
      // A stored width that is not a number is not a width. Missing keys keep
      // the default rather than collapsing the column to the floor.
      if (typeof value === "number" && Number.isFinite(value)) {
        widths[key] = clampFileColumnWidth(value);
      }
    }
    return widths;
  } catch {
    return { ...DEFAULT_FILE_COLUMN_WIDTHS };
  }
}

export function persistFileColumnWidths(widths: FileColumnWidths) {
  try {
    localStorage.setItem(FILE_COLUMN_WIDTH_KEY, JSON.stringify(widths));
  } catch {
    // A full or blocked storage must not stop the column from resizing.
  }
}
