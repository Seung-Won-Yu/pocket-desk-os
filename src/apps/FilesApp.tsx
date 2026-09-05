import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bomb,
  Check,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  FolderOutput,
  FolderSymlink,
  Grid2X2,
  House,
  Info,
  LayoutGrid,
  List,
  Monitor,
  Paintbrush,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Trash2,
  Upload,
  Wallpaper,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type React from "react";
import AppIconTile from "../components/AppIconTile";
import { VFS_DRAG_MIME } from "../shell/constants";
import {
  isLocalFolderAccessAvailable,
  pickLocalDirectory,
  readLocalFolder,
  writeLocalFolder,
} from "../vfs/localFolder";
import { trapDialogFocus } from "../shell/dialogFocus";
import type { AppId, ClipboardMode, DesktopItem, SystemClipboard, ToastInput } from "../types";
import {
  clamp,
  formatStorageSize,
  formatVfsEntrySize,
  formatVfsPropertyDate,
  getVfsEntrySize,
  normalizeSearchText,
  splitSearchMatch,
} from "../utils/format";
import {
  VFS_DOCUMENTS_ID,
  VFS_DOWNLOADS_ID,
  VFS_GAMES_ID,
  VFS_PICTURES_ID,
  VFS_ROOT_ID,
  formatDesktopItemTime,
  getVfsEntryAssociation,
  getVfsEntryDetail,
  getVfsFolderPath,
  getVfsNameParts,
  getVfsTopLevelIds,
  hasForbiddenVfsNameChar,
  isVfsSystemFolderId,
} from "../vfs/model";
import { formatVfsPathText, resolveVfsPathText } from "../vfs/pathInput";
import { handleMenuKeyboard } from "../shell/keyboardNav";

type FileSortDirection = "asc" | "desc";
type FileSortKey = "name" | "type" | "modified" | "size";
type FileViewMode = "details" | "list" | "icons";

type FileContextMenuState = {
  /** `null` targets the folder background rather than one entry. */
  fileId: string | null;
  /** Fly submenus out to the left when the menu sits near the right edge. */
  opensLeft?: boolean;
  x: number;
  y: number;
};

type FileFolderSubmenu = "new" | "sort" | "view";

export type FilesLaunchRequest = {
  folderId: string;
  id: string;
  windowId: string;
};

type FilesAppProps = {
  clipboard: SystemClipboard;
  copyToClipboard: (itemIds: string[], mode?: ClipboardMode) => void;
  pasteFromClipboard: (parentId: string) => string[];
  createVfsFolder: (parentId?: string, name?: string) => DesktopItem;
  onImportLocalEntries: (entries: DesktopItem[]) => void;
  createVfsTextFile: (parentId?: string) => DesktopItem;
  deleteVfsEntry: (itemId: string) => void;
  desktopItems: DesktopItem[];
  exportVfsZip: () => void;
  filesLaunchRequest: FilesLaunchRequest | null;
  importVfsZip: (file: File) => Promise<void>;
  moveVfsEntries: (itemIds: string[], parentId: string) => boolean;
  notify: (toast: ToastInput) => void;
  openApp: (appId: AppId) => void;
  openNewAppWindow: (appId: AppId) => string;
  openVfsEntry: (item: DesktopItem) => void;
  renameVfsEntry: (itemId: string, name: string) => void;
  setCustomWallpaper: (itemId: string | null) => void;
  reportDocument: (
    windowId: string,
    ref: { itemId?: string; title?: string } | undefined,
  ) => void;
  windowId: string;
};

const APP_BAR_HEIGHT = 48;
const FILE_EXPLORER_SORT_KEY = "pocket-desk-explorer-sort-v1";
const FILE_EXPLORER_SORT_DIRECTION_KEY = "pocket-desk-explorer-sort-direction-v1";
const FILE_EXPLORER_VIEW_KEY = "pocket-desk-explorer-view-v1";
// The command strip and the folder background menu offer the same choices, so
// they read from one table instead of drifting apart.
const FILE_SORT_OPTIONS: Array<[FileSortKey, string]> = [
  ["name", "이름"],
  ["type", "항목 유형"],
  ["modified", "수정한 날짜"],
];
const FILE_SORT_DIRECTION_OPTIONS: Array<[FileSortDirection, string]> = [
  ["asc", "오름차순"],
  ["desc", "내림차순"],
];
const FILE_VIEW_OPTIONS: Array<[FileViewMode, string]> = [
  ["details", "자세히"],
  ["list", "목록"],
  ["icons", "큰 아이콘"],
];
// What a menu needs to stay on screen: 204px of menu width plus a margin, that
// again with its 190px submenu beside it, and the height of the rows each of the
// two menus carries.
const FILE_COLUMNS: [FileSortKey, string][] = [
  ["name", "이름"],
  ["modified", "수정한 날짜"],
  ["type", "유형"],
  ["size", "크기"],
];

const FILE_CONTEXT_MENU_RESERVE_X = 212;
const FILE_FOLDER_MENU_RESERVE_X = 410;
const FILE_CONTEXT_MENU_RESERVE_Y = 226;
const FILE_FOLDER_MENU_RESERVE_Y = 214;

/** The first lines of a text file for the details pane, the way the Windows preview pane shows them. */
export const TEXT_PREVIEW_LINES = 14;
export function getTextPreview(content: string) {
  const lines = content.split("\n");
  const shown = lines.slice(0, TEXT_PREVIEW_LINES).join("\n");
  return lines.length > TEXT_PREVIEW_LINES ? `${shown}\n…` : shown;
}

export default function FilesApp({
  reportDocument,
  clipboard,
  copyToClipboard,
  pasteFromClipboard,
  createVfsFolder,
  onImportLocalEntries,
  createVfsTextFile,
  deleteVfsEntry,
  desktopItems,
  exportVfsZip,
  filesLaunchRequest,
  importVfsZip,
  moveVfsEntries,
  notify,
  openApp,
  openNewAppWindow,
  openVfsEntry,
  renameVfsEntry,
  setCustomWallpaper,
  windowId,
}: FilesAppProps) {
  const fileListRef = useRef<HTMLDivElement | null>(null);
  const fileContextMenuRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const newControlRef = useRef<HTMLDivElement | null>(null);
  const cancelRenameRef = useRef(false);
  const propertiesConfirmRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  // Windows lets you read the path, type another, and press Enter. The
  // breadcrumbs alone could only be clicked.
  const [addressDraft, setAddressDraft] = useState<string | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const typeAheadRef = useRef({ at: 0, query: "" });
  const sortControlRef = useRef<HTMLDivElement | null>(null);
  const [navigationHistory, setNavigationHistory] = useState([VFS_ROOT_ID]);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [sortKey, setSortKey] = useState<FileSortKey>(() => {
    const stored = localStorage.getItem(FILE_EXPLORER_SORT_KEY);
    return stored === "type" || stored === "modified" ? stored : "name";
  });
  const [sortDirection, setSortDirection] = useState<FileSortDirection>(() =>
    localStorage.getItem(FILE_EXPLORER_SORT_DIRECTION_KEY) === "desc" ? "desc" : "asc",
  );
  const [viewMode, setViewMode] = useState<FileViewMode>(() => {
    const stored = localStorage.getItem(FILE_EXPLORER_VIEW_KEY);
    return stored === "list" || stored === "icons" ? stored : "details";
  });
  const [sortOpen, setSortOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  // Off by default, like the Windows preview pane: it costs 248px of a 900px
  // window, which is width the file list needs more than the summary does.
  const [detailsPaneOpen, setDetailsPaneOpen] = useState(false);
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null);
  const [folderSubmenu, setFolderSubmenu] = useState<FileFolderSubmenu | null>(null);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [propertiesFileId, setPropertiesFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const currentFolderId = navigationHistory[navigationIndex] ?? VFS_ROOT_ID;
  const folderPath = useMemo(
    () => getVfsFolderPath(desktopItems, currentFolderId),
    [currentFolderId, desktopItems],
  );

  useEffect(() => {
    if (addressDraft === null) return;
    const input = addressInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [addressDraft === null]);
  const locationLabel = folderPath[folderPath.length - 1]?.name ?? "바탕 화면";

  useEffect(() => {
    // Windows titles an Explorer window after the folder it shows, which is
    // also what tells two Explorer windows apart in Alt+Tab and the preview.
    reportDocument(
      windowId,
      currentFolderId === VFS_ROOT_ID ? { title: "바탕 화면" } : { itemId: currentFolderId },
    );
  }, [currentFolderId, reportDocument, windowId]);

  const locationItems = useMemo(() => {
    return desktopItems.filter((item) => !item.trashed && item.parentId === currentFolderId);
  }, [currentFolderId, desktopItems]);
  const files = useMemo(
    () =>
      locationItems.map((item) => {
        const association = getVfsEntryAssociation(item);
        return {
          association,
          detail: getVfsEntryDetail(item),
          icon: association.icon,
          id: item.id,
          item,
          name: item.name,
          modified: formatDesktopItemTime(item.updatedAt),
          type: association.typeLabel,
          updatedAt: item.updatedAt,
        };
      }),
    [locationItems],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** Bytes the selection holds; Windows shows this beside the count. */
  const selectedSize = useMemo(
    () =>
      desktopItems
        .filter((item) => selectedIds.includes(item.id))
        .reduce((total, item) => total + getVfsEntrySize(item), 0),
    [desktopItems, selectedIds],
  );
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const filteredFiles = useMemo(() => {
    const normalizedQuery = normalizeSearchText(fileQuery);
    if (!normalizedQuery) return files;
    return files.filter((file) =>
      [file.name, file.type, file.detail, file.association.appTitle]
        .map(normalizeSearchText)
        .some((field) => field.includes(normalizedQuery)),
    );
  }, [fileQuery, files]);
  const visibleFiles = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredFiles].sort((first, second) => {
      if (first.item.kind === "folder" && second.item.kind !== "folder") return -1;
      if (first.item.kind !== "folder" && second.item.kind === "folder") return 1;
      let order = 0;
      if (sortKey === "modified") order = first.updatedAt - second.updatedAt;
      if (sortKey === "size") {
        order = getVfsEntrySize(first.item) - getVfsEntrySize(second.item);
      }
      if (sortKey === "type") {
        order = first.type.localeCompare(second.type, "ko", {
          numeric: true,
          sensitivity: "base",
        });
      }
      if (sortKey === "name" || order === 0) {
        order = first.name.localeCompare(second.name, "ko", {
          numeric: true,
          sensitivity: "base",
        });
      }
      return order * direction;
    });
  }, [filteredFiles, sortDirection, sortKey]);
  const selectedFile =
    visibleFiles.find((file) => file.id === activeFileId && selectedIds.includes(file.id)) ??
    visibleFiles.find((file) => selectedIds.includes(file.id));
  const propertiesFile = files.find((file) => file.id === propertiesFileId);
  /*
   * The clamp above budgets a constant for the menu's height, and a constant
   * can only guess: the file menu renders 282px tall against a 226px reserve,
   * so its last rows — 속성 among them — sat under the taskbar and could not be
   * clicked at all. Measure the menu that actually rendered and lift it.
   */
  useLayoutEffect(() => {
    const menu = fileContextMenuRef.current;
    if (!menu || !fileContextMenu) return;

    const rect = menu.getBoundingClientRect();
    const limit = window.innerHeight - APP_BAR_HEIGHT - 8;
    const overflow = rect.bottom - limit;
    if (overflow <= 0) return;

    const shift = Math.min(overflow, Math.max(0, rect.top - 8));
    if (shift <= 0) return;
    setFileContextMenu((current) => (current ? { ...current, y: current.y - shift } : current));
  }, [fileContextMenu]);

  const contextFile = files.find((file) => file.id === fileContextMenu?.fileId);
  const selectedHasSystemFolder = selectedIds.some(isVfsSystemFolderId);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(selectedFile?.name ?? "");
  const [importing, setImporting] = useState(false);
  const [localFolderBusy, setLocalFolderBusy] = useState(false);
  // Local-only: the deployed origin never offers this.
  const localFolderAvailable = useMemo(() => isLocalFolderAccessAvailable(), []);

  useEffect(() => {
    const visibleIds = new Set(visibleFiles.map((file) => file.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
    setActiveFileId((current) =>
      current && visibleIds.has(current) ? current : (visibleFiles[0]?.id ?? null),
    );
  }, [visibleFiles]);

  useEffect(() => {
    if (
      currentFolderId === VFS_ROOT_ID ||
      desktopItems.some(
        (item) => item.id === currentFolderId && item.kind === "folder" && !item.trashed,
      )
    ) {
      return;
    }
    setNavigationHistory((current) => [...current.slice(0, navigationIndex + 1), VFS_ROOT_ID]);
    setNavigationIndex((current) => current + 1);
  }, [currentFolderId, desktopItems, navigationIndex]);

  useEffect(() => {
    localStorage.setItem(FILE_EXPLORER_SORT_KEY, sortKey);
  }, [sortKey]);

  useEffect(() => {
    localStorage.setItem(FILE_EXPLORER_SORT_DIRECTION_KEY, sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    localStorage.setItem(FILE_EXPLORER_VIEW_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!sortOpen && !newOpen) return;

    const closeOnOutsidePointer = (event: Event) => {
      if (event.target instanceof Node && !sortControlRef.current?.contains(event.target)) {
        setSortOpen(false);
      }
      if (event.target instanceof Node && !newControlRef.current?.contains(event.target)) {
        setNewOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNewOpen(false);
      setSortOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [newOpen, sortOpen]);

  useEffect(() => {
    if (!fileContextMenu && !propertiesFileId) return;
    const closeOnOutsidePointer = (event: Event) => {
      if (
        fileContextMenu &&
        event.target instanceof Node &&
        !fileContextMenuRef.current?.contains(event.target)
      ) {
        setFileContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFileContextMenu(null);
      setPropertiesFileId(null);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [fileContextMenu, propertiesFileId]);

  useEffect(() => {
    if (!propertiesFileId) return;
    const windowContent = propertiesConfirmRef.current?.closest<HTMLElement>(".window-content");
    if (windowContent) {
      windowContent.scrollLeft = 0;
      windowContent.scrollTop = 0;
    }
    const focusFrame = window.requestAnimationFrame(() => {
      propertiesConfirmRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [propertiesFileId]);

  useEffect(() => {
    setDraftName(selectedFile?.name ?? "");
    if (selectedFile?.id === pendingRenameId) {
      setRenaming(true);
      setPendingRenameId(null);
    } else {
      setRenaming(false);
    }
  }, [selectedFile?.id, selectedFile?.name]);

  useEffect(() => {
    if (!renaming) return;
    cancelRenameRef.current = false;
    const input = renameInputRef.current;
    if (!input) return;
    /*
     * Windows preselects the base name, leaving the extension in place. This
     * selected the whole string, so typing a new name over `g1.txt` produced a
     * file called `보고서` with no extension at all — and the extension is what
     * decides this shell's icon, file type and which app opens it.
     */
    const { base } = getVfsNameParts(input.value);
    input.setSelectionRange(0, base.length);
    input.focus();
  }, [renaming]);

  const focusFileList = () => {
    const focusActive = () => {
      const list = fileListRef.current;
      if (!list) return;
      const active = list.querySelector<HTMLElement>('[tabindex="0"]');
      (active ?? list).focus();
    };
    focusActive();
    window.requestAnimationFrame(focusActive);
  };

  const resetTransientState = () => {
    setSelectedIds([]);
    setActiveFileId(null);
    setFileQuery("");
    setRenaming(false);
    setNewOpen(false);
    setSortOpen(false);
    setFileContextMenu(null);
    setPropertiesFileId(null);
    selectionAnchorRef.current = null;
  };

  const navigateToFolder = (folderId: string) => {
    if (
      folderId !== VFS_ROOT_ID &&
      !desktopItems.some(
        (item) => item.id === folderId && item.kind === "folder" && !item.trashed,
      )
    ) {
      return;
    }
    if (folderId === currentFolderId) return;
    setNavigationHistory((current) => [...current.slice(0, navigationIndex + 1), folderId]);
    setNavigationIndex((current) => current + 1);
    resetTransientState();
  };

  const visitHistory = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= navigationHistory.length) return;
    setNavigationIndex(nextIndex);
    resetTransientState();
  };

  const navigateUp = () => {
    const parent = folderPath[folderPath.length - 2];
    if (parent) navigateToFolder(parent.id);
  };

  const openFile = (item: DesktopItem) => {
    if (item.kind === "folder") {
      navigateToFolder(item.id);
      return;
    }
    openVfsEntry(item);
  };

  useEffect(() => {
    if (!filesLaunchRequest || filesLaunchRequest.windowId !== windowId) return;
    navigateToFolder(filesLaunchRequest.folderId);
  }, [filesLaunchRequest?.id]);

  const getSelectedCommandIds = () =>
    getVfsTopLevelIds(
      desktopItems,
      selectedIds.length > 0 ? selectedIds : selectedFile ? [selectedFile.id] : [],
    );

  const copySelectedFiles = (
    itemIds = getSelectedCommandIds(),
    mode: ClipboardMode = "copy",
  ) => {
    const copyableIds = itemIds.filter((itemId) => !isVfsSystemFolderId(itemId));
    if (copyableIds.length === 0) return;
    copyToClipboard(copyableIds, mode);
    setFileContextMenu(null);
  };

  const pasteCopiedFiles = () => {
    const pastedIds = pasteFromClipboard(currentFolderId);
    if (pastedIds.length === 0) return;
    setSelectedIds(pastedIds);
    setActiveFileId(pastedIds[0] ?? null);
    selectionAnchorRef.current = pastedIds[0] ?? null;
    setFileContextMenu(null);
    focusFileList();
  };

  const createTextFile = () => {
    const item = createVfsTextFile(currentFolderId);
    setSelectedIds([item.id]);
    setActiveFileId(item.id);
    setPendingRenameId(item.id);
    selectionAnchorRef.current = item.id;
    setNewOpen(false);
    setFileContextMenu(null);
  };

  const createFolder = () => {
    const item = createVfsFolder(currentFolderId);
    setSelectedIds([item.id]);
    setActiveFileId(item.id);
    setPendingRenameId(item.id);
    selectionAnchorRef.current = item.id;
    setNewOpen(false);
    setFileContextMenu(null);
  };

  /**
   * Both menus are `position: fixed`, but the window frame's `backdrop-filter`
   * makes the frame their containing block, so `left`/`top` are frame-relative:
   * feeding them a viewport `clientX`/`clientY` put the menu one window offset
   * away from the pointer, and clamping against `window.innerHeight` measured a
   * box the menu does not live in — a window dragged down the screen could send
   * the whole menu below the viewport. Clamp in viewport space, where those
   * numbers mean something, then convert to the frame.
   */
  const getContextMenuPosition = (event: React.MouseEvent<HTMLElement>, menuHeight: number) => {
    const origin = event.currentTarget
      .closest<HTMLElement>(".window-frame")
      ?.getBoundingClientRect();
    return {
      x:
        clamp(event.clientX, 8, Math.max(8, window.innerWidth - FILE_CONTEXT_MENU_RESERVE_X)) -
        (origin?.left ?? 0),
      y:
        clamp(event.clientY, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - menuHeight)) -
        (origin?.top ?? 0),
    };
  };

  const showFileContextMenu = (event: React.MouseEvent<HTMLButtonElement>, fileId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedIds.includes(fileId)) {
      setSelectedIds([fileId]);
      selectionAnchorRef.current = fileId;
    }
    setActiveFileId(fileId);
    setRenaming(false);
    setFileContextMenu({
      fileId,
      ...getContextMenuPosition(event, FILE_CONTEXT_MENU_RESERVE_Y),
    });
  };

  /**
   * The folder background menu. Entry rows stop propagation in
   * `showFileContextMenu`, so anything that reaches here is background: the
   * empty area under the rows, the empty-folder placeholder, or the column
   * header. Without this the browser's own Reload / Inspect menu opened on top
   * of the desktop illusion.
   */
  const showFolderContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    // A rename box is a real text field, so it keeps the browser's editing menu.
    if (event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    setRenaming(false);
    setFolderSubmenu(null);
    setFileContextMenu({
      fileId: null,
      // The same edge test the desktop background menu makes, on the viewport
      // coordinate the pointer actually reported.
      opensLeft: event.clientX > window.innerWidth - FILE_FOLDER_MENU_RESERVE_X,
      ...getContextMenuPosition(event, FILE_FOLDER_MENU_RESERVE_Y),
    });
  };

  /**
   * Windows re-reads the folder here. This VFS is reactive, so the listing is
   * never stale; what is left of a refresh is the observable half — re-list the
   * location from scratch, which is the same transient-state reset navigation
   * does, then scroll back to the top and hand focus to the list.
   */
  const refreshFileList = () => {
    resetTransientState();
    if (fileListRef.current) fileListRef.current.scrollTop = 0;
    focusFileList();
  };

  const openFileProperties = (fileId: string) => {
    setFileContextMenu(null);
    setPropertiesFileId(fileId);
  };

  /*
   * Windows refuses these characters outright. Accepting them produced files
   * this shell could list but not open: renaming one to `a\\b.txt` left the
   * Command Prompt reading the backslash as a path separator, so `type` could
   * never find a file `dir` had just shown.
   */
  const commitRename = (fileId: string, name: string) => {
    if (hasForbiddenVfsNameChar(name)) {
      notify({
        detail: '파일 이름에 \\ / : * ? " < > | 문자를 사용할 수 없습니다.',
        title: "이름을 바꿀 수 없음",
      });
      return false;
    }
    renameVfsEntry(fileId, name);
    return true;
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || isVfsSystemFolderId(selectedFile.id)) return;
    cancelRenameRef.current = false;
    if (!commitRename(selectedFile.id, draftName)) return;
    setRenaming(false);
    focusFileList();
  };

  const deleteSelectedFiles = () => {
    const ids = getSelectedCommandIds().filter((itemId) => !isVfsSystemFolderId(itemId));
    if (ids.length === 0) return;
    ids.forEach(deleteVfsEntry);
    setRenaming(false);
    setFileContextMenu(null);
    setPropertiesFileId(null);
    setSelectedIds([]);
    setActiveFileId(null);
    selectionAnchorRef.current = null;
  };

  const startFileDrag = (event: React.DragEvent<HTMLButtonElement>, fileId: string) => {
    const draggedIds = getVfsTopLevelIds(
      desktopItems,
      selectedIds.includes(fileId) ? selectedIds : [fileId],
    ).filter((itemId) => !isVfsSystemFolderId(itemId));
    if (draggedIds.length === 0) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(VFS_DRAG_MIME, JSON.stringify(draggedIds));
    event.dataTransfer.setData("text/plain", draggedIds.join(","));
  };

  const dropFilesIntoFolder = (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverFolderId(null);
    const payload = event.dataTransfer.getData(VFS_DRAG_MIME);
    if (!payload) return;
    try {
      const itemIds = JSON.parse(payload);
      if (!Array.isArray(itemIds) || !itemIds.every((itemId) => typeof itemId === "string")) {
        return;
      }
      if (moveVfsEntries(itemIds, folderId)) {
        setSelectedIds([]);
        setActiveFileId(null);
      }
    } catch {
      setDragOverFolderId(null);
    }
  };

  const selectFile = (
    fileId: string,
    index: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = visibleFiles.findIndex(
        (file) => file.id === selectionAnchorRef.current,
      );
      if (anchorIndex >= 0) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);
        setSelectedIds(visibleFiles.slice(start, end + 1).map((file) => file.id));
      }
    } else if (event.ctrlKey || event.metaKey) {
      const next = selectedIds.includes(fileId)
        ? selectedIds.filter((id) => id !== fileId)
        : [...selectedIds, fileId];
      setSelectedIds(next);
      setActiveFileId(next.includes(fileId) ? fileId : (next[next.length - 1] ?? null));
      selectionAnchorRef.current = fileId;
      setRenaming(false);
      return;
    } else {
      setSelectedIds([fileId]);
      selectionAnchorRef.current = fileId;
    }
    setActiveFileId(fileId);
    setRenaming(false);
  };

  const handleFileListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        copySelectedFiles();
      } else if (key === "x") {
        event.preventDefault();
        copySelectedFiles(undefined, "cut");
      } else if (key === "v") {
        event.preventDefault();
        pasteCopiedFiles();
      } else if (key === "a") {
        event.preventDefault();
        const ids = visibleFiles.map((file) => file.id);
        setSelectedIds(ids);
        setActiveFileId(ids[0] ?? null);
        selectionAnchorRef.current = ids[0] ?? null;
      }
      return;
    }

    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      visitHistory(navigationIndex - 1);
      return;
    }
    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      visitHistory(navigationIndex + 1);
      return;
    }
    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault();
      navigateUp();
      return;
    }
    // Windows takes Backspace as "up one level" too, whenever the list has focus
    // and no rename box is open — the text-field guard above already returned.
    if (event.key === "Backspace") {
      event.preventDefault();
      navigateUp();
      return;
    }

    if (
      event.key === "F2" &&
      selectedFile &&
      selectedIds.length <= 1 &&
      !isVfsSystemFolderId(selectedFile.id)
    ) {
      event.preventDefault();
      setSelectedIds([selectedFile.id]);
      setActiveFileId(selectedFile.id);
      setRenaming(true);
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      deleteSelectedFiles();
      return;
    }
    if (event.key === "Enter" && selectedFile) {
      event.preventDefault();
      openFile(selectedFile.item);
      return;
    }
    /*
     * Typing jumps to the next item starting with that letter, the way every
     * Windows list does. Nothing happened before, so a long folder could only be
     * walked one arrow press at a time.
     */
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      visibleFiles.length > 0
    ) {
      const now = performance.now();
      const prefix =
        now - typeAheadRef.current.at < 900
          ? typeAheadRef.current.query + event.key.toLowerCase()
          : event.key.toLowerCase();
      typeAheadRef.current = { at: now, query: prefix };

      const startIndex = Math.max(
        0,
        visibleFiles.findIndex((file) => file.id === activeFileId),
      );
      // Repeating one letter steps through the matches rather than sticking on
      // the first, which is what Windows does.
      const offsetStart = prefix.length === 1 ? startIndex + 1 : startIndex;
      const ordered = [
        ...visibleFiles.slice(offsetStart),
        ...visibleFiles.slice(0, offsetStart),
      ];
      const match = ordered.find((file) => file.item.name.toLowerCase().startsWith(prefix));
      if (match) {
        event.preventDefault();
        setActiveFileId(match.id);
        setSelectedIds([match.id]);
        selectionAnchorRef.current = match.id;
        return;
      }
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const edgeIndex = event.key === "Home" ? 0 : visibleFiles.length - 1;
      const edge = visibleFiles[edgeIndex];
      if (!edge) return;
      setActiveFileId(edge.id);
      // Shift+Home/End select everything between the anchor and that end,
      // matching Explorer; they used to collapse the selection to one item.
      if (event.shiftKey && selectionAnchorRef.current) {
        const anchorIndex = visibleFiles.findIndex(
          (file) => file.id === selectionAnchorRef.current,
        );
        if (anchorIndex !== -1) {
          const [from, to] =
            anchorIndex <= edgeIndex ? [anchorIndex, edgeIndex] : [edgeIndex, anchorIndex];
          setSelectedIds(visibleFiles.slice(from, to + 1).map((file) => file.id));
          return;
        }
      }
      setSelectedIds([edge.id]);
      selectionAnchorRef.current = edge.id;
      return;
    }

    if (!["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) return;

    event.preventDefault();
    const currentIndex = Math.max(
      0,
      visibleFiles.findIndex((file) => file.id === activeFileId),
    );
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    /*
     * Icons wrap into a grid, so ↑/↓ have to cross a row. Stepping the index by
     * one moved the selection sideways instead: from 게임 at x=262 the down
     * arrow landed on 문서 at x=381, on the same row.
     */
    const rowIndex =
      vertical && viewMode === "icons"
        ? stepFileRow(currentIndex, event.key === "ArrowDown" ? 1 : -1)
        : null;
    const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextFile =
      rowIndex === null
        ? visibleFiles[clamp(currentIndex + offset, 0, visibleFiles.length - 1)]
        : visibleFiles[rowIndex];
    if (!nextFile) return;
    setActiveFileId(nextFile.id);

    /*
     * Shift extends the selection from the anchor instead of replacing it.
     * Shift+↓ used to move the selection like a plain arrow, so a range could
     * only be built with the mouse.
     */
    if (event.shiftKey) {
      const anchorId = selectionAnchorRef.current ?? visibleFiles[currentIndex]?.id;
      const anchorIndex = visibleFiles.findIndex((file) => file.id === anchorId);
      const nextIndex = visibleFiles.findIndex((file) => file.id === nextFile.id);
      if (anchorIndex !== -1 && nextIndex !== -1) {
        const [from, to] =
          anchorIndex <= nextIndex ? [anchorIndex, nextIndex] : [nextIndex, anchorIndex];
        setSelectedIds(visibleFiles.slice(from, to + 1).map((file) => file.id));
        return;
      }
    }

    setSelectedIds([nextFile.id]);
    selectionAnchorRef.current = nextFile.id;
  };

  /** Index of the item one row away in a wrapping grid, or null if there is none. */
  const stepFileRow = (currentIndex: number, direction: 1 | -1) => {
    const list = fileListRef.current;
    if (!list) return null;
    const nodes = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    const currentNode = nodes[currentIndex];
    if (!currentNode) return null;

    const current = currentNode.getBoundingClientRect();
    const candidates = nodes
      .map((node, index) => ({ index, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) =>
        direction === 1 ? rect.top > current.top + 1 : rect.top < current.top - 1,
      );
    if (candidates.length === 0) return null;

    // The nearest row in the direction of travel, then the nearest column in it.
    const rowTop =
      direction === 1
        ? Math.min(...candidates.map((item) => item.rect.top))
        : Math.max(...candidates.map((item) => item.rect.top));
    const row = candidates.filter((item) => Math.abs(item.rect.top - rowTop) < 2);
    return row.reduce((closest, item) =>
      Math.abs(item.rect.left - current.left) < Math.abs(closest.rect.left - current.left)
        ? item
        : closest,
    ).index;
  };

  const importLocalFolder = async () => {
    setLocalFolderBusy(true);
    try {
      const handle = await pickLocalDirectory("read");
      const parent = createVfsFolder(currentFolderId, handle.name);
      const result = await readLocalFolder(handle, parent.id);
      if (result.entries.length > 0) onImportLocalEntries(result.entries);

      const detail = [
        `${result.entries.length}개 항목을 읽었습니다.`,
        result.skipped.length > 0 && `${result.skipped.length}개는 건너뜀`,
        result.truncated && "한도에 걸려 일부만 읽음",
      ]
        .filter(Boolean)
        .join(" · ");
      notify({ detail, title: `${handle.name} 가져옴`, tone: "success" });
    } catch (error) {
      // An empty picker is a cancel, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify({
        detail: error instanceof Error ? error.message : "폴더를 읽지 못했습니다.",
        title: "실제 폴더 가져오기 실패",
      });
    } finally {
      setLocalFolderBusy(false);
    }
  };

  const exportLocalFolder = async () => {
    setLocalFolderBusy(true);
    try {
      const handle = await pickLocalDirectory("readwrite");
      const written = await writeLocalFolder(handle, desktopItems, currentFolderId);
      notify({
        detail: `${written}개 파일을 ${handle.name} 폴더에 썼습니다.`,
        title: "폴더로 저장 완료",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify({
        detail: error instanceof Error ? error.message : "폴더에 쓰지 못했습니다.",
        title: "폴더로 저장 실패",
      });
    } finally {
      setLocalFolderBusy(false);
    }
  };

  const importSelectedZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      await importVfsZip(file);
      setSelectedIds([]);
      setActiveFileId(null);
    } catch (error) {
      notify({
        detail: error instanceof Error ? error.message : "ZIP 파일을 읽을 수 없습니다.",
        title: "ZIP 가져오기 실패",
        tone: "info",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div
      className="files-app app-fill"
      // Ctrl+L belongs to the whole window in Explorer, not just the list: it
      // has to work with the search box, the toolbar, or nothing focused.
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "l") return;
        event.preventDefault();
        setAddressDraft(formatVfsPathText(desktopItems, currentFolderId));
      }}
    >
      <aside>
        <button onClick={() => openApp("thispc")} type="button">
          <Monitor aria-hidden="true" size={16} />내 PC
        </button>
        {(
          [
            [VFS_ROOT_ID, "바탕 화면", Folder],
            [VFS_DOCUMENTS_ID, "문서", FileText],
            [VFS_PICTURES_ID, "사진", Paintbrush],
            [VFS_GAMES_ID, "게임", Bomb],
            [VFS_DOWNLOADS_ID, "다운로드", Download],
          ] as const
        ).map(([folderId, label, Icon]) => (
          <button
            className={`${currentFolderId === folderId ? "is-selected" : ""}${
              dragOverFolderId === folderId ? " is-drop-target" : ""
            }`}
            key={folderId}
            onClick={() => navigateToFolder(folderId)}
            onDragEnter={() => setDragOverFolderId(folderId)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragOverFolderId(null);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => dropFilesIntoFolder(event, folderId)}
            type="button"
          >
            <Icon aria-hidden="true" size={16} />
            {label}
          </button>
        ))}
      </aside>
      <section className="file-main-pane">
        <div className="file-tab-strip">
          <div className="file-tab">
            <Folder aria-hidden="true" size={15} />
            <span>{locationLabel}</span>
          </div>
          <button
            aria-label="새 파일 탐색기 창"
            className="file-new-window-button"
            onClick={() => openNewAppWindow("files")}
            title="새 창"
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="file-explorer-top">
          <div className="file-address-row">
            <div aria-label="탐색" className="file-nav-controls" role="group">
              <button
                aria-label="뒤로"
                disabled={navigationIndex <= 0}
                onClick={() => visitHistory(navigationIndex - 1)}
                title="뒤로 (Alt+왼쪽 화살표)"
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="앞으로"
                disabled={navigationIndex >= navigationHistory.length - 1}
                onClick={() => visitHistory(navigationIndex + 1)}
                title="앞으로 (Alt+오른쪽 화살표)"
                type="button"
              >
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="위로"
                disabled={folderPath.length <= 1}
                onClick={navigateUp}
                title="위로 (Alt+위쪽 화살표)"
                type="button"
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
            </div>
            {addressDraft !== null ? (
              <form
                className="file-address is-editing"
                onSubmit={(event) => {
                  event.preventDefault();
                  const target = resolveVfsPathText(
                    desktopItems,
                    addressDraft,
                    currentFolderId,
                  );
                  if (!target) {
                    notify({
                      detail: `${addressDraft.trim() || "빈 경로"}은(는) 없는 폴더입니다.`,
                      title: "경로를 찾을 수 없음",
                    });
                    return;
                  }
                  setAddressDraft(null);
                  navigateToFolder(target);
                  // The field unmounts on submit; without this the window has
                  // no focus at all afterwards and Ctrl+L cannot reopen it.
                  window.requestAnimationFrame(() =>
                    fileListRef.current?.focus({ preventScroll: true }),
                  );
                }}
              >
                <input
                  aria-label="경로"
                  onBlur={() => setAddressDraft(null)}
                  onChange={(event) => setAddressDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setAddressDraft(null);
                  }}
                  ref={addressInputRef}
                  value={addressDraft}
                />
              </form>
            ) : (
              <div
                className="file-address"
                onDoubleClick={() =>
                  setAddressDraft(formatVfsPathText(desktopItems, currentFolderId))
                }
                title="두 번 클릭하거나 Ctrl+L을 눌러 경로를 입력합니다"
              >
                {folderPath.map((segment, index) => (
                  <div className="file-breadcrumb" key={segment.id}>
                    {index > 0 && <ChevronRight aria-hidden="true" size={14} />}
                    <button
                      aria-current={segment.id === currentFolderId ? "location" : undefined}
                      onClick={() => navigateToFolder(segment.id)}
                      onDragEnter={() => setDragOverFolderId(segment.id)}
                      onDragLeave={() => setDragOverFolderId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropFilesIntoFolder(event, segment.id)}
                      type="button"
                    >
                      {index === 0 && <House aria-hidden="true" size={15} />}
                      <span>{segment.name}</span>
                    </button>
                  </div>
                ))}
                {/* The empty stretch of a Windows address bar is where you click
                  to type a path; a lone breadcrumb row left nowhere to aim. */}
                <button
                  aria-label="경로 입력"
                  className="file-address-edit"
                  onClick={() =>
                    setAddressDraft(formatVfsPathText(desktopItems, currentFolderId))
                  }
                  title="경로 입력 (Ctrl+L)"
                  type="button"
                />
              </div>
            )}
            <label className="file-search">
              <Search aria-hidden="true" size={15} />
              <input
                aria-label="파일 검색"
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder={`${locationLabel} 검색`}
                value={fileQuery}
              />
            </label>
          </div>
          <div className="file-command-strip">
            <div className="file-new-control" ref={newControlRef}>
              <button
                aria-expanded={newOpen}
                aria-haspopup="menu"
                aria-label="새로 만들기"
                className="file-command-action"
                onClick={() => {
                  setNewOpen((current) => !current);
                  setSortOpen(false);
                }}
                type="button"
              >
                <FilePlus2 aria-hidden="true" size={15} />
                <span>새로 만들기</span>
              </button>
              {newOpen && (
                <div
                  aria-label="새로 만들기"
                  className="file-command-menu file-new-menu"
                  onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
                  role="menu"
                >
                  <button onClick={createFolder} role="menuitem" type="button">
                    <Folder aria-hidden="true" size={15} />
                    폴더
                  </button>
                  <button onClick={createTextFile} role="menuitem" type="button">
                    <FileText aria-hidden="true" size={15} />
                    텍스트 문서
                  </button>
                </div>
              )}
            </div>
            <button
              aria-label="열기"
              className="file-command-action file-command-compact"
              disabled={!selectedFile}
              onClick={() => selectedFile && openFile(selectedFile.item)}
              type="button"
            >
              <ExternalLink aria-hidden="true" size={15} />
              <span>열기</span>
            </button>
            <button
              aria-label="복사"
              className="file-command-action file-command-compact"
              disabled={!selectedFile || selectedHasSystemFolder}
              onClick={() => copySelectedFiles()}
              type="button"
            >
              <Copy aria-hidden="true" size={15} />
              <span>복사</span>
            </button>
            <button
              aria-label="붙여넣기"
              className="file-command-action file-command-compact"
              disabled={clipboard.itemIds.length === 0}
              onClick={pasteCopiedFiles}
              type="button"
            >
              <ClipboardPaste aria-hidden="true" size={15} />
              <span>붙여넣기</span>
            </button>
            <button
              aria-label="이름 바꾸기"
              className="file-command-action file-command-compact"
              disabled={!selectedFile || selectedIds.length > 1 || selectedHasSystemFolder}
              onClick={() => selectedFile && setRenaming(true)}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
              <span>이름 바꾸기</span>
            </button>
            <button
              aria-label="삭제"
              className="file-command-action file-command-compact file-danger"
              disabled={!selectedFile || selectedHasSystemFolder}
              onClick={deleteSelectedFiles}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
              <span>삭제</span>
            </button>
            <span aria-hidden="true" className="file-command-separator" />
            <button
              aria-label="ZIP 내보내기"
              className="file-command-action file-command-compact"
              onClick={exportVfsZip}
              title="ZIP 내보내기"
              type="button"
            >
              <Download aria-hidden="true" size={15} />
              <span>내보내기</span>
            </button>
            <button
              aria-busy={importing}
              aria-label="ZIP 가져오기"
              className="file-command-action file-command-compact"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
              title="ZIP 가져오기"
              type="button"
            >
              <Upload aria-hidden="true" size={15} />
              <span>{importing ? "가져오는 중" : "가져오기"}</span>
            </button>
            <input
              accept=".zip,application/zip"
              aria-label="ZIP 파일 가져오기"
              className="file-import-input"
              onChange={importSelectedZip}
              ref={importInputRef}
              type="file"
            />
            {localFolderAvailable && (
              <>
                <span aria-hidden="true" className="file-command-separator" />
                <button
                  aria-label="실제 폴더 가져오기"
                  className="file-command-action file-command-compact"
                  disabled={localFolderBusy}
                  onClick={importLocalFolder}
                  title="이 컴퓨터의 폴더를 읽어 옵니다 (로컬 실행 전용)"
                  type="button"
                >
                  <FolderSymlink aria-hidden="true" size={15} />
                  <span>{localFolderBusy ? "읽는 중" : "실제 폴더"}</span>
                </button>
                <button
                  aria-label="실제 폴더로 내보내기"
                  className="file-command-action file-command-compact"
                  disabled={localFolderBusy}
                  onClick={exportLocalFolder}
                  title="현재 폴더의 내용을 이 컴퓨터의 폴더에 씁니다"
                  type="button"
                >
                  <FolderOutput aria-hidden="true" size={15} />
                  <span>폴더로 저장</span>
                </button>
              </>
            )}
            <span aria-hidden="true" className="file-command-separator" />
            <div className="file-sort-control" ref={sortControlRef}>
              <button
                aria-label="정렬"
                aria-expanded={sortOpen}
                aria-haspopup="menu"
                className="file-command-action"
                onClick={() => {
                  setSortOpen((current) => !current);
                  setNewOpen(false);
                }}
                type="button"
              >
                <ArrowUpDown aria-hidden="true" size={15} />
                <span>정렬</span>
              </button>
              {sortOpen && (
                <div
                  aria-label="파일 정렬"
                  className="file-sort-menu"
                  role="menu"
                  onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
                >
                  {FILE_SORT_OPTIONS.map(([nextSortKey, label]) => (
                    <button
                      aria-checked={sortKey === nextSortKey}
                      key={nextSortKey}
                      onClick={() => {
                        setSortKey(nextSortKey);
                        setSortOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {sortKey === nextSortKey ? (
                        <Check aria-hidden="true" size={15} />
                      ) : (
                        <span />
                      )}
                      {label}
                    </button>
                  ))}
                  <span aria-hidden="true" className="menu-separator" />
                  {FILE_SORT_DIRECTION_OPTIONS.map(([direction, label]) => (
                    <button
                      aria-checked={sortDirection === direction}
                      key={direction}
                      onClick={() => {
                        setSortDirection(direction);
                        setSortOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {sortDirection === direction ? (
                        <Check aria-hidden="true" size={15} />
                      ) : (
                        <span />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div aria-label="보기 방식" className="file-view-control" role="group">
              <button
                aria-label="자세히 보기"
                aria-pressed={viewMode === "details"}
                onClick={() => setViewMode("details")}
                title="자세히 보기"
                type="button"
              >
                <List aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="목록 보기"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                title="목록 보기"
                type="button"
              >
                <LayoutGrid aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="큰 아이콘 보기"
                aria-pressed={viewMode === "icons"}
                onClick={() => setViewMode("icons")}
                title="큰 아이콘 보기"
                type="button"
              >
                <Grid2X2 aria-hidden="true" size={16} />
              </button>
            </div>
            <button
              aria-label="세부 정보 창"
              aria-pressed={detailsPaneOpen}
              className="file-details-toggle"
              onClick={() => setDetailsPaneOpen((current) => !current)}
              title="세부 정보 창"
              type="button"
            >
              <Info aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <div className={`file-workspace${detailsPaneOpen ? " has-details" : ""}`}>
          {/* The context menu lives on the surface so the empty area under the
              rows, the empty-folder placeholder and the column header all reach
              one handler; entry rows stop propagation before it. */}
          <div className="file-list-surface" onContextMenu={showFolderContextMenu}>
            {/* The header stays a sibling of the scroller rather than moving
                inside it. Windows auto-fits the columns so a normal window has
                nothing to scroll sideways, and the details columns now flex the
                same way in styles.css (`minmax(0, …)` instead of a flat 520px
                floor): with horizontal overflow gone, a header that cannot
                scroll can no longer drift off its columns, and the rows stop
                being sliced. Syncing the two scroll positions instead would
                have kept the sideways scrolling that Explorer does not have at
                this size. */}
            {/*
              Windows sorts a details view from its column headers. These were
              inert spans, so sorting was only reachable from the background
              menu — and 크기 was not offered there at all. */}
            {viewMode === "details" && (
              /*
               * Not row/columnheader: those roles demand a table or grid
               * ancestor, and the list below is a listbox — the mixed
               * semantics were the shell's one axe violation. The header is a
               * plain group of sort buttons; the sort state rides on each
               * button's name instead of aria-sort, which is only valid
               * inside a real table.
               */
              <div aria-label="파일 정렬 기준" className="file-list-header" role="group">
                {FILE_COLUMNS.map(([key, label]) => (
                  <button
                    aria-label={`${label} 정렬${
                      sortKey === key
                        ? sortDirection === "asc"
                          ? " (오름차순)"
                          : " (내림차순)"
                        : ""
                    }`}
                    key={key}
                    onClick={() => {
                      if (sortKey === key) {
                        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                        return;
                      }
                      setSortKey(key);
                      setSortDirection("asc");
                    }}
                    type="button"
                  >
                    {label}
                    {sortKey === key && (
                      <ChevronUp
                        aria-hidden="true"
                        className={sortDirection === "asc" ? "" : "is-descending"}
                        size={13}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div
              aria-label={`${locationLabel} 파일`}
              aria-multiselectable="true"
              className={`file-list file-view-${viewMode}${
                dragOverFolderId === currentFolderId ? " is-drop-target" : ""
              }`}
              onDragEnter={(event) => {
                if (event.target === event.currentTarget) setDragOverFolderId(currentFolderId);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverFolderId(null);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => dropFilesIntoFolder(event, currentFolderId)}
              data-vfs-drop-folder={currentFolderId}
              onKeyDown={handleFileListKeyDown}
              onPointerDown={() => setFileContextMenu(null)}
              ref={fileListRef}
              role="listbox"
              // A listbox is a single tab stop. The active option holds it, so
              // the container is only focusable when there is no option at all.
              tabIndex={visibleFiles.length === 0 ? 0 : -1}
            >
              {visibleFiles.map((file, index) => {
                const FileIcon = file.icon;
                return (
                  <div className="file-list-item" key={file.id} role="presentation">
                    <button
                      aria-selected={selectedIds.includes(file.id)}
                      className={`${selectedIds.includes(file.id) ? "is-selected" : ""}${
                        dragOverFolderId === file.id ? " is-drop-target" : ""
                      }${
                        // Windows dims an item waiting to be moved. Nothing marked
                        // a cut item here, so Ctrl+X looked like it did nothing.
                        clipboard.mode === "cut" && clipboard.itemIds.includes(file.id)
                          ? " is-cut"
                          : ""
                      }`}
                      data-file-id={file.id}
                      draggable={!isVfsSystemFolderId(file.id)}
                      tabIndex={file.id === (activeFileId ?? visibleFiles[0]?.id) ? 0 : -1}
                      onClick={(event) => selectFile(file.id, index, event)}
                      onContextMenu={(event) => showFileContextMenu(event, file.id)}
                      onDoubleClick={() => openFile(file.item)}
                      onDragEnd={() => setDragOverFolderId(null)}
                      onDragStart={(event) => startFileDrag(event, file.id)}
                      onDragEnter={() => {
                        if (file.item.kind === "folder") setDragOverFolderId(file.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverFolderId === file.id) setDragOverFolderId(null);
                      }}
                      onDragOver={(event) => {
                        if (file.item.kind !== "folder") return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        if (file.item.kind === "folder") dropFilesIntoFolder(event, file.id);
                      }}
                      role="option"
                      type="button"
                    >
                      {file.item.kind === "canvas" && file.item.content ? (
                        <img
                          alt=""
                          className="file-row-thumbnail"
                          draggable={false}
                          src={file.item.content}
                        />
                      ) : (
                        <FileIcon aria-hidden="true" size={18} />
                      )}
                      <span>
                        {/* Unmatched runs stay bare text: wrapping them in
                            spans would change what every locator that reads a
                            row's name sees. */}
                        {splitSearchMatch(file.name, fileQuery).map((part, index) =>
                          part.match ? <mark key={index}>{part.text}</mark> : part.text,
                        )}
                      </span>
                      <small>{file.modified}</small>
                      <small>{file.type}</small>
                      <small>
                        {file.item.kind === "folder" ? "" : formatVfsEntrySize(file.item)}
                      </small>
                    </button>
                    {renaming && selectedFile?.id === file.id && (
                      <form className="file-inline-rename" onSubmit={submitRename}>
                        <input
                          aria-label="파일 이름"
                          onBlur={() => {
                            if (!cancelRenameRef.current && !commitRename(file.id, draftName)) {
                              // The name was refused: keep editing rather than
                              // silently discarding what was typed. Submit
                              // already behaves this way; blur did not.
                              renameInputRef.current?.focus();
                              return;
                            }
                            cancelRenameRef.current = false;
                            setRenaming(false);
                          }}
                          onChange={(event) => setDraftName(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key !== "Escape") return;
                            event.preventDefault();
                            event.stopPropagation();
                            cancelRenameRef.current = true;
                            setDraftName(file.name);
                            setRenaming(false);
                            focusFileList();
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          ref={renameInputRef}
                          value={draftName}
                        />
                      </form>
                    )}
                  </div>
                );
              })}
              {visibleFiles.length === 0 && (
                <div className="file-empty-state" role="presentation">
                  {fileQuery ? (
                    <Search aria-hidden="true" size={24} />
                  ) : (
                    <Folder aria-hidden="true" size={24} />
                  )}
                  <strong>{fileQuery ? "검색 결과 없음" : "이 폴더는 비어 있습니다."}</strong>
                  {fileQuery && <small>다른 이름이나 파일 형식으로 검색해보세요.</small>}
                </div>
              )}
            </div>
          </div>
          {detailsPaneOpen && (
            <section aria-label="세부 정보" className="file-preview">
              {selectedFile ? (
                <>
                  <div className="file-preview-header">
                    <h3>{selectedFile.name}</h3>
                    <small>
                      {selectedFile.type} · {selectedFile.modified}
                    </small>
                  </div>
                  <div className="file-association">
                    <AppIconTile
                      accent={selectedFile.association.accent}
                      icon={selectedFile.association.icon}
                      size="small"
                    />
                    <span>
                      연결 프로그램: <strong>{selectedFile.association.appTitle}</strong>
                    </span>
                  </div>
                  <p>{selectedFile.detail}</p>
                  {selectedFile.item.kind === "canvas" && selectedFile.item.content && (
                    <img
                      alt={`${selectedFile.name} 미리보기`}
                      className="file-image-preview"
                      src={selectedFile.item.content}
                    />
                  )}
                  {selectedFile.item.kind === "note" && selectedFile.item.content && (
                    <pre
                      aria-label={`${selectedFile.name} 미리보기`}
                      className="file-text-preview"
                    >
                      {getTextPreview(selectedFile.item.content)}
                    </pre>
                  )}
                  <div className="file-actions">
                    <button onClick={() => openFile(selectedFile.item)} type="button">
                      <ExternalLink aria-hidden="true" size={15} />
                      열기
                    </button>
                    <button
                      disabled={isVfsSystemFolderId(selectedFile.id)}
                      onClick={() => setRenaming(true)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={15} />
                      이름 변경
                    </button>
                    <button onClick={() => openFileProperties(selectedFile.id)} type="button">
                      <Info aria-hidden="true" size={15} />
                      속성
                    </button>
                    <button
                      className="file-danger"
                      disabled={isVfsSystemFolderId(selectedFile.id)}
                      onClick={deleteSelectedFiles}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      삭제
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3>{locationLabel}</h3>
                  <p>파일을 선택하면 세부 정보가 표시됩니다.</p>
                </>
              )}
            </section>
          )}
        </div>
        {/* Windows offers no status-bar menu, but it does not hand out the
            browser's either. */}
        <div className="file-statusbar" onContextMenu={(event) => event.preventDefault()}>
          <span>{visibleFiles.length}개 항목</span>
          <span>
            {selectedIds.length > 0
              ? `${selectedIds.length}개 선택됨${
                  selectedSize > 0 ? ` · ${formatStorageSize(selectedSize)}` : ""
                }`
              : "선택한 항목 없음"}
          </span>
        </div>
      </section>
      {fileContextMenu && contextFile && (
        <div
          aria-label="파일 메뉴"
          className="file-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          ref={fileContextMenuRef}
          role="menu"
          style={{ left: fileContextMenu.x, top: fileContextMenu.y }}
        >
          <button
            onClick={() => {
              setFileContextMenu(null);
              openFile(contextFile.item);
            }}
            role="menuitem"
            type="button"
          >
            <ExternalLink aria-hidden="true" size={16} />
            열기
          </button>
          <button
            disabled={selectedHasSystemFolder}
            onClick={() => copySelectedFiles()}
            role="menuitem"
            type="button"
          >
            <Copy aria-hidden="true" size={16} />
            복사
          </button>
          <button
            disabled={selectedHasSystemFolder}
            onClick={() => copySelectedFiles(undefined, "cut")}
            role="menuitem"
            type="button"
          >
            <Scissors aria-hidden="true" size={16} />
            잘라내기
          </button>
          <button
            disabled={clipboard.itemIds.length === 0}
            onClick={pasteCopiedFiles}
            role="menuitem"
            type="button"
          >
            <ClipboardPaste aria-hidden="true" size={16} />
            붙여넣기
          </button>
          <button
            disabled={selectedIds.length > 1 || isVfsSystemFolderId(contextFile.id)}
            onClick={() => {
              setFileContextMenu(null);
              setRenaming(true);
            }}
            role="menuitem"
            type="button"
          >
            <Pencil aria-hidden="true" size={16} />
            이름 바꾸기
          </button>
          {contextFile.item.kind === "canvas" && contextFile.item.content && (
            <button
              onClick={() => {
                setFileContextMenu(null);
                setCustomWallpaper(contextFile.id);
              }}
              role="menuitem"
              type="button"
            >
              <Wallpaper aria-hidden="true" size={16} />
              바탕 화면 배경으로 설정
            </button>
          )}
          <button
            disabled={selectedHasSystemFolder}
            onClick={() => deleteSelectedFiles()}
            role="menuitem"
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
            삭제
          </button>
          <span aria-hidden="true" className="menu-separator" />
          <button
            onClick={() => openFileProperties(contextFile.id)}
            role="menuitem"
            type="button"
          >
            <Info aria-hidden="true" size={16} />
            속성
          </button>
        </div>
      )}
      {fileContextMenu && fileContextMenu.fileId === null && (
        // Same rows Windows shows on a folder background, wired to the commands
        // the app already has. The submenu shell is the shared one from the
        // desktop background menu, so both widgets behave identically.
        <div
          aria-label="폴더 메뉴"
          className={`file-context-menu${fileContextMenu.opensLeft ? " opens-left" : ""}`}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
          ref={fileContextMenuRef}
          role="menu"
          style={{ left: fileContextMenu.x, top: fileContextMenu.y }}
        >
          <div className="desktop-menu-row" onMouseEnter={() => setFolderSubmenu("view")}>
            <button
              aria-expanded={folderSubmenu === "view"}
              aria-haspopup="menu"
              onClick={() =>
                setFolderSubmenu((current) => (current === "view" ? null : "view"))
              }
              role="menuitem"
              type="button"
            >
              <LayoutGrid aria-hidden="true" size={16} />
              <span>보기</span>
              <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
            </button>
            {folderSubmenu === "view" && (
              <div
                aria-label="보기"
                className="desktop-context-submenu"
                onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
                role="menu"
              >
                {FILE_VIEW_OPTIONS.map(([nextViewMode, label]) => (
                  <button
                    aria-checked={viewMode === nextViewMode}
                    key={nextViewMode}
                    onClick={() => {
                      setViewMode(nextViewMode);
                      setFileContextMenu(null);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    {viewMode === nextViewMode ? (
                      <Check aria-hidden="true" size={15} />
                    ) : (
                      <span />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="desktop-menu-row" onMouseEnter={() => setFolderSubmenu("sort")}>
            <button
              aria-expanded={folderSubmenu === "sort"}
              aria-haspopup="menu"
              onClick={() =>
                setFolderSubmenu((current) => (current === "sort" ? null : "sort"))
              }
              role="menuitem"
              type="button"
            >
              <ArrowUpDown aria-hidden="true" size={16} />
              <span>정렬 기준</span>
              <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
            </button>
            {folderSubmenu === "sort" && (
              <div
                aria-label="정렬 기준"
                className="desktop-context-submenu"
                onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
                role="menu"
              >
                {FILE_SORT_OPTIONS.map(([nextSortKey, label]) => (
                  <button
                    aria-checked={sortKey === nextSortKey}
                    key={nextSortKey}
                    onClick={() => {
                      setSortKey(nextSortKey);
                      setFileContextMenu(null);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    {sortKey === nextSortKey ? (
                      <Check aria-hidden="true" size={15} />
                    ) : (
                      <span />
                    )}
                    {label}
                  </button>
                ))}
                <span aria-hidden="true" className="menu-separator" />
                {FILE_SORT_DIRECTION_OPTIONS.map(([direction, label]) => (
                  <button
                    aria-checked={sortDirection === direction}
                    key={direction}
                    onClick={() => {
                      setSortDirection(direction);
                      setFileContextMenu(null);
                    }}
                    role="menuitemradio"
                    type="button"
                  >
                    {sortDirection === direction ? (
                      <Check aria-hidden="true" size={15} />
                    ) : (
                      <span />
                    )}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={refreshFileList}
            onMouseEnter={() => setFolderSubmenu(null)}
            role="menuitem"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={16} />
            새로 고침
          </button>
          <span aria-hidden="true" className="menu-separator" />
          <button
            disabled={clipboard.itemIds.length === 0}
            onClick={pasteCopiedFiles}
            onMouseEnter={() => setFolderSubmenu(null)}
            role="menuitem"
            type="button"
          >
            <ClipboardPaste aria-hidden="true" size={16} />
            붙여넣기
          </button>
          <div className="desktop-menu-row" onMouseEnter={() => setFolderSubmenu("new")}>
            <button
              aria-expanded={folderSubmenu === "new"}
              aria-haspopup="menu"
              onClick={() => setFolderSubmenu((current) => (current === "new" ? null : "new"))}
              role="menuitem"
              type="button"
            >
              <FilePlus2 aria-hidden="true" size={16} />
              <span>새로 만들기</span>
              <ChevronRight aria-hidden="true" className="menu-chevron" size={15} />
            </button>
            {folderSubmenu === "new" && (
              <div
                aria-label="새로 만들기"
                className="desktop-context-submenu"
                onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
                role="menu"
              >
                <button onClick={createFolder} role="menuitem" type="button">
                  <Folder aria-hidden="true" size={15} />
                  폴더
                </button>
                <button onClick={createTextFile} role="menuitem" type="button">
                  <FileText aria-hidden="true" size={15} />
                  텍스트 문서
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {propertiesFile && (
        <div
          className="file-properties-overlay"
          onPointerDown={() => setPropertiesFileId(null)}
        >
          <section
            aria-label="파일 속성"
            aria-modal="true"
            className="file-properties-dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setPropertiesFileId(null);
                return;
              }
              trapDialogFocus(event, event.currentTarget);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <AppIconTile
                accent={propertiesFile.association.accent}
                icon={propertiesFile.association.icon}
                size="medium"
              />
              <div>
                <h2>{propertiesFile.name}</h2>
                <span>{propertiesFile.type}</span>
              </div>
              <button
                aria-label="파일 속성 닫기"
                onClick={() => setPropertiesFileId(null)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </header>
            <dl>
              <div>
                <dt>파일 형식</dt>
                <dd>{propertiesFile.type}</dd>
              </div>
              <div>
                <dt>연결 프로그램</dt>
                <dd>{propertiesFile.association.appTitle}</dd>
              </div>
              <div>
                <dt>위치</dt>
                <dd>
                  {getVfsFolderPath(desktopItems, propertiesFile.item.parentId)
                    .map((segment) => segment.name)
                    .join(" > ")}
                </dd>
              </div>
              <div>
                <dt>크기</dt>
                <dd>{formatVfsEntrySize(propertiesFile.item)}</dd>
              </div>
              <div>
                <dt>만든 날짜</dt>
                <dd>{formatVfsPropertyDate(propertiesFile.item.createdAt)}</dd>
              </div>
              <div>
                <dt>수정한 날짜</dt>
                <dd>{formatVfsPropertyDate(propertiesFile.item.updatedAt)}</dd>
              </div>
            </dl>
            <footer>
              <button
                onClick={() => setPropertiesFileId(null)}
                ref={propertiesConfirmRef}
                type="button"
              >
                확인
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
