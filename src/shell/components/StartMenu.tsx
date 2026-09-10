import AppIconTile from "../../components/AppIconTile";
import { type AppId, type DesktopItem } from "../../types";
import { getVfsEntryAssociation } from "../../vfs/model";
import {
  type StartPinnedEntry,
  getEntryKey,
  getPinnedAppIds,
  groupTiles,
  removeFromFolder,
  reorderTiles,
  ungroupFolder,
} from "../startPinned";
import {
  getResultIconTileTone,
  getStartPinnedTiles,
  loadStartPinnedEntries,
  persistStartPinnedEntries,
} from "../startSearch";
import { type AppDefinition, type StartSearchResult } from "../types";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Lock,
  Moon,
  Pin,
  PinOff,
  Power,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { handleMenuKeyboard } from "../keyboardNav";
import { clampContextMenuPosition } from "../desktopLayout";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";

export function StartMenu({
  apps,
  onClose,
  onLock,
  onSleep,
  onOpenApp,
  onRestart,
  onShutdown,
  onPointerDown,
  onRecentItemOpen,
  onResultOpen,
  query,
  recentItems,
  results,
  setQuery,
  userName,
}: {
  apps: AppDefinition[];
  onClose: () => void;
  onLock: () => void;
  onSleep: () => void;
  onOpenApp: (appId: AppId) => void;
  onRestart: () => void;
  onShutdown: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onRecentItemOpen: (item: DesktopItem) => void;
  onResultOpen: (result: StartSearchResult) => void;
  query: string;
  recentItems: DesktopItem[];
  results: StartSearchResult[];
  setQuery: (value: string) => void;
  userName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape used to leave focus on <body> instead of the Start button.
  useReturnFocus();
  const [powerMenuOpen, setPowerMenuOpen] = useState(false);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const hasQuery = query.trim().length > 0;
  const knownAppIds = useMemo(() => new Set(apps.map((app) => app.id as string)), [apps]);
  const [pinnedEntries, setPinnedEntries] = useState<StartPinnedEntry[]>(() =>
    loadStartPinnedEntries(knownAppIds),
  );
  const [tileMenu, setTileMenu] = useState<{
    appId?: AppId;
    folderId?: string;
    x: number;
    y: number;
  } | null>(null);
  /**
   * Windows 11 reads where a tile is dropped: near an edge it takes that slot,
   * on the middle it makes a folder with what it landed on.
   */
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [tileDrop, setTileDrop] = useState<{ key: string; mode: "group" | "reorder" } | null>(
    null,
  );
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  // Windows lets you name a tile folder; ours arrived as 폴더 1.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const pinnedTiles = getStartPinnedTiles(apps, pinnedEntries);
  const pinnedAppIds = getPinnedAppIds(pinnedEntries);
  const openFolder = pinnedEntries.find(
    (entry): entry is Extract<StartPinnedEntry, { kind: "folder" }> =>
      entry.kind === "folder" && entry.id === openFolderId,
  );
  const openFolderName = openFolder?.name ?? "폴더";

  /*
   * A folder that drops to one app is flattened away, and 그룹 해제 removes it
   * outright. Either left the flyout open on a folder that was no longer
   * there: a panel headed 폴더 with nothing in it.
   */
  useEffect(() => {
    if (openFolderId && !openFolder) setOpenFolderId(null);
  }, [openFolder, openFolderId]);

  /** An empty or blank name keeps the one the folder had. */
  const commitFolderName = () => {
    const id = renamingFolderId;
    const name = folderNameDraft.trim();
    setRenamingFolderId(null);
    if (!id || !name) return;
    setPinnedEntries((current) =>
      current.map((entry) =>
        entry.kind === "folder" && entry.id === id ? { ...entry, name } : entry,
      ),
    );
  };

  // Persisting inside the updater made it impure — StrictMode runs updaters
  // twice, so every pin wrote storage twice. The effect writes once per change.
  useEffect(() => {
    persistStartPinnedEntries(pinnedEntries);
  }, [pinnedEntries]);

  const unpinApp = (appId: AppId) =>
    setPinnedEntries((current) =>
      current.flatMap((entry) => {
        if (entry.kind === "app") return entry.appId === appId ? [] : [entry];
        return removeFromFolder([entry], entry.id, appId);
      }),
    );
  const pinApp = (appId: AppId) =>
    setPinnedEntries((current) =>
      getPinnedAppIds(current).includes(appId) ? current : [...current, { appId, kind: "app" }],
    );

  /** Which half of the tile the pointer is over: an edge reorders, the middle groups. */
  const readDropMode = (event: React.DragEvent<HTMLElement>): "group" | "reorder" => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 0.5;
    return ratio < 0.3 || ratio > 0.7 ? "reorder" : "group";
  };
  const allApps = [...apps].sort((a, b) => a.title.localeCompare(b.title));

  const powerMenuFirstItemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (powerMenuOpen) powerMenuFirstItemRef.current?.focus();
  }, [powerMenuOpen]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      // Opened by typing into the taskbar search box: the query is already
      // here and the user is mid-word out there — stealing focus would cut
      // their typing off. Only an empty open takes focus.
      if (inputRef.current && !inputRef.current.value) inputRef.current.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && hasQuery && results[0]) {
      event.preventDefault();
      onResultOpen(results[0]);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const runPowerAction = (action: () => void) => {
    setPowerMenuOpen(false);
    action();
  };

  return (
    <aside
      className="start-menu"
      // Tab used to walk off the end of the menu and carry on into the desktop
      // behind it, leaving the menu open with focus outside it.
      onKeyDown={(event) => trapDialogFocus(event, event.currentTarget)}
      onPointerDown={(event) => {
        // A click anywhere else in the menu puts the tile menu away.
        setTileMenu(null);
        onPointerDown(event);
      }}
    >
      <label className="start-search">
        <Search aria-hidden="true" size={17} />
        <input
          aria-label="앱과 바탕화면 항목 검색"
          onKeyDown={handleSearchKeyDown}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="앱, 폴더, 메모 검색"
          ref={inputRef}
          value={query}
        />
        {query && (
          <button aria-label="검색어 지우기" onClick={() => setQuery("")} type="button">
            <X aria-hidden="true" size={15} />
          </button>
        )}
      </label>
      <div className="start-section-title">
        <strong>{hasQuery ? "검색 결과" : allAppsOpen ? "모든 앱" : "고정됨"}</strong>
        {hasQuery ? (
          <small>{results.length}개</small>
        ) : (
          <button
            className="start-all-apps-toggle"
            onClick={() => setAllAppsOpen((value) => !value)}
            type="button"
          >
            {allAppsOpen ? <ChevronLeft aria-hidden="true" size={14} /> : null}
            {allAppsOpen ? "뒤로" : "모든 앱"}
            {!allAppsOpen ? <ChevronRight aria-hidden="true" size={14} /> : null}
          </button>
        )}
      </div>
      {hasQuery ? (
        results.length > 0 ? (
          <div aria-label="검색 결과" className="start-result-list" role="group">
            {results.map((result) => {
              const ResultIcon = result.icon;
              return (
                <button key={result.id} onClick={() => onResultOpen(result)} type="button">
                  <AppIconTile
                    accent={result.accent}
                    icon={ResultIcon}
                    size="medium"
                    tone={getResultIconTileTone(result)}
                  />
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                  <em>{result.sourceLabel}</em>
                  <small className="match-label">일치: {result.matchLabel}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="start-empty-state">
            <Search aria-hidden="true" size={22} />
            <strong>검색 결과가 없습니다</strong>
            <small>앱 이름, 한글 별칭, 폴더나 파일 이름, 메모 안의 글로 찾아보세요.</small>
          </div>
        )
      ) : (
        <div className="start-dashboard">
          {allAppsOpen ? (
            <section className="start-all-apps start-all-apps-panel">
              <div className="start-app-list">
                {allApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => onOpenApp(app.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setTileMenu({ appId: app.id, x: event.clientX, y: event.clientY });
                    }}
                    type="button"
                  >
                    <AppIconTile accent={app.accent} icon={app.icon} size="small" />
                    <span>
                      <strong>{app.title}</strong>
                      <small>{app.subtitle}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <div aria-label="고정된 앱" className="start-pinned-grid" role="group">
                {pinnedTiles.map((tile) => {
                  const key = getEntryKey(tile.entry);
                  const isFolder = tile.entry.kind === "folder";
                  const label = isFolder
                    ? (tile.entry as Extract<StartPinnedEntry, { kind: "folder" }>).name
                    : tile.app!.title;
                  const dragProps = {
                    className: `${draggingKey === key ? "is-dragging" : ""} ${
                      tileDrop?.key === key ? `is-drop-${tileDrop.mode}` : ""
                    }`,
                    draggable: true,
                    onDragEnd: () => {
                      setDraggingKey(null);
                      setTileDrop(null);
                    },
                    onDragEnter: (event: React.DragEvent<HTMLElement>) => {
                      if (!draggingKey) return;
                      event.preventDefault();
                      setTileDrop({ key, mode: readDropMode(event) });
                    },
                    onDragLeave: (event: React.DragEvent<HTMLElement>) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null))
                        return;
                      setTileDrop((current) => (current?.key === key ? null : current));
                    },
                    onDragOver: (event: React.DragEvent<HTMLElement>) => {
                      if (!draggingKey) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setTileDrop({ key, mode: readDropMode(event) });
                    },
                    onDragStart: (event: React.DragEvent<HTMLElement>) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", key);
                      setDraggingKey(key);
                    },
                    onDrop: (event: React.DragEvent<HTMLElement>) => {
                      const movedKey = draggingKey ?? event.dataTransfer.getData("text/plain");
                      const mode = tileDrop?.key === key ? tileDrop.mode : readDropMode(event);
                      setDraggingKey(null);
                      setTileDrop(null);
                      if (!movedKey || movedKey === key) return;
                      event.preventDefault();
                      setPinnedEntries((current) =>
                        mode === "group"
                          ? groupTiles(current, movedKey, key)
                          : reorderTiles(current, movedKey, key),
                      );
                    },
                  };
                  if (isFolder) {
                    const folder = tile.entry as Extract<StartPinnedEntry, { kind: "folder" }>;
                    return (
                      <button
                        {...dragProps}
                        className={`start-tile-folder ${dragProps.className}`}
                        key={key}
                        onClick={() => setOpenFolderId(folder.id)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setTileMenu({
                            folderId: folder.id,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        type="button"
                      >
                        <span aria-hidden="true" className="start-folder-preview">
                          {(tile.apps ?? []).slice(0, 4).map((app) => (
                            <AppIconTile
                              accent={app!.accent}
                              icon={app!.icon}
                              key={app!.id}
                              size="tiny"
                            />
                          ))}
                        </span>
                        <strong>{label}</strong>
                      </button>
                    );
                  }
                  const app = tile.app!;
                  return (
                    <button
                      {...dragProps}
                      key={key}
                      onClick={() => onOpenApp(app.id)}
                      onContextMenu={(event) => {
                        // Windows unpins a tile from its own right-click menu;
                        // these tiles had no menu at all.
                        event.preventDefault();
                        event.stopPropagation();
                        setTileMenu({ appId: app.id, x: event.clientX, y: event.clientY });
                      }}
                      type="button"
                    >
                      <AppIconTile accent={app.accent} icon={app.icon} size="medium" />
                      <strong>{app.title}</strong>
                    </button>
                  );
                })}
                {pinnedTiles.length === 0 && (
                  <p className="start-empty-compact">고정된 앱이 없습니다.</p>
                )}
              </div>
              {openFolder && (
                <div aria-label="폴더" className="start-folder-flyout" role="group">
                  <header>
                    {renamingFolderId === openFolderId ? (
                      <form
                        className="start-folder-rename"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitFolderName();
                        }}
                      >
                        <input
                          aria-label="폴더 이름"
                          autoFocus
                          onBlur={commitFolderName}
                          onChange={(event) => setFolderNameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Escape") return;
                            event.preventDefault();
                            event.stopPropagation();
                            setRenamingFolderId(null);
                          }}
                          value={folderNameDraft}
                        />
                      </form>
                    ) : (
                      <button
                        className="start-folder-name"
                        onClick={() => {
                          setFolderNameDraft(openFolderName);
                          setRenamingFolderId(openFolderId);
                        }}
                        title="이름 바꾸기"
                        type="button"
                      >
                        <strong>{openFolderName}</strong>
                      </button>
                    )}
                    <button
                      aria-label="폴더 닫기"
                      onClick={() => setOpenFolderId(null)}
                      type="button"
                    >
                      <X aria-hidden="true" size={14} />
                    </button>
                  </header>
                  <div className="start-folder-apps">
                    {(
                      pinnedTiles.find((tile) => getEntryKey(tile.entry) === openFolderId)
                        ?.apps ?? []
                    ).map((app) => (
                      <button
                        key={app!.id}
                        onClick={() => {
                          setOpenFolderId(null);
                          onOpenApp(app!.id);
                        }}
                        type="button"
                      >
                        <AppIconTile accent={app!.accent} icon={app!.icon} size="medium" />
                        <strong>{app!.title}</strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <section className="start-recommended">
                <div className="start-section-title start-subsection-title">
                  <strong>추천</strong>
                  <small>{recentItems.length}개</small>
                </div>
                {recentItems.length > 0 ? (
                  <div className="start-recommended-list">
                    {recentItems.map((item) => {
                      const association = getVfsEntryAssociation(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => onRecentItemOpen(item)}
                          type="button"
                        >
                          {item.kind === "canvas" && item.content ? (
                            // A picture is its own best icon here too.
                            <img
                              alt=""
                              className="start-recommended-thumbnail"
                              src={item.content}
                            />
                          ) : (
                            <AppIconTile
                              accent={association.accent}
                              icon={association.icon}
                              size="small"
                              tone="file"
                            />
                          )}
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {association.typeLabel} · {association.appTitle}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="start-empty-compact">
                    <FileText aria-hidden="true" size={19} />
                    <span>추천 항목 없음</span>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
      <div className="start-menu-footer">
        <div className="start-account">
          <span className="start-account-avatar">
            <UserRound aria-hidden="true" size={17} />
          </span>
          <span>
            <strong>{userName}</strong>
          </span>
        </div>
        <div className="start-footer-actions">
          <div className="power-menu-wrap">
            <button
              aria-expanded={powerMenuOpen}
              aria-haspopup="menu"
              aria-label="전원 옵션"
              onClick={() => setPowerMenuOpen((value) => !value)}
              title="전원"
              type="button"
            >
              <Power aria-hidden="true" size={18} />
            </button>
            {powerMenuOpen && (
              <div
                aria-label="전원 옵션 메뉴"
                className="power-menu"
                role="menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    // One Escape closes one layer: the submenu, not the whole
                    // Start menu it lives in.
                    event.stopPropagation();
                    setPowerMenuOpen(false);
                    return;
                  }
                  handleMenuKeyboard(event, event.currentTarget);
                }}
              >
                <button
                  onClick={() => runPowerAction(onLock)}
                  ref={powerMenuFirstItemRef}
                  role="menuitem"
                  type="button"
                >
                  <Lock aria-hidden="true" size={15} />
                  잠금
                </button>
                <button onClick={() => runPowerAction(onSleep)} role="menuitem" type="button">
                  <Moon aria-hidden="true" size={15} />
                  절전
                </button>
                <button onClick={() => runPowerAction(onRestart)} role="menuitem" type="button">
                  <RotateCcw aria-hidden="true" size={15} />
                  다시 시작
                </button>
                <button
                  onClick={() => runPowerAction(onShutdown)}
                  role="menuitem"
                  type="button"
                >
                  <Power aria-hidden="true" size={15} />
                  시스템 종료
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/*
       * Portaled to <body>: the aside's backdrop-filter makes it the
       * containing block for position: fixed, so the menu opened offset by
       * the menu's own position and the aside's overflow clipped it entirely
       * on the right-hand tiles — the only pin/unpin UI, unreachable exactly
       * where it was needed.
       */}
      {tileMenu &&
        createPortal(
          <div
            className="start-tile-menu"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setTileMenu(null);
                return;
              }
              handleMenuKeyboard(event, event.currentTarget);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            role="menu"
            style={(() => {
              const clamped = clampContextMenuPosition(tileMenu.x, tileMenu.y);
              return { left: clamped.x, top: clamped.y };
            })()}
          >
            {tileMenu.folderId ? (
              <button
                autoFocus
                onClick={() => {
                  setPinnedEntries((current) => ungroupFolder(current, tileMenu.folderId!));
                  setOpenFolderId(null);
                  setTileMenu(null);
                }}
                role="menuitem"
                type="button"
              >
                <FolderOpen aria-hidden="true" size={15} />
                그룹 해제
              </button>
            ) : (
              <button
                autoFocus
                onClick={() => {
                  const appId = tileMenu.appId!;
                  if (pinnedAppIds.includes(appId)) unpinApp(appId);
                  else pinApp(appId);
                  setTileMenu(null);
                }}
                role="menuitem"
                type="button"
              >
                {pinnedAppIds.includes(tileMenu.appId!) ? (
                  <PinOff aria-hidden="true" size={15} />
                ) : (
                  <Pin aria-hidden="true" size={15} />
                )}
                {pinnedAppIds.includes(tileMenu.appId!)
                  ? "시작 화면에서 제거"
                  : "시작 화면에 고정"}
              </button>
            )}
          </div>,
          document.body,
        )}
    </aside>
  );
}
