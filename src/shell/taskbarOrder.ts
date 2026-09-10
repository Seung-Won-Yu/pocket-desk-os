import type { AppId } from "../types";

/**
 * The order the taskbar's buttons stand in: the pinned apps first, in the
 * order the user dragged them into, then one button per app that has a window
 * but is not pinned.
 *
 * Lives here rather than inside the bar because Win+1…9 addresses the same
 * order. Two places deriving it separately is the shape of bug this project
 * has already paid for once with the work area.
 */
export function getTaskbarAppOrder(
  pinnedAppIds: AppId[],
  availableAppIds: Iterable<AppId>,
  windowAppIds: AppId[],
): AppId[] {
  const available = new Set(availableAppIds);
  const pinned = pinnedAppIds.filter((appId) => available.has(appId));
  const unpinned = [...new Set(windowAppIds.filter((appId) => !pinned.includes(appId)))];
  return [...pinned, ...unpinned];
}

/**
 * The digit a key press names, read from `code` rather than `key`: with Shift
 * held the 1 key reports "!" on a US layout, so Win+Shift+1 matched nothing
 * and the new-window half of the shortcut did nothing at all. `key` is the
 * fallback for a synthetic event that carries no code.
 */
export function getTaskbarNumberKey(event: { code?: string; key: string }): number | null {
  const fromCode = /^(?:Digit|Numpad)([1-9])$/.exec(event.code ?? "");
  if (fromCode) return Number(fromCode[1]);
  return /^[1-9]$/.test(event.key) ? Number(event.key) : null;
}

/** Win+1…9 counts buttons from the left; Windows gives 9 nothing beyond it. */
export function getTaskbarAppForNumberKey(
  order: AppId[],
  event: { code?: string; key: string },
): AppId | null {
  const slot = getTaskbarNumberKey(event);
  return slot === null ? null : (order[slot - 1] ?? null);
}

/**
 * What Win+N does to an app that is already running, the way Windows does it:
 * one window toggles — active goes to the taskbar, anything else comes
 * forward — and several cycle, so pressing it again walks along them.
 */
export function getTaskbarNumberAction(
  windowIds: string[],
  activeWindowId: string | null,
):
  | { kind: "focus"; windowId: string }
  | { kind: "launch" }
  | { kind: "minimize"; windowId: string } {
  if (windowIds.length === 0) return { kind: "launch" };
  const activeIndex = activeWindowId ? windowIds.indexOf(activeWindowId) : -1;
  if (activeIndex === -1) return { kind: "focus", windowId: windowIds[0] };
  if (windowIds.length === 1) return { kind: "minimize", windowId: windowIds[0] };
  return { kind: "focus", windowId: windowIds[(activeIndex + 1) % windowIds.length] };
}
