import { DEFAULT_APP_CHOICES, type DefaultAppMap } from "../shell/preferences";
import { type AppId, type DesktopItem } from "../types";
import { getVfsEntryAssociation, getVfsEntryExtension } from "./model";

/**
 * 연결 프로그램. A file opened with its default app and nothing else — the
 * only way to open a .txt in 명령 프롬프트, or a .png in 그림판, was to change
 * 기본 앱 for every file of that type. The apps offered here are the ones
 * 설정 > 기본 앱 already offers for the extension, so the two lists can never
 * disagree.
 */
export type OpenWithChoice = { appId: AppId; isDefault: boolean };

/** The apps that can open the file, the current default first; null for a folder. */
export function getOpenWithChoices(
  item: DesktopItem,
  defaultApps: DefaultAppMap,
): OpenWithChoice[] | null {
  if (item.kind === "folder") return null;
  const extension = getVfsEntryExtension(item);
  const association = getVfsEntryAssociation(item);
  const current = defaultApps[extension] ?? association.appId;
  const offered =
    DEFAULT_APP_CHOICES.find((choice) => choice.extension === extension)?.apps ?? [];
  const apps = [current, ...offered.filter((appId) => appId !== current)];
  return apps.map((appId) => ({ appId, isDefault: appId === current }));
}

/** Whether the extension's default can be changed at all from 다른 앱 선택. */
export function canRememberOpenWith(item: DesktopItem) {
  const extension = getVfsEntryExtension(item);
  return DEFAULT_APP_CHOICES.some((choice) => choice.extension === extension);
}

/** ".txt" for the 항상 이 앱을 사용 line. */
export function getOpenWithExtensionLabel(item: DesktopItem) {
  return `.${getVfsEntryExtension(item)}`;
}
