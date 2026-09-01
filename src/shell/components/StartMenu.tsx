import AppIconTile from "../../components/AppIconTile";
import { type AppId, type DesktopItem } from "../../types";
import { getVfsEntryAssociation } from "../../vfs/model";
import {
  getResultIconTileTone,
  getStartPinnedApps,
  loadStartPinnedAppIds,
  persistStartPinnedAppIds,
} from "../startSearch";
import { type AppDefinition, type StartSearchResult } from "../types";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Power,
  RotateCcw,
  Search,
  UserRound,
  X,
  Pin,
  PinOff,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { handleMenuKeyboard } from "../keyboardNav";
import { clampContextMenuPosition } from "../desktopLayout";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";

export function StartMenu({
  apps,
  onClose,
  onLock,
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
  const [pinnedAppIds, setPinnedAppIds] = useState<AppId[]>(() => loadStartPinnedAppIds());
  const [tileMenu, setTileMenu] = useState<{ appId: AppId; x: number; y: number } | null>(null);
  const pinnedApps = getStartPinnedApps(apps, pinnedAppIds);

  // Persisting inside the updater made it impure — StrictMode runs updaters
  // twice, so every pin wrote storage twice. The effect writes once per change.
  useEffect(() => {
    persistStartPinnedAppIds(pinnedAppIds);
  }, [pinnedAppIds]);

  const setPins = (updater: (current: AppId[]) => AppId[]) => {
    setPinnedAppIds(updater);
  };

  const unpinApp = (appId: AppId) => setPins((current) => current.filter((id) => id !== appId));
  const pinApp = (appId: AppId) =>
    setPins((current) => (current.includes(appId) ? current : [...current, appId]));
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
            <small>앱 이름, 한글 별칭, 바탕화면 폴더나 메모 이름으로 찾아보세요.</small>
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
                {pinnedApps.map((app) => (
                  <button
                    key={app.id}
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
                ))}
                {pinnedApps.length === 0 && (
                  <p className="start-empty-compact">고정된 앱이 없습니다.</p>
                )}
              </div>
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
                          <AppIconTile
                            accent={association.accent}
                            icon={association.icon}
                            size="small"
                            tone="file"
                          />
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
            <button
              autoFocus
              onClick={() => {
                if (pinnedAppIds.includes(tileMenu.appId)) unpinApp(tileMenu.appId);
                else pinApp(tileMenu.appId);
                setTileMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              {pinnedAppIds.includes(tileMenu.appId) ? (
                <PinOff aria-hidden="true" size={15} />
              ) : (
                <Pin aria-hidden="true" size={15} />
              )}
              {pinnedAppIds.includes(tileMenu.appId)
                ? "시작 화면에서 제거"
                : "시작 화면에 고정"}
            </button>
          </div>,
          document.body,
        )}
    </aside>
  );
}
