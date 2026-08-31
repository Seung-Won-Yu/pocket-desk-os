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
          Number.isFinite((item as ShellLogEvent).timestamp),
      )
      .slice(-EVENT_LOG_LIMIT);
  } catch {
    return [];
  }
}

export function persistShellEventLog(log: ShellLogEvent[]) {
  localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(log.slice(-EVENT_LOG_LIMIT)));
}

/** Append-only: the new record goes on the end and old ones are never touched. */
export function appendShellEvent(
  log: ShellLogEvent[],
  event: Omit<ShellLogEvent, "id" | "timestamp">,
): ShellLogEvent[] {
  return [
    ...log,
    { ...event, id: `shell-${crypto.randomUUID()}`, timestamp: Date.now() },
  ].slice(-EVENT_LOG_LIMIT);
}
