// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALARM_SNOOZE_MS,
  CLOCK_ALARM_LIMIT,
  CLOCK_TIMER_DEFAULT_MS,
  CLOCK_TIMER_MAX_MS,
  collectDueClockAlarms,
  createClockAlarm,
  createIdleClockTimer,
  describeAlarmFireDay,
  formatClockDuration,
  formatStopwatchDuration,
  getClockTimerRemaining,
  getNextAlarmFireTime,
  isMissedAlarmFire,
  isValidAlarmTime,
  loadClockAlarms,
  loadClockTimer,
  pauseClockTimer,
  describeAlarmRepeat,
  getTimeZoneOffsetMinutes,
  loadWorldClocks,
  sanitizeRepeatDays,
  toggleAlarmRepeatDay,
  persistClockAlarms,
  persistClockTimer,
  persistWorldClocks,
  readWorldClock,
  rescheduleClockAlarm,
  resetClockTimer,
  setClockAlarmEnabled,
  setClockTimerDuration,
  snoozeClockAlarm,
  startClockTimer,
  tickClockTimer,
  type ClockAlarm,
} from "./clock";
import { CLOCK_ALARMS_KEY, CLOCK_TIMER_KEY, CLOCK_WORLD_KEY } from "./constants";

// A fixed local morning so "today vs tomorrow" is deterministic.
const NOW = new Date(2026, 7, 31, 9, 30, 0, 0).getTime();

beforeEach(() => {
  localStorage.clear();
});

describe("alarm scheduling", () => {
  it("accepts 24h HH:MM and nothing else", () => {
    expect(isValidAlarmTime("00:00")).toBe(true);
    expect(isValidAlarmTime("23:59")).toBe(true);
    expect(isValidAlarmTime("24:00")).toBe(false);
    expect(isValidAlarmTime("9:30")).toBe(false);
    expect(isValidAlarmTime("09:60")).toBe(false);
    expect(isValidAlarmTime("")).toBe(false);
  });

  it("schedules a still-ahead time for today and a passed time for tomorrow", () => {
    const today = new Date(getNextAlarmFireTime("10:00", NOW));
    expect([today.getDate(), today.getHours(), today.getMinutes()]).toEqual([31, 10, 0]);

    const tomorrow = new Date(getNextAlarmFireTime("09:00", NOW));
    expect([tomorrow.getMonth(), tomorrow.getDate(), tomorrow.getHours()]).toEqual([8, 1, 9]);
  });

  it("treats the current minute as already passed", () => {
    const fire = new Date(getNextAlarmFireTime("09:30", NOW));
    expect(fire.getDate()).toBe(1);
  });

  it("rings a due alarm once and turns it off, leaving others untouched", () => {
    const due = { ...createClockAlarm("09:00", "기상", NOW), nextFireAt: NOW - 1000 };
    const pending = createClockAlarm("10:00", "", NOW);
    const { due: fired, next } = collectDueClockAlarms([due, pending], NOW);

    expect(fired.map((alarm) => alarm.id)).toEqual([due.id]);
    expect(next.find((alarm) => alarm.id === due.id)?.enabled).toBe(false);
    expect(next.find((alarm) => alarm.id === pending.id)).toBe(pending);

    // Already off: nothing rings twice.
    expect(collectDueClockAlarms(next, NOW).due).toEqual([]);
  });

  it("returns the same array reference when nothing is due", () => {
    const alarms = [createClockAlarm("10:00", "", NOW)];
    expect(collectDueClockAlarms(alarms, NOW).next).toBe(alarms);
  });

  it("re-arming schedules from the present and labels the day", () => {
    const alarm = setClockAlarmEnabled(
      { ...createClockAlarm("10:00", "", NOW), enabled: false, nextFireAt: 0 },
      true,
      NOW,
    );
    expect(alarm.nextFireAt).toBeGreaterThan(NOW);
    expect(describeAlarmFireDay(alarm.nextFireAt, NOW)).toBe("오늘");
    expect(describeAlarmFireDay(getNextAlarmFireTime("09:00", NOW), NOW)).toBe("내일");
  });

  it("rescheduling keeps the on/off state and rejects malformed input", () => {
    // A disabled alarm keeps its state: the row's time input fires onChange
    // per keystroke, and editing must not arm times the user never chose.
    const off = { ...createClockAlarm("10:00", "", NOW), enabled: false, nextFireAt: 123 };
    const movedOff = rescheduleClockAlarm(off, "11:15", NOW);
    expect(movedOff.time).toBe("11:15");
    expect(movedOff.enabled).toBe(false);
    expect(movedOff.nextFireAt).toBe(123);

    const on = createClockAlarm("10:00", "", NOW);
    const movedOn = rescheduleClockAlarm(on, "11:15", NOW);
    expect(movedOn.enabled).toBe(true);
    expect(new Date(movedOn.nextFireAt).getHours()).toBe(11);

    expect(rescheduleClockAlarm(on, "25:00", NOW)).toBe(on);
  });

  it("caps stored alarms at the limit on both write and read", () => {
    const many = Array.from({ length: CLOCK_ALARM_LIMIT + 5 }, (_, index) => ({
      ...createClockAlarm("10:00", `a${index}`, NOW),
      id: `alarm-${index}`,
    }));
    persistClockAlarms(many);
    expect(loadClockAlarms()).toHaveLength(CLOCK_ALARM_LIMIT);

    localStorage.setItem(CLOCK_ALARMS_KEY, JSON.stringify(many));
    expect(loadClockAlarms()).toHaveLength(CLOCK_ALARM_LIMIT);
  });

  it("snooze re-arms a fired alarm a few minutes out, whatever its schedule", () => {
    const fired = { ...createClockAlarm("09:00", "", NOW), enabled: false };
    const snoozed = snoozeClockAlarm(fired, NOW);
    expect(snoozed.enabled).toBe(true);
    expect(snoozed.nextFireAt).toBe(NOW + ALARM_SNOOZE_MS);
    // The weekly schedule is untouched — snooze moves the ring, not the calendar.
    const repeating = snoozeClockAlarm(createClockAlarm("09:00", "", NOW, [1, 3]), NOW);
    expect(repeating.repeatDays).toEqual([1, 3]);
    expect(repeating.nextFireAt).toBe(NOW + ALARM_SNOOZE_MS);
  });

  it("distinguishes a live ring from one found long after the fact", () => {
    const alarm = createClockAlarm("10:00", "", NOW);
    expect(isMissedAlarmFire({ ...alarm, nextFireAt: NOW - 5000 }, NOW)).toBe(false);
    expect(isMissedAlarmFire({ ...alarm, nextFireAt: NOW - 10 * 60 * 1000 }, NOW)).toBe(true);
  });
});

describe("반복 알람", () => {
  // NOW is Monday 2026-08-31 09:30 local.
  it("schedules onto the nearest repeat weekday, wrapping a full week", () => {
    const wednesday = new Date(getNextAlarmFireTime("10:00", NOW, [3]));
    expect([wednesday.getDate(), wednesday.getDay(), wednesday.getHours()]).toEqual([2, 3, 10]);

    const stillToday = new Date(getNextAlarmFireTime("10:00", NOW, [1]));
    expect([stillToday.getDate(), stillToday.getDay()]).toEqual([31, 1]);

    // Monday 09:00 already passed — the next one is a week out.
    const nextWeek = new Date(getNextAlarmFireTime("09:00", NOW, [1]));
    expect([nextWeek.getMonth(), nextWeek.getDate(), nextWeek.getDay()]).toEqual([8, 7, 1]);
  });

  it("a fired repeating alarm re-arms armed instead of turning off", () => {
    const alarm = { ...createClockAlarm("09:00", "기상", NOW, [1, 3]), nextFireAt: NOW - 1000 };
    const { due, next } = collectDueClockAlarms([alarm], NOW);
    expect(due).toHaveLength(1);
    expect(next[0].enabled).toBe(true);
    expect(next[0].nextFireAt).toBeGreaterThan(NOW);
    expect(new Date(next[0].nextFireAt).getDay()).toBe(3);
  });

  it("toggling weekdays keeps the set sorted and re-schedules an armed alarm", () => {
    let alarm = createClockAlarm("10:00", "", NOW);
    alarm = toggleAlarmRepeatDay(alarm, 5, NOW);
    alarm = toggleAlarmRepeatDay(alarm, 1, NOW);
    expect(alarm.repeatDays).toEqual([1, 5]);
    expect(new Date(alarm.nextFireAt).getDay()).toBe(1);
    alarm = toggleAlarmRepeatDay(alarm, 1, NOW);
    expect(alarm.repeatDays).toEqual([5]);
  });

  it("labels repeats and sanitizes stored day lists", () => {
    expect(describeAlarmRepeat([])).toBe("");
    expect(describeAlarmRepeat([1, 3, 5])).toBe("매주 월·수·금");
    expect(describeAlarmRepeat([0, 1, 2, 3, 4, 5, 6])).toBe("매일");
    expect(sanitizeRepeatDays([6, 1, 1, 2.5, -1, 9, "월"])).toEqual([1, 6]);
  });

  it("records saved before repeat existed load as one-shot", () => {
    const legacy = {
      enabled: true,
      id: "alarm-old",
      label: "",
      nextFireAt: NOW,
      time: "07:00",
    };
    localStorage.setItem(CLOCK_ALARMS_KEY, JSON.stringify([legacy]));
    expect(loadClockAlarms()).toEqual([{ ...legacy, repeatDays: [] }]);
  });
});

describe("timer state machine", () => {
  it("counts down from start, holds through pause, and resumes", () => {
    let timer = createIdleClockTimer(60_000);
    timer = startClockTimer(timer, NOW);
    expect(getClockTimerRemaining(timer, NOW + 10_000)).toBe(50_000);

    timer = pauseClockTimer(timer, NOW + 10_000);
    expect(timer.running).toBe(false);
    expect(getClockTimerRemaining(timer, NOW + 99_000)).toBe(50_000);

    timer = startClockTimer(timer, NOW + 99_000);
    expect(getClockTimerRemaining(timer, NOW + 99_000 + 50_000)).toBe(0);
  });

  it("fires exactly once when the deadline passes, then sits reset", () => {
    const running = startClockTimer(createIdleClockTimer(30_000), NOW);
    expect(tickClockTimer(running, NOW + 29_999).fired).toBe(false);

    const { fired, next } = tickClockTimer(running, NOW + 30_000);
    expect(fired).toBe(true);
    expect(next.running).toBe(false);
    expect(next.remainingMs).toBe(30_000);
    expect(tickClockTimer(next, NOW + 31_000).fired).toBe(false);
  });

  it("cannot change the length mid-run and clamps what it accepts", () => {
    const running = startClockTimer(createIdleClockTimer(30_000), NOW);
    expect(setClockTimerDuration(running, 5000)).toBe(running);

    const idle = createIdleClockTimer(30_000);
    expect(setClockTimerDuration(idle, 250).durationMs).toBe(1000);
    expect(setClockTimerDuration(idle, Number.POSITIVE_INFINITY).durationMs).toBe(
      CLOCK_TIMER_DEFAULT_MS,
    );
    expect(setClockTimerDuration(idle, CLOCK_TIMER_MAX_MS * 2).durationMs).toBe(
      CLOCK_TIMER_MAX_MS,
    );
  });

  it("reset returns to the configured length, and a zero remainder cannot start", () => {
    const spent = { ...createIdleClockTimer(30_000), remainingMs: 0 };
    expect(startClockTimer(spent, NOW)).toBe(spent);
    expect(resetClockTimer(spent).remainingMs).toBe(30_000);
  });
});

describe("display formats", () => {
  it("reads like the Windows timer and stopwatch", () => {
    expect(formatClockDuration(0)).toBe("00:00");
    expect(formatClockDuration(59_400)).toBe("01:00");
    expect(formatClockDuration(65_000)).toBe("01:05");
    expect(formatClockDuration(3_600_000)).toBe("1:00:00");
    expect(formatStopwatchDuration(0)).toBe("00:00.00");
    expect(formatStopwatchDuration(61_230)).toBe("01:01.23");
    expect(formatStopwatchDuration(3_601_010)).toBe("1:00:01.01");
  });
});

describe("persistence", () => {
  it("round-trips alarms and the timer", () => {
    const alarms = [createClockAlarm("07:30", "기상", NOW)];
    persistClockAlarms(alarms);
    expect(loadClockAlarms()).toEqual(alarms);

    const timer = startClockTimer(createIdleClockTimer(90_000), NOW);
    persistClockTimer(timer);
    expect(loadClockTimer()).toEqual(timer);
  });

  it("drops malformed alarm records instead of loading them", () => {
    const good = createClockAlarm("07:30", "", NOW);
    localStorage.setItem(
      CLOCK_ALARMS_KEY,
      JSON.stringify([good, { ...good, id: 7 }, { ...good, time: "7:30" }, "garbage", null]),
    );
    expect(loadClockAlarms()).toEqual([good]);

    localStorage.setItem(CLOCK_ALARMS_KEY, "{not json");
    expect(loadClockAlarms()).toEqual([]);
  });

  it("repairs an impossible stored timer instead of trusting it", () => {
    localStorage.setItem(CLOCK_TIMER_KEY, "{not json");
    expect(loadClockTimer()).toEqual(createIdleClockTimer());

    // "Running" with no deadline can never fire — it comes back paused.
    localStorage.setItem(
      CLOCK_TIMER_KEY,
      JSON.stringify({ durationMs: 60_000, endsAt: null, remainingMs: 999_000, running: true }),
    );
    const repaired = loadClockTimer();
    expect(repaired.running).toBe(false);
    expect(repaired.remainingMs).toBe(60_000);
  });

  it("a deadline that passed while the tab was closed fires on the next tick", () => {
    const running = startClockTimer(createIdleClockTimer(30_000), NOW);
    persistClockTimer(running);
    const revived = loadClockTimer();
    expect(tickClockTimer(revived, NOW + 60 * 60 * 1000).fired).toBe(true);
  });

  it("swallows a storage write failure", () => {
    const alarm: ClockAlarm = createClockAlarm("07:30", "", NOW);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    try {
      expect(() => persistClockAlarms([alarm])).not.toThrow();
      expect(() => persistClockTimer(createIdleClockTimer())).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("세계 시계", () => {
  it("reads real timezone offsets out of Intl", () => {
    expect(getTimeZoneOffsetMinutes("Asia/Seoul", NOW)).toBe(540);
    expect(getTimeZoneOffsetMinutes("Asia/Kolkata", NOW)).toBe(330);
    // August: New York sits on daylight time; January is standard time.
    expect(getTimeZoneOffsetMinutes("America/New_York", NOW)).toBe(-240);
    expect(getTimeZoneOffsetMinutes("America/New_York", Date.UTC(2026, 0, 15))).toBe(-300);
  });

  it("describes a city relative to an explicit local zone", () => {
    const morning = Date.UTC(2026, 7, 31, 0, 30); // 09:30 in Seoul
    expect(readWorldClock("Asia/Seoul", morning, "Asia/Seoul")).toEqual({
      dayLabel: "오늘",
      offsetLabel: "현지와 같음",
      time: "09:30",
    });
    expect(readWorldClock("America/New_York", morning, "Asia/Seoul")).toEqual({
      dayLabel: "어제",
      offsetLabel: "-13시간",
      time: "20:30",
    });
    expect(readWorldClock("Asia/Kolkata", morning, "Asia/Seoul")).toEqual({
      dayLabel: "오늘",
      offsetLabel: "-3시간 30분",
      time: "06:00",
    });
  });

  it("crosses midnight into 내일", () => {
    const lateEvening = Date.UTC(2026, 7, 31, 14, 30); // 23:30 in Seoul
    expect(readWorldClock("Pacific/Auckland", lateEvening, "Asia/Seoul")).toEqual({
      dayLabel: "내일",
      offsetLabel: "+3시간",
      time: "02:30",
    });
  });

  it("round-trips stored cities, drops unknown ids, and falls back on garbage", () => {
    persistWorldClocks(["Asia/Tokyo", "Europe/Paris"]);
    expect(loadWorldClocks()).toEqual(["Asia/Tokyo", "Europe/Paris"]);

    localStorage.setItem(
      CLOCK_WORLD_KEY,
      JSON.stringify(["Asia/Tokyo", "Asia/Tokyo", "Mars/Base", 7]),
    );
    expect(loadWorldClocks()).toEqual(["Asia/Tokyo"]);

    localStorage.setItem(CLOCK_WORLD_KEY, "{not json");
    expect(loadWorldClocks()).toEqual(["Asia/Seoul", "Europe/London", "America/New_York"]);
  });
});
