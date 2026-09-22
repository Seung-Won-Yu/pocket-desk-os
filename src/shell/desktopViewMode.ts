import { type DesktopViewMode } from "./types";

/**
 * 바탕 화면 아이콘 크기, as Ctrl+휠 changes it. The sizes were only reachable
 * through 보기 in the desktop's menu; Windows gives them to the wheel, which
 * is how most people have ever changed them.
 */
export const DESKTOP_VIEW_ORDER: DesktopViewMode[] = ["small", "medium", "large"];

export function getNextDesktopViewMode(
  current: DesktopViewMode,
  delta: number,
): DesktopViewMode {
  if (delta === 0) return current;
  const index = DESKTOP_VIEW_ORDER.indexOf(current);
  if (index === -1) return current;
  // Wheel up enlarges. The ends hold rather than wrapping — one notch past 큰
  // 아이콘 must not drop back to 작은 아이콘.
  const next = index + (delta < 0 ? 1 : -1);
  return DESKTOP_VIEW_ORDER[Math.min(DESKTOP_VIEW_ORDER.length - 1, Math.max(0, next))];
}
