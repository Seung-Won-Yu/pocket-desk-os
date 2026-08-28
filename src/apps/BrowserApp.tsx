import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  History,
  House,
  Info,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldAlert,
  Star,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { useReturnFocus } from "../shell/dialogFocus";
import { isSafeHttpUrl, toSafeHttpUrl } from "../utils/safeUrl";
import { handleMenuKeyboard } from "../shell/keyboardNav";

type BrowserSearchEngineId = "duckduckgo" | "google" | "bing";
type BrowserViewMode = "reader" | "web";
type BrowserFrameIssue = "error" | "manual" | "settled";

type BrowserBookmark = {
  createdAt: number;
  id: string;
  title: string;
  url: string;
};

type BrowserHistoryEntry = {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
};

export type BrowserLaunchRequest = {
  id: string;
  value: string;
};

type BrowserReaderDocument = {
  markdown: string;
  title: string;
};

type BrowserNavigationEntry = {
  url: string | null;
  viewMode: BrowserViewMode;
};

type BrowserToast = {
  detail?: string;
  title: string;
  tone?: "info" | "success";
};

type BrowserAppProps = {
  browserLaunchRequest: BrowserLaunchRequest | null;
  notify: (toast: BrowserToast) => void;
};

const BROWSER_BOOKMARKS_KEY = "pocket-desk-browser-bookmarks-v1";
const BROWSER_HISTORY_KEY = "pocket-desk-browser-history-v1";
const BROWSER_SEARCH_ENGINE_KEY = "pocket-desk-browser-search-engine-v1";
const APPLE_BURST_URL = "https://seung-won-yu.github.io/apple-burst/";

/**
 * A same-origin document must never be framed. The frame needs allow-scripts to
 * be useful, and a same-origin frame with allow-same-origin can reach
 * parent.document, delete its own sandbox attribute and escape — which would
 * hand it this app's origin, its stored files, and any permission the user has
 * granted. GitHub Pages puts every repo of an account on one origin, so the
 * project's own sibling pages are same-origin too. Those open in a real tab.
 */
export function isSameOriginTarget(value: string) {
  if (typeof window === "undefined") return false;
  try {
    return new URL(value, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

const browserSearchEngines: Array<{
  id: BrowserSearchEngineId;
  label: string;
  searchUrl: (query: string) => string;
}> = [
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  },
  {
    id: "google",
    label: "Google",
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "bing",
    label: "Bing",
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
];

/**
 * A live region is announced by its contents, not by its label, so the spinners
 * below need real text. styles.css owns no visually-hidden utility class and
 * this file may not add one, so the recipe lives here as an inline style.
 */
const browserVisuallyHiddenStyle: CSSProperties = {
  border: 0,
  clipPath: "inset(50%)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

// The `select` this replaced carried its own label and box; a menuitemradio row
// borrows `.browser-menu button`, so the caption needs the muted look back.
const browserMenuGroupLabelStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.78rem",
  padding: "5px 6px 3px",
};

// `.browser-menu` is the grid that spaces the rows; a `role="group"` inserts a
// box between it and the rows, so the group has to space its own children.
const browserMenuGroupStyle: CSSProperties = { display: "grid", gap: 4 };

// Keeps every row's label in one column whether or not its check mark is shown.
const browserMenuCheckSlotStyle: CSSProperties = { flex: "0 0 auto", width: 16 };

const browserReaderPreferredHosts = [
  "bing.com",
  "developer.mozilla.org",
  "duckduckgo.com",
  "facebook.com",
  "github.com",
  "google.com",
  "instagram.com",
  "naver.com",
  "notion.so",
  "openai.com",
  "x.com",
  "youtube.com",
];

export default function BrowserApp({ browserLaunchRequest, notify }: BrowserAppProps) {
  const [searchEngine, setSearchEngine] = useState<BrowserSearchEngineId>(() =>
    loadBrowserSearchEngine(),
  );
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(() => loadBrowserBookmarks());
  const [history, setHistory] = useState<BrowserHistoryEntry[]>(() => loadBrowserHistory());
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<BrowserViewMode>("web");
  const [pageLoading, setPageLoading] = useState(false);
  const [pageLoadKey, setPageLoadKey] = useState(0);
  const [navigationStack, setNavigationStack] = useState<BrowserNavigationEntry[]>([
    { url: null, viewMode: "web" },
  ]);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [browserMenuOpen, setBrowserMenuOpen] = useState(false);
  const [frameIssue, setFrameIssue] = useState<BrowserFrameIssue | null>(null);
  const [frameSettledAt, setFrameSettledAt] = useState<number | null>(null);

  /*
   * A frame blocked by X-Frame-Options or a CSP `frame-ancestors` rule fires
   * `load`, never `error`, so `onError` above catches almost nothing: most real
   * sites left an empty white rectangle and no way out, because the recovery
   * panel was only reachable by hunting through the ⋯ menu. The frame is
   * sandboxed into an opaque origin on purpose, so this app genuinely cannot
   * read whether the page rendered — rather than guess, it offers the two ways
   * out a short while after the frame settles, and the offer dismisses like any
   * other.
   */
  useEffect(() => {
    if (viewMode !== "web" || frameSettledAt === null || !url) return;
    if (frameIssue || isSameOriginTarget(url)) return;

    const timer = window.setTimeout(() => setFrameIssue("settled"), 2500);
    return () => window.clearTimeout(timer);
  }, [frameIssue, frameSettledAt, url, viewMode]);

  // A fresh navigation gets a fresh offer; dismissing one clears it until then.
  useEffect(() => {
    setFrameSettledAt(null);
  }, [pageLoadKey, url]);
  const browserMenuButtonRef = useRef<HTMLButtonElement>(null);
  const isBookmarked = Boolean(url && bookmarks.some((bookmark) => bookmark.url === url));
  const closeBrowserMenu = useCallback(() => setBrowserMenuOpen(false), []);

  useEffect(() => {
    localStorage.setItem(BROWSER_SEARCH_ENGINE_KEY, searchEngine);
  }, [searchEngine]);

  useEffect(() => {
    localStorage.setItem(BROWSER_BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(BROWSER_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const recordNavigation = useCallback(
    (value: string, requestedViewMode?: BrowserViewMode) => {
      const nextUrl = normalizeUrl(value, searchEngine);
      const nextViewMode = requestedViewMode ?? getPreferredBrowserViewMode(value, nextUrl);
      const title = getBrowserPageTitle(nextUrl);
      const now = Date.now();
      setUrl(nextUrl);
      setDraft(nextUrl);
      setViewMode(nextViewMode);
      setFrameIssue(null);
      setPageLoading(nextViewMode === "web");
      setPageLoadKey((current) => current + 1);
      setNavigationStack((current) => [
        ...current.slice(0, navigationIndex + 1),
        { url: nextUrl, viewMode: nextViewMode },
      ]);
      setNavigationIndex((current) => current + 1);
      setHistory((current) =>
        [
          { id: `history-${crypto.randomUUID()}`, title, url: nextUrl, visitedAt: now },
          ...current.filter((entry) => entry.url !== nextUrl),
        ].slice(0, 20),
      );
      return nextUrl;
    },
    [navigationIndex, searchEngine],
  );

  const navigateReader = useCallback(
    (nextUrl: string) => recordNavigation(nextUrl, "reader"),
    [recordNavigation],
  );

  useEffect(() => {
    if (!browserLaunchRequest) return;
    recordNavigation(browserLaunchRequest.value);
  }, [browserLaunchRequest?.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    recordNavigation(draft || "PocketDesk");
  };

  const openHome = () => {
    setUrl(null);
    setDraft("");
    setViewMode("web");
    setFrameIssue(null);
    setPageLoading(false);
    setNavigationStack((current) => [
      ...current.slice(0, navigationIndex + 1),
      { url: null, viewMode: "web" },
    ]);
    setNavigationIndex((current) => current + 1);
    setBrowserMenuOpen(false);
  };

  const moveThroughHistory = (nextIndex: number) => {
    const nextEntry = navigationStack[nextIndex];
    if (!nextEntry) return;
    setNavigationIndex(nextIndex);
    setUrl(nextEntry.url);
    setDraft(nextEntry.url ?? "");
    setViewMode(nextEntry.viewMode);
    setFrameIssue(null);
    setPageLoading(Boolean(nextEntry.url) && nextEntry.viewMode === "web");
    setPageLoadKey((current) => current + 1);
    setBrowserMenuOpen(false);
  };

  const changeViewMode = (nextViewMode: BrowserViewMode) => {
    if (!url || nextViewMode === viewMode) return;
    setViewMode(nextViewMode);
    setFrameIssue(null);
    setPageLoading(nextViewMode === "web");
    setPageLoadKey((current) => current + 1);
    setNavigationStack((current) =>
      current.map((entry, index) =>
        index === navigationIndex ? { ...entry, viewMode: nextViewMode } : entry,
      ),
    );
    setBrowserMenuOpen(false);
  };

  const refreshPage = () => {
    if (!url) return;
    setPageLoading(viewMode === "web");
    setFrameIssue(null);
    setPageLoadKey((current) => current + 1);
  };

  const toggleBookmark = () => {
    if (!url) return;

    if (isBookmarked) {
      setBookmarks((current) => current.filter((bookmark) => bookmark.url !== url));
      notify({
        detail: getBrowserPageTitle(url),
        title: "즐겨찾기 제거됨",
        tone: "success",
      });
      return;
    }

    const bookmark = {
      createdAt: Date.now(),
      id: `bookmark-${crypto.randomUUID()}`,
      title: getBrowserPageTitle(url),
      url,
    };
    setBookmarks((current) =>
      [bookmark, ...current.filter((item) => item.url !== url)].slice(0, 16),
    );
    notify({
      detail: bookmark.url,
      title: "즐겨찾기 추가됨",
      tone: "success",
    });
  };

  const clearHistory = () => {
    setHistory([]);
    notify({
      detail: "Microsoft Edge 방문 기록을 비웠습니다.",
      title: "방문 기록 삭제됨",
      tone: "success",
    });
  };

  return (
    <div className="browser-app app-fill">
      <div className="browser-tab-strip">
        <button className="browser-tab is-current" type="button">
          <Globe2 aria-hidden="true" size={14} />
          <span>{url ? getBrowserPageTitle(url) : "새 탭"}</span>
        </button>
        <button aria-label="새 탭" onClick={openHome} title="새 탭" type="button">
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>
      <form className="browser-toolbar" onSubmit={submit}>
        <button
          aria-label="뒤로"
          disabled={navigationIndex <= 0}
          onClick={() => moveThroughHistory(navigationIndex - 1)}
          title="뒤로"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={17} />
        </button>
        <button
          aria-label="앞으로"
          disabled={navigationIndex >= navigationStack.length - 1}
          onClick={() => moveThroughHistory(navigationIndex + 1)}
          title="앞으로"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={17} />
        </button>
        <button
          aria-label="새로고침"
          disabled={!url}
          onClick={refreshPage}
          title="새로고침"
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} />
        </button>
        <button aria-label="홈" onClick={openHome} title="홈" type="button">
          <House aria-hidden="true" size={16} />
        </button>
        <input
          aria-label="웹 주소 또는 검색어"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="주소 또는 검색어"
          spellCheck={false}
          value={draft}
        />
        <button
          aria-label={isBookmarked ? "즐겨찾기 제거" : "즐겨찾기 추가"}
          disabled={!url}
          onClick={toggleBookmark}
          title={isBookmarked ? "즐겨찾기 제거" : "즐겨찾기 추가"}
          type="button"
        >
          <Star aria-hidden="true" fill={isBookmarked ? "currentColor" : "none"} size={16} />
        </button>
        <button
          aria-label={viewMode === "reader" ? "웹 보기" : "읽기 보기"}
          aria-pressed={viewMode === "reader"}
          className={viewMode === "reader" ? "is-active" : ""}
          disabled={!url}
          onClick={() => changeViewMode(viewMode === "reader" ? "web" : "reader")}
          title={viewMode === "reader" ? "웹 보기" : "읽기 보기"}
          type="button"
        >
          <BookOpen aria-hidden="true" size={16} />
        </button>
        {url ? (
          <a
            aria-label="새 탭에서 열기"
            className="icon-link"
            href={url}
            rel="noreferrer"
            target="_blank"
            title="새 탭에서 열기"
          >
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        ) : (
          <span aria-hidden="true" className="icon-link is-disabled">
            <ExternalLink aria-hidden="true" size={16} />
          </span>
        )}
        <button
          aria-expanded={browserMenuOpen}
          aria-haspopup="menu"
          aria-label="설정 및 기타"
          onClick={() => setBrowserMenuOpen((current) => !current)}
          ref={browserMenuButtonRef}
          title="설정 및 기타"
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={18} />
        </button>
      </form>
      {browserMenuOpen && (
        <BrowserSettingsMenu
          canClearHistory={history.length > 0}
          canReportFrameIssue={Boolean(url) && viewMode === "web"}
          canSwitchViewMode={Boolean(url)}
          onClearHistory={() => {
            clearHistory();
            setBrowserMenuOpen(false);
          }}
          onClose={closeBrowserMenu}
          onReportFrameIssue={() => {
            setFrameIssue("manual");
            setBrowserMenuOpen(false);
          }}
          onSearchEngineChange={setSearchEngine}
          onViewModeChange={changeViewMode}
          searchEngine={searchEngine}
          triggerRef={browserMenuButtonRef}
          viewMode={viewMode}
        />
      )}
      {url ? (
        <section
          aria-label={`${viewMode === "reader" ? "읽기" : "웹"} 보기`}
          className={`browser-viewport is-${viewMode}`}
        >
          {pageLoading && viewMode === "web" && !isSameOriginTarget(url) && (
            <div className="browser-loading" role="status">
              <span aria-hidden="true" />
              {/* `.browser-loading span` is the spinner ring, so the text is a <p>. */}
              <p style={browserVisuallyHiddenStyle}>페이지 불러오는 중</p>
            </div>
          )}
          {isSameOriginTarget(url) ? (
            <div className="browser-frame-fallback is-static" role="alert">
              <ShieldAlert aria-hidden="true" size={24} />
              <span>
                <strong>이 주소는 창 안에서 열 수 없습니다</strong>
                <small>
                  PocketDesk와 같은 오리진이라 프레임에 넣으면 이 앱의 파일과 권한에 접근할 수
                  있습니다. 새 탭에서 열어 주세요.
                </small>
              </span>
              <a className="is-primary" href={url} rel="noreferrer" target="_blank">
                <ExternalLink aria-hidden="true" size={15} />새 탭에서 열기
              </a>
            </div>
          ) : viewMode === "reader" ? (
            <BrowserReader
              key={`${pageLoadKey}-${url}`}
              onNavigate={navigateReader}
              onOpenWeb={() => changeViewMode("web")}
              url={url}
            />
          ) : (
            <iframe
              /*
               * No `allow` list. A framed site needs none of it, and even
               * `fullscreen` would let it paint a full-screen imitation of this
               * desktop.
               */
              key={`${pageLoadKey}-${url}`}
              onError={() => {
                setPageLoading(false);
                setFrameIssue("error");
              }}
              onLoad={() => {
                setPageLoading(false);
                setFrameSettledAt(Date.now());
              }}
              referrerPolicy="strict-origin-when-cross-origin"
              /*
               * `allow-same-origin` is deliberately absent. With it, a framed
               * document that reaches this origin — by navigating itself there,
               * or through a redirect — becomes same-origin with the parent and
               * can read parent.document, this app's storage, and remove its own
               * sandbox attribute. The load-time origin check above cannot see
               * that: the app can never read a cross-origin frame's current
               * location. Without the flag the frame is an opaque origin, so the
               * escape is impossible regardless of where it navigates.
               *
               * The cost is real — sites that need their own cookies or storage
               * will not render — and that is what the reader view and the
               * "페이지 표시 문제" recovery panel exist for. `allow-downloads`
               * and `allow-modals` are gone too: a drive-by download and an
               * alert() the browser attributes to this window are not worth it.
               */
              sandbox="allow-forms allow-scripts"
              src={url}
              title={`${getBrowserPageTitle(url)} 웹 보기`}
            />
          )}
          {viewMode === "web" && frameIssue && !isSameOriginTarget(url) && (
            <div className="browser-frame-fallback" role="alert">
              <ShieldAlert aria-hidden="true" size={24} />
              <span>
                {frameIssue === "settled" ? (
                  <>
                    <strong>페이지가 비어 있나요?</strong>
                    <small>
                      많은 사이트가 다른 창 안에 표시되는 것을 막습니다. 읽기 보기로 열면 본문을
                      볼 수 있습니다.
                    </small>
                  </>
                ) : (
                  <>
                    <strong>이 사이트를 창 안에 표시할 수 없습니다</strong>
                    <small>사이트 보안 정책이 iframe 표시를 차단했을 수 있습니다.</small>
                  </>
                )}
              </span>
              <button
                className="is-primary"
                onClick={() => changeViewMode("reader")}
                type="button"
              >
                <BookOpen aria-hidden="true" size={15} />
                읽기 보기
              </button>
              <a href={url} rel="noreferrer" target="_blank">
                <ExternalLink aria-hidden="true" size={15} />새 탭
              </a>
              <button
                aria-label="표시 문제 안내 닫기"
                className="browser-frame-fallback-close"
                onClick={() => {
                  setFrameIssue(null);
                  setFrameSettledAt(null);
                }}
                title="닫기"
                type="button"
              >
                <X aria-hidden="true" size={15} />
              </button>
            </div>
          )}
        </section>
      ) : (
        <BrowserHome
          bookmarks={bookmarks}
          history={history}
          onClearHistory={clearHistory}
          onNavigate={recordNavigation}
          searchEngine={getBrowserSearchEngine(searchEngine).label}
        />
      )}
    </div>
  );
}

/**
 * The Edge "설정 및 기타" flyout. It is its own component so that mounting and
 * unmounting bracket the menu's lifetime: `useReturnFocus` can then capture the
 * trigger on open and hand focus back on close, however the menu was dismissed.
 */
function BrowserSettingsMenu({
  canClearHistory,
  canReportFrameIssue,
  canSwitchViewMode,
  onClearHistory,
  onClose,
  onReportFrameIssue,
  onSearchEngineChange,
  onViewModeChange,
  searchEngine,
  triggerRef,
  viewMode,
}: {
  canClearHistory: boolean;
  canReportFrameIssue: boolean;
  canSwitchViewMode: boolean;
  onClearHistory: () => void;
  onClose: () => void;
  onReportFrameIssue: () => void;
  onSearchEngineChange: (searchEngineId: BrowserSearchEngineId) => void;
  onViewModeChange: (nextViewMode: BrowserViewMode) => void;
  searchEngine: BrowserSearchEngineId;
  triggerRef: RefObject<HTMLButtonElement>;
  viewMode: BrowserViewMode;
}) {
  useReturnFocus();

  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchEngineLabelId = useId();

  // A menu takes focus when it opens, which is also where the arrow keys start.
  // The move waits a frame so it happens after `useReturnFocus` has noted the
  // trigger; taking focus inside the effect itself would let StrictMode's double
  // mount record a menu row as the element to return to, and that row is gone by
  // the time the menu closes.
  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => firstItemRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, []);

  useEffect(() => {
    const closeOnOutsidePointer = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current?.contains(event.target)) return;
      // The trigger toggles the menu on click, so treating its own pointerdown
      // as an outside click would close the flyout and immediately reopen it.
      if (triggerRef.current?.contains(event.target)) return;
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, triggerRef]);

  return (
    <div
      aria-label="설정 및 기타"
      className="browser-menu"
      onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
      ref={menuRef}
      role="menu"
    >
      {/*
        The engine picker was a `<label>` around a `<select>`, which is not a
        valid child of `role="menu"` and so was skipped in menu context. Rather
        than lift it out of the menu, it became `menuitemradio` rows: choosing
        one of three engines is exactly the one-of-many choice that role models,
        it keeps the flyout a single arrow-navigable list instead of a menu with
        a stray form control, and it matches how ContextMenus.tsx and FilesApp
        express the same kind of choice. The rows sit in a labelled `group` so
        they read as their own set, separate from the view-mode radios below.
      */}
      <div aria-labelledby={searchEngineLabelId} role="group" style={browserMenuGroupStyle}>
        <span id={searchEngineLabelId} style={browserMenuGroupLabelStyle}>
          검색 엔진
        </span>
        {browserSearchEngines.map((engine, index) => (
          <button
            aria-checked={searchEngine === engine.id}
            key={engine.id}
            onClick={() => onSearchEngineChange(engine.id)}
            ref={index === 0 ? firstItemRef : undefined}
            role="menuitemradio"
            type="button"
          >
            {searchEngine === engine.id ? (
              <Check aria-hidden="true" size={16} style={browserMenuCheckSlotStyle} />
            ) : (
              <span aria-hidden="true" style={browserMenuCheckSlotStyle} />
            )}
            {engine.label}
          </button>
        ))}
      </div>
      {/*
        Web and reader are two states of one setting rather than two independent
        toggles, so they are `menuitemradio` with `aria-checked`; `menuitem` does
        not support the `aria-pressed` they used to carry.
      */}
      <div aria-label="페이지 보기 방식" role="group" style={browserMenuGroupStyle}>
        <button
          aria-checked={viewMode === "web"}
          disabled={!canSwitchViewMode}
          onClick={() => onViewModeChange("web")}
          role="menuitemradio"
          type="button"
        >
          <Globe2 aria-hidden="true" size={16} />웹 보기
          {viewMode === "web" && <Check aria-hidden="true" size={16} />}
        </button>
        <button
          aria-checked={viewMode === "reader"}
          disabled={!canSwitchViewMode}
          onClick={() => onViewModeChange("reader")}
          role="menuitemradio"
          type="button"
        >
          <BookOpen aria-hidden="true" size={16} />
          읽기 보기
          {viewMode === "reader" && <Check aria-hidden="true" size={16} />}
        </button>
      </div>
      {/* These two run an action once and hold no state, so they stay menuitems. */}
      <button
        disabled={!canReportFrameIssue}
        onClick={onReportFrameIssue}
        role="menuitem"
        type="button"
      >
        <ShieldAlert aria-hidden="true" size={16} />
        페이지 표시 문제
      </button>
      <button
        disabled={!canClearHistory}
        onClick={onClearHistory}
        role="menuitem"
        type="button"
      >
        <History aria-hidden="true" size={16} />
        방문 기록 지우기
      </button>
    </div>
  );
}

function BrowserReader({
  onNavigate,
  onOpenWeb,
  url,
}: {
  onNavigate: (url: string) => void;
  onOpenWeb: () => void;
  url: string;
}) {
  const [document, setDocument] = useState<BrowserReaderDocument | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setDocument(null);
    setError("");

    const readerUrl = getBrowserReaderUrl(url);
    if (!readerUrl) {
      setError("이 주소는 읽기 보기로 변환할 수 없습니다.");
      return;
    }

    fetch(readerUrl, {
      headers: {
        Accept: "text/plain",
        "X-Retain-Images": "none",
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Reader request failed: ${response.status}`);
        }
        return response.text();
      })
      .then((content) => setDocument(parseBrowserReaderResponse(content, url)))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("페이지를 읽기 보기로 변환하지 못했습니다.");
      });

    return () => controller.abort();
  }, [retryKey, url]);

  const markdownComponents = useMemo<Components>(
    () => ({
      a: ({ children, href }) => {
        const isAnchor = Boolean(href?.startsWith("#"));
        const safeHref = isAnchor ? href : toSafeHttpUrl(href, url);
        return (
          <a
            href={safeHref ?? undefined}
            onClick={(event) => {
              if (isAnchor) return;
              event.preventDefault();
              if (!safeHref) return;
              const nextUrl = getBrowserReaderLinkUrl(safeHref, url);
              if (nextUrl) onNavigate(nextUrl);
            }}
            rel="noreferrer"
          >
            {children}
          </a>
        );
      },
      img: ({ alt, src }) => {
        const safeSrc = toSafeHttpUrl(src, url);
        if (!safeSrc) return null;
        return (
          <img alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" src={safeSrc} />
        );
      },
    }),
    [onNavigate, url],
  );

  if (error) {
    return (
      <div className="browser-reader-state is-error">
        <Info aria-hidden="true" size={24} />
        <strong>{error}</strong>
        <button onClick={() => setRetryKey((current) => current + 1)} type="button">
          <RotateCcw aria-hidden="true" size={15} />
          다시 시도
        </button>
        <button onClick={onOpenWeb} type="button">
          <Globe2 aria-hidden="true" size={15} />웹 보기
        </button>
        <a href={url} rel="noreferrer" target="_blank">
          <ExternalLink aria-hidden="true" size={15} />새 탭
        </a>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="browser-reader-state" role="status">
        <span aria-hidden="true" className="browser-reader-spinner" />
        <p style={browserVisuallyHiddenStyle}>읽기 보기 불러오는 중</p>
      </div>
    );
  }

  const isSearchResult = Boolean(getBrowserSearchQuery(new URL(url)));

  return (
    <div className={`browser-reader${isSearchResult ? " is-search" : ""}`}>
      <header>
        <BookOpen aria-hidden="true" size={20} />
        <span>
          <strong>{document.title}</strong>
          <small>{getBrowserPageTitle(url)}</small>
        </span>
      </header>
      {!isSearchResult && (
        // Reader mode substitutes text for the page. Without saying so, a site
        // that forbids framing just looks like a broken render.
        <p className="browser-reader-notice">
          이 사이트는 창 안에 표시되지 않아 본문만 옮겨 왔습니다. 원래 디자인은 새 탭에서 볼 수
          있습니다.
          <a href={url} rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" size={14} />새 탭에서 열기
          </a>
        </p>
      )}
      <article>
        <ReactMarkdown components={markdownComponents}>{document.markdown}</ReactMarkdown>
      </article>
    </div>
  );
}

function BrowserHome({
  bookmarks,
  history,
  onClearHistory,
  onNavigate,
  searchEngine,
}: {
  bookmarks: BrowserBookmark[];
  history: BrowserHistoryEntry[];
  onClearHistory: () => void;
  onNavigate: (value: string) => void;
  searchEngine: string;
}) {
  const quickLinks = [
    { label: "사과게임", url: APPLE_BURST_URL },
    { label: "MDN", url: "https://developer.mozilla.org" },
    { label: "Wikipedia", url: "https://wikipedia.org" },
  ];

  return (
    <div className="browser-home">
      <section className="browser-home-search">
        <Globe2 aria-hidden="true" size={30} />
        <h2>Microsoft Edge</h2>
        <p>{searchEngine}로 검색하거나 주소를 입력하세요.</p>
        <div className="browser-quick-links" aria-label="빠른 링크">
          {quickLinks.map((link) => (
            <button key={link.url} onClick={() => onNavigate(link.url)} type="button">
              {link.label}
            </button>
          ))}
        </div>
      </section>
      <section className="browser-home-panel">
        <div className="browser-panel-title">
          <Star aria-hidden="true" size={16} />
          <strong>즐겨찾기</strong>
        </div>
        {bookmarks.length > 0 ? (
          <div className="browser-link-list">
            {bookmarks.map((bookmark) => (
              <button key={bookmark.id} onClick={() => onNavigate(bookmark.url)} type="button">
                <strong>{bookmark.title}</strong>
                <small>{bookmark.url}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="browser-empty">열린 페이지에서 별표를 눌러 저장하세요.</p>
        )}
      </section>
      <section className="browser-home-panel">
        <div className="browser-panel-title">
          <History aria-hidden="true" size={16} />
          <strong>방문 기록</strong>
          {history.length > 0 && (
            <button onClick={onClearHistory} type="button">
              지우기
            </button>
          )}
        </div>
        {history.length > 0 ? (
          <div className="browser-link-list">
            {history.map((entry) => (
              <button key={entry.id} onClick={() => onNavigate(entry.url)} type="button">
                <strong>{entry.title}</strong>
                <small>{new Date(entry.visitedAt).toLocaleString("ko-KR")}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="browser-empty">아직 방문한 페이지가 없습니다.</p>
        )}
      </section>
    </div>
  );
}

export function normalizeUrl(value: string, searchEngine: BrowserSearchEngineId = "bing") {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "https://example.com";

  // Anything carrying a scheme has to survive the http(s) check on its own.
  // Without this, a scheme like javascript: would only be neutralized by the
  // accident of being prefixed with https:// further down.
  // Validate the scheme without canonicalizing, so the address bar keeps showing
  // exactly what the user typed.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return isSafeHttpUrl(trimmed)
      ? trimmed
      : getBrowserSearchEngine(searchEngine).searchUrl(trimmed);
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    const candidate = `https://${trimmed}`;
    return isSafeHttpUrl(candidate)
      ? candidate
      : getBrowserSearchEngine(searchEngine).searchUrl(trimmed);
  }
  return getBrowserSearchEngine(searchEngine).searchUrl(trimmed);
}

function getBrowserSearchEngine(searchEngineId: BrowserSearchEngineId) {
  return (
    browserSearchEngines.find((engine) => engine.id === searchEngineId) ??
    browserSearchEngines.find((engine) => engine.id === "bing")!
  );
}

function loadBrowserSearchEngine() {
  const stored = localStorage.getItem(
    BROWSER_SEARCH_ENGINE_KEY,
  ) as BrowserSearchEngineId | null;
  return browserSearchEngines.some((engine) => engine.id === stored) ? stored! : "bing";
}

function getPreferredBrowserViewMode(input: string, url: string): BrowserViewMode {
  const trimmed = input.trim();
  const looksLikeSearch =
    !/^https?:\/\//i.test(trimmed) && !(trimmed.includes(".") && !trimmed.includes(" "));
  if (looksLikeSearch) return "reader";

  try {
    // A query string can carry an invite or reset token. Reader mode would send
    // it to a third party, so it is never chosen automatically for such a URL —
    // the user has to ask for it.
    if (readerWouldLeakQuery(url)) return "web";

    const hostname = new URL(url).hostname.toLowerCase();
    return browserReaderPreferredHosts.some(
      (blockedHost) => hostname === blockedHost || hostname.endsWith(`.${blockedHost}`),
    )
      ? "reader"
      : "web";
  } catch {
    return "web";
  }
}

/**
 * Reader mode hands the target address to a third-party service that fetches it
 * server-side, so whatever is in that address leaves the machine. Strip the
 * parts that carry secrets: userinfo, the query string, and the fragment. A
 * search page is the one exception — its query *is* the content — and that
 * branch already rebuilds the URL from the single `q` parameter.
 */
export function getBrowserReaderUrl(url: string) {
  const safe = toSafeHttpUrl(url);
  if (!safe) return null;

  const readerTarget = new URL(safe);
  const searchQuery = getBrowserSearchQuery(readerTarget);
  if (searchQuery) {
    return `https://r.jina.ai/https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
  }

  readerTarget.hash = "";
  readerTarget.username = "";
  readerTarget.password = "";
  readerTarget.search = "";
  return `https://r.jina.ai/${readerTarget.toString()}`;
}

/** True when reading the page would send a query string to the reader service. */
export function readerWouldLeakQuery(url: string) {
  const safe = toSafeHttpUrl(url);
  if (!safe) return false;
  const target = new URL(safe);
  if (getBrowserSearchQuery(target)) return false;
  return target.search.length > 0 || target.username.length > 0;
}

function parseBrowserReaderResponse(content: string, url: string): BrowserReaderDocument {
  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  const marker = "Markdown Content:";
  const markerIndex = content.indexOf(marker);
  const rawMarkdown =
    markerIndex >= 0 ? content.slice(markerIndex + marker.length).trim() : content.trim();
  const markdown = rawMarkdown
    .replace(/^\[\]\([^\n]*\)\s*$/gm, "")
    .replace(/^## \[[^\n]+\]\([^\n]+\)\n\nAd\n[\s\S]*?(?=^## \[)/gm, "")
    .replace(/\*{4}/g, " ")
    .replace(/\s+\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown: markdown || `[${url}](${url})`,
    title: getBrowserSearchQuery(new URL(url))
      ? `${getBrowserPageTitle(url)} - 검색 결과`
      : titleMatch?.[1]?.trim() || getBrowserPageTitle(url),
  };
}

function getBrowserSearchQuery(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "bing.com" ||
    hostname.endsWith(".bing.com") ||
    hostname === "duckduckgo.com" ||
    hostname.endsWith(".duckduckgo.com") ||
    hostname === "google.com" ||
    hostname.endsWith(".google.com")
  ) {
    return url.searchParams.get("q")?.trim() || "";
  }
  return "";
}

function getBrowserReaderLinkUrl(href: string, baseUrl: string) {
  const safe = toSafeHttpUrl(href, baseUrl);
  if (!safe) return null;
  const resolved = new URL(safe);
  if (resolved.hostname.endsWith("duckduckgo.com") && resolved.pathname === "/l/") {
    const destination = resolved.searchParams.get("uddg");
    if (destination && /^https?:\/\//i.test(destination)) return destination;
  }
  return resolved.toString();
}

function getBrowserPageTitle(url: string) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("duckduckgo.com") ||
      parsed.hostname.includes("google.com") ||
      parsed.hostname.includes("bing.com")
    ) {
      return parsed.searchParams.get("q") || parsed.hostname.replace(/^www\./, "");
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeBrowserBookmark(item: unknown): BrowserBookmark | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<BrowserBookmark>;
  if (typeof value.url !== "string" || typeof value.title !== "string") return null;

  // Stored entries are attacker-controlled: the Registry Editor exposes this key
  // for editing, and a ZIP backup can carry one. Drop anything that is not
  // http(s) rather than restoring a URL that could execute on this origin.
  const url = toSafeHttpUrl(value.url);
  if (!url) return null;

  const createdAt = Number(value.createdAt);
  return {
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    id: typeof value.id === "string" ? value.id : `bookmark-${crypto.randomUUID()}`,
    title: value.title.slice(0, 80),
    url,
  };
}

export function normalizeBrowserHistoryEntry(item: unknown): BrowserHistoryEntry | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<BrowserHistoryEntry>;
  if (typeof value.url !== "string" || typeof value.title !== "string") return null;

  const url = toSafeHttpUrl(value.url);
  if (!url) return null;

  const visitedAt = Number(value.visitedAt);
  return {
    id: typeof value.id === "string" ? value.id : `history-${crypto.randomUUID()}`,
    title: value.title.slice(0, 80),
    url,
    visitedAt: Number.isFinite(visitedAt) ? visitedAt : Date.now(),
  };
}

function loadBrowserBookmarks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_BOOKMARKS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeBrowserBookmark)
          .filter((item): item is BrowserBookmark => Boolean(item))
          .slice(0, 16)
      : [];
  } catch {
    return [];
  }
}

function loadBrowserHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeBrowserHistoryEntry)
          .filter((item): item is BrowserHistoryEntry => Boolean(item))
          .sort((a, b) => b.visitedAt - a.visitedAt)
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
