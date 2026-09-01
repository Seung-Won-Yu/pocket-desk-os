import {
  AlarmClock,
  Flag,
  Globe2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Watch,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  CLOCK_ALARM_LIMIT,
  createClockAlarm,
  describeAlarmFireDay,
  formatClockDuration,
  formatStopwatchDuration,
  getClockTimerRemaining,
  isValidAlarmTime,
  pauseClockTimer,
  describeAlarmRepeat,
  rescheduleClockAlarm,
  resetClockTimer,
  toggleAlarmRepeatDay,
  WEEKDAY_LABELS,
  setClockAlarmEnabled,
  setClockTimerDuration,
  startClockTimer,
  loadWorldClocks,
  persistWorldClocks,
  readWorldClock,
  WORLD_CLOCK_CITIES,
  type ClockAlarm,
  type ClockTimer,
} from "../shell/clock";
import { getNextRovingIndex } from "../shell/keyboardNav";
import { type OpenWindowInfo, type SoundEffectName } from "../types";

type ClockAppProps = {
  clockAlarms: ClockAlarm[];
  clockTimer: ClockTimer;
  openWindows: OpenWindowInfo[];
  playSound: (effect: SoundEffectName) => void;
  updateClockAlarms: (alarms: ClockAlarm[]) => void;
  updateClockTimer: (timer: ClockTimer) => void;
  windowId: string;
};

type ClockTab = "alarm" | "timer" | "world" | "stopwatch";

const CLOCK_TABS: { icon: typeof AlarmClock; id: ClockTab; label: string }[] = [
  { icon: AlarmClock, id: "alarm", label: "알람" },
  { icon: Timer, id: "timer", label: "타이머" },
  { icon: Globe2, id: "world", label: "세계 시계" },
  { icon: Watch, id: "stopwatch", label: "스톱워치" },
];

const TIMER_PRESETS = [
  { label: "1분", ms: 60_000 },
  { label: "3분", ms: 180_000 },
  { label: "5분", ms: 300_000 },
  { label: "10분", ms: 600_000 },
];

type StopwatchLap = {
  /** Monotonic flag number — survives the cap dropping older laps. */
  n: number;
  /** This lap's own duration, fixed at flag time. */
  split: number;
  /** Total elapsed at flag time. */
  total: number;
};

type StopwatchState = {
  baseMs: number;
  laps: StopwatchLap[];
  running: boolean;
  startedAt: number | null;
};

const IDLE_STOPWATCH: StopwatchState = { baseMs: 0, laps: [], running: false, startedAt: null };

export default function ClockApp({
  clockAlarms,
  clockTimer,
  openWindows,
  playSound,
  updateClockAlarms,
  updateClockTimer,
  windowId,
}: ClockAppProps) {
  const [tab, setTab] = useState<ClockTab>("alarm");
  const [newAlarmTime, setNewAlarmTime] = useState("07:30");
  const [newAlarmLabel, setNewAlarmLabel] = useState("");
  const [stopwatch, setStopwatch] = useState<StopwatchState>(IDLE_STOPWATCH);
  const [worldClocks, setWorldClocks] = useState<string[]>(() => loadWorldClocks());
  const [newCityId, setNewCityId] = useState("");

  useEffect(() => {
    persistWorldClocks(worldClocks);
  }, [worldClocks]);
  const [now, setNow] = useState(() => Date.now());
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // One display clock for everything that moves: the header time, the timer
  // readout and the stopwatch. The alarms and timer themselves fire from the
  // shell scheduler — this tick only keeps the numbers on screen honest, so it
  // stops entirely while the window is minimized (the frame stays mounted) and
  // catches up the moment it comes back.
  const selfMinimized = openWindows.find((item) => item.id === windowId)?.minimized ?? false;
  useEffect(() => {
    if (selfMinimized) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), stopwatch.running ? 50 : 250);
    return () => window.clearInterval(id);
  }, [selfMinimized, stopwatch.running]);

  const sortedAlarms = useMemo(
    () => [...clockAlarms].sort((a, b) => a.time.localeCompare(b.time)),
    [clockAlarms],
  );
  const nextAlarm = useMemo(
    () =>
      clockAlarms
        .filter((alarm) => alarm.enabled)
        .reduce<ClockAlarm | null>(
          (best, alarm) => (!best || alarm.nextFireAt < best.nextFireAt ? alarm : best),
          null,
        ),
    [clockAlarms],
  );

  const addAlarm = () => {
    if (!isValidAlarmTime(newAlarmTime) || clockAlarms.length >= CLOCK_ALARM_LIMIT) return;
    updateClockAlarms([
      ...clockAlarms,
      createClockAlarm(newAlarmTime, newAlarmLabel, Date.now()),
    ]);
    setNewAlarmLabel("");
    playSound("toggle");
  };

  const addWorldClock = () => {
    if (!newCityId || worldClocks.includes(newCityId)) return;
    setWorldClocks([...worldClocks, newCityId]);
    setNewCityId("");
    playSound("toggle");
  };

  const timerRemaining = getClockTimerRemaining(clockTimer, now);
  const timerIdle = !clockTimer.running && clockTimer.remainingMs === clockTimer.durationMs;
  const timerProgress =
    clockTimer.durationMs > 0
      ? Math.max(0, Math.min(1, timerRemaining / clockTimer.durationMs))
      : 0;
  const timerHours = Math.floor(clockTimer.durationMs / 3_600_000);
  const timerMinutes = Math.floor(clockTimer.durationMs / 60_000) % 60;
  const timerSeconds = Math.floor(clockTimer.durationMs / 1000) % 60;

  const setTimerParts = (hours: number, minutes: number, seconds: number) => {
    const clampPart = (value: number, max: number) =>
      Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
    const ms =
      clampPart(hours, 99) * 3_600_000 +
      clampPart(minutes, 59) * 60_000 +
      clampPart(seconds, 59) * 1000;
    updateClockTimer(setClockTimerDuration(clockTimer, Math.max(1000, ms)));
  };

  const stopwatchElapsed =
    stopwatch.baseMs +
    (stopwatch.running && stopwatch.startedAt !== null ? now - stopwatch.startedAt : 0);

  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // A horizontal tablist: vertical arrows belong to whatever is around it.
    if (event.key === "ArrowUp" || event.key === "ArrowDown") return;
    const currentIndex = CLOCK_TABS.findIndex((item) => item.id === tab);
    const nextIndex = getNextRovingIndex(event.key, currentIndex, CLOCK_TABS.length);
    if (nextIndex === null) return;
    event.preventDefault();
    setTab(CLOCK_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="clock-app">
      <header className="clock-header">
        <div aria-label="현재 시각" className="clock-now" role="group">
          {new Date(now).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            hour12: false,
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
        <div
          aria-label="알람 및 시계 화면"
          className="clock-tabs"
          onKeyDown={handleTabKey}
          role="tablist"
        >
          {CLOCK_TABS.map((item, index) => (
            <button
              aria-controls={tab === item.id ? `clock-panel-${item.id}` : undefined}
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : undefined}
              id={`clock-tab-${item.id}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={tab === item.id ? 0 : -1}
              type="button"
            >
              <item.icon aria-hidden size={15} />
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {tab === "alarm" && (
        <section
          aria-labelledby="clock-tab-alarm"
          className="clock-panel"
          id="clock-panel-alarm"
          role="tabpanel"
        >
          <form
            className="clock-alarm-form"
            onSubmit={(event) => {
              event.preventDefault();
              addAlarm();
            }}
          >
            <input
              aria-label="알람 시간"
              onChange={(event) => setNewAlarmTime(event.target.value)}
              required
              type="time"
              value={newAlarmTime}
            />
            <input
              aria-label="알람 이름"
              maxLength={40}
              onChange={(event) => setNewAlarmLabel(event.target.value)}
              placeholder="알람 이름 (선택)"
              type="text"
              value={newAlarmLabel}
            />
            <button
              disabled={
                !isValidAlarmTime(newAlarmTime) || clockAlarms.length >= CLOCK_ALARM_LIMIT
              }
              type="submit"
            >
              <Plus aria-hidden size={15} /> 알람 추가
            </button>
          </form>

          <p aria-live="polite" className="clock-summary">
            {nextAlarm
              ? `다음 알람: ${describeAlarmFireDay(nextAlarm.nextFireAt, now)} ${nextAlarm.time}${
                  nextAlarm.label ? ` · ${nextAlarm.label}` : ""
                }`
              : "예정된 알람이 없습니다."}
          </p>

          {sortedAlarms.length === 0 ? (
            <p className="clock-empty">
              알람을 추가하면 창을 닫아도 셸이 시간에 맞춰 알립니다.
            </p>
          ) : (
            <ul aria-label="알람 목록" className="clock-alarm-list">
              {sortedAlarms.map((alarm) => {
                const alarmName = alarm.label || alarm.time;
                return (
                  <li className={alarm.enabled ? "is-armed" : undefined} key={alarm.id}>
                    <input
                      aria-label={`알람 시간 변경: ${alarmName}`}
                      className="clock-alarm-time"
                      onChange={(event) => {
                        if (!isValidAlarmTime(event.target.value)) return;
                        updateClockAlarms(
                          clockAlarms.map((item) =>
                            item.id === alarm.id
                              ? rescheduleClockAlarm(item, event.target.value, Date.now())
                              : item,
                          ),
                        );
                      }}
                      type="time"
                      value={alarm.time}
                    />
                    <div className="clock-alarm-meta">
                      <strong>{alarm.label || "알람"}</strong>
                      <small>
                        {alarm.enabled
                          ? alarm.repeatDays.length > 0
                            ? `${describeAlarmRepeat(alarm.repeatDays)} ${alarm.time}에 울림`
                            : `${describeAlarmFireDay(alarm.nextFireAt, now)} ${alarm.time}에 울림`
                          : "꺼짐"}
                      </small>
                      <div
                        aria-label={`반복 요일: ${alarmName}`}
                        className="clock-repeat-days"
                        role="group"
                      >
                        {WEEKDAY_LABELS.map((label, day) => (
                          <button
                            aria-label={`${label}요일 반복: ${alarmName}`}
                            aria-pressed={alarm.repeatDays.includes(day)}
                            className={alarm.repeatDays.includes(day) ? "is-on" : undefined}
                            key={label}
                            onClick={() =>
                              updateClockAlarms(
                                clockAlarms.map((item) =>
                                  item.id === alarm.id
                                    ? toggleAlarmRepeatDay(item, day, Date.now())
                                    : item,
                                ),
                              )
                            }
                            type="button"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="settings-toggle clock-alarm-toggle">
                      <input
                        aria-label={`알람 사용: ${alarmName}`}
                        checked={alarm.enabled}
                        onChange={(event) => {
                          updateClockAlarms(
                            clockAlarms.map((item) =>
                              item.id === alarm.id
                                ? setClockAlarmEnabled(item, event.target.checked, Date.now())
                                : item,
                            ),
                          );
                          playSound("toggle");
                        }}
                        type="checkbox"
                      />
                      <span />
                    </label>
                    <button
                      aria-label={`알람 삭제: ${alarmName}`}
                      className="clock-icon-button"
                      onClick={() =>
                        updateClockAlarms(clockAlarms.filter((item) => item.id !== alarm.id))
                      }
                      title="알람 삭제"
                      type="button"
                    >
                      <Trash2 aria-hidden size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "timer" && (
        <section
          aria-labelledby="clock-tab-timer"
          className="clock-panel"
          id="clock-panel-timer"
          role="tabpanel"
        >
          <div aria-label="남은 시간" aria-live="off" className="clock-readout" role="timer">
            {formatClockDuration(timerRemaining)}
          </div>
          <div aria-hidden className="clock-progress">
            <span style={{ width: `${timerProgress * 100}%` }} />
          </div>

          <div className="clock-timer-setup">
            <label>
              시간
              <input
                aria-label="타이머 시간 (시)"
                disabled={!timerIdle}
                max={99}
                min={0}
                onChange={(event) =>
                  setTimerParts(Number(event.target.value), timerMinutes, timerSeconds)
                }
                type="number"
                value={timerHours}
              />
            </label>
            <label>
              분
              <input
                aria-label="타이머 시간 (분)"
                disabled={!timerIdle}
                max={59}
                min={0}
                onChange={(event) =>
                  setTimerParts(timerHours, Number(event.target.value), timerSeconds)
                }
                type="number"
                value={timerMinutes}
              />
            </label>
            <label>
              초
              <input
                aria-label="타이머 시간 (초)"
                disabled={!timerIdle}
                max={59}
                min={0}
                onChange={(event) =>
                  setTimerParts(timerHours, timerMinutes, Number(event.target.value))
                }
                type="number"
                value={timerSeconds}
              />
            </label>
          </div>

          <div className="clock-presets" role="group" aria-label="타이머 프리셋">
            {TIMER_PRESETS.map((preset) => (
              <button
                disabled={!timerIdle}
                key={preset.ms}
                onClick={() => updateClockTimer(setClockTimerDuration(clockTimer, preset.ms))}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="clock-actions">
            {clockTimer.running ? (
              <button
                onClick={() => {
                  updateClockTimer(pauseClockTimer(clockTimer, Date.now()));
                  playSound("toggle");
                }}
                type="button"
              >
                <Pause aria-hidden size={15} /> 일시 정지
              </button>
            ) : (
              <button
                disabled={timerRemaining <= 0}
                onClick={() => {
                  updateClockTimer(startClockTimer(clockTimer, Date.now()));
                  playSound("toggle");
                }}
                type="button"
              >
                <Play aria-hidden size={15} /> {timerIdle ? "시작" : "계속"}
              </button>
            )}
            <button
              disabled={timerIdle}
              onClick={() => updateClockTimer(resetClockTimer(clockTimer))}
              type="button"
            >
              <RotateCcw aria-hidden size={15} /> 초기화
            </button>
          </div>
          <p className="clock-hint">
            타이머는 셸에서 동작하므로 창을 닫거나 새로 고쳐도 이어집니다.
          </p>
        </section>
      )}

      {tab === "world" && (
        <section
          aria-labelledby="clock-tab-world"
          className="clock-panel"
          id="clock-panel-world"
          role="tabpanel"
        >
          <form
            className="clock-world-form"
            onSubmit={(event) => {
              event.preventDefault();
              addWorldClock();
            }}
          >
            <select
              aria-label="추가할 도시"
              onChange={(event) => setNewCityId(event.target.value)}
              value={newCityId}
            >
              <option value="">도시 선택…</option>
              {WORLD_CLOCK_CITIES.filter((city) => !worldClocks.includes(city.id)).map(
                (city) => (
                  <option key={city.id} value={city.id}>
                    {city.label}
                  </option>
                ),
              )}
            </select>
            <button disabled={!newCityId} type="submit">
              <Plus aria-hidden size={15} /> 도시 추가
            </button>
          </form>
          {worldClocks.length === 0 ? (
            <p className="clock-empty">도시를 추가하면 해당 시간대의 현재 시각을 보여줍니다.</p>
          ) : (
            <ul aria-label="세계 시계 목록" className="clock-world-list">
              {worldClocks.map((cityId) => {
                const city = WORLD_CLOCK_CITIES.find((item) => item.id === cityId);
                if (!city) return null;
                const reading = readWorldClock(cityId, now);
                return (
                  <li key={cityId}>
                    <div className="clock-world-meta">
                      <strong>{city.label}</strong>
                      <small>
                        {reading.dayLabel} · {reading.offsetLabel}
                      </small>
                    </div>
                    <span className="clock-world-time">{reading.time}</span>
                    <button
                      aria-label={`도시 삭제: ${city.label}`}
                      className="clock-icon-button"
                      onClick={() => setWorldClocks(worldClocks.filter((id) => id !== cityId))}
                      title="도시 삭제"
                      type="button"
                    >
                      <Trash2 aria-hidden size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "stopwatch" && (
        <section
          aria-labelledby="clock-tab-stopwatch"
          className="clock-panel"
          id="clock-panel-stopwatch"
          role="tabpanel"
        >
          <div aria-label="경과 시간" aria-live="off" className="clock-readout" role="timer">
            {formatStopwatchDuration(stopwatchElapsed)}
          </div>
          <div className="clock-actions">
            {stopwatch.running ? (
              <button
                onClick={() => {
                  setStopwatch((current) => ({
                    ...current,
                    baseMs:
                      current.baseMs +
                      (current.startedAt !== null ? Date.now() - current.startedAt : 0),
                    running: false,
                    startedAt: null,
                  }));
                  playSound("toggle");
                }}
                type="button"
              >
                <Pause aria-hidden size={15} /> 중지
              </button>
            ) : (
              <button
                onClick={() => {
                  setStopwatch((current) => ({
                    ...current,
                    running: true,
                    startedAt: Date.now(),
                  }));
                  playSound("toggle");
                }}
                type="button"
              >
                <Play aria-hidden size={15} /> {stopwatchElapsed > 0 ? "계속" : "시작"}
              </button>
            )}
            <button
              disabled={!stopwatch.running}
              onClick={() =>
                setStopwatch((current) => {
                  const elapsed =
                    current.baseMs +
                    (current.running && current.startedAt !== null
                      ? Date.now() - current.startedAt
                      : 0);
                  const last = current.laps[current.laps.length - 1];
                  const lap = {
                    n: (last?.n ?? 0) + 1,
                    split: elapsed - (last?.total ?? 0),
                    total: elapsed,
                  };
                  return { ...current, laps: [...current.laps, lap].slice(-99) };
                })
              }
              type="button"
            >
              <Flag aria-hidden size={15} /> 플래그
            </button>
            <button
              disabled={stopwatch.running || stopwatchElapsed === 0}
              onClick={() => setStopwatch(IDLE_STOPWATCH)}
              type="button"
            >
              <RotateCcw aria-hidden size={15} /> 초기화
            </button>
          </div>
          {stopwatch.laps.length > 0 && (
            <table aria-label="플래그 기록" className="clock-laps">
              <thead>
                <tr>
                  <th scope="col">플래그</th>
                  <th scope="col">구간</th>
                  <th scope="col">전체</th>
                </tr>
              </thead>
              <tbody>
                {[...stopwatch.laps].reverse().map((lap) => (
                  <tr key={lap.n}>
                    <td>{lap.n}</td>
                    <td>{formatStopwatchDuration(lap.split)}</td>
                    <td>{formatStopwatchDuration(lap.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
