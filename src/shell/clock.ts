import { CLOCK_ALARMS_KEY, CLOCK_TIMER_KEY } from "./constants";

/**
 * The shell half of 알람 및 시계. Alarms and the timer live at the shell, not in
 * the app window, for the same reason Windows keeps them in a background task:
 * an alarm that only rings while its window is open is a countdown display,
 * not an alarm. The app edits this state through props; a scheduler in the
 * shell fires the notifications whether or not the window exists, and both
 * survive a reload because the deadlines are stored as absolute times.
 */
export type ClockAlarm = {
  enabled: boolean;
  id: string;
  label: string;
  /** Epoch ms of the next scheduled ring; recomputed whenever the alarm is armed. */
  nextFireAt: number;
  /** Wall-clock ring time as 24h "HH:MM". */
  time: string;
};

export type ClockTimer = {
  /** Configured length in ms — what 초기화 returns to. */
  durationMs: number;
  /** Epoch ms a running timer fires at; null while paused or idle. */
  endsAt: number | null;
  /** Remaining ms while paused or idle; ignored while running. */
  remainingMs: number;
  running: boolean;
};

export const CLOCK_ALARM_LIMIT = 24;
export const CLOCK_TIMER_MAX_MS = 100 * 60 * 60 * 1000;
export const CLOCK_TIMER_DEFAULT_MS = 5 * 60 * 1000;
/** A ring further in the past than this is reported as missed, not live. */
export const MISSED_ALARM_GRACE_MS = 60 * 1000;

const ALARM_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidAlarmTime(value: string) {
  return ALARM_TIME_PATTERN.test(value);
}

/**
 * The next moment the wall clock reads `time`: today if that is still ahead,
 * otherwise tomorrow. Built through local Date math so a DST jump moves the
 * ring with the clock instead of drifting an hour off it.
 */
export function getNextAlarmFireTime(time: string, now: number) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now) {
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
  }
  return next.getTime();
}

export function createClockAlarm(time: string, label: string, now: number): ClockAlarm {
  return {
    enabled: true,
    id: `alarm-${crypto.randomUUID()}`,
    label: label.trim(),
    nextFireAt: getNextAlarmFireTime(time, now),
    time,
  };
}

/** Re-arms (or disarms) an alarm; arming always schedules from the present. */
export function setClockAlarmEnabled(
  alarm: ClockAlarm,
  enabled: boolean,
  now: number,
): ClockAlarm {
  if (!enabled) return { ...alarm, enabled: false };
  return { ...alarm, enabled: true, nextFireAt: getNextAlarmFireTime(alarm.time, now) };
}

/** Changes an alarm's ring time and re-arms it in one step. */
export function rescheduleClockAlarm(alarm: ClockAlarm, time: string, now: number): ClockAlarm {
  if (!isValidAlarmTime(time)) return alarm;
  return { ...alarm, enabled: true, nextFireAt: getNextAlarmFireTime(time, now), time };
}

/**
 * Splits the list into alarms that should ring now and the list as it looks
 * after they ring. One-shot like an un-repeated Windows alarm: a fired alarm
 * turns itself off instead of silently re-arming for tomorrow. Returns the
 * input array untouched when nothing is due, so a 500ms scheduler can compare
 * by reference and skip the state update entirely.
 */
export function collectDueClockAlarms(alarms: ClockAlarm[], now: number) {
  const due = alarms.filter((alarm) => alarm.enabled && alarm.nextFireAt <= now);
  if (due.length === 0) return { due, next: alarms };
  const dueIds = new Set(due.map((alarm) => alarm.id));
  return {
    due,
    next: alarms.map((alarm) => (dueIds.has(alarm.id) ? { ...alarm, enabled: false } : alarm)),
  };
}

/** True when the ring time passed long ago — a reload finding a stale deadline. */
export function isMissedAlarmFire(alarm: ClockAlarm, now: number) {
  return now - alarm.nextFireAt > MISSED_ALARM_GRACE_MS;
}

export function createIdleClockTimer(durationMs = CLOCK_TIMER_DEFAULT_MS): ClockTimer {
  const clamped = clampTimerDuration(durationMs);
  return { durationMs: clamped, endsAt: null, remainingMs: clamped, running: false };
}

export function clampTimerDuration(durationMs: number) {
  if (!Number.isFinite(durationMs)) return CLOCK_TIMER_DEFAULT_MS;
  return Math.min(CLOCK_TIMER_MAX_MS, Math.max(1000, Math.round(durationMs)));
}

export function startClockTimer(timer: ClockTimer, now: number): ClockTimer {
  const remaining = getClockTimerRemaining(timer, now);
  if (remaining <= 0) return timer;
  return { ...timer, endsAt: now + remaining, remainingMs: remaining, running: true };
}

export function pauseClockTimer(timer: ClockTimer, now: number): ClockTimer {
  if (!timer.running) return timer;
  return {
    ...timer,
    endsAt: null,
    remainingMs: getClockTimerRemaining(timer, now),
    running: false,
  };
}

export function resetClockTimer(timer: ClockTimer): ClockTimer {
  return { ...timer, endsAt: null, remainingMs: timer.durationMs, running: false };
}

export function setClockTimerDuration(timer: ClockTimer, durationMs: number): ClockTimer {
  if (timer.running) return timer;
  const clamped = clampTimerDuration(durationMs);
  return { ...timer, durationMs: clamped, endsAt: null, remainingMs: clamped, running: false };
}

export function getClockTimerRemaining(timer: ClockTimer, now: number) {
  if (timer.running && timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  return Math.max(0, timer.remainingMs);
}

/**
 * One scheduler step. `fired` is true exactly once per countdown: the moment
 * the deadline passes, the timer resets itself to its configured length —
 * including a deadline that passed while the tab was closed, which is how a
 * timer left running fires (as due) right after a reload.
 */
export function tickClockTimer(
  timer: ClockTimer,
  now: number,
): { fired: boolean; next: ClockTimer } {
  if (!timer.running || timer.endsAt === null || timer.endsAt > now) {
    return { fired: false, next: timer };
  }
  return { fired: true, next: resetClockTimer(timer) };
}

/** "MM:SS", growing to "H:MM:SS" past an hour — the way the Windows timer reads. */
export function formatClockDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** Stopwatch reading with centiseconds: "MM:SS.cc", hours prefixed when reached. */
export function formatStopwatchDuration(ms: number) {
  const clamped = Math.max(0, Math.floor(ms));
  const centis = Math.floor((clamped % 1000) / 10);
  const totalSeconds = Math.floor(clamped / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    centis,
  ).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${base}` : base;
}

/** "오늘 14:30" / "내일 07:00" for the alarm list's next-ring caption. */
export function describeAlarmFireDay(nextFireAt: number, now: number) {
  const fire = new Date(nextFireAt);
  const today = new Date(now);
  const isToday =
    fire.getFullYear() === today.getFullYear() &&
    fire.getMonth() === today.getMonth() &&
    fire.getDate() === today.getDate();
  return isToday ? "오늘" : "내일";
}

export function loadClockAlarms(): ClockAlarm[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CLOCK_ALARMS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ClockAlarm =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ClockAlarm).id === "string" &&
          typeof (item as ClockAlarm).label === "string" &&
          typeof (item as ClockAlarm).enabled === "boolean" &&
          Number.isFinite((item as ClockAlarm).nextFireAt) &&
          isValidAlarmTime((item as ClockAlarm).time),
      )
      .slice(0, CLOCK_ALARM_LIMIT);
  } catch {
    return [];
  }
}

export function persistClockAlarms(alarms: ClockAlarm[]) {
  try {
    localStorage.setItem(CLOCK_ALARMS_KEY, JSON.stringify(alarms.slice(0, CLOCK_ALARM_LIMIT)));
  } catch {
    // Storage is full or blocked; the in-memory alarms keep working.
  }
}

export function loadClockTimer(): ClockTimer {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CLOCK_TIMER_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return createIdleClockTimer();
    const candidate = parsed as ClockTimer;
    if (
      !Number.isFinite(candidate.durationMs) ||
      !Number.isFinite(candidate.remainingMs) ||
      typeof candidate.running !== "boolean" ||
      (candidate.endsAt !== null && !Number.isFinite(candidate.endsAt))
    ) {
      return createIdleClockTimer();
    }
    const durationMs = clampTimerDuration(candidate.durationMs);
    // A "running" record without a deadline cannot fire; treat it as paused.
    if (candidate.running && candidate.endsAt === null) {
      return {
        durationMs,
        endsAt: null,
        remainingMs: Math.min(durationMs, Math.max(0, candidate.remainingMs)),
        running: false,
      };
    }
    return {
      durationMs,
      endsAt: candidate.endsAt,
      remainingMs: Math.min(durationMs, Math.max(0, candidate.remainingMs)),
      running: candidate.running,
    };
  } catch {
    return createIdleClockTimer();
  }
}

export function persistClockTimer(timer: ClockTimer) {
  try {
    localStorage.setItem(CLOCK_TIMER_KEY, JSON.stringify(timer));
  } catch {
    // Same rule as the alarms: losing the write must not lose the session.
  }
}
