import { Monitor, Palette, RotateCcw, Search, Volume2 } from "lucide-react";
import { useState } from "react";
import type { SoundEffectName, ThemeName, WallpaperName } from "../types";
import { normalizeSearchText } from "../utils/format";
import { getWallpaperPreviewStyle, wallpaperGallery } from "../wallpapers";

type SettingsAppProps = {
  playSound: (effect: SoundEffectName) => void;
  resetDesktopIconLayout: () => void;
  resetWindowLayout: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTheme: (theme: ThemeName) => void;
  setWallpaper: (wallpaper: WallpaperName) => void;
  soundEnabled: boolean;
  theme: ThemeName;
  wallpaper: WallpaperName;
};

export default function SettingsApp({
  playSound,
  resetDesktopIconLayout,
  resetWindowLayout,
  setSoundEnabled,
  setTheme,
  setWallpaper,
  soundEnabled,
  theme,
  wallpaper,
}: SettingsAppProps) {
  const [section, setSection] = useState<"personalization" | "sound" | "system">(
    "personalization",
  );
  const [settingsQuery, setSettingsQuery] = useState("");
  const themes: Array<{ id: ThemeName; label: string; detail: string }> = [
    { id: "lagoon", label: "Windows 기본", detail: "파란색 강조색" },
    { id: "meadow", label: "녹색", detail: "녹색 강조색" },
    { id: "ember", label: "회색", detail: "청록색 강조색" },
  ];
  const settingsSections = [
    { id: "system" as const, icon: Monitor, label: "시스템", keywords: "창 바탕 화면 배치" },
    {
      id: "personalization" as const,
      icon: Palette,
      label: "개인 설정",
      keywords: "테마 배경 화면",
    },
    { id: "sound" as const, icon: Volume2, label: "소리", keywords: "시스템 소리" },
  ];
  const filteredSettingsSections = settingsSections.filter((item) =>
    normalizeSearchText(`${item.label} ${item.keywords}`).includes(
      normalizeSearchText(settingsQuery),
    ),
  );

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-profile">
          <Monitor aria-hidden="true" size={24} />
          <span>
            <strong>Seung-Won</strong>
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
        <nav aria-label="설정 범주">
          {filteredSettingsSections.map((item) => {
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
          {filteredSettingsSections.length === 0 && (
            <span className="settings-no-results">결과 없음</span>
          )}
        </nav>
      </aside>
      <section className="settings-content">
        <header className="settings-hero">
          <h2>
            {section === "personalization"
              ? "개인 설정"
              : section === "system"
                ? "시스템"
                : "소리"}
          </h2>
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
                    className={wallpaper === option.id ? "is-selected" : ""}
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
      </section>
    </div>
  );
}
