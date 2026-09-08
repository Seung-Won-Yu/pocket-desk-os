import { DESKTOP_NAMES_KEY, MAX_VIRTUAL_DESKTOPS } from "./constants";

/**
 * Virtual desktops you can name, the way Windows 11 lets you rename one in
 * Task View. A desktop with no name of its own is "데스크톱 N", so the list
 * only holds what the user actually typed — and an unnamed desktop renumbers
 * itself when the ones before it close.
 */

export const MAX_DESKTOP_NAME_LENGTH = 24;

/** A name that is only spaces is no name; the numbered default comes back. */
export function normalizeDesktopName(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_DESKTOP_NAME_LENGTH);
}

export function normalizeDesktopNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_VIRTUAL_DESKTOPS)
    .map((entry) => (typeof entry === "string" ? normalizeDesktopName(entry) : ""));
}

/** What a desktop is called: its own name, or its number. */
export function getDesktopName(names: string[], index: number) {
  return names[index] || `데스크톱 ${index + 1}`;
}

/** The list with one desktop renamed. An empty name restores the default. */
export function renameDesktop(names: string[], index: number, name: string): string[] {
  if (index < 0 || index >= MAX_VIRTUAL_DESKTOPS) return names;
  const normalized = normalizeDesktopName(name);
  if (getDesktopName(names, index) === normalized) return names;
  const next = [...names];
  while (next.length <= index) next.push("");
  next[index] = normalized;
  // Trailing blanks say nothing; dropping them keeps the stored list honest.
  while (next.length > 0 && next[next.length - 1] === "") next.pop();
  return next;
}

/**
 * The list after the desktop at `index` closes. The names after it move up
 * with their desktops — without this, closing 데스크톱 1 handed its name to
 * whatever slid into its place.
 */
export function removeDesktopName(names: string[], index: number): string[] {
  if (index < 0 || index >= names.length) return names;
  const next = [...names.slice(0, index), ...names.slice(index + 1)];
  while (next.length > 0 && next[next.length - 1] === "") next.pop();
  return next;
}

export function loadDesktopNames(): string[] {
  try {
    return normalizeDesktopNames(JSON.parse(localStorage.getItem(DESKTOP_NAMES_KEY) ?? "null"));
  } catch {
    return [];
  }
}

export function persistDesktopNames(names: string[]) {
  try {
    localStorage.setItem(DESKTOP_NAMES_KEY, JSON.stringify(names));
    return true;
  } catch {
    return false;
  }
}
