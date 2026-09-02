import {
  Activity,
  AlarmClock,
  Bomb,
  Calculator,
  Database,
  FileText,
  Folder,
  Globe2,
  Image,
  Monitor,
  Paintbrush,
  ScrollText,
  Settings,
  SquareTerminal,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { AppId } from "../types";

export type AppMetadata = {
  accent: string;
  defaultSize: { width: number; height: number };
  /**
   * Smallest size the app's own UI stays usable at, the way a Windows app
   * declares a minimum track size. A single shared floor let the calculator be
   * shrunk until its whole keypad was outside the window and unreachable.
   */
  minSize?: { width: number; height: number };
  /**
   * Whether a second window of this app is safe to open. Notepad, Paint and
   * Photos read their document from one shell-level id, so two windows show the
   * same file and the autosave of one silently overwrote the unsaved text of
   * the other. Only apps whose per-window state is genuinely window-local opt
   * in — the same rule the session restore uses to deduplicate windows.
   */
  multiInstance?: boolean;
  icon: LucideIcon;
  id: AppId;
  subtitle: string;
  title: string;
};

export const appOrder: AppId[] = [
  "thispc",
  "browser",
  "minesweeper",
  "calculator",
  "clock",
  "stickynotes",
  "paint",
  "notepad",
  "files",
  "photos",
  "terminal",
  "taskmanager",
  "eventviewer",
  "registry",
  "recycle",
  "settings",
];

export const appMetadata: Record<AppId, AppMetadata> = {
  thispc: {
    id: "thispc",
    title: "내 PC",
    subtitle: "드라이브와 기본 폴더",
    icon: Monitor,
    accent: "#8fc9ff",
    defaultSize: { width: 780, height: 560 },
    minSize: { width: 520, height: 360 },
  },
  browser: {
    id: "browser",
    title: "Microsoft Edge",
    subtitle: "웹 검색 및 사이트 열기",
    icon: Globe2,
    accent: "#43b0f1",
    defaultSize: { width: 860, height: 560 },
    minSize: { width: 560, height: 360 },
  },
  minesweeper: {
    id: "minesweeper",
    title: "지뢰찾기",
    subtitle: "난이도별 지뢰찾기",
    icon: Bomb,
    accent: "#f6b44b",
    defaultSize: { width: 440, height: 560 },
    minSize: { width: 360, height: 460 },
  },
  calculator: {
    id: "calculator",
    title: "계산기",
    subtitle: "키보드와 공학 모드 계산기",
    icon: Calculator,
    accent: "#7bc96f",
    defaultSize: { width: 400, height: 570 },
    minSize: { width: 330, height: 520 },
  },
  clock: {
    id: "clock",
    title: "알람 및 시계",
    subtitle: "알람, 타이머와 스톱워치",
    icon: AlarmClock,
    accent: "#5ab7c4",
    defaultSize: { width: 520, height: 640 },
    minSize: { width: 420, height: 520 },
  },
  stickynotes: {
    id: "stickynotes",
    title: "스티커 메모",
    subtitle: "바탕 화면에 붙이는 색색의 메모",
    icon: StickyNote,
    accent: "#e8c447",
    defaultSize: { width: 280, height: 280 },
    minSize: { width: 200, height: 180 },
    multiInstance: true,
  },
  paint: {
    id: "paint",
    title: "그림판",
    subtitle: "캔버스 그림판",
    icon: Paintbrush,
    accent: "#ef6f6c",
    defaultSize: { width: 820, height: 560 },
    minSize: { width: 620, height: 440 },
  },
  notepad: {
    id: "notepad",
    title: "메모장",
    subtitle: "로컬 저장 메모장",
    icon: FileText,
    accent: "#f2d16b",
    defaultSize: { width: 600, height: 520 },
    minSize: { width: 400, height: 300 },
  },
  files: {
    multiInstance: true,
    id: "files",
    title: "파일 탐색기",
    subtitle: "가상 파일 탐색기",
    icon: Folder,
    accent: "#f3c64d",
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 620, height: 380 },
  },
  photos: {
    id: "photos",
    title: "사진",
    subtitle: "이미지 보기와 확대",
    icon: Image,
    accent: "#6fc3ff",
    defaultSize: { width: 820, height: 600 },
    minSize: { width: 480, height: 380 },
  },
  terminal: {
    multiInstance: true,
    id: "terminal",
    title: "명령 프롬프트",
    subtitle: "가상 파일 시스템 셸",
    icon: SquareTerminal,
    accent: "#5ac8b0",
    defaultSize: { width: 780, height: 520 },
    minSize: { width: 360, height: 260 },
  },
  taskmanager: {
    id: "taskmanager",
    title: "작업 관리자",
    subtitle: "실행 중인 앱과 자원 사용량",
    icon: Activity,
    accent: "#ff9f6b",
    defaultSize: { width: 720, height: 560 },
    minSize: { width: 480, height: 360 },
  },
  eventviewer: {
    id: "eventviewer",
    title: "이벤트 뷰어",
    subtitle: "파일과 앱 활동 기록",
    icon: ScrollText,
    accent: "#9db4d0",
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 640, height: 420 },
  },
  registry: {
    id: "registry",
    title: "레지스트리 편집기",
    subtitle: "저장된 설정 값 편집",
    icon: Database,
    accent: "#c9a2f0",
    defaultSize: { width: 880, height: 580 },
    minSize: { width: 620, height: 400 },
  },
  recycle: {
    id: "recycle",
    title: "휴지통",
    subtitle: "삭제 항목 복원과 영구 비우기",
    icon: Trash2,
    accent: "#9bb7c9",
    defaultSize: { width: 720, height: 520 },
    minSize: { width: 520, height: 360 },
  },
  settings: {
    id: "settings",
    title: "설정",
    subtitle: "테마와 배경",
    icon: Settings,
    accent: "#b99cff",
    defaultSize: { width: 840, height: 610 },
    minSize: { width: 620, height: 440 },
  },
};
