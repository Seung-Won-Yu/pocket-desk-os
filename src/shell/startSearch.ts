import { type AppId, type DesktopItem, type ThemeName } from "../types";
import { normalizeSearchText } from "../utils/format";
import { VFS_ROOT_ID, getVfsEntryAssociation, getVfsFolderPath } from "../vfs/model";
import { appCatalog } from "./appCatalog";
import { START_PINNED_APPS_KEY, appSearchKeywords, runCommandAliases } from "./constants";
import { type AppDefinition, type RunCommandResolution, type StartSearchResult } from "./types";

export function getResultIconTileTone(result: StartSearchResult) {
  return result.kind === "app" ? "app" : "file";
}

export function getThemeLabel(theme: ThemeName) {
  if (theme === "meadow") return "Meadow";
  if (theme === "ember") return "Ember";
  return "Lagoon";
}

export function formatNotificationTime(createdAt: number) {
  const seconds = Math.max(0, Math.round((Date.now() - createdAt) / 1000));
  if (seconds < 45) return "방금 전";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  return new Date(createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createCalendarGrid(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function buildStartSearchResults(
  query: string,
  desktopItems: DesktopItem[],
  apps: AppDefinition[],
): StartSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const appResults = apps
    .map((app): StartSearchResult | null => {
      const rank = rankSearchCandidate(normalizedQuery, [
        app.title,
        app.subtitle,
        ...appSearchKeywords[app.id],
        // The names people actually type. Matching only ran one way — the field
        // had to contain the query — so "notepad" found nothing against the
        // keyword "note", while the Run dialog knew the alias all along.
        ...(runCommandAliases[app.id] ?? []),
      ]);
      if (!rank) {
        return null;
      }

      return {
        accent: app.accent,
        appId: app.id,
        icon: app.icon,
        id: `app-${app.id}`,
        kind: "app",
        matchLabel: rank.matchLabel,
        score: rank.score,
        sourceLabel: "앱",
        subtitle: app.subtitle,
        title: app.title,
      };
    })
    .filter((result): result is StartSearchResult => Boolean(result));

  const fileResults = desktopItems
    .map((item): StartSearchResult | null => {
      const association = getVfsEntryAssociation(item);
      /*
       * Where the file actually lives. Every entry used to carry the literal
       * keywords "desktop"/"바탕화면" and the label 바탕화면 — so searching
       * 바탕화면 returned the whole disk, and a file three folders deep gave no
       * hint where opening it would land. Now the real folder chain is both the
       * caption and a match field, the way Windows search shows the path.
       */
      const pathSegments = getVfsFolderPath(desktopItems, item.parentId);
      const onDesktop = item.parentId === VFS_ROOT_ID;
      const rank = rankSearchCandidate(normalizedQuery, [
        item.name,
        association.typeLabel,
        association.appTitle,
        item.kind,
        ...pathSegments.slice(1).map((segment) => segment.name),
        ...(onDesktop ? ["desktop", "바탕화면"] : []),
      ]);
      if (!rank) {
        return null;
      }

      return {
        accent: association.accent,
        icon: association.icon,
        id: `desktop-${item.id}`,
        item,
        kind: "desktopItem",
        matchLabel: rank.matchLabel,
        score: rank.score,
        sourceLabel: item.kind === "folder" ? "폴더" : "파일",
        subtitle: `${association.typeLabel} · ${pathSegments
          .map((segment) => segment.name)
          .join(" > ")}`,
        title: item.name,
      };
    })
    .filter((result): result is StartSearchResult => Boolean(result));

  return [...appResults, ...fileResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });
}

// The pinned grid scrolls, so the cap only exists to stop it growing without
// bound. Keep it above the catalog size so a newly added app still lands there.
const START_PINNED_APP_LIMIT = 18;

/**
 * The set Windows ships pinned before anyone touches it. 고정됨 used to be
 * every installed app in a fixed order — indistinguishable from 모든 앱, with
 * nothing to pin or unpin — so it said nothing about what the user reaches for.
 */
const DEFAULT_START_PINS: AppId[] = [
  "thispc",
  "files",
  "browser",
  "notepad",
  "photos",
  "terminal",
  "calculator",
  "paint",
  "settings",
];

export function loadStartPinnedAppIds(): AppId[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(START_PINNED_APPS_KEY) ?? "null");
    if (!Array.isArray(parsed)) return [...DEFAULT_START_PINS];
    // A duplicated id would render two tiles with the same React key.
    return [...new Set(parsed.filter((value): value is AppId => typeof value === "string"))];
  } catch {
    return [...DEFAULT_START_PINS];
  }
}

export function persistStartPinnedAppIds(appIds: AppId[]) {
  localStorage.setItem(START_PINNED_APPS_KEY, JSON.stringify(appIds));
}

export function getStartPinnedApps(apps: AppDefinition[], pinnedIds: AppId[]) {
  const appMap = new Map(apps.map((app) => [app.id, app]));
  return pinnedIds
    .map((appId) => appMap.get(appId))
    .filter((app): app is AppDefinition => Boolean(app))
    .slice(0, START_PINNED_APP_LIMIT);
}

export function resolveRunCommand(command: string): RunCommandResolution {
  const trimmed = command.trim();
  if (!trimmed) {
    return { kind: "unknown", value: "" };
  }

  const normalizedCommand = normalizeRunCommand(trimmed);
  const matchedApp = appCatalog.find((app) =>
    getRunCommandCandidates(app).some(
      (candidate) => normalizeRunCommand(candidate) === normalizedCommand,
    ),
  );

  if (matchedApp) {
    return { appId: matchedApp.id, kind: "app" };
  }

  if (isBrowserRunTarget(trimmed)) {
    return { kind: "browser", value: trimmed };
  }

  return { kind: "unknown", value: trimmed };
}

export function getRunCommandCandidates(app: AppDefinition) {
  return [
    app.id,
    `${app.id}.exe`,
    app.title,
    app.title.replace(/\s+/g, ""),
    app.subtitle,
    ...appSearchKeywords[app.id],
    ...(runCommandAliases[app.id] ?? []),
  ];
}

export function normalizeRunCommand(value: string) {
  return normalizeSearchText(value)
    .replace(/\s+/g, " ")
    .replace(/\.exe$/i, "");
}

/**
 * Extensions that read as a hostname suffix but always mean "a program".
 * `.com` is deliberately absent — as a TLD it far outweighs the DOS executable.
 */
const PROGRAM_SUFFIX_PATTERN = /\.(bat|cmd|cpl|dll|exe|msc|msi|ps1|scr|sys|vbs)$/i;

export function isBrowserRunTarget(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  // `winword.exe` is a program name, not the `.exe` top-level domain.
  if (PROGRAM_SUFFIX_PATTERN.test(trimmed)) return false;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return true;
  }
  return /\s/.test(trimmed);
}

export function rankSearchCandidate(
  query: string,
  fields: string[],
): { matchLabel: string; score: number } | null {
  const tokens = query.split(" ").filter(Boolean);
  let bestMatch: { matchLabel: string; score: number } | null = null;

  for (const [index, field] of fields.entries()) {
    const normalizedField = normalizeSearchText(field);
    if (!normalizedField) continue;

    let score = 0;
    if (normalizedField === query) {
      score = 130;
    } else if (normalizedField.startsWith(query)) {
      score = 112;
    } else if (normalizedField.split(" ").some((token) => token.startsWith(query))) {
      score = 96;
    } else if (normalizedField.includes(query)) {
      score = 78;
    } else if (tokens.length > 1 && tokens.every((token) => normalizedField.includes(token))) {
      score = 64;
    }

    if (score === 0) continue;

    const adjustedScore = score - index;
    if (!bestMatch || adjustedScore > bestMatch.score) {
      bestMatch = { matchLabel: field, score: adjustedScore };
    }
  }

  return bestMatch;
}
