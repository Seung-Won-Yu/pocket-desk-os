import { type AppId } from "../types";
import { appsById } from "./appCatalog";
import { CLOCK_24H_KEY, DEFAULT_APPS_KEY, DEFAULT_USER_NAME, USER_NAME_KEY } from "./constants";

/** File extensions the user is allowed to reassign, and what each may open with. */
export const DEFAULT_APP_CHOICES: Array<{
  apps: AppId[];
  extension: string;
  label: string;
}> = [
  { apps: ["notepad", "terminal"], extension: "txt", label: "텍스트 문서" },
  { apps: ["notepad"], extension: "md", label: "Markdown 문서" },
  { apps: ["photos", "paint"], extension: "png", label: "PNG 이미지" },
  { apps: ["paint", "photos"], extension: "canvas", label: "캔버스 이미지" },
  { apps: ["browser"], extension: "url", label: "인터넷 바로 가기" },
];

export type DefaultAppMap = Partial<Record<string, AppId>>;

export function loadUserName() {
  try {
    const stored = localStorage.getItem(USER_NAME_KEY)?.trim();
    return stored ? stored.slice(0, 20) : DEFAULT_USER_NAME;
  } catch {
    return DEFAULT_USER_NAME;
  }
}

export function loadClock24h() {
  try {
    return localStorage.getItem(CLOCK_24H_KEY) === "on";
  } catch {
    return false;
  }
}

export function loadDefaultApps(): DefaultAppMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DEFAULT_APPS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const allowed = new Set(DEFAULT_APP_CHOICES.map((choice) => choice.extension));
    const result: DefaultAppMap = {};
    for (const [extension, appId] of Object.entries(parsed as Record<string, unknown>)) {
      // Ignore anything that is not a reassignable extension paired with a real app,
      // so a hand-edited registry value cannot point a file type at nothing.
      if (!allowed.has(extension)) continue;
      if (typeof appId !== "string" || !appsById.has(appId as AppId)) continue;
      result[extension] = appId as AppId;
    }
    return result;
  } catch {
    return {};
  }
}

export function persistDefaultApps(defaultApps: DefaultAppMap) {
  try {
    localStorage.setItem(DEFAULT_APPS_KEY, JSON.stringify(defaultApps));
  } catch {
    // A private-mode storage failure must not break the setting itself.
  }
}
