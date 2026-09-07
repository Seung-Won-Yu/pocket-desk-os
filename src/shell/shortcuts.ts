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
      { action: "이름 바꾸기", keys: "F2" },
      { action: "뒤로 · 앞으로 · 위로", keys: "Alt + ←/→/↑" },
    ],
    title: "파일 탐색기",
  },
];
