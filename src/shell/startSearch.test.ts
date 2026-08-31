// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppId, type DesktopItem } from "../types";
import { appCatalog } from "./appCatalog";
import {
  buildStartSearchResults,
  createCalendarGrid,
  formatNotificationTime,
  getLocalDateKey,
  getResultIconTileTone,
  getRunCommandCandidates,
  getStartPinnedApps,
  getThemeLabel,
  isBrowserRunTarget,
  loadStartPinnedAppIds,
  normalizeRunCommand,
  persistStartPinnedAppIds,
  rankSearchCandidate,
  resolveRunCommand,
} from "./startSearch";

function createDesktopItem(overrides: Partial<DesktopItem> = {}): DesktopItem {
  return {
    createdAt: 0,
    id: "item-1",
    kind: "note",
    name: "메모.txt",
    parentId: "desktop",
    showOnDesktop: true,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function appsWithIds(ids: string[]) {
  return appCatalog.filter((app) => ids.includes(app.id));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("rankSearchCandidate", () => {
  it("returns null when no field matches", () => {
    expect(rankSearchCandidate("zzz", ["alpha", "beta"])).toBeNull();
  });

  it("scores an exact field match highest", () => {
    expect(rankSearchCandidate("calc", ["calc"])).toEqual({ matchLabel: "calc", score: 130 });
  });

  it("scores a field prefix below an exact match", () => {
    expect(rankSearchCandidate("calc", ["calculator"])).toEqual({
      matchLabel: "calculator",
      score: 112,
    });
  });

  it("scores an inner-word prefix below a field prefix", () => {
    expect(rankSearchCandidate("wor", ["hello world"])).toEqual({
      matchLabel: "hello world",
      score: 96,
    });
  });

  it("scores a bare substring below an inner-word prefix", () => {
    expect(rankSearchCandidate("ell", ["hello"])).toEqual({ matchLabel: "hello", score: 78 });
  });

  it("scores scattered multi-token matches lowest", () => {
    expect(rankSearchCandidate("red car", ["car is red"])).toEqual({
      matchLabel: "car is red",
      score: 64,
    });
  });

  it("does not use the scattered-token rule for a single-token query", () => {
    // "car" is present, but only as a substring, so it stays at the substring score.
    expect(rankSearchCandidate("car", ["a scarf"])).toEqual({
      matchLabel: "a scarf",
      score: 78,
    });
  });

  it("requires every query token for the scattered-token rule", () => {
    expect(rankSearchCandidate("red bike", ["car is red"])).toBeNull();
  });

  it("normalizes fields before comparing but reports the raw field", () => {
    expect(rankSearchCandidate("hello world", ["  HELLO   World  "])).toEqual({
      matchLabel: "  HELLO   World  ",
      score: 130,
    });
  });

  it("penalizes later fields by their position", () => {
    expect(rankSearchCandidate("calc", ["nope", "nada", "calc"])).toEqual({
      matchLabel: "calc",
      score: 128,
    });
  });

  it("prefers a weaker match in an earlier field over a stronger one far down the list", () => {
    const fields = ["calculator", ...Array.from({ length: 20 }, () => "nope"), "calc"];
    // The exact match sits at index 21, so its 130 falls below the leading prefix match.
    expect(rankSearchCandidate("calc", fields)).toEqual({
      matchLabel: "calculator",
      score: 112,
    });
  });

  it("keeps the earliest field when two fields tie after the position penalty", () => {
    const fields = ["calculator", ...Array.from({ length: 17 }, () => ""), "calc"];
    // 112 - 0 ties with 130 - 18, and the earlier field wins.
    expect(rankSearchCandidate("calc", fields)).toEqual({
      matchLabel: "calculator",
      score: 112,
    });
  });

  it("skips blank fields without shifting the position penalty", () => {
    expect(rankSearchCandidate("calc", ["", "   ", "calc"])).toEqual({
      matchLabel: "calc",
      score: 128,
    });
  });
});

describe("buildStartSearchResults", () => {
  it("returns nothing for a blank query", () => {
    expect(buildStartSearchResults("", [], appCatalog)).toEqual([]);
    expect(buildStartSearchResults("   ", [], appCatalog)).toEqual([]);
  });

  it("finds an app by keyword and reports where the match came from", () => {
    const results = buildStartSearchResults("calc", [], appCatalog);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      appId: "calculator",
      id: "app-calculator",
      kind: "app",
      matchLabel: "calc",
      score: 128,
      sourceLabel: "앱",
      title: "계산기",
    });
  });

  it("finds an app by a multi-word keyword", () => {
    const results = buildStartSearchResults("this pc", [], appCatalog);
    expect(results.map((result) => result.title)).toEqual(["내 PC"]);
  });

  it("normalizes the query before matching", () => {
    expect(buildStartSearchResults("  CALC  ", [], appCatalog).map((r) => r.id)).toEqual([
      "app-calculator",
    ]);
  });

  it("prefers a keyword hit over a subtitle hit and sorts by score", () => {
    const results = buildStartSearchResults("파일", [], appCatalog);
    expect(results.map((result) => result.id)).toEqual([
      "app-files",
      "app-eventviewer",
      "app-terminal",
    ]);
    // The title/keyword hit outranks both subtitle hits.
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
    expect(results[0].matchLabel).toBe("파일");
    expect(results[2].matchLabel).toBe("가상 파일 시스템 셸");
  });

  it("finds a desktop file by name", () => {
    const items = [createDesktopItem({ id: "note-1", name: "회의록.txt" })];
    const results = buildStartSearchResults("회의", items, []);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "desktop-note-1",
      kind: "desktopItem",
      matchLabel: "회의록.txt",
      sourceLabel: "파일",
      subtitle: "텍스트 문서 · 바탕 화면",
      title: "회의록.txt",
    });
  });

  it("carries the matched desktop item through the result", () => {
    const item = createDesktopItem({ id: "note-1", name: "회의록.txt" });
    const result = buildStartSearchResults("회의", [item], [])[0];
    expect(result.kind).toBe("desktopItem");
    if (result.kind === "desktopItem") {
      expect(result.item).toBe(item);
    }
  });

  it("matches a desktop file by its file-type association", () => {
    const items = [createDesktopItem({ id: "folder-1", kind: "folder", name: "사진" })];
    const results = buildStartSearchResults("폴더", items, []);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      matchLabel: "파일 폴더",
      sourceLabel: "폴더",
      subtitle: "파일 폴더 · 바탕 화면",
      title: "사진",
    });
  });

  it("matches every desktop file through its implicit location keywords", () => {
    const items = [
      createDesktopItem({ id: "a", name: "a.txt" }),
      createDesktopItem({ id: "b", kind: "folder", name: "b" }),
    ];
    expect(buildStartSearchResults("바탕화면", items, []).map((r) => r.id)).toEqual([
      "desktop-a",
      "desktop-b",
    ]);
  });

  it("shows the real folder chain and keeps the desktop keyword off nested files", () => {
    const folder = createDesktopItem({
      id: "folder-1",
      kind: "folder",
      name: "보고서",
      showOnDesktop: false,
    });
    const nested = createDesktopItem({
      id: "note-2",
      name: "8월 결산.txt",
      parentId: "folder-1",
      showOnDesktop: false,
    });
    const items = [folder, nested];

    const byName = buildStartSearchResults("결산", items, []);
    expect(byName.map((result) => result.id)).toEqual(["desktop-note-2"]);
    expect(byName[0]).toMatchObject({
      sourceLabel: "파일",
      subtitle: "텍스트 문서 · 바탕 화면 > 보고서",
    });

    // The folder chain is itself a match field…
    expect(buildStartSearchResults("보고서", items, []).map((result) => result.id)).toEqual([
      "desktop-folder-1",
      "desktop-note-2",
    ]);
    // …while 바탕화면 no longer returns the whole disk, only what sits on it.
    expect(buildStartSearchResults("바탕화면", items, []).map((result) => result.id)).toEqual([
      "desktop-folder-1",
    ]);
  });

  it("breaks score ties by title", () => {
    const items = [
      createDesktopItem({ id: "b", name: "b.txt" }),
      createDesktopItem({ id: "a", name: "a.txt" }),
    ];
    const results = buildStartSearchResults("txt", items, []);
    expect(results.map((result) => result.title)).toEqual(["a.txt", "b.txt"]);
    expect(results[0].score).toBe(results[1].score);
  });

  it("ranks apps and desktop files together by score", () => {
    const items = [createDesktopItem({ id: "memo", name: "메모.txt" })];
    const results = buildStartSearchResults("메모", items, appCatalog);
    expect(results.map((result) => result.id)).toEqual(["app-notepad", "desktop-memo"]);
    expect(results.map((result) => result.score)).toEqual([124, 112]);
  });

  it("returns results sorted by descending score for a broad query", () => {
    const results = buildStartSearchResults("s", [], appCatalog);
    expect(results.length).toBeGreaterThan(1);
    const scores = results.map((result) => result.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("returns nothing when neither apps nor files match", () => {
    expect(buildStartSearchResults("zzzqqq", [createDesktopItem()], appCatalog)).toEqual([]);
  });
});

describe("getResultIconTileTone", () => {
  it("tones app results and file results differently", () => {
    const appResult = buildStartSearchResults("calc", [], appCatalog)[0];
    const fileResult = buildStartSearchResults(
      "회의",
      [createDesktopItem({ id: "note-1", name: "회의록.txt" })],
      [],
    )[0];

    expect(getResultIconTileTone(appResult)).toBe("app");
    expect(getResultIconTileTone(fileResult)).toBe("file");
  });
});

describe("getStartPinnedApps", () => {
  it("shows the pinned ids in their pinned order", () => {
    expect(
      getStartPinnedApps(appCatalog, ["calculator", "files", "browser"]).map((app) => app.id),
    ).toEqual(["calculator", "files", "browser"]);
  });

  it("drops a pinned id whose app is not installed", () => {
    expect(
      getStartPinnedApps(appsWithIds(["files"]), ["files", "notepad"]).map((app) => app.id),
    ).toEqual(["files"]);
  });

  it("caps the grid at its slot limit", () => {
    const oversized = [
      ...appCatalog,
      ...appCatalog.map((app, index) => ({ ...app, id: `extra-${index}` as AppId })),
    ];
    expect(
      getStartPinnedApps(
        oversized,
        oversized.map((app) => app.id),
      ),
    ).toHaveLength(18);
  });

  it("returns nothing when nothing is pinned", () => {
    // 고정됨 used to be every installed app, indistinguishable from 모든 앱.
    expect(getStartPinnedApps(appCatalog, [])).toEqual([]);
  });
});

describe("start pin persistence", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips the pinned set", () => {
    persistStartPinnedAppIds(["files", "calculator"]);
    expect(loadStartPinnedAppIds()).toEqual(["files", "calculator"]);
  });

  it("falls back to the defaults for garbage storage", () => {
    localStorage.setItem("pocket-desk-start-pins-v1", "{broken");
    expect(loadStartPinnedAppIds().length).toBeGreaterThan(0);
  });

  it("deduplicates a stored id so no two tiles share a key", () => {
    localStorage.setItem(
      "pocket-desk-start-pins-v1",
      JSON.stringify(["files", "files", "notepad"]),
    );
    expect(loadStartPinnedAppIds()).toEqual(["files", "notepad"]);
  });
});

describe("normalizeRunCommand", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeRunCommand("  My   COMPUTER ")).toBe("my computer");
  });

  it("drops a trailing .exe", () => {
    expect(normalizeRunCommand("Calc.EXE")).toBe("calc");
    expect(normalizeRunCommand("MSPaint.exe")).toBe("mspaint");
  });

  it("drops only the final .exe", () => {
    expect(normalizeRunCommand("a.exe.exe")).toBe("a.exe");
  });

  it("leaves a non-trailing exe alone", () => {
    expect(normalizeRunCommand("exec")).toBe("exec");
  });
});

describe("isBrowserRunTarget", () => {
  it("accepts explicit urls regardless of case", () => {
    expect(isBrowserRunTarget("https://example.com")).toBe(true);
    expect(isBrowserRunTarget("HTTP://EXAMPLE.COM")).toBe(true);
  });

  it("accepts www hosts and bare domains", () => {
    expect(isBrowserRunTarget("www.google.com")).toBe(true);
    expect(isBrowserRunTarget("example.com")).toBe(true);
    expect(isBrowserRunTarget("sub.example.co.kr")).toBe(true);
    expect(isBrowserRunTarget("example.com/path?q=1#top")).toBe(true);
  });

  it("rejects hostless words", () => {
    expect(isBrowserRunTarget("localhost")).toBe(false);
    expect(isBrowserRunTarget("calc")).toBe(false);
  });

  it("rejects a single-letter top level domain", () => {
    expect(isBrowserRunTarget("a.b")).toBe(false);
  });

  it("treats a multi-word entry as a web search", () => {
    expect(isBrowserRunTarget("hello world")).toBe(true);
    expect(isBrowserRunTarget("  hello   world  ")).toBe(true);
  });

  it("rejects empty and whitespace-only input", () => {
    expect(isBrowserRunTarget("")).toBe(false);
    expect(isBrowserRunTarget("    ")).toBe(false);
  });
});

describe("getRunCommandCandidates", () => {
  it("offers the id, the executable name, both title spellings, the subtitle, keywords and aliases", () => {
    const thispc = appsWithIds(["thispc"])[0];
    const candidates = getRunCommandCandidates(thispc);
    expect(candidates).toContain("thispc");
    expect(candidates).toContain("thispc.exe");
    expect(candidates).toContain("내 PC");
    expect(candidates).toContain("내PC");
    expect(candidates).toContain("드라이브와 기본 폴더");
    expect(candidates).toContain("컴퓨터");
    expect(candidates).toContain("my computer");
  });

  it("includes the alias list of an app that has one", () => {
    expect(getRunCommandCandidates(appsWithIds(["calculator"])[0])).toContain("calc.exe");
    expect(getRunCommandCandidates(appsWithIds(["paint"])[0])).toContain("mspaint");
  });

  it("still produces candidates for an app with no aliases", () => {
    const candidates = getRunCommandCandidates(appsWithIds(["minesweeper"])[0]);
    expect(candidates).toContain("minesweeper");
    expect(candidates).toContain("minesweeper.exe");
    expect(candidates).toContain("지뢰찾기");
  });
});

describe("resolveRunCommand", () => {
  it("treats a blank command as unknown with an empty value", () => {
    expect(resolveRunCommand("")).toEqual({ kind: "unknown", value: "" });
    expect(resolveRunCommand("   ")).toEqual({ kind: "unknown", value: "" });
  });

  it("resolves an app by id, keyword or title", () => {
    expect(resolveRunCommand("calc")).toEqual({ appId: "calculator", kind: "app" });
    expect(resolveRunCommand("notepad")).toEqual({ appId: "notepad", kind: "app" });
    expect(resolveRunCommand("내 PC")).toEqual({ appId: "thispc", kind: "app" });
  });

  it("resolves the space-free spelling of a title", () => {
    expect(resolveRunCommand("내PC")).toEqual({ appId: "thispc", kind: "app" });
  });

  it("ignores case, padding and the .exe suffix", () => {
    expect(resolveRunCommand("  CALC.EXE  ")).toEqual({ appId: "calculator", kind: "app" });
    expect(resolveRunCommand("Notepad.exe")).toEqual({ appId: "notepad", kind: "app" });
  });

  it("resolves the classic Windows aliases", () => {
    expect(resolveRunCommand("explorer")).toEqual({ appId: "files", kind: "app" });
    expect(resolveRunCommand("mspaint")).toEqual({ appId: "paint", kind: "app" });
    expect(resolveRunCommand("cmd")).toEqual({ appId: "terminal", kind: "app" });
    expect(resolveRunCommand("taskmgr")).toEqual({ appId: "taskmanager", kind: "app" });
    expect(resolveRunCommand("control panel")).toEqual({ appId: "settings", kind: "app" });
    expect(resolveRunCommand("trash")).toEqual({ appId: "recycle", kind: "app" });
  });

  it("resolves Korean aliases", () => {
    expect(resolveRunCommand("작업 관리자")).toEqual({ appId: "taskmanager", kind: "app" });
    expect(resolveRunCommand("명령 프롬프트")).toEqual({ appId: "terminal", kind: "app" });
  });

  it("prefers an app alias over url detection", () => {
    expect(resolveRunCommand("www")).toEqual({ appId: "browser", kind: "app" });
  });

  it("sends urls and hosts to the browser with the trimmed input", () => {
    expect(resolveRunCommand("  https://example.com  ")).toEqual({
      kind: "browser",
      value: "https://example.com",
    });
    expect(resolveRunCommand("www.google.com")).toEqual({
      kind: "browser",
      value: "www.google.com",
    });
    expect(resolveRunCommand("example.com")).toEqual({ kind: "browser", value: "example.com" });
  });

  it("sends a multi-word entry to the browser as a search", () => {
    expect(resolveRunCommand("pocket desk os")).toEqual({
      kind: "browser",
      value: "pocket desk os",
    });
  });

  it("reports an unrecognized single word as unknown", () => {
    expect(resolveRunCommand("zzzqqq")).toEqual({ kind: "unknown", value: "zzzqqq" });
  });
});

describe("getThemeLabel", () => {
  it("labels every theme", () => {
    expect(getThemeLabel("lagoon")).toBe("Lagoon");
    expect(getThemeLabel("meadow")).toBe("Meadow");
    expect(getThemeLabel("ember")).toBe("Ember");
  });
});

describe("formatNotificationTime", () => {
  const now = new Date("2026-08-26T12:30:00.000Z").getTime();

  function freeze() {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  }

  it("shows a relative label for the last 45 seconds", () => {
    freeze();
    expect(formatNotificationTime(now)).toBe("방금 전");
    expect(formatNotificationTime(now - 44_000)).toBe("방금 전");
  });

  it("switches to minutes at 45 seconds, rounding to the nearest minute", () => {
    freeze();
    expect(formatNotificationTime(now - 45_000)).toBe("1분 전");
    expect(formatNotificationTime(now - 90_000)).toBe("2분 전");
    expect(formatNotificationTime(now - 30 * 60_000)).toBe("30분 전");
    expect(formatNotificationTime(now - 59 * 60_000)).toBe("59분 전");
  });

  it("clamps future timestamps to the present", () => {
    freeze();
    expect(formatNotificationTime(now + 60_000)).toBe("방금 전");
  });

  it("switches to a clock time after an hour", () => {
    freeze();
    const label = formatNotificationTime(now - 60 * 60_000);
    expect(label).not.toContain("분 전");
    expect(label).toMatch(/\d/);
  });
});

describe("getLocalDateKey", () => {
  it("formats a zero-padded local date key", () => {
    expect(getLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(getLocalDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("ignores the time of day", () => {
    expect(getLocalDateKey(new Date(2026, 7, 26, 23, 59, 59))).toBe("2026-08-26");
  });
});

describe("createCalendarGrid", () => {
  it("always returns six weeks starting on a Sunday", () => {
    const grid = createCalendarGrid(new Date(2026, 7, 1));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(0);
  });

  it("back-fills the days before the first of the month", () => {
    const grid = createCalendarGrid(new Date(2026, 7, 1));
    // 2026-08-01 is a Saturday, so the grid opens on the previous Sunday.
    expect(getLocalDateKey(grid[0])).toBe("2026-07-26");
    expect(getLocalDateKey(grid[41])).toBe("2026-09-05");
  });

  it("starts on the first when the month already begins on a Sunday", () => {
    const grid = createCalendarGrid(new Date(2026, 1, 1));
    expect(getLocalDateKey(grid[0])).toBe("2026-02-01");
    expect(getLocalDateKey(grid[41])).toBe("2026-03-14");
  });

  it("depends only on the month of the given date", () => {
    const fromFirst = createCalendarGrid(new Date(2026, 7, 1)).map(getLocalDateKey);
    const fromMiddle = createCalendarGrid(new Date(2026, 7, 17, 22, 15)).map(getLocalDateKey);
    expect(fromMiddle).toEqual(fromFirst);
  });

  it("returns consecutive days", () => {
    const grid = createCalendarGrid(new Date(2026, 7, 1));
    for (let index = 1; index < grid.length; index += 1) {
      const previous = new Date(grid[index - 1]);
      previous.setDate(previous.getDate() + 1);
      expect(getLocalDateKey(grid[index])).toBe(getLocalDateKey(previous));
    }
  });
});
