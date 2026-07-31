import {
  ArrowUpDown,
  Bomb,
  Check,
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
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type React from "react";
import AppIconTile from "../components/AppIconTile";
import type {
  AppId,
  DesktopItem,
  ToastInput,
  VfsDuplicateOptions,
} from "../types";
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
} from "../vfs/model";

type FileSortDirection = "asc" | "desc";
type FileSortKey = "name" | "type" | "modified";
type FileViewMode = "details" | "list" | "icons";

type FileContextMenuState = {
  fileId: string;
  x: number;
  y: number;
};

type FilesAppProps = {
  createVfsTextFile: () => DesktopItem;
  deleteVfsEntry: (itemId: string) => void;
  desktopItems: DesktopItem[];
  duplicateVfsEntries: (itemIds: string[], options?: VfsDuplicateOptions) => string[];
  exportVfsZip: () => void;
  importVfsZip: (file: File) => Promise<void>;
  notify: (toast: ToastInput) => void;
  openApp: (appId: AppId) => void;
  openVfsEntry: (item: DesktopItem) => void;
  renameVfsEntry: (itemId: string, name: string) => void;
};

const APP_BAR_HEIGHT = 48;
const FILE_EXPLORER_SORT_KEY = "pocket-desk-explorer-sort-v1";
const FILE_EXPLORER_SORT_DIRECTION_KEY = "pocket-desk-explorer-sort-direction-v1";
const FILE_EXPLORER_VIEW_KEY = "pocket-desk-explorer-view-v1";

export default function FilesApp({
  createVfsTextFile,
  deleteVfsEntry,
  desktopItems,
  duplicateVfsEntries,
  exportVfsZip,
  importVfsZip,
  notify,
  openApp,
  openVfsEntry,
  renameVfsEntry,
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
  const [location, setLocation] = useState<"desktop" | "documents" | "games" | "pictures">(
    "desktop",
  );
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
  const [clipboardIds, setClipboardIds] = useState<string[]>([]);
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState | null>(null);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [propertiesFileId, setPropertiesFileId] = useState<string | null>(null);
  const locationLabel = {
    desktop: "바탕 화면",
    documents: "문서",
    games: "게임",
    pictures: "사진",
  }[location];
  const locationItems = useMemo(() => {
    if (location === "documents") return desktopItems.filter((item) => item.kind === "note");
    if (location === "pictures") return desktopItems.filter((item) => item.kind === "canvas");
    if (location === "games") return desktopItems.filter((item) => item.kind === "game");
    return desktopItems;
  }, [desktopItems, location]);
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
      let order = 0;
      if (sortKey === "modified") order = first.updatedAt - second.updatedAt;
      if (sortKey === "type") {
        order = first.type.localeCompare(second.type, "ko", { numeric: true, sensitivity: "base" });
      }
      if (sortKey === "name" || order === 0) {
        order = first.name.localeCompare(second.name, "ko", { numeric: true, sensitivity: "base" });
      }
      return order * direction;
    });
  }, [filteredFiles, sortDirection, sortKey]);
  const selectedFile =
    visibleFiles.find((file) => file.id === activeFileId && selectedIds.includes(file.id)) ??
    visibleFiles.find((file) => selectedIds.includes(file.id));
  const propertiesFile = files.find((file) => file.id === propertiesFileId);
  const contextFile = files.find((file) => file.id === fileContextMenu?.fileId);
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

  const getSelectedCommandIds = () =>
    selectedIds.length > 0 ? selectedIds : selectedFile ? [selectedFile.id] : [];

  const copySelectedFiles = (itemIds = getSelectedCommandIds()) => {
    if (itemIds.length === 0) return;
    setClipboardIds(itemIds);
    setFileContextMenu(null);
    notify({
      detail: "이 파일 탐색기 안에서 Ctrl+V로 붙여넣을 수 있습니다.",
      title: `${itemIds.length}개 항목 복사됨`,
      tone: "success",
    });
  };

  const pasteCopiedFiles = () => {
    if (clipboardIds.length === 0) return;
    const copiedIds = duplicateVfsEntries(clipboardIds);
    if (copiedIds.length === 0) return;
    setSelectedIds(copiedIds);
    setActiveFileId(copiedIds[0] ?? null);
    selectionAnchorRef.current = copiedIds[0] ?? null;
    setFileContextMenu(null);
    focusFileList();
  };

  const createTextFile = () => {
    const item = createVfsTextFile();
    setSelectedIds([item.id]);
    setActiveFileId(item.id);
    setPendingRenameId(item.id);
    selectionAnchorRef.current = item.id;
    setNewOpen(false);
    setFileContextMenu(null);
  };

  const showFileContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    fileId: string,
  ) => {
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
    if (!selectedFile) return;
    cancelRenameRef.current = false;
    renameVfsEntry(selectedFile.id, draftName);
    setRenaming(false);
    focusFileList();
  };

  const deleteSelectedFiles = () => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedFile ? [selectedFile.id] : [];
    if (ids.length === 0) return;
    ids.forEach(deleteVfsEntry);
    setRenaming(false);
    setFileContextMenu(null);
    setPropertiesFileId(null);
    setSelectedIds([]);
    setActiveFileId(null);
    selectionAnchorRef.current = null;
  };

  const changeLocation = (nextLocation: typeof location) => {
    setLocation(nextLocation);
    setSelectedIds([]);
    setActiveFileId(null);
    setRenaming(false);
    setNewOpen(false);
    setSortOpen(false);
    setFileContextMenu(null);
    setPropertiesFileId(null);
    selectionAnchorRef.current = null;
  };

  const selectFile = (
    fileId: string,
    index: number,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const anchorIndex = visibleFiles.findIndex((file) => file.id === selectionAnchorRef.current);
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

    if (event.key === "F2" && selectedFile && selectedIds.length <= 1) {
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
      openVfsEntry(selectedFile.item);
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
          <Monitor aria-hidden="true" size={16} />
          내 PC
        </button>
        <button
          className={location === "desktop" ? "is-selected" : ""}
          onClick={() => changeLocation("desktop")}
          type="button"
        >
          <Folder aria-hidden="true" size={16} />
          바탕 화면
        </button>
        <button
          className={location === "documents" ? "is-selected" : ""}
          onClick={() => changeLocation("documents")}
          type="button"
        >
          <FileText aria-hidden="true" size={16} />
          문서
        </button>
        <button
          className={location === "pictures" ? "is-selected" : ""}
          onClick={() => changeLocation("pictures")}
          type="button"
        >
          <Paintbrush aria-hidden="true" size={16} />
          사진
        </button>
        <button
          className={location === "games" ? "is-selected" : ""}
          onClick={() => changeLocation("games")}
          type="button"
        >
          <Bomb aria-hidden="true" size={16} />
          게임
        </button>
      </aside>
      <section className="file-main-pane">
        <div className="file-tab-strip">
          <div className="file-tab">
            <Folder aria-hidden="true" size={15} />
            <span>{locationLabel}</span>
          </div>
        </div>
        <div className="file-explorer-top">
          <div className="file-address-row">
            <div className="file-address">
              <House aria-hidden="true" size={15} />
              <span>홈</span>
              <span aria-hidden="true">›</span>
              <strong>{locationLabel}</strong>
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
                <div aria-label="새로 만들기" className="file-command-menu file-new-menu" role="menu">
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
              onClick={() => selectedFile && openVfsEntry(selectedFile.item)}
              type="button"
            >
              <ExternalLink aria-hidden="true" size={15} />
              <span>열기</span>
            </button>
            <button
              aria-label="복사"
              className="file-command-action file-command-compact"
              disabled={!selectedFile}
              onClick={() => copySelectedFiles()}
              type="button"
            >
              <Copy aria-hidden="true" size={15} />
              <span>복사</span>
            </button>
            <button
              aria-label="붙여넣기"
              className="file-command-action file-command-compact"
              disabled={clipboardIds.length === 0}
              onClick={pasteCopiedFiles}
              type="button"
            >
              <ClipboardPaste aria-hidden="true" size={15} />
              <span>붙여넣기</span>
            </button>
            <button
              aria-label="이름 바꾸기"
              className="file-command-action file-command-compact"
              disabled={!selectedFile || selectedIds.length > 1}
              onClick={() => selectedFile && setRenaming(true)}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
              <span>이름 바꾸기</span>
            </button>
            <button
              aria-label="삭제"
              className="file-command-action file-command-compact file-danger"
              disabled={!selectedFile}
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
                      {sortKey === nextSortKey ? <Check aria-hidden="true" size={15} /> : <span />}
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
                      {sortDirection === direction ? <Check aria-hidden="true" size={15} /> : <span />}
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
              className={`file-list file-view-${viewMode}`}
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
                      className={selectedIds.includes(file.id) ? "is-selected" : ""}
                      data-file-id={file.id}
                      onClick={(event) => selectFile(file.id, index, event)}
                      onContextMenu={(event) => showFileContextMenu(event, file.id)}
                      onDoubleClick={() => openVfsEntry(file.item)}
                      role="option"
                      type="button"
                    >
                      <FileIcon aria-hidden="true" size={18} />
                      <span>{file.name}</span>
                      <small>{file.modified}</small>
                      <small>{file.type}</small>
                      <small>{formatVfsEntrySize(file.item)}</small>
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
                  <Search aria-hidden="true" size={24} />
                  <strong>검색 결과 없음</strong>
                  <small>다른 이름, 확장자, 앱 이름으로 검색해보세요.</small>
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
                    <button onClick={() => openVfsEntry(selectedFile.item)} type="button">
                      <ExternalLink aria-hidden="true" size={15} />
                      열기
                    </button>
                    <button onClick={() => setRenaming(true)} type="button">
                      <Pencil aria-hidden="true" size={15} />
                      이름 변경
                    </button>
                    <button onClick={() => openFileProperties(selectedFile.id)} type="button">
                      <Info aria-hidden="true" size={15} />
                      속성
                    </button>
                    <button className="file-danger" onClick={deleteSelectedFiles} type="button">
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
          <span>{selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : "선택한 항목 없음"}</span>
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
              openVfsEntry(contextFile.item);
            }}
            role="menuitem"
            type="button"
          >
            <ExternalLink aria-hidden="true" size={16} />
            열기
          </button>
          <button onClick={() => copySelectedFiles()} role="menuitem" type="button">
            <Copy aria-hidden="true" size={16} />
            복사
          </button>
          <button
            disabled={selectedIds.length > 1}
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
          <button onClick={() => deleteSelectedFiles()} role="menuitem" type="button">
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
                <dd>바탕 화면</dd>
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
