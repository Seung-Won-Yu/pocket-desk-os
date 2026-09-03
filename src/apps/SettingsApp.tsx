import {
  Clock3,
  LayoutGrid,
  Monitor,
  Palette,
  RotateCcw,
  Search,
  UserRound,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { appMetadata } from "./metadata";
import { DEFAULT_APP_CHOICES, type DefaultAppMap } from "../shell/preferences";
import type { AppId, SoundEffectName, ThemeName, WallpaperName } from "../types";
import { normalizeSearchText } from "../utils/format";
import { getWallpaperPreviewStyle, wallpaperGallery } from "../wallpapers";

type SettingsAppProps = {
  clock24h: boolean;
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
  soundEnabled: boolean;
  theme: ThemeName;
  wallpaper: WallpaperName;
};

export default function SettingsApp({
  clock24h,
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
  wallpaper,
}: SettingsAppProps) {
  const [section, setSection] = useState<
    "accounts" | "apps" | "personalization" | "sound" | "system" | "time"
  >("personalization");
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
      id: "personalization" as const,
      icon: Palette,
      label: "개인 설정",
      keywords: "테마 배경 화면",
      aliases: "personalization theme wallpaper background",
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
          </>
        )}
        {section === "system" && (
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
