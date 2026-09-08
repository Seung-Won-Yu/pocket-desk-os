// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  CALENDAR_EVENT_LIMIT,
  MAX_CALENDAR_TITLE_LENGTH,
  addCalendarEvent,
  type CalendarEvent,
  collectDueCalendarEvents,
  compareCalendarEvents,
  createCalendarEvent,
  formatCalendarEventDay,
  getEventDateKeys,
  getEventReminderTime,
  getEventsForDate,
  isMissedEventReminder,
  isValidEventDate,
  isValidEventTime,
  loadCalendarEvents,
  persistCalendarEvents,
  removeCalendarEvent,
} from "./calendarEvents";

const KEY = "pocket-desk-calendar-events-v1";
/** 2026-09-08 10:00 local. */
const NOW = new Date(2026, 8, 8, 10, 0, 0, 0).getTime();

function make(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    date: "2026-09-08",
    id: `event-${Math.random()}`,
    notified: false,
    remindAt: null,
    time: null,
    title: "일정",
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("isValidEventDate / isValidEventTime", () => {
  it("takes a local day key and a 24h time, and nothing shaped like one", () => {
    expect(isValidEventDate("2026-09-08")).toBe(true);
    expect(isValidEventDate("2026-13-08")).toBe(false);
    expect(isValidEventDate("2026-09-32")).toBe(false);
    expect(isValidEventDate("2026-9-8")).toBe(false);
    expect(isValidEventDate(20260908)).toBe(false);

    expect(isValidEventTime("00:00")).toBe(true);
    expect(isValidEventTime("23:59")).toBe(true);
    expect(isValidEventTime("24:00")).toBe(false);
    expect(isValidEventTime("9:30")).toBe(false);
    expect(isValidEventTime(null)).toBe(false);
  });
});

describe("getEventReminderTime", () => {
  it("lands on the local wall clock of that day", () => {
    expect(getEventReminderTime("2026-09-08", "10:05")).toBe(
      new Date(2026, 8, 8, 10, 5, 0, 0).getTime(),
    );
  });

  it("has no moment for an all-day entry", () => {
    expect(getEventReminderTime("2026-09-08", null)).toBeNull();
  });
});

describe("createCalendarEvent", () => {
  it("keeps a trimmed title and the time it was given", () => {
    const event = createCalendarEvent("2026-09-08", "14:30", "  팀 회의  ", NOW);
    expect(event).toMatchObject({ date: "2026-09-08", time: "14:30", title: "팀 회의" });
    expect(event?.remindAt).toBe(new Date(2026, 8, 8, 14, 30).getTime());
    expect(event?.notified).toBe(false);
  });

  it("refuses an empty title and an impossible day", () => {
    expect(createCalendarEvent("2026-09-08", "14:30", "   ", NOW)).toBeNull();
    expect(createCalendarEvent("어제", "14:30", "팀 회의", NOW)).toBeNull();
  });

  it("cuts a very long title to what the field accepts", () => {
    const event = createCalendarEvent("2026-09-08", null, "가".repeat(200), NOW);
    expect(event?.title).toHaveLength(MAX_CALENDAR_TITLE_LENGTH);
  });

  it("treats a time that is not a time as an all-day entry", () => {
    const event = createCalendarEvent("2026-09-08", "정오", "점심", NOW);
    expect(event?.time).toBeNull();
    expect(event?.remindAt).toBeNull();
  });

  it("does not arm a reminder for a moment that has already passed", () => {
    // Writing down something that happened this morning must not set it off.
    expect(createCalendarEvent("2026-09-08", "09:00", "지난 일정", NOW)?.notified).toBe(true);
    expect(createCalendarEvent("2026-09-08", "11:00", "다음 일정", NOW)?.notified).toBe(false);
    // An all-day entry has nothing to fire, so nothing to suppress either.
    expect(createCalendarEvent("2026-09-08", null, "종일", NOW)?.notified).toBe(false);
  });
});

describe("compareCalendarEvents", () => {
  it("orders by day, then all-day first, then by time", () => {
    const sorted = [
      make({ date: "2026-09-09", time: "08:00", title: "다음 날" }),
      make({ date: "2026-09-08", time: "18:00", title: "저녁" }),
      make({ date: "2026-09-08", time: null, title: "종일" }),
      make({ date: "2026-09-08", time: "09:00", title: "아침" }),
    ].sort(compareCalendarEvents);
    expect(sorted.map((event) => event.title)).toEqual(["종일", "아침", "저녁", "다음 날"]);
  });
});

describe("addCalendarEvent", () => {
  it("keeps the list sorted", () => {
    const list = addCalendarEvent(
      [make({ date: "2026-09-10", title: "나중" })],
      make({ date: "2026-09-08", title: "먼저" }),
    );
    expect(list.map((event) => event.title)).toEqual(["먼저", "나중"]);
  });

  it("drops the oldest day at the cap rather than refusing the new entry", () => {
    let list: CalendarEvent[] = [];
    for (let index = 0; index < CALENDAR_EVENT_LIMIT; index += 1) {
      const day = String(index + 1).padStart(2, "0");
      list = addCalendarEvent(list, make({ date: `2025-01-${day}`, title: `옛날 ${index}` }));
    }
    expect(list).toHaveLength(CALENDAR_EVENT_LIMIT);

    const next = addCalendarEvent(list, make({ date: "2026-09-08", title: "오늘" }));
    expect(next).toHaveLength(CALENDAR_EVENT_LIMIT);
    expect(next[next.length - 1].title).toBe("오늘");
    expect(next.some((event) => event.title === "옛날 0")).toBe(false);
  });
});

describe("removeCalendarEvent", () => {
  it("returns the same array when nothing matched", () => {
    const list = [make({ id: "a" })];
    expect(removeCalendarEvent(list, "b")).toBe(list);
    expect(removeCalendarEvent(list, "a")).toEqual([]);
  });
});

describe("getEventsForDate / getEventDateKeys", () => {
  const events = [
    make({ date: "2026-09-08", time: "09:00", title: "아침" }),
    make({ date: "2026-09-10", title: "다른 날" }),
    make({ date: "2026-09-08", time: null, title: "종일" }),
  ];

  it("lists one day in reading order", () => {
    expect(getEventsForDate(events, "2026-09-08").map((event) => event.title)).toEqual([
      "종일",
      "아침",
    ]);
    expect(getEventsForDate(events, "2026-09-09")).toEqual([]);
  });

  it("dots only the days in the grid that carry something", () => {
    const days = [new Date(2026, 8, 8), new Date(2026, 8, 9), new Date(2026, 8, 10)];
    expect([...getEventDateKeys(events, days)].sort()).toEqual(["2026-09-08", "2026-09-10"]);
    expect(getEventDateKeys([], days).size).toBe(0);
  });
});

describe("collectDueCalendarEvents", () => {
  it("delivers a reminder once and marks it delivered", () => {
    const due = make({ remindAt: NOW - 1000, time: "09:59", title: "지금" });
    const later = make({ remindAt: NOW + 60_000, time: "10:01", title: "곧" });
    const allDay = make({ title: "종일" });

    const first = collectDueCalendarEvents([due, later, allDay], NOW);
    expect(first.due.map((event) => event.title)).toEqual(["지금"]);
    expect(first.next.find((event) => event.title === "지금")?.notified).toBe(true);

    // The same tick a moment later has nothing left to deliver.
    const second = collectDueCalendarEvents(first.next, NOW);
    expect(second.due).toEqual([]);
    expect(second.next).toBe(first.next);
  });

  it("says a reminder is missed only once it is well past its moment", () => {
    const event = make({ remindAt: NOW });
    expect(isMissedEventReminder(event, NOW + 30_000)).toBe(false);
    expect(isMissedEventReminder(event, NOW + 120_000)).toBe(true);
    expect(isMissedEventReminder(make(), NOW + 120_000)).toBe(false);
  });
});

describe("loadCalendarEvents", () => {
  it("round-trips what was saved", () => {
    const event = createCalendarEvent("2026-09-08", "14:30", "팀 회의", NOW)!;
    persistCalendarEvents([event]);
    expect(loadCalendarEvents()).toEqual([event]);
  });

  it("drops records that are not appointments", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        {
          date: "2026-09-08",
          id: "a",
          notified: false,
          remindAt: null,
          time: null,
          title: "좋음",
        },
        {
          date: "어제",
          id: "b",
          notified: false,
          remindAt: null,
          time: null,
          title: "나쁜 날짜",
        },
        {
          date: "2026-09-08",
          id: "c",
          notified: false,
          remindAt: null,
          time: "25:00",
          title: "나쁜 시간",
        },
        {
          date: "2026-09-08",
          id: "d",
          notified: false,
          remindAt: null,
          time: null,
          title: "   ",
        },
        "일정이 아님",
      ]),
    );
    expect(loadCalendarEvents().map((event) => event.id)).toEqual(["a"]);
  });

  it("recomputes the reminder rather than trusting the stored one", () => {
    // A hand-edited moment that disagrees with the day and time on screen would
    // fire when nothing shows.
    localStorage.setItem(
      KEY,
      JSON.stringify([
        {
          date: "2026-09-08",
          id: "a",
          notified: false,
          remindAt: 1,
          time: "14:30",
          title: "팀 회의",
        },
      ]),
    );
    expect(loadCalendarEvents()[0].remindAt).toBe(new Date(2026, 8, 8, 14, 30).getTime());
  });

  it("survives a store that holds something other than a list", () => {
    localStorage.setItem(KEY, "{}");
    expect(loadCalendarEvents()).toEqual([]);
    localStorage.setItem(KEY, "not json");
    expect(loadCalendarEvents()).toEqual([]);
  });
});

describe("formatCalendarEventDay", () => {
  it("names the day the way the agenda heading does", () => {
    expect(formatCalendarEventDay("2026-09-08")).toBe("9월 8일 (화)");
    expect(formatCalendarEventDay("어제")).toBe("어제");
  });
});
