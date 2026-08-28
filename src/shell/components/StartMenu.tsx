import AppIconTile from "../../components/AppIconTile";
import { type AppId, type DesktopItem } from "../../types";
import { getVfsEntryAssociation } from "../../vfs/model";
import { getResultIconTileTone, getStartPinnedApps } from "../startSearch";
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
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { handleMenuKeyboard } from "../keyboardNav";
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
}: {
  apps: AppDefinition[];
  onClose: () => void;
  onLock: () => void;
  onOpenApp: (appId: AppId) => void;
  onRestart: () => void;
  onShutdown: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onRecentItemOpen: (item: DesktopItem) => void;
  onResultOpen: (result: StartSearchResult) => void;
  query: string;
  recentItems: DesktopItem[];
  results: StartSearchResult[];
  setQuery: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape used to leave focus on <body> instead of the Start button.
  useReturnFocus();
  const [powerMenuOpen, setPowerMenuOpen] = useState(false);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const hasQuery = query.trim().length > 0;
  const pinnedApps = getStartPinnedApps(apps);
  const allApps = [...apps].sort((a, b) => a.title.localeCompare(b.title));

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
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
      onPointerDown={onPointerDown}
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
          <div className="start-result-list" role="listbox">
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
                  <button key={app.id} onClick={() => onOpenApp(app.id)} type="button">
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
              <div className="start-pinned-grid" aria-label="고정된 앱">
                {pinnedApps.map((app) => (
                  <button key={app.id} onClick={() => onOpenApp(app.id)} type="button">
                    <AppIconTile accent={app.accent} icon={app.icon} size="medium" />
                    <strong>{app.title}</strong>
                  </button>
                ))}
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
            <strong>Seung-Won</strong>
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
                className="power-menu"
                role="menu"
                onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
              >
                <button onClick={() => runPowerAction(onLock)} role="menuitem" type="button">
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
    </aside>
  );
}
