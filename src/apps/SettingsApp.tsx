import {
  Clock3,
  Keyboard,
  LayoutGrid,
  Monitor,
  Palette,
  RotateCcw,
  Search,
  Type,
  UserRound,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { appMetadata } from "./metadata";
import {
  DEFAULT_APP_CHOICES,
  type DefaultAppMap,
  TEXT_SCALES,
  type TextScale,
} from "../shell/preferences";
import {
  TASKBAR_POSITIONS,
  TASKBAR_POSITION_LABELS,
  type TaskbarPosition,
} from "../shell/taskbarPosition";
import type { AppId, SoundEffectName, ThemeName, WallpaperName } from "../types";
import { normalizeSearchText } from "../utils/format";
import { SHELL_SHORTCUTS } from "../shell/shortcuts";
import { getWallpaperPreviewStyle, wallpaperGallery } from "../wallpapers";

/** Which page 설정 shows. */
export type SettingsSection =
  | "accessibility"
  | "accounts"
  | "apps"
  | "keyboard"
  | "personalization"
  | "sound"
  | "system"
  | "time";

/** "Open 설정 at this page" — a fresh id per request so the same page opens twice. */
export type SettingsLaunchRequest = { id: string; section: SettingsSection };

type SettingsAppProps = {
  clock24h: boolean;
  focusAssist: boolean;
  setFocusAssist: (enabled: boolean) => void;
  setTextScale: (scale: TextScale) => void;
  textScale: TextScale;
  setTaskbarPosition: (position: TaskbarPosition) => void;
  taskbarPosition: TaskbarPosition;
  defaultApps: DefaultAppMap;
  setClock24h: (enabled: boolean) => void;
  setDefaultApp: (extension: string, appId: AppId) => void;
  setUserName: (name: string) => void;
  userName: string;
  playSound: (effect: SoundEffectName) => void;
  resetDesktopIconLayout: () => void;
  resetWindowLayout: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTheme: (theme: ThemeName) => void;
  setWallpaper: (wallpaper: WallpaperName) => void;
  customWallpaperItemId: string | null;
  setCustomWallpaper: (itemId: string | null) => void;
  /** The page 설정 was asked to open at. */
  settingsLaunchRequest: SettingsLaunchRequest | null;
  consumeLaunchRequest: (requestId: string) => void;
  soundEnabled: boolean;
  theme: ThemeName;
  wallpaper: WallpaperName;
};

export default function SettingsApp({
  clock24h,
  focusAssist,
  setFocusAssist,
  setTextScale,
  textScale,
  setTaskbarPosition,
  taskbarPosition,
  defaultApps,
  setClock24h,
  setDefaultApp,
  setUserName,
  userName,
  playSound,
  resetDesktopIconLayout,
  resetWindowLayout,
  setSoundEnabled,
  setTheme,
  setWallpaper,
  customWallpaperItemId,
  setCustomWallpaper,
  soundEnabled,
  theme,
  consumeLaunchRequest,
  settingsLaunchRequest,
  wallpaper,
}: SettingsAppProps) {
  const [section, setSection] = useState<SettingsSection>(
    settingsLaunchRequest?.section ?? "personalization",
  );

  // A later request (the tray clock's 날짜 및 시간 조정) moves the open window.
  useEffect(() => {
    if (!settingsLaunchRequest) return;
    setSection(settingsLaunchRequest.section);
    consumeLaunchRequest(settingsLaunchRequest.id);
  }, [consumeLaunchRequest, settingsLaunchRequest]);
  const [nameDraft, setNameDraft] = useState(userName);
  const [settingsQuery, setSettingsQuery] = useState("");
  const themes: Array<{ id: ThemeName; label: string; detail: string }> = [
    { id: "lagoon", label: "Windows 기본", detail: "파란색 강조색" },
    { id: "meadow", label: "녹색", detail: "녹색 강조색" },
    { id: "ember", label: "회색", detail: "청록색 강조색" },
  ];
  const settingsSections = [
    {
      id: "system" as const,
      icon: Monitor,
      label: "시스템",
      keywords: "창 바탕 화면 배치",
      aliases: "system display window desktop",
    },
    {
      id: "accessibility" as const,
      icon: Type,
      label: "접근성",
      keywords: "텍스트 크기 글자 크기 확대",
      aliases: "accessibility text size font scale larger",
    },
    {
      id: "personalization" as const,
      icon: Palette,
      label: "개인 설정",
      keywords: "테마 배경 화면 작업 표시줄 위치",
      aliases: "personalization theme wallpaper background taskbar position",
    },
    {
      id: "sound" as const,
      icon: Volume2,
      label: "소리",
      keywords: "시스템 소리",
      aliases: "sound audio volume",
    },
    {
      id: "apps" as const,
      icon: LayoutGrid,
      label: "앱",
      keywords: "기본 앱 연결 프로그램",
      aliases: "apps default programs",
    },
    {
      id: "accounts" as const,
      icon: UserRound,
      label: "계정",
      keywords: "사용자 이름 로컬",
      aliases: "account user name",
    },
    {
      id: "keyboard" as const,
      icon: Keyboard,
      label: "키보드 단축키",
      keywords: "단축키 바로 가기 키",
      aliases: "keyboard shortcuts keys hotkey",
    },
    {
      id: "time" as const,
      icon: Clock3,
      label: "시간 및 언어",
      keywords: "시계 24시간 표시 형식",
      aliases: "time language clock format",
    },
  ];
  /*
   * Windows' settings search offers matches and leaves the navigation alone.
   * Filtering the navigation itself removed the page the reader was on from
   * the list — the content stayed put with no way back to its own entry.
   */
  const normalizedSettingsQuery = normalizeSearchText(settingsQuery);
  const settingsMatches = normalizedSettingsQuery
    ? settingsSections.filter(
        (item) =>
          normalizeSearchText(`${item.label} ${item.keywords} ${item.aliases ?? ""}`).includes(
            normalizedSettingsQuery,
          ) || normalizedSettingsQuery.startsWith(normalizeSearchText(item.label)),
      )
    : [];

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-profile">
          <Monitor aria-hidden="true" size={24} />
          <span>
            <strong>{userName}</strong>
            <small>로컬 계정</small>
          </span>
        </div>
        <label className="settings-search">
          <Search aria-hidden="true" size={15} />
          <input
            aria-label="설정 찾기"
            onChange={(event) => setSettingsQuery(event.target.value)}
            placeholder="설정 찾기"
            value={settingsQuery}
          />
        </label>
        {normalizedSettingsQuery !== "" && (
          <div aria-label="설정 검색 결과" className="settings-search-results" role="group">
            {settingsMatches.length === 0 ? (
              <span className="settings-no-results">결과 없음</span>
            ) : (
              settingsMatches.map((item) => (
                <button
                  key={`result-${item.id}`}
                  onClick={() => {
                    setSection(item.id);
                    setSettingsQuery("");
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        )}
        <nav aria-label="설정 범주">
          {settingsSections.map((item) => {
            const SectionIcon = item.icon;
            return (
              <button
                className={section === item.id ? "is-selected" : ""}
                key={item.id}
                onClick={() => setSection(item.id)}
                type="button"
              >
                <SectionIcon aria-hidden="true" size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <section className="settings-content">
        <header className="settings-hero">
          <h2>{settingsSections.find((item) => item.id === section)?.label ?? "설정"}</h2>
        </header>
        {section === "personalization" && (
          <>
            <section className="settings-section">
              <h3>테마</h3>
              <div className="theme-options">
                {themes.map((option) => (
                  <button
                    className={theme === option.id ? "is-selected" : ""}
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    type="button"
                  >
                    <span className={`theme-swatch theme-swatch-${option.id}`} />
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-section">
              <h3>배경</h3>
              <div className="wallpaper-options">
                {wallpaperGallery.map((option) => (
                  <button
                    className={
                      !customWallpaperItemId && wallpaper === option.id ? "is-selected" : ""
                    }
                    key={option.id}
                    onClick={() => setWallpaper(option.id)}
                    type="button"
                  >
                    <span
                      className="wallpaper-preview"
                      style={getWallpaperPreviewStyle(option.id)}
                    />
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
              {customWallpaperItemId && (
                <p className="settings-wallpaper-note">
                  지금은 내 그림이 배경입니다. 그림을 삭제하거나 위에서 배경을 고르면
                  되돌아갑니다.
                  <button
                    className="settings-action"
                    onClick={() => setCustomWallpaper(null)}
                    type="button"
                  >
                    기본 배경으로
                  </button>
                </p>
              )}
            </section>
            <section className="settings-section">
              <h3>작업 표시줄</h3>
              <p>
                작업 표시줄을 화면의 다른 가장자리로 옮깁니다. 창이 최대화되는 영역, 스냅 위치,
                바탕 화면 아이콘 격자가 모두 따라 움직입니다.
              </p>
              <div
                aria-label="작업 표시줄 위치"
                className="settings-taskbar-position"
                role="radiogroup"
              >
                {TASKBAR_POSITIONS.map((position) => (
                  <button
                    aria-checked={taskbarPosition === position}
                    className={taskbarPosition === position ? "is-selected" : ""}
                    key={position}
                    onClick={() => setTaskbarPosition(position)}
                    role="radio"
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={`taskbar-position-preview is-${position}`}
                    />
                    <small>{TASKBAR_POSITION_LABELS[position]}</small>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
        {section === "system" && (
          <>
            <section className="settings-section">
              <h3>집중 지원</h3>
              <p>
                켜면 알림이 화면에 뜨지 않고 알림 센터에서 기다립니다. 알림 자체는 그대로
                도착합니다.
              </p>
              <label className="settings-toggle">
                <input
                  checked={focusAssist}
                  onChange={(event) => setFocusAssist(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <strong>알림을 화면에 띄우지 않음</strong>
                  <small>{focusAssist ? "켜짐 · 알림 센터에 모임" : "꺼짐"}</small>
                </span>
              </label>
            </section>
            <section className="settings-section">
              <h3>창과 바탕 화면</h3>
              <p>창 위치와 크기, 아이콘 위치를 기본값으로 되돌립니다.</p>
              <div className="settings-action-row">
                <button className="settings-action" onClick={resetWindowLayout} type="button">
                  <RotateCcw aria-hidden="true" size={16} />창 배치 초기화
                </button>
                <button
                  className="settings-action"
                  onClick={resetDesktopIconLayout}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" size={16} />
                  아이콘 배치 초기화
                </button>
              </div>
            </section>
          </>
        )}
        {section === "accessibility" && (
          <section className="settings-section">
            <h3>텍스트 크기</h3>
            <p>
              셸과 앱의 글자 크기를 함께 키웁니다. 창 단추와 아이콘은 그대로입니다 — 윈도우의
              텍스트 크기 조정과 같은 방식입니다.
            </p>
            <div aria-label="텍스트 크기" className="settings-text-scale" role="radiogroup">
              {TEXT_SCALES.map((scale) => (
                <button
                  aria-checked={textScale === scale}
                  className={textScale === scale ? "is-selected" : ""}
                  key={scale}
                  onClick={() => setTextScale(scale)}
                  role="radio"
                  type="button"
                >
                  <span style={{ fontSize: `${Math.round(13 * (scale / 100))}px` }}>가나</span>
                  <small>{scale}%</small>
                </button>
              ))}
            </div>
            <p className="settings-text-scale-sample">이 문장은 지금 고른 크기로 보입니다.</p>
          </section>
        )}
        {section === "sound" && (
          <section className="settings-section">
            <h3>시스템 소리</h3>
            <label className="settings-toggle">
              <input
                checked={soundEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  if (!enabled) playSound("toggle");
                  setSoundEnabled(enabled);
                  if (enabled) window.setTimeout(() => playSound("success"), 0);
                }}
                type="checkbox"
              />
              <span>
                <strong>시스템 소리 재생</strong>
                <small>{soundEnabled ? "켜짐" : "꺼짐"}</small>
              </span>
            </label>
          </section>
        )}

        {section === "apps" && (
          <section className="settings-section">
            <h3>기본 앱</h3>
            <p className="settings-note">
              파일 형식별로 두 번 클릭했을 때 열리는 앱을 정합니다.
            </p>
            <div className="settings-default-apps">
              {DEFAULT_APP_CHOICES.map((choice) => {
                const current = defaultApps[choice.extension] ?? choice.apps[0];
                const CurrentIcon = appMetadata[current].icon;
                return (
                  <div className="settings-default-app" key={choice.extension}>
                    <span>
                      <strong>.{choice.extension}</strong>
                      <small>{choice.label}</small>
                    </span>
                    <label>
                      <CurrentIcon
                        aria-hidden="true"
                        size={16}
                        style={{ color: appMetadata[current].accent }}
                      />
                      <select
                        aria-label={`.${choice.extension} 기본 앱`}
                        disabled={choice.apps.length < 2}
                        onChange={(event) => {
                          playSound("toggle");
                          setDefaultApp(choice.extension, event.target.value as AppId);
                        }}
                        value={current}
                      >
                        {choice.apps.map((appId) => (
                          <option key={appId} value={appId}>
                            {appMetadata[appId].title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {section === "accounts" && (
          <section className="settings-section">
            <h3>사용자 정보</h3>
            <p className="settings-note">
              여기서 정한 이름은 잠금 화면과 명령 프롬프트의 <code>%USERNAME%</code>에 함께
              반영됩니다.
            </p>
            <form
              className="settings-name-form"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = nameDraft.trim().slice(0, 20);
                if (!trimmed) return;
                playSound("success");
                setUserName(trimmed);
              }}
            >
              <label>
                사용자 이름
                <input
                  maxLength={20}
                  onChange={(event) => setNameDraft(event.target.value)}
                  value={nameDraft}
                />
              </label>
              <button
                disabled={!nameDraft.trim() || nameDraft.trim() === userName}
                type="submit"
              >
                저장
              </button>
            </form>
          </section>
        )}

        {section === "keyboard" && (
          <section className="settings-section">
            <h3>키보드 단축키</h3>
            {/* One list with App.tsx: 설정 shows what the shell listens for,
                not a hand-copied menu that drifts from it. */}
            <p>
              PocketDesk가 처리하는 키입니다. 목록과 셸 처리기는 별개 코드이므로, 키를 더하거나
              바꿀 때 둘을 함께 고쳐야 합니다.
            </p>
            <div className="shortcut-groups">
              {SHELL_SHORTCUTS.map((group) => (
                <section aria-label={group.title} key={group.title}>
                  <h4>{group.title}</h4>
                  <dl>
                    {group.items.map((item) => (
                      <div key={item.keys}>
                        <dt>{item.action}</dt>
                        <dd>
                          {item.keys.split(" + ").map((key, index) => (
                            <span key={key}>
                              {index > 0 && <em aria-hidden="true">+</em>}
                              <kbd>{key}</kbd>
                            </span>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </section>
        )}
        {section === "time" && (
          <section className="settings-section">
            <h3>날짜 및 시간 형식</h3>
            <label className="settings-toggle">
              <input
                checked={clock24h}
                onChange={(event) => {
                  playSound("toggle");
                  setClock24h(event.target.checked);
                }}
                type="checkbox"
              />
              <span>
                <strong>24시간제 시계 사용</strong>
                <small>
                  {clock24h ? "작업 표시줄에 13:45로 표시" : "작업 표시줄에 오후 1:45로 표시"}
                </small>
              </span>
            </label>
          </section>
        )}
      </section>
    </div>
  );
}
