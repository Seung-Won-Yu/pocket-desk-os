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

/*
 * 열 선택 — right-clicking the heading picks which columns show, the way
 * Windows' does. 이름 always shows: a list with no names is not a list.
 */
export type HideableFileColumn = Exclude<FileColumnKey, "name">;
export const HIDEABLE_FILE_COLUMNS: HideableFileColumn[] = ["modified", "type", "size"];
export const FILE_HIDDEN_COLUMNS_KEY = "pocket-desk-file-hidden-columns-v1";

export function toggleFileColumn(hidden: HideableFileColumn[], key: HideableFileColumn) {
  const next = hidden.includes(key) ? hidden.filter((item) => item !== key) : [...hidden, key];
  return HIDEABLE_FILE_COLUMNS.filter((item) => next.includes(item));
}

/**
 * The details grid for the columns that show: the icon, 이름 taking the rest,
 * then each visible column at its own width. Hidden columns drop out of the
 * template entirely, so the cells after them do not slide into their track.
 */
export function getFileGridTemplate(widths: FileColumnWidths, hidden: HideableFileColumn[]) {
  const tracks = HIDEABLE_FILE_COLUMNS.filter((key) => !hidden.includes(key)).map(
    (key) => `minmax(0, ${widths[key]}px)`,
  );
  return ["26px", "minmax(96px, 1fr)", ...tracks].join(" ");
}

export function loadHiddenFileColumns(): HideableFileColumn[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FILE_HIDDEN_COLUMNS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return HIDEABLE_FILE_COLUMNS.filter((key) => parsed.includes(key));
  } catch {
    return [];
  }
}

export function persistHiddenFileColumns(hidden: HideableFileColumn[]) {
  try {
    localStorage.setItem(FILE_HIDDEN_COLUMNS_KEY, JSON.stringify(hidden));
  } catch {
    // A full or blocked storage must not stop the column from hiding.
  }
}
