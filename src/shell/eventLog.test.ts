// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EVENT_LOG_KEY, EVENT_LOG_LIMIT } from "./constants";
import {
  appendShellEvent,
  createShellEvent,
  loadShellEventLog,
  persistShellEventLog,
  type ShellLogEvent,
} from "./eventLog";

function makeEvent(overrides: Partial<ShellLogEvent> = {}): ShellLogEvent {
  return {
    channel: "system",
    detail: "테스트 이벤트",
    eventId: 4688,
    id: "shell-test",
    level: "information",
    source: "테스트",
    taskCategory: "프로세스 생성",
    timestamp: 1,
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("appendShellEvent", () => {
  it("appends to the end and never edits what came before", () => {
    const first = makeEvent({ id: "shell-1" });
    const log = appendShellEvent([first], makeEvent({ id: "shell-2" }));

    expect(log.map((event) => event.id)).toEqual(["shell-1", "shell-2"]);
    expect(log[0]).toBe(first);
  });

  it("drops the oldest record at the cap, like a Windows log's size limit", () => {
    let log: ShellLogEvent[] = [];
    for (let index = 0; index < EVENT_LOG_LIMIT + 5; index += 1) {
      log = appendShellEvent(log, makeEvent({ id: `shell-${index}` }));
    }

    expect(log).toHaveLength(EVENT_LOG_LIMIT);
    expect(log[0].id).toBe("shell-5");
  });
});

describe("createShellEvent", () => {
  it("stamps a unique id and a timestamp", () => {
    const a = createShellEvent(makeEvent());
    const b = createShellEvent(makeEvent());

    expect(a.id).not.toBe(b.id);
    expect(Number.isFinite(a.timestamp)).toBe(true);
  });
});

describe("loadShellEventLog", () => {
  it("round-trips what was persisted", () => {
    persistShellEventLog([makeEvent({ id: "shell-keep" })]);

    expect(loadShellEventLog().map((event) => event.id)).toEqual(["shell-keep"]);
  });

  it("drops a record missing a field the viewer reads", () => {
    // The viewer calls source.trim() and sorts by it; one corrupt record used
    // to take the whole shell down through the error boundary.
    const corrupt = { ...makeEvent({ id: "shell-bad" }) } as Record<string, unknown>;
    delete corrupt.source;
    localStorage.setItem(
      EVENT_LOG_KEY,
      JSON.stringify([makeEvent({ id: "shell-ok" }), corrupt]),
    );

    expect(loadShellEventLog().map((event) => event.id)).toEqual(["shell-ok"]);
  });

  it("returns an empty log for garbage storage", () => {
    localStorage.setItem(EVENT_LOG_KEY, "{not json");

    expect(loadShellEventLog()).toEqual([]);
  });
});

describe("persistShellEventLog", () => {
  it("swallows a storage failure instead of crashing the shell", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      expect(() => persistShellEventLog([makeEvent()])).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
