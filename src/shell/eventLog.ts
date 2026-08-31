import { EVENT_LOG_KEY, EVENT_LOG_LIMIT } from "./constants";

/**
 * The shell's own event log, written the way Windows writes one: a record is
 * appended when something happens and never edited or removed afterwards.
 *
 * The Event Viewer used to project the list of currently open windows instead,
 * which made it a live mirror wearing a log's clothes — closing a window
 * deleted its "process started" record, and maximizing one rewrote the detail
 * text of an event that claimed a past timestamp. A real log also survives a
 * reload, so it is persisted with the same cap Windows applies per log.
 */
export type ShellEventChannel = "security" | "system";

export type ShellLogEvent = {
  channel: ShellEventChannel;
  detail: string;
  eventId: number;
  id: string;
  level: "information" | "warning";
  source: string;
  taskCategory: string;
  timestamp: number;
};

export const SHELL_EVENT_PROCESS_STARTED = 4688;
export const SHELL_EVENT_PROCESS_ENDED = 4689;
export const SHELL_EVENT_LOGON = 4624;
export const SHELL_EVENT_WORKSTATION_LOCKED = 4800;
export const SHELL_EVENT_POWER_OFF = 1074;

export function loadShellEventLog(): ShellLogEvent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EVENT_LOG_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ShellLogEvent =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as ShellLogEvent).id === "string" &&
          typeof (item as ShellLogEvent).detail === "string" &&
          Number.isFinite((item as ShellLogEvent).timestamp) &&
          // The viewer calls source.trim() and taskCategory renders as the
          // type column, so a record missing either killed the whole shell
          // the moment a search ran. Every field the viewer reads is checked.
          ((item as ShellLogEvent).channel === "security" ||
            (item as ShellLogEvent).channel === "system") &&
          ((item as ShellLogEvent).level === "information" ||
            (item as ShellLogEvent).level === "warning") &&
          Number.isFinite((item as ShellLogEvent).eventId) &&
          typeof (item as ShellLogEvent).source === "string" &&
          typeof (item as ShellLogEvent).taskCategory === "string",
      )
      .slice(-EVENT_LOG_LIMIT);
  } catch {
    return [];
  }
}

export function persistShellEventLog(log: ShellLogEvent[]) {
  /*
   * Writes were unguarded while reads were wrapped — so the first quota
   * failure, thrown from a passive effect on any window open or close, took
   * the whole desktop down through the error boundary. Losing a log write is
   * an acceptable outcome; losing the session is not.
   */
  try {
    localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(log.slice(-EVENT_LOG_LIMIT)));
  } catch {
    // Storage is full or blocked; the in-memory log keeps working.
  }
}

/** Builds the finished record so state updaters stay pure. */
export function createShellEvent(
  event: Omit<ShellLogEvent, "id" | "timestamp">,
): ShellLogEvent {
  return { ...event, id: `shell-${crypto.randomUUID()}`, timestamp: Date.now() };
}

/** Append-only: the new record goes on the end and old ones are never touched. */
export function appendShellEvent(log: ShellLogEvent[], event: ShellLogEvent): ShellLogEvent[] {
  return [...log, event].slice(-EVENT_LOG_LIMIT);
}
