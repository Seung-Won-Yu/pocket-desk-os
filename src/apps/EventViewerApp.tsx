import {
  ChevronRight,
  Copy,
  Info,
  ScrollText,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { appMetadata } from "./metadata";
import type { DesktopItem, OpenWindowInfo, SoundEffectName, ToastInput } from "../types";
import { normalizeSearchText } from "../utils/format";
import { VFS_ROOT_ID, getVfsEntryAssociation } from "../vfs/model";

type EventViewerAppProps = {
  desktopItems: DesktopItem[];
  notify: (toast: ToastInput) => void;
  openWindows: OpenWindowInfo[];
  playSound: (effect: SoundEffectName) => void;
  trashedItems: DesktopItem[];
};

type EventChannel = "application" | "security" | "system";
type EventLevel = "information" | "warning";
type EventSortKey = "eventId" | "level" | "source" | "timestamp";
type SortDirection = "asc" | "desc";

type LogEvent = {
  /** True when the timestamp is when this app first saw the window, not when it opened. */
  approximate: boolean;
  channel: EventChannel;
  detail: string;
  eventId: number;
  id: string;
  level: EventLevel;
  source: string;
  taskCategory: string;
  timestamp: number;
  typeLabel: string;
};

type WindowSighting = {
  approximate: boolean;
  at: number;
};

/** One stable id per event kind, the way Windows keeps a fixed id per audit type. */
const EVENT_ID_CREATED = 4656;
const EVENT_ID_UPDATED = 4663;
const EVENT_ID_TRASHED = 4660;
const EVENT_ID_APP_STARTED = 4688;

const SOURCE_VFS = "PocketDesk-Vfs";
const SOURCE_RECYCLE_BIN = "PocketDesk-RecycleBin";
const SOURCE_SHELL = "PocketDesk-Shell";

const LEVEL_RANK: Record<EventLevel, number> = { information: 0, warning: 1 };
const LEVEL_LABEL: Record<EventLevel, string> = { information: "정보", warning: "경고" };

const channelList: { id: EventChannel; label: string }[] = [
  { id: "application", label: "응용 프로그램" },
  { id: "system", label: "시스템" },
  { id: "security", label: "보안" },
];

const columnList: { key: EventSortKey; label: string }[] = [
  { key: "level", label: "수준" },
  { key: "timestamp", label: "날짜 및 시간" },
  { key: "source", label: "원본" },
  { key: "eventId", label: "이벤트 ID" },
];

function formatEventTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function getWindowStateLabel(info: OpenWindowInfo) {
  if (info.minimized) return "최소화됨";
  if (info.maximized) return "최대화됨";
  return "일반";
}

/**
 * Every row below is derived from a fact the shell already stores: a timestamp on
 * a VFS entry, or a window that is open right now. Nothing here is invented.
 */
function buildFileEvents(entries: DesktopItem[], trashedEntries: DesktopItem[]) {
  const allEntries = [...entries, ...trashedEntries];
  const folderNames = new Map(allEntries.map((entry) => [entry.id, entry.name]));
  const describeLocation = (parentId: string) =>
    parentId === VFS_ROOT_ID ? "바탕 화면" : (folderNames.get(parentId) ?? parentId);
  const events: LogEvent[] = [];

  for (const entry of allEntries) {
    const typeLabel = getVfsEntryAssociation(entry).typeLabel;
    events.push({
      approximate: false,
      channel: "application",
      detail: [
        `"${entry.name}" 항목이 새로 만들어졌습니다.`,
        `종류: ${typeLabel}`,
        `위치: ${describeLocation(entry.parentId)}`,
        `바탕 화면 표시: ${entry.showOnDesktop ? "예" : "아니요"}`,
      ].join("\n"),
      eventId: EVENT_ID_CREATED,
      id: `${entry.id}:created`,
      level: "information",
      source: SOURCE_VFS,
      taskCategory: "파일 만들기",
      timestamp: entry.createdAt,
      typeLabel: "파일 만들어짐",
    });

    if (entry.updatedAt !== entry.createdAt) {
      events.push({
        approximate: false,
        channel: "application",
        detail: [
          `"${entry.name}" 항목이 저장되어 내용이 바뀌었습니다.`,
          `종류: ${typeLabel}`,
          `만든 시간: ${formatEventTime(entry.createdAt)}`,
        ].join("\n"),
        eventId: EVENT_ID_UPDATED,
        id: `${entry.id}:updated`,
        level: "information",
        source: SOURCE_VFS,
        taskCategory: "파일 저장",
        timestamp: entry.updatedAt,
        typeLabel: "파일 수정됨",
      });
    }
  }

  for (const entry of trashedEntries) {
    // trashedAt is optional on the entry, so skip rather than guess a time.
    if (entry.trashedAt == null) continue;
    events.push({
      approximate: false,
      channel: "application",
      detail: [
        `"${entry.name}" 항목이 휴지통으로 이동했습니다.`,
        `종류: ${getVfsEntryAssociation(entry).typeLabel}`,
        `원래 위치: ${describeLocation(entry.restoreParentId ?? entry.parentId)}`,
      ].join("\n"),
      eventId: EVENT_ID_TRASHED,
      id: `${entry.id}:trashed`,
      level: "warning",
      source: SOURCE_RECYCLE_BIN,
      taskCategory: "휴지통",
      timestamp: entry.trashedAt,
      typeLabel: "휴지통으로 이동",
    });
  }

  return events;
}

function buildWindowEvents(
  windows: OpenWindowInfo[],
  sightings: Record<string, WindowSighting>,
) {
  return windows.map<LogEvent>((info) => {
    const sighting = sightings[info.id];
    const approximate = sighting?.approximate ?? true;
    const detail = [
      `"${info.title}" 창이 열렸습니다.`,
      `앱: ${appMetadata[info.appId].title}`,
      `창 ID: ${info.id}`,
      `상태: ${getWindowStateLabel(info)}`,
    ];
    if (approximate) {
      detail.push("※ 이벤트 뷰어보다 먼저 열린 창이라 기록 시각은 관찰을 시작한 시각입니다.");
    }
    return {
      approximate,
      channel: "system",
      detail: detail.join("\n"),
      eventId: EVENT_ID_APP_STARTED,
      id: `${info.id}:started`,
      level: "information",
      source: SOURCE_SHELL,
      taskCategory: "프로세스 만들기",
      timestamp: sighting?.at ?? Date.now(),
      typeLabel: "앱 시작됨",
    };
  });
}

export default function EventViewerApp({
  desktopItems,
  notify,
  openWindows,
  playSound,
  trashedItems,
}: EventViewerAppProps) {
  const [channel, setChannel] = useState<EventChannel>("application");
  const [levelFilter, setLevelFilter] = useState<EventLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<EventSortKey>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [windowSightings, setWindowSightings] = useState<Record<string, WindowSighting>>(() => {
    const openedAt = Date.now();
    const initial: Record<string, WindowSighting> = {};
    for (const info of openWindows) initial[info.id] = { approximate: true, at: openedAt };
    return initial;
  });

  // Windows opened while this app runs get a real timestamp; earlier ones stay approximate.
  useEffect(() => {
    setWindowSightings((current) => {
      const seenAt = Date.now();
      let changed = false;
      const next = { ...current };
      for (const info of openWindows) {
        if (next[info.id]) continue;
        next[info.id] = { approximate: false, at: seenAt };
        changed = true;
      }
      return changed ? next : current;
    });
  }, [openWindows]);

  const events = useMemo(
    () => [
      ...buildFileEvents(desktopItems, trashedItems),
      ...buildWindowEvents(openWindows, windowSightings),
    ],
    [desktopItems, openWindows, trashedItems, windowSightings],
  );

  const channelEvents = useMemo(
    () => events.filter((event) => event.channel === channel),
    [channel, events],
  );

  const visibleEvents = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const filtered = channelEvents.filter((event) => {
      if (levelFilter !== "all" && event.level !== levelFilter) return false;
      if (!normalizedQuery) return true;
      return [
        event.typeLabel,
        event.source,
        event.detail,
        event.taskCategory,
        LEVEL_LABEL[event.level],
        String(event.eventId),
        formatEventTime(event.timestamp),
      ]
        .map(normalizeSearchText)
        .some((field) => field.includes(normalizedQuery));
    });

    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((first, second) => {
      let primary = 0;
      if (sortKey === "level") primary = LEVEL_RANK[first.level] - LEVEL_RANK[second.level];
      else if (sortKey === "source")
        primary = first.source.localeCompare(second.source, "ko-KR");
      else if (sortKey === "eventId") primary = first.eventId - second.eventId;
      else primary = first.timestamp - second.timestamp;
      if (primary !== 0) return direction * primary;
      return second.timestamp - first.timestamp || first.id.localeCompare(second.id);
    });
  }, [channelEvents, levelFilter, query, sortDirection, sortKey]);

  const selectedEvent = visibleEvents.find((event) => event.id === selectedId) ?? null;
  const activeChannel = channelList.find((item) => item.id === channel) ?? channelList[0];
  const isFiltered = levelFilter !== "all" || normalizeSearchText(query).length > 0;

  const countByChannel = (target: EventChannel) =>
    events.filter((event) => event.channel === target).length;

  const changeChannel = (next: EventChannel) => {
    playSound("click");
    setChannel(next);
    setSelectedId(null);
  };

  const changeLevelFilter = (next: EventLevel | "all") => {
    playSound("click");
    setLevelFilter(next);
  };

  const changeSort = (key: EventSortKey) => {
    playSound("click");
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "timestamp" ? "desc" : "asc");
  };

  const copySelectedEvent = async () => {
    if (!selectedEvent) return;
    const text = [
      `로그 이름: ${activeChannel.label}`,
      `원본: ${selectedEvent.source}`,
      `이벤트 ID: ${selectedEvent.eventId}`,
      `수준: ${LEVEL_LABEL[selectedEvent.level]}`,
      `기록된 날짜: ${formatEventTime(selectedEvent.timestamp)}`,
      `작업 범주: ${selectedEvent.taskCategory}`,
      "",
      selectedEvent.detail,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      playSound("success");
      notify({
        detail: `${selectedEvent.typeLabel} · 이벤트 ID ${selectedEvent.eventId}`,
        title: "이벤트를 복사했습니다",
        tone: "success",
      });
    } catch {
      playSound("error");
      notify({
        detail: "브라우저가 클립보드 사용을 막았습니다.",
        title: "이벤트를 복사하지 못했습니다",
        tone: "info",
      });
    }
  };

  return (
    <div className="event-viewer-app">
      <nav aria-label="이벤트 로그" className="event-viewer-tree">
        <p className="event-viewer-tree-root">
          <ScrollText aria-hidden="true" size={15} />
          이벤트 뷰어(로컬)
        </p>
        <button
          aria-expanded={logsExpanded}
          className="event-viewer-tree-toggle"
          onClick={() => setLogsExpanded((current) => !current)}
          type="button"
        >
          <ChevronRight
            aria-hidden="true"
            className={logsExpanded ? "is-expanded" : ""}
            size={14}
          />
          PocketDesk 로그
        </button>
        {logsExpanded && (
          <div className="event-viewer-tree-group">
            {channelList.map((item) => (
              <button
                aria-current={item.id === channel ? "true" : undefined}
                className={item.id === channel ? "is-selected" : ""}
                key={item.id}
                onClick={() => changeChannel(item.id)}
                type="button"
              >
                {item.id === "security" ? (
                  <ShieldCheck aria-hidden="true" size={14} />
                ) : (
                  <ScrollText aria-hidden="true" size={14} />
                )}
                <span>{item.label}</span>
                <small>{countByChannel(item.id)}</small>
              </button>
            ))}
          </div>
        )}
      </nav>

      <section className="event-viewer-main">
        <header className="event-viewer-toolbar">
          <h2>{activeChannel.label}</h2>
          <div aria-label="수준 필터" className="event-viewer-levels" role="group">
            <button
              aria-pressed={levelFilter === "all"}
              onClick={() => changeLevelFilter("all")}
              type="button"
            >
              전체
            </button>
            <button
              aria-pressed={levelFilter === "information"}
              onClick={() => changeLevelFilter("information")}
              type="button"
            >
              <Info aria-hidden="true" size={13} />
              정보
            </button>
            <button
              aria-pressed={levelFilter === "warning"}
              onClick={() => changeLevelFilter("warning")}
              type="button"
            >
              <TriangleAlert aria-hidden="true" size={13} />
              경고
            </button>
          </div>
          <label className="event-viewer-search">
            <Search aria-hidden="true" size={14} />
            <input
              aria-label="이벤트 검색"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이벤트 검색"
              value={query}
            />
          </label>
          <button
            className="event-viewer-copy"
            disabled={!selectedEvent}
            onClick={() => void copySelectedEvent()}
            type="button"
          >
            <Copy aria-hidden="true" size={14} />
            복사
          </button>
        </header>

        <div
          aria-label={`${activeChannel.label} 이벤트`}
          className="event-viewer-table"
          role="grid"
        >
          <div className="event-viewer-row is-head" role="row">
            {columnList.map((column) => (
              <span
                aria-sort={
                  sortKey === column.key
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                key={column.key}
                role="columnheader"
              >
                <button onClick={() => changeSort(column.key)} type="button">
                  {column.label}
                  {sortKey === column.key && (
                    <ChevronRight
                      aria-hidden="true"
                      className={sortDirection === "asc" ? "is-asc" : "is-desc"}
                      size={12}
                    />
                  )}
                </button>
              </span>
            ))}
          </div>
          {visibleEvents.length === 0 ? (
            <p className="event-viewer-empty">
              {channelEvents.length === 0
                ? "기록된 이벤트가 없습니다."
                : "조건에 맞는 이벤트가 없습니다."}
            </p>
          ) : (
            visibleEvents.map((event) => (
              <div
                aria-selected={event.id === selectedId}
                className={`event-viewer-row${event.id === selectedId ? " is-selected" : ""}`}
                key={event.id}
                onClick={() => setSelectedId(event.id)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                  keyEvent.preventDefault();
                  setSelectedId(event.id);
                }}
                role="row"
                tabIndex={0}
              >
                <span
                  className={`event-viewer-level${event.level === "warning" ? " is-warning" : ""}`}
                  role="cell"
                >
                  {event.level === "warning" ? (
                    <TriangleAlert aria-hidden="true" size={14} />
                  ) : (
                    <Info aria-hidden="true" size={14} />
                  )}
                  {LEVEL_LABEL[event.level]}
                </span>
                <span role="cell">
                  {formatEventTime(event.timestamp)}
                  {event.approximate && <em>관찰 시각</em>}
                </span>
                <span role="cell">{event.source}</span>
                <span role="cell">{event.eventId}</span>
              </div>
            ))
          )}
        </div>

        <section aria-label="이벤트 세부 정보" className="event-viewer-detail">
          {selectedEvent ? (
            <>
              <h3>{selectedEvent.typeLabel}</h3>
              <p>{selectedEvent.detail}</p>
              <dl>
                <div>
                  <dt>로그 이름</dt>
                  <dd>{activeChannel.label}</dd>
                </div>
                <div>
                  <dt>원본</dt>
                  <dd>{selectedEvent.source}</dd>
                </div>
                <div>
                  <dt>이벤트 ID</dt>
                  <dd>{selectedEvent.eventId}</dd>
                </div>
                <div>
                  <dt>수준</dt>
                  <dd>{LEVEL_LABEL[selectedEvent.level]}</dd>
                </div>
                <div>
                  <dt>기록된 날짜</dt>
                  <dd>{formatEventTime(selectedEvent.timestamp)}</dd>
                </div>
                <div>
                  <dt>작업 범주</dt>
                  <dd>{selectedEvent.taskCategory}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="event-viewer-detail-empty">
              이벤트를 선택하면 자세한 정보가 표시됩니다.
            </p>
          )}
        </section>

        <footer className="event-viewer-status">
          <span>이벤트 {visibleEvents.length}개</span>
          <span>
            {isFiltered
              ? `전체 ${channelEvents.length}개 중 필터됨`
              : `${activeChannel.label} 로그 전체`}
          </span>
        </footer>
      </section>
    </div>
  );
}
