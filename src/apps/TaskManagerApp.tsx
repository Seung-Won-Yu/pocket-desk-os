import { Activity, Cpu, HardDrive, MemoryStick, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNextRovingIndex } from "../shell/keyboardNav";
import { appMetadata } from "./metadata";
import type { OpenWindowInfo, SoundEffectName } from "../types";
import { formatStorageSize } from "../utils/format";

type TaskManagerAppProps = {
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  openWindows: OpenWindowInfo[];
  playSound: (effect: SoundEffectName) => void;
};

type TaskManagerTab = "performance" | "processes";

const SAMPLE_COUNT = 48;
const SAMPLE_INTERVAL_MS = 1000;

/**
 * Per-window load figures. Derived from the window id so a process keeps the
 * same numbers across re-renders instead of flickering every tick.
 */
function getWindowLoad(windowId: string, maximized: boolean, minimized: boolean) {
  let hash = 0;
  for (let index = 0; index < windowId.length; index += 1) {
    hash = (hash * 31 + windowId.charCodeAt(index)) % 100000;
  }
  const base = hash % 100;
  const memoryMb = 24 + (base % 96) + (maximized ? 48 : 0);
  const cpu = minimized ? 0 : Number((((base % 37) / 10) * (maximized ? 1.4 : 1)).toFixed(1));
  return { cpu, diskMbPerSecond: Number(((base % 13) / 10).toFixed(1)), memoryMb };
}

function Sparkline({
  label,
  samples,
  unit,
}: {
  label: string;
  samples: number[];
  unit: string;
}) {
  const points = samples
    .map((value, index) => {
      const x = (index / Math.max(1, SAMPLE_COUNT - 1)) * 100;
      const y = 100 - Math.max(0, Math.min(100, value));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const current = samples[samples.length - 1] ?? 0;

  return (
    <div className="taskmgr-graph">
      <div className="taskmgr-graph-head">
        <span>{label}</span>
        <strong>
          {current.toFixed(0)}
          {unit}
        </strong>
      </div>
      <svg
        aria-label={`${label} 사용률 그래프`}
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 100"
      >
        {[25, 50, 75].map((line) => (
          <line key={line} x1="0" x2="100" y1={line} y2={line} />
        ))}
        <polyline points={points} />
      </svg>
    </div>
  );
}

export default function TaskManagerApp({
  closeWindow,
  focusWindow,
  openWindows,
  playSound,
}: TaskManagerAppProps) {
  const [tab, setTab] = useState<TaskManagerTab>("processes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [cpuSamples, setCpuSamples] = useState<number[]>(() => new Array(SAMPLE_COUNT).fill(4));
  const [memorySamples, setMemorySamples] = useState<number[]>(() =>
    new Array(SAMPLE_COUNT).fill(28),
  );
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const jitterRef = useRef(0);

  const rows = useMemo(
    () =>
      openWindows
        .map((item) => ({ ...item, ...getWindowLoad(item.id, item.maximized, item.minimized) }))
        .sort(
          (first, second) => second.cpu - first.cpu || first.title.localeCompare(second.title),
        ),
    [openWindows],
  );

  // The grid is a single tab stop: arrows move the active row, Enter focuses the
  // window, Space selects it.
  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    index: number,
    windowId: string,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      focusWindow(windowId);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      setSelectedId(windowId);
      return;
    }

    const next = getNextRovingIndex(event.key, index, rows.length);
    if (next === null) return;
    event.preventDefault();
    setActiveIndex(next);
    rowRefs.current[next]?.focus();
  };

  // A closed window must not leave the tab stop pointing past the last row.
  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const totals = useMemo(
    () => ({
      cpu: rows.reduce((sum, row) => sum + row.cpu, 0),
      disk: rows.reduce((sum, row) => sum + row.diskMbPerSecond, 0),
      memoryMb: rows.reduce((sum, row) => sum + row.memoryMb, 0),
    }),
    [rows],
  );

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    let cancelled = false;
    navigator.storage
      .estimate()
      .then((estimate) => {
        if (!cancelled) setStorage(estimate);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      jitterRef.current = (jitterRef.current + 7) % 23;
      const jitter = jitterRef.current / 4;
      setCpuSamples((current) => [
        ...current.slice(1),
        Math.min(100, 3 + totals.cpu * 2.4 + jitter),
      ]);
      setMemorySamples((current) => [
        ...current.slice(1),
        Math.min(100, 22 + totals.memoryMb / 24 + jitter / 3),
      ]);
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [totals.cpu, totals.memoryMb]);

  // role="tablist" promises Left/Right movement between tabs.
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const order: TaskManagerTab[] = ["processes", "performance"];
    const next = getNextRovingIndex(event.key, order.indexOf(tab), order.length);
    if (next === null) return;
    event.preventDefault();
    setTab(order[next]);
  };

  const endTask = (windowId: string) => {
    playSound("close");
    closeWindow(windowId);
    setSelectedId(null);
  };

  return (
    <div className="taskmgr-app">
      <div className="taskmgr-tabs" onKeyDown={handleTabKeyDown} role="tablist">
        <button
          aria-controls="taskmgr-panel-processes"
          aria-selected={tab === "processes"}
          className={tab === "processes" ? "is-active" : ""}
          id="taskmgr-tab-processes"
          onClick={() => setTab("processes")}
          role="tab"
          tabIndex={tab === "processes" ? 0 : -1}
          type="button"
        >
          <Activity size={15} /> 프로세스
        </button>
        <button
          aria-controls="taskmgr-panel-performance"
          aria-selected={tab === "performance"}
          className={tab === "performance" ? "is-active" : ""}
          id="taskmgr-tab-performance"
          onClick={() => setTab("performance")}
          role="tab"
          tabIndex={tab === "performance" ? 0 : -1}
          type="button"
        >
          <Cpu size={15} /> 성능
        </button>
      </div>

      {tab === "processes" ? (
        <div
          aria-labelledby="taskmgr-tab-processes"
          className="taskmgr-processes"
          id="taskmgr-panel-processes"
          role="tabpanel"
        >
          <div aria-label="실행 중인 프로세스" className="taskmgr-table" role="grid">
            <div className="taskmgr-row is-head" role="row">
              <span role="columnheader">이름</span>
              <span role="columnheader">CPU</span>
              <span role="columnheader">메모리</span>
              <span role="columnheader">디스크</span>
            </div>
            {rows.length === 0 ? (
              <p className="taskmgr-empty">실행 중인 앱이 없습니다.</p>
            ) : (
              rows.map((row, index) => {
                const Icon = appMetadata[row.appId].icon;
                return (
                  <div
                    aria-selected={selectedId === row.id}
                    className={`taskmgr-row${selectedId === row.id ? " is-selected" : ""}`}
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    onDoubleClick={() => focusWindow(row.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, index, row.id)}
                    ref={(node) => {
                      rowRefs.current[index] = node;
                    }}
                    role="row"
                    tabIndex={index === activeIndex ? 0 : -1}
                  >
                    <span className="taskmgr-name" role="cell">
                      <Icon size={16} style={{ color: appMetadata[row.appId].accent }} />
                      {row.title}
                      {row.minimized && <em>최소화됨</em>}
                    </span>
                    <span role="cell">{row.cpu.toFixed(1)}%</span>
                    <span role="cell">{row.memoryMb.toLocaleString("ko-KR")} MB</span>
                    <span role="cell">{row.diskMbPerSecond.toFixed(1)} MB/s</span>
                  </div>
                );
              })
            )}
          </div>
          <footer className="taskmgr-actions">
            <p>
              프로세스 {rows.length}개 · CPU {totals.cpu.toFixed(1)}% · 메모리{" "}
              {totals.memoryMb.toLocaleString("ko-KR")} MB
            </p>
            <button
              disabled={!selectedId}
              onClick={() => selectedId && endTask(selectedId)}
              type="button"
            >
              <Square size={14} /> 작업 끝내기
            </button>
          </footer>
        </div>
      ) : (
        <div
          aria-labelledby="taskmgr-tab-performance"
          className="taskmgr-performance"
          id="taskmgr-panel-performance"
          role="tabpanel"
        >
          <Sparkline label="CPU" samples={cpuSamples} unit="%" />
          <Sparkline label="메모리" samples={memorySamples} unit="%" />
          <dl className="taskmgr-stats">
            <div>
              <dt>
                <Cpu size={14} /> 프로세스
              </dt>
              <dd>{rows.length}개</dd>
            </div>
            <div>
              <dt>
                <MemoryStick size={14} /> 커밋된 메모리
              </dt>
              <dd>{totals.memoryMb.toLocaleString("ko-KR")} MB</dd>
            </div>
            <div>
              <dt>
                <HardDrive size={14} /> 브라우저 저장소
              </dt>
              <dd>
                {storage?.usage != null && storage.quota != null
                  ? `${formatStorageSize(storage.usage)} / ${formatStorageSize(storage.quota)}`
                  : "측정할 수 없음"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
