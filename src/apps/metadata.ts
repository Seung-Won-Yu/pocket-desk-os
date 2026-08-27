import {
  Activity,
  Bomb,
  Calculator,
  FileText,
  Folder,
  Globe2,
  Image,
  Monitor,
  Paintbrush,
  Settings,
  SquareTerminal,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { AppId } from "../types";

export type AppMetadata = {
  accent: string;
  defaultSize: { width: number; height: number };
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
  "paint",
  "notepad",
  "files",
  "photos",
  "terminal",
  "taskmanager",
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
  },
  browser: {
    id: "browser",
    title: "Microsoft Edge",
    subtitle: "웹 검색 및 사이트 열기",
    icon: Globe2,
    accent: "#43b0f1",
    defaultSize: { width: 860, height: 560 },
  },
  minesweeper: {
    id: "minesweeper",
    title: "지뢰찾기",
    subtitle: "난이도별 지뢰찾기",
    icon: Bomb,
    accent: "#f6b44b",
    defaultSize: { width: 440, height: 560 },
  },
  calculator: {
    id: "calculator",
    title: "계산기",
    subtitle: "키보드와 공학 모드 계산기",
    icon: Calculator,
    accent: "#7bc96f",
    defaultSize: { width: 400, height: 570 },
  },
  paint: {
    id: "paint",
    title: "그림판",
    subtitle: "캔버스 그림판",
    icon: Paintbrush,
    accent: "#ef6f6c",
    defaultSize: { width: 820, height: 560 },
  },
  notepad: {
    id: "notepad",
    title: "메모장",
    subtitle: "로컬 저장 메모장",
    icon: FileText,
    accent: "#f2d16b",
    defaultSize: { width: 600, height: 520 },
  },
  files: {
    id: "files",
    title: "파일 탐색기",
    subtitle: "가상 파일 탐색기",
    icon: Folder,
    accent: "#f3c64d",
    defaultSize: { width: 900, height: 600 },
  },
  photos: {
    id: "photos",
    title: "사진",
    subtitle: "이미지 보기와 확대",
    icon: Image,
    accent: "#6fc3ff",
    defaultSize: { width: 820, height: 600 },
  },
  terminal: {
    id: "terminal",
    title: "명령 프롬프트",
    subtitle: "가상 파일 시스템 셸",
    icon: SquareTerminal,
    accent: "#5ac8b0",
    defaultSize: { width: 780, height: 520 },
  },
  taskmanager: {
    id: "taskmanager",
    title: "작업 관리자",
    subtitle: "실행 중인 앱과 자원 사용량",
    icon: Activity,
    accent: "#ff9f6b",
    defaultSize: { width: 720, height: 560 },
  },
  recycle: {
    id: "recycle",
    title: "휴지통",
    subtitle: "삭제 항목 복원과 영구 비우기",
    icon: Trash2,
    accent: "#9bb7c9",
    defaultSize: { width: 720, height: 520 },
  },
  settings: {
    id: "settings",
    title: "설정",
    subtitle: "테마와 배경",
    icon: Settings,
    accent: "#b99cff",
    defaultSize: { width: 840, height: 610 },
  },
};
