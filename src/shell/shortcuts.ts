import { getTaskbarNumberKey } from "./taskbarOrder";
/**
 * The keyboard the shell actually listens for. One list, so 설정 shows exactly
 * what App.tsx handles rather than a hand-copied menu that drifts.
 */
export interface ShortcutGroup {
  items: Array<{ action: string; keys: string }>;
  title: string;
}

export const SHELL_SHORTCUTS: ShortcutGroup[] = [
  {
    items: [
      { action: "시작 메뉴 열기", keys: "Win" },
      { action: "실행", keys: "Ctrl + Alt + R" },
      { action: "파일 탐색기", keys: "Win + E" },
      { action: "설정", keys: "Win + I" },
      { action: "화면 캡처 도구", keys: "Win + Shift + S" },
      { action: "화면 잠금", keys: "Win + L" },
      { action: "작업 관리자", keys: "Ctrl + Shift + Esc" },
      { action: "작업 표시줄 n번째 앱 (없으면 실행, 여러 창이면 차례로)", keys: "Win + 1~9" },
      { action: "작업 표시줄 n번째 앱의 새 창", keys: "Win + Shift + 1~9" },
    ],
    title: "셸",
  },
  {
    items: [
      { action: "창 전환", keys: "Alt + Tab" },
      { action: "작업 보기", keys: "Win + Tab" },
      { action: "현재 창 닫기", keys: "Alt + F4" },
      { action: "창 시스템 메뉴", keys: "Alt + Space" },
      { action: "모든 창 최소화", keys: "Win + M" },
      { action: "바탕 화면 보기", keys: "Win + D" },
    ],
    title: "창",
  },
  {
    items: [
      { action: "창 스냅 (절반 → 사분면 → 최대화 → 복원)", keys: "Win + ←/→/↑/↓" },
      { action: "스냅 레이아웃 열기 (3분할·4분할 포함)", keys: "Win + Z" },
      { action: "현재 창 스냅", keys: "Ctrl + Alt + ←/→/↑" },
      { action: "가상 데스크톱 전환", keys: "Ctrl + Win + ←/→" },
    ],
    title: "배치",
  },
  {
    items: [
      { action: "전체 화면 캡처", keys: "PrintScreen" },
      { action: "활성 창 캡처", keys: "Alt + PrintScreen" },
    ],
    title: "캡처",
  },
  {
    items: [
      { action: "경로 입력", keys: "Ctrl + L" },
      { action: "모두 선택 · 복사 · 잘라내기 · 붙여넣기", keys: "Ctrl + A / C / X / V" },
      { action: "파일 작업 실행 취소 · 다시 실행", keys: "Ctrl + Z / Ctrl + Y" },
      { action: "이름 바꾸기", keys: "F2" },
      { action: "새 폴더", keys: "Ctrl + Shift + N" },
      { action: "속성", keys: "Alt + Enter" },
      { action: "뒤로 · 앞으로 · 위로", keys: "Alt + ←/→/↑" },
      { action: "새 탭 · 탭 닫기", keys: "Ctrl + T / W" },
      { action: "다음 · 이전 탭", keys: "Ctrl + Tab / Ctrl + Shift + Tab" },
    ],
    title: "파일 탐색기",
  },
  {
    items: [
      { action: "찾기 · 바꾸기", keys: "Ctrl + F / Ctrl + H" },
      { action: "다음 · 이전 찾기", keys: "F3 / Shift + F3" },
    ],
    title: "메모장",
  },
];

/**
 * Chords the shell owns. On Windows a Win-modified key never reaches the app —
 * 메모장 was taking Win+Shift+S as its own 다른 이름으로 저장 and stopping the
 * event, so the capture tool never opened while a text field had focus.
 *
 * In a browser the Win key arrives as `metaKey`, which is also macOS's Cmd, so
 * an app that reads Cmd as its Ctrl has to step aside for these.
 */
export function isShellReservedChord(event: {
  altKey: boolean;
  code?: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}) {
  if (event.key === "PrintScreen") return true;
  if (event.ctrlKey && event.shiftKey && event.key === "Escape") return true;
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "r") return true;
  if (!event.metaKey || event.ctrlKey || event.altKey) return false;
  const key = event.key.toLowerCase();
  if (event.key === "Tab") return true;
  if (event.key.startsWith("Arrow")) return true;
  // Win+1…9 addresses the taskbar, so an app must not take the digit either.
  // Read off the physical key: Shift turns 1 into "!".
  if (getTaskbarNumberKey(event) !== null) return true;
  if (event.shiftKey) return key === "s";
  return ["d", "e", "i", "l", "m", "z"].includes(key);
}
