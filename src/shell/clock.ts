import { CLOCK_ALARMS_KEY, CLOCK_TIMER_KEY, CLOCK_WORLD_KEY } from "./constants";

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
  /**
   * Weekdays the alarm repeats on (0 = 일요일 … 6 = 토요일), sorted and unique.
   * Empty means one-shot: ring once, then turn off — records saved before this
   * field existed load as one-shot, which is what they were.
   */
  repeatDays: number[];
  /** Wall-clock ring time as 24h "HH:MM". */
  time: string;
};

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

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
export function getNextAlarmFireTime(time: string, now: number, repeatDays: number[] = []) {
  const [hours, minutes] = time.split(":").map(Number);
  if (repeatDays.length > 0) {
    // The nearest future moment landing on a repeat weekday. Offset 7 covers
    // "today is the only repeat day but its time already passed".
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(hours, minutes, 0, 0);
      if (candidate.getTime() > now && repeatDays.includes(candidate.getDay())) {
        return candidate.getTime();
      }
    }
  }
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now) {
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
  }
  return next.getTime();
}

export function createClockAlarm(
  time: string,
  label: string,
  now: number,
  repeatDays: number[] = [],
): ClockAlarm {
  const days = sanitizeRepeatDays(repeatDays);
  return {
    enabled: true,
    id: `alarm-${crypto.randomUUID()}`,
    label: label.trim(),
    nextFireAt: getNextAlarmFireTime(time, now, days),
    repeatDays: days,
    time,
  };
}

export function sanitizeRepeatDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ].sort((a, b) => a - b);
}

/** Adds or removes one weekday; an armed alarm re-schedules for the new set. */
export function toggleAlarmRepeatDay(alarm: ClockAlarm, day: number, now: number): ClockAlarm {
  const repeatDays = alarm.repeatDays.includes(day)
    ? alarm.repeatDays.filter((item) => item !== day)
    : sanitizeRepeatDays([...alarm.repeatDays, day]);
  return {
    ...alarm,
    nextFireAt: alarm.enabled
      ? getNextAlarmFireTime(alarm.time, now, repeatDays)
      : alarm.nextFireAt,
    repeatDays,
  };
}

/** "매주 월·수·금" for the alarm caption; empty for a one-shot alarm. */
export function describeAlarmRepeat(repeatDays: number[]) {
  if (repeatDays.length === 0) return "";
  if (repeatDays.length === 7) return "매일";
  return `매주 ${repeatDays.map((day) => WEEKDAY_LABELS[day]).join("·")}`;
}

/** Re-arms (or disarms) an alarm; arming always schedules from the present. */
export function setClockAlarmEnabled(
  alarm: ClockAlarm,
  enabled: boolean,
  now: number,
): ClockAlarm {
  if (!enabled) return { ...alarm, enabled: false };
  return {
    ...alarm,
    enabled: true,
    nextFireAt: getNextAlarmFireTime(alarm.time, now, alarm.repeatDays),
  };
}

/**
 * Changes an alarm's ring time. An armed alarm re-schedules; a disabled one
 * keeps its state — the row's time field fires onChange per keystroke, so
 * "editing turns the alarm on" would arm intermediate times the user never
 * chose.
 */
export function rescheduleClockAlarm(alarm: ClockAlarm, time: string, now: number): ClockAlarm {
  if (!isValidAlarmTime(time)) return alarm;
  return {
    ...alarm,
    nextFireAt: alarm.enabled
      ? getNextAlarmFireTime(time, now, alarm.repeatDays)
      : alarm.nextFireAt,
    time,
  };
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
    next: alarms.map((alarm) => {
      if (!dueIds.has(alarm.id)) return alarm;
      // A repeating alarm rides on to its next weekday; a one-shot turns off.
      if (alarm.repeatDays.length > 0) {
        return {
          ...alarm,
          nextFireAt: getNextAlarmFireTime(alarm.time, now, alarm.repeatDays),
        };
      }
      return { ...alarm, enabled: false };
    }),
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
    return (
      parsed
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
        // Records saved before repeat existed carry no repeatDays; they were
        // one-shot alarms, so they stay one-shot.
        .map((item) => ({ ...item, repeatDays: sanitizeRepeatDays(item.repeatDays) }))
        .slice(0, CLOCK_ALARM_LIMIT)
    );
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

/**
 * 세계 시계. Real timezone math through Intl — the same tz database the OS
 * uses — so DST transitions and half-hour offsets (Kolkata, Adelaide) are
 * right by construction instead of by a hand-maintained offset table.
 */
export type WorldClockCity = {
  /** IANA timezone id; doubles as the stored identifier. */
  id: string;
  label: string;
};

export const WORLD_CLOCK_CITIES: WorldClockCity[] = [
  { id: "Asia/Seoul", label: "서울" },
  { id: "Asia/Tokyo", label: "도쿄" },
  { id: "Asia/Shanghai", label: "상하이" },
  { id: "Asia/Singapore", label: "싱가포르" },
  { id: "Asia/Kolkata", label: "뉴델리" },
  { id: "Asia/Dubai", label: "두바이" },
  { id: "Europe/Moscow", label: "모스크바" },
  { id: "Europe/Istanbul", label: "이스탄불" },
  { id: "Europe/Berlin", label: "베를린" },
  { id: "Europe/Paris", label: "파리" },
  { id: "Europe/London", label: "런던" },
  { id: "America/Sao_Paulo", label: "상파울루" },
  { id: "America/New_York", label: "뉴욕" },
  { id: "America/Chicago", label: "시카고" },
  { id: "America/Denver", label: "덴버" },
  { id: "America/Los_Angeles", label: "로스앤젤레스" },
  { id: "Pacific/Honolulu", label: "호놀룰루" },
  { id: "Pacific/Auckland", label: "오클랜드" },
  { id: "Australia/Sydney", label: "시드니" },
];

const WORLD_CLOCK_CITY_IDS = new Set(WORLD_CLOCK_CITIES.map((city) => city.id));
const DEFAULT_WORLD_CLOCKS = ["Asia/Seoul", "Europe/London", "America/New_York"];

/**
 * The zone's UTC offset at a given moment, in minutes. Formats the moment in
 * that zone and reads the wall-clock fields back — the standard way to get an
 * offset out of Intl, which exposes no direct accessor.
 */
const intlFormatterCache = new Map<string, Intl.DateTimeFormat>();

/** Intl.DateTimeFormat construction is expensive; a display tick reuses these. */
function getCachedFormatter(key: string, build: () => Intl.DateTimeFormat) {
  const cached = intlFormatterCache.get(key);
  if (cached) return cached;
  const formatter = build();
  intlFormatterCache.set(key, formatter);
  return formatter;
}

export function getTimeZoneOffsetMinutes(timeZone: string, at: number) {
  const parts = getCachedFormatter(
    `offset|${timeZone}`,
    () =>
      new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "2-digit",
        second: "2-digit",
        timeZone,
        year: "numeric",
      }),
  ).formatToParts(new Date(at));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  // The seconds field is the finest the parts carry, so compare at that grain.
  return Math.round((asUtc - (at - (at % 1000))) / 60000);
}

export type WorldClockReading = {
  /** "어제" | "오늘" | "내일" relative to the local calendar. */
  dayLabel: string;
  /** Signed difference to local time, e.g. "+5시간 30분", or "현지와 같음". */
  offsetLabel: string;
  /** Wall-clock "HH:MM" in that zone. */
  time: string;
};

export function readWorldClock(
  timeZone: string,
  now: number,
  localZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): WorldClockReading {
  const time = getCachedFormatter(
    `time|${timeZone}`,
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        timeZone,
      }),
  ).format(new Date(now));

  const diffMinutes =
    getTimeZoneOffsetMinutes(timeZone, now) - getTimeZoneOffsetMinutes(localZone, now);
  const magnitude = Math.abs(diffMinutes);
  const hours = Math.floor(magnitude / 60);
  const minutes = magnitude % 60;
  const offsetLabel =
    diffMinutes === 0
      ? "현지와 같음"
      : `${diffMinutes > 0 ? "+" : "-"}${hours > 0 ? `${hours}시간` : ""}${
          minutes > 0 ? `${hours > 0 ? " " : ""}${minutes}분` : ""
        }`;

  const dateIn = (zone: string) =>
    getCachedFormatter(
      `date|${zone}`,
      () =>
        new Intl.DateTimeFormat("en-CA", {
          day: "2-digit",
          month: "2-digit",
          timeZone: zone,
          year: "numeric",
        }),
    ).format(new Date(now));
  const localDate = dateIn(localZone);
  const remoteDate = dateIn(timeZone);
  // The two calendars are never more than one day apart.
  const dayLabel = remoteDate === localDate ? "오늘" : remoteDate > localDate ? "내일" : "어제";

  return { dayLabel, offsetLabel, time };
}

export function loadWorldClocks(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CLOCK_WORLD_KEY) ?? "null");
    if (!Array.isArray(parsed)) return [...DEFAULT_WORLD_CLOCKS];
    const known = parsed.filter(
      (value): value is string => typeof value === "string" && WORLD_CLOCK_CITY_IDS.has(value),
    );
    return [...new Set(known)];
  } catch {
    return [...DEFAULT_WORLD_CLOCKS];
  }
}

export function persistWorldClocks(cityIds: string[]) {
  try {
    localStorage.setItem(CLOCK_WORLD_KEY, JSON.stringify(cityIds));
  } catch {
    // Same rule as the alarms: losing the write must not lose the session.
  }
}
