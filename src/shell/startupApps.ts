import { appOrder } from "../apps/metadata";
import { type AppId } from "../types";

/**
 * 시작 프로그램 — the apps that open by themselves when you sign in. Windows
 * lists them in 작업 관리자 with 사용 / 사용 안 함; the shell had no such list,
 * so every sign-in started from an empty desktop.
 */
const knownApps = new Set<string>(appOrder);

/** Turns one app on or off, keeping the list in the apps' own order. */
export function setStartupAppEnabled(current: AppId[], appId: AppId, enabled: boolean) {
  const next = new Set(current.filter((id) => id !== appId));
  if (enabled) next.add(appId);
  return appOrder.filter((id) => next.has(id));
}

/**
 * The apps a sign-in opens: every enabled one that is not already on screen —
 * a session restored with its windows must not get a second copy of each.
 */
export function getStartupLaunchIds(startupApps: AppId[], openAppIds: AppId[]) {
  const open = new Set(openAppIds);
  return startupApps.filter((appId) => !open.has(appId));
}

/** What a stored list may hold: real app ids, each once, in order. */
export function normalizeStartupApps(value: unknown): AppId[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(
    value.filter((id): id is string => typeof id === "string" && knownApps.has(id)),
  );
  return appOrder.filter((id) => wanted.has(id));
}
