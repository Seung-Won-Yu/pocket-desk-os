// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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
  persistClockAlarms,
  persistClockTimer,
  rescheduleClockAlarm,
  resetClockTimer,
  setClockAlarmEnabled,
  setClockTimerDuration,
  startClockTimer,
  tickClockTimer,
  type ClockAlarm,
} from "./clock";
import { CLOCK_ALARMS_KEY, CLOCK_TIMER_KEY } from "./constants";

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

  it("rescheduling swaps the time, re-arms, and rejects malformed input", () => {
    const alarm = { ...createClockAlarm("10:00", "", NOW), enabled: false };
    const moved = rescheduleClockAlarm(alarm, "11:15", NOW);
    expect(moved.time).toBe("11:15");
    expect(moved.enabled).toBe(true);
    expect(rescheduleClockAlarm(alarm, "25:00", NOW)).toBe(alarm);
  });

  it("distinguishes a live ring from one found long after the fact", () => {
    const alarm = createClockAlarm("10:00", "", NOW);
    expect(isMissedAlarmFire({ ...alarm, nextFireAt: NOW - 5000 }, NOW)).toBe(false);
    expect(isMissedAlarmFire({ ...alarm, nextFireAt: NOW - 10 * 60 * 1000 }, NOW)).toBe(true);
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
