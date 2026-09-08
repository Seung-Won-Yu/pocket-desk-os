import { CALENDAR_EVENTS_KEY } from "./constants";
import { getLocalDateKey } from "./startSearch";

/**
 * 캘린더 일정 — the appointments Windows lets you add straight from the tray
 * calendar. They live at the shell rather than in a window, for the same reason
 * the alarms do: a reminder that only arrives while some app is open is not a
 * reminder. The tray calendar edits this state; the shell's own tick delivers
 * the reminders whether or not anything is open, and both survive a reload
 * because the reminder is stored as an absolute time.
 */
export type CalendarEvent = {
  /** Local day key, "YYYY-MM-DD" — the day the entry belongs to. */
  date: string;
  id: string;
  /**
   * Set once the reminder has been delivered, so a reminder arrives once and a
   * reload does not deliver it again.
   */
  notified: boolean;
  /** Epoch ms the reminder fires at; null for an all-day entry, which has none. */
  remindAt: number | null;
  /** Wall-clock "HH:MM", or null for an all-day entry. */
  time: string | null;
  title: string;
};

export const CALENDAR_EVENT_LIMIT = 100;
export const MAX_CALENDAR_TITLE_LENGTH = 60;
/** A reminder further in the past than this is reported as missed, not live. */
export const MISSED_EVENT_GRACE_MS = 60 * 1000;

const DATE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EVENT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidEventDate(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value);
}

export function isValidEventTime(value: unknown): value is string {
  return typeof value === "string" && EVENT_TIME_PATTERN.test(value);
}

/**
 * The moment a day plus a wall-clock time falls on, built through local Date
 * math so an entry keeps the time it was written at across a DST jump.
 */
export function getEventReminderTime(date: string, time: string | null) {
  if (!isValidEventDate(date) || !isValidEventTime(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

export function createCalendarEvent(
  date: string,
  time: string | null,
  title: string,
  now: number,
): CalendarEvent | null {
  if (!isValidEventDate(date)) return null;
  const trimmed = title.trim().slice(0, MAX_CALENDAR_TITLE_LENGTH);
  if (!trimmed) return null;
  const eventTime = isValidEventTime(time) ? time : null;
  const remindAt = getEventReminderTime(date, eventTime);
  return {
    date,
    id: `event-${crypto.randomUUID()}`,
    /*
     * Writing down something that already happened must not set off a reminder
     * for it. A stored entry that came due while the tab was closed still
     * fires — as 놓친 일정 — because it was written before the moment passed;
     * this one was not.
     */
    notified: remindAt !== null && remindAt <= now,
    remindAt,
    time: eventTime,
    title: trimmed,
  };
}

/** Earliest day first, all-day entries before timed ones within a day. */
export function compareCalendarEvents(a: CalendarEvent, b: CalendarEvent) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time === b.time) return a.title.localeCompare(b.title, "ko-KR");
  if (a.time === null) return -1;
  if (b.time === null) return 1;
  return a.time < b.time ? -1 : 1;
}

/**
 * Adds one entry, keeping the list sorted and inside its cap. At the cap the
 * *oldest* day is dropped rather than the new entry refused: the list fills up
 * with days that have gone by, and a calendar that stops accepting appointments
 * because of last year is worse than one that forgets last year.
 */
export function addCalendarEvent(events: CalendarEvent[], event: CalendarEvent) {
  const next = [...events, event].sort(compareCalendarEvents);
  return next.length > CALENDAR_EVENT_LIMIT
    ? next.slice(next.length - CALENDAR_EVENT_LIMIT)
    : next;
}

export function removeCalendarEvent(events: CalendarEvent[], id: string) {
  const next = events.filter((event) => event.id !== id);
  return next.length === events.length ? events : next;
}

export function getEventsForDate(events: CalendarEvent[], dateKey: string) {
  return events.filter((event) => event.date === dateKey).sort(compareCalendarEvents);
}

/** The days in `days` that carry at least one entry — what the grid dots. */
export function getEventDateKeys(events: CalendarEvent[], days: Date[]): Set<string> {
  const keys = new Set<string>();
  if (events.length === 0) return keys;
  const eventDays = new Set(events.map((event) => event.date));
  for (const day of days) {
    const key = getLocalDateKey(day);
    if (eventDays.has(key)) keys.add(key);
  }
  return keys;
}

/**
 * The reminders that have come due, and the list with those marked delivered.
 * Shaped like the alarm collector so the shell's one tick can drive both.
 */
export function collectDueCalendarEvents(events: CalendarEvent[], now: number) {
  const due = events.filter(
    (event) => !event.notified && event.remindAt !== null && event.remindAt <= now,
  );
  if (due.length === 0) return { due, next: events };
  const dueIds = new Set(due.map((event) => event.id));
  return {
    due,
    next: events.map((event) => (dueIds.has(event.id) ? { ...event, notified: true } : event)),
  };
}

/** True when the reminder is being delivered well after the moment it named. */
export function isMissedEventReminder(event: CalendarEvent, now: number) {
  return event.remindAt !== null && now - event.remindAt > MISSED_EVENT_GRACE_MS;
}

export function formatCalendarEventDay(dateKey: string) {
  if (!isValidEventDate(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ko-KR", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
}

export function loadCalendarEvents(): CalendarEvent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CALENDAR_EVENTS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CalendarEvent =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as CalendarEvent).id === "string" &&
          typeof (item as CalendarEvent).title === "string" &&
          (item as CalendarEvent).title.trim().length > 0 &&
          isValidEventDate((item as CalendarEvent).date) &&
          ((item as CalendarEvent).time === null ||
            isValidEventTime((item as CalendarEvent).time)),
      )
      .map((item) => ({
        date: item.date,
        id: item.id,
        notified: item.notified === true,
        // Recomputed rather than trusted: a stored reminder that disagrees with
        // the day and time on screen would fire at a moment nothing shows.
        remindAt: getEventReminderTime(item.date, item.time),
        time: item.time,
        title: item.title.trim().slice(0, MAX_CALENDAR_TITLE_LENGTH),
      }))
      .sort(compareCalendarEvents)
      .slice(-CALENDAR_EVENT_LIMIT);
  } catch {
    return [];
  }
}

export function persistCalendarEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // A refused write costs the appointment, not the session.
  }
}
