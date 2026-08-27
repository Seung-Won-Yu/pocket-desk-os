import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bomb,
  Check,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  Grid2X2,
  House,
  Info,
  LayoutGrid,
  List,
  Monitor,
  Paintbrush,
  Pencil,
  Plus,
  Scissors,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type React from "react";
import AppIconTile from "../components/AppIconTile";
import { VFS_DRAG_MIME } from "../shell/constants";
import { trapDialogFocus } from "../shell/dialogFocus";
import type { AppId, ClipboardMode, DesktopItem, SystemClipboard, ToastInput } from "../types";
import {
  clamp,
  formatVfsEntrySize,
  formatVfsPropertyDate,
  normalizeSearchText,
} from "../utils/format";
import {
  formatDesktopItemTime,
  getVfsEntryAssociation,
  getVfsEntryDetail,
  getVfsFolderPath,
  getVfsTopLevelIds,
  isVfsSystemFolderId,
  VFS_DOCUMENTS_ID,
  VFS_GAMES_ID,
  VFS_PICTURES_ID,
  VFS_ROOT_ID,
} from "../vfs/model";

type FileSortDirection = "asc" | "desc";
type FileSortKey = "name" | "type" | "modified";
type FileViewMode = "details" | "list" | "icons";

type FileContextMenuState = {
  fileId: string;
  x: number;
  y: number;
};

export type FilesLaunchRequest = {
  folderId: string;
  id: string;
  windowId: string;
};

type FilesAppProps = {
  clipboard: SystemClipboard;
  copyToClipboard: (itemIds: string[], mode?: ClipboardMode) => void;
  pasteFromClipboard: (parentId: string) => string[];
  createVfsFolder: (parentId?: string) => DesktopItem;
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
  windowId: string;
};

const APP_BAR_HEIGHT = 48;
const FILE_EXPLORER_SORT_KEY = "pocket-desk-explorer-sort-v1";
const FILE_EXPLORER_SORT_DIRECTION_KEY = "pocket-desk-explorer-sort-direction-v1";
const FILE_EXPLORER_VIEW_KEY = "pocket-desk-explorer-view-v1";

export default function FilesApp({
  clipboard,
  copyToClipboard,
  pasteFromClipboard,
  createVfsFolder,
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
  windowId,
}: FilesAppProps) {
  const fileListRef = useRef<HTMLDivElement | null>(null);
  const fileContextMenuRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const newControlRef = useRef<HTMLDivElement | null>(null);
  const cancelRenameRef = useRef(false);
  const propertiesConfirmRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
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
  const [detailsPaneOpen, setDetailsPaneOpen] = useState(true);
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [propertiesFileId, setPropertiesFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const currentFolderId = navigationHistory[navigationIndex] ?? VFS_ROOT_ID;
  const folderPath = useMemo(
    () => getVfsFolderPath(desktopItems, currentFolderId),
    [currentFolderId, desktopItems],
  );
  const locationLabel = folderPath[folderPath.length - 1]?.name ?? "바탕 화면";
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
  const contextFile = files.find((file) => file.id === fileContextMenu?.fileId);
  const selectedHasSystemFolder = selectedIds.some(isVfsSystemFolderId);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(selectedFile?.name ?? "");
  const [importing, setImporting] = useState(false);

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
    renameInputRef.current?.select();
  }, [renaming]);

  const focusFileList = () => {
    fileListRef.current?.focus();
    window.requestAnimationFrame(() => fileListRef.current?.focus());
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
      x: clamp(event.clientX, 8, Math.max(8, window.innerWidth - 212)),
      y: clamp(event.clientY, 8, Math.max(8, window.innerHeight - APP_BAR_HEIGHT - 226)),
    });
  };

  const openFileProperties = (fileId: string) => {
    setFileContextMenu(null);
    setPropertiesFileId(fileId);
  };

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || isVfsSystemFolderId(selectedFile.id)) return;
    cancelRenameRef.current = false;
    renameVfsEntry(selectedFile.id, draftName);
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
    if (!["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) return;

    event.preventDefault();
    const currentIndex = Math.max(
      0,
      visibleFiles.findIndex((file) => file.id === activeFileId),
    );
    const offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextFile = visibleFiles[clamp(currentIndex + offset, 0, visibleFiles.length - 1)];
    if (!nextFile) return;
    setActiveFileId(nextFile.id);
    setSelectedIds([nextFile.id]);
    selectionAnchorRef.current = nextFile.id;
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
    <div className="files-app app-fill">
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
            <div className="file-address">
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
            </div>
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
                <div aria-label="파일 정렬" className="file-sort-menu" role="menu">
                  {(
                    [
                      ["name", "이름"],
                      ["type", "항목 유형"],
                      ["modified", "수정한 날짜"],
                    ] as Array<[FileSortKey, string]>
                  ).map(([nextSortKey, label]) => (
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
                  {(
                    [
                      ["asc", "오름차순"],
                      ["desc", "내림차순"],
                    ] as Array<[FileSortDirection, string]>
                  ).map(([direction, label]) => (
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
          <div className="file-list-surface">
            {viewMode === "details" && (
              <div aria-hidden="true" className="file-list-header">
                <span>이름</span>
                <span>수정한 날짜</span>
                <span>유형</span>
                <span>크기</span>
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
              tabIndex={0}
            >
              {visibleFiles.map((file, index) => {
                const FileIcon = file.icon;
                return (
                  <div className="file-list-item" key={file.id}>
                    <button
                      aria-selected={selectedIds.includes(file.id)}
                      className={`${selectedIds.includes(file.id) ? "is-selected" : ""}${
                        dragOverFolderId === file.id ? " is-drop-target" : ""
                      }`}
                      data-file-id={file.id}
                      draggable={!isVfsSystemFolderId(file.id)}
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
                      <FileIcon aria-hidden="true" size={18} />
                      <span>{file.name}</span>
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
                            if (!cancelRenameRef.current) renameVfsEntry(file.id, draftName);
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
                <div className="file-empty-state">
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
        <div className="file-statusbar">
          <span>{visibleFiles.length}개 항목</span>
          <span>
            {selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : "선택한 항목 없음"}
          </span>
        </div>
      </section>
      {fileContextMenu && contextFile && (
        <div
          aria-label="파일 메뉴"
          className="file-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
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
