import { type AppId } from "../types";

export const APP_BAR_HEIGHT = 48;
export const DESKTOP_ICON_WIDTH = 86;
export const DESKTOP_ICON_HEIGHT = 94;
export const CONTEXT_MENU_WIDTH = 220;
export const CONTEXT_MENU_HEIGHT = 260;
export const WINDOW_SYSTEM_MENU_WIDTH = 214;
export const WINDOW_SYSTEM_MENU_HEIGHT = 220;
export const NOTE_KEY = "pocket-desk-note";
export const LEGACY_DEFAULT_NOTE_CONTENT =
  "PocketDesk 메모장\n\n여기에 내용을 적고 저장하면 브라우저 로컬 저장소와 IndexedDB 파일 시스템에 남습니다.";
export const NOTE_SAVE_EVENT = "pocket-desk-save-note";
export const NOTE_OPEN_EVENT = "pocket-desk-open-note";
export const NOTE_SAVE_AS_EVENT = "pocket-desk-save-note-as";
export const PAINT_SAVE_EVENT = "pocket-desk-save-paint";
/* Undo and redo reach the canvas the same way save does: the window frame holds
   focus, not the app, so a key handler inside the app never sees them. */
export const PAINT_UNDO_EVENT = "pocket-desk-undo-paint";
export const PAINT_REDO_EVENT = "pocket-desk-redo-paint";
export const PAINT_OPEN_EVENT = "pocket-desk-open-paint";
export const PAINT_SAVE_AS_EVENT = "pocket-desk-save-paint-as";
export const VFS_PRIMARY_NOTE_ID = "vfs-notes";
export const VFS_PRIMARY_CANVAS_ID = "vfs-sketch";
export const WALLPAPER_KEY = "pocket-desk-wallpaper-v2";
export const WINDOW_STATE_KEY = "pocket-desk-windows-v1";
export const DESKTOP_ICON_LAYOUT_KEY = "pocket-desk-icons-v2";
export const DESKTOP_ICON_VIEW_KEY = "pocket-desk-icon-view-v1";
export const DESKTOP_ICON_SORT_KEY = "pocket-desk-icon-sort-v1";
export const DESKTOP_ICON_GRID_KEY = "pocket-desk-icon-grid-v1";
export const DESKTOP_ITEMS_KEY = "pocket-desk-desktop-items-v1";
export const SOUND_VOLUME_KEY = "pocket-desk-volume-v1";
export const SOUND_ENABLED_KEY = "pocket-desk-sound-enabled-v1";
export const DISPLAY_BRIGHTNESS_KEY = "pocket-desk-display-brightness-v1";
export const TASKBAR_PINNED_APPS_KEY = "pocket-desk-taskbar-pinned-v2";
export const VFS_DRAG_MIME = "application/x-pocketdesk-vfs";
export const ACTIVE_DESKTOP_KEY = "pocket-desk-active-desktop-v1";
export const EVENT_LOG_KEY = "pocket-desk-event-log-v1";
export const START_PINNED_APPS_KEY = "pocket-desk-start-pins-v1";
/** Records the shell keeps before the oldest falls off, like a Windows log's size cap. */
export const EVENT_LOG_LIMIT = 200;
export const NOTIFICATION_HISTORY_KEY = "pocket-desk-notifications-v1";
/** How many notifications the action centre keeps — and shows. */
export const NOTIFICATION_HISTORY_LIMIT = 12;
export const VIRTUAL_DESKTOPS_KEY = "pocket-desk-virtual-desktops-v1";
export const USER_NAME_KEY = "pocket-desk-user-name-v1";
export const CLOCK_24H_KEY = "pocket-desk-clock-24h-v1";
export const DEFAULT_APPS_KEY = "pocket-desk-default-apps-v1";
export const DEFAULT_USER_NAME = "PocketDesk";
export const MAX_VIRTUAL_DESKTOPS = 6;
export const SNAP_EDGE_SIZE = 24;
export const SNAP_CORNER_SIZE = 72;
export const WINDOW_EXIT_MOTION_MS = 170;
export const appSearchKeywords: Record<AppId, string[]> = {
  thispc: [
    "this pc",
    "my computer",
    "computer",
    "pc",
    "내 pc",
    "내컴퓨터",
    "컴퓨터",
    "드라이브",
    "disk",
  ],
  browser: ["internet", "web", "edge", "인터넷", "웹", "브라우저", "검색", "google", "url"],
  minesweeper: ["mine", "field", "mines", "minesweeper", "지뢰", "지뢰찾기", "게임", "폭탄"],
  photos: ["photo", "photos", "image", "picture", "사진", "이미지", "그림 보기", "뷰어"],
  terminal: [
    "cmd",
    "command",
    "prompt",
    "shell",
    "terminal",
    "명령",
    "명령프롬프트",
    "터미널",
    "콘솔",
  ],
  eventviewer: ["event", "viewer", "log", "이벤트", "이벤트뷰어", "로그", "기록"],
  registry: ["registry", "regedit", "레지스트리", "편집기", "설정값"],
  taskmanager: [
    "task",
    "manager",
    "taskmgr",
    "process",
    "작업",
    "작업관리자",
    "프로세스",
    "성능",
    "cpu",
  ],
  calculator: ["calc", "calculator", "계산", "계산기", "수학", "사칙연산"],
  paint: ["paint", "sketch", "draw", "그림", "그림판", "스케치", "드로잉", "캔버스"],
  notepad: ["note", "notes", "memo", "txt", "메모", "메모장", "문서", "글쓰기"],
  files: ["file", "files", "folder", "explorer", "파일", "폴더", "탐색기", "desktop"],
  recycle: ["recycle", "trash", "bin", "deleted", "휴지통", "삭제", "복원", "비우기"],
  settings: ["setting", "settings", "control", "theme", "wallpaper", "설정", "테마", "배경"],
};

export const runCommandAliases: Partial<Record<AppId, string[]>> = {
  thispc: ["computer", "this pc", "my computer", "내 pc", "내컴퓨터"],
  browser: ["edge", "iexplore", "msedge", "chrome", "www"],
  calculator: ["calc", "calc.exe", "calculator"],
  photos: ["photo", "photos", "사진", "사진 앱"],
  terminal: ["cmd", "cmd.exe", "command", "powershell", "terminal", "명령 프롬프트"],
  taskmanager: ["taskmgr", "taskmgr.exe", "task manager", "작업 관리자"],
  eventviewer: ["eventvwr", "eventvwr.msc", "event viewer", "이벤트 뷰어"],
  registry: ["regedit", "regedit.exe", "레지스트리 편집기"],
  files: ["explorer", "explorer.exe", "file explorer", "files"],
  notepad: ["notepad", "notepad.exe"],
  paint: ["mspaint", "mspaint.exe", "paint"],
  recycle: ["recycle bin", "trash", "bin"],
  settings: ["control", "control.exe", "control panel", "settings"],
};

export const runCommandSuggestions = [
  { command: "computer", label: "computer" },
  { command: "explorer", label: "explorer" },
  { command: "calc", label: "calc" },
  { command: "cmd", label: "cmd" },
  { command: "taskmgr", label: "taskmgr" },
  { command: "notepad", label: "notepad" },
  { command: "mspaint", label: "mspaint" },
  { command: "recycle", label: "recycle" },
  { command: "https://example.com", label: "url" },
];

/** Pointer travel before a title-bar drag un-maximizes a window, as Windows does. */
export const WINDOW_DRAG_THRESHOLD = 5;

/** Pixels one arrow press moves a window in the keyboard 이동 / 크기 조정 mode. */
export const WINDOW_KEYBOARD_STEP = 10;
