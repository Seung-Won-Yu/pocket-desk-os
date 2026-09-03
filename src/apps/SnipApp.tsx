import { AppWindow, Camera, Clipboard, ExternalLink, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type DesktopItem } from "../types";
import { type ScreenshotMode } from "../shell/screenshotTypes";

/**
 * 캡처 도구 — the Snipping Tool. A button for people without a PrintScreen
 * key (every Mac): capture the whole screen or the active window, after an
 * optional delay, save it to 사진 and show it here. The tool never appears in
 * its own picture; the shell leaves this window out of the capture.
 */
export default function SnipApp({
  captureScreenshot,
  copyImageToClipboard,
  openVfsEntry,
}: {
  captureScreenshot: (mode: ScreenshotMode) => Promise<DesktopItem | null>;
  copyImageToClipboard: (dataUrl: string) => Promise<boolean>;
  openVfsEntry: (item: DesktopItem) => void;
}) {
  const [mode, setMode] = useState<ScreenshotMode>("screen");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DesktopItem | null>(null);
  const [status, setStatus] = useState("새 캡처를 누르면 화면을 찍어 사진 폴더에 저장합니다.");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const takePicture = async () => {
    setBusy(true);
    setCountdown(null);
    try {
      const item = await captureScreenshot(mode);
      if (item) {
        setResult(item);
        setStatus(`사진 폴더에 저장됨: ${item.name}`);
      } else {
        setStatus(mode === "window" ? "캡처할 활성 창이 없습니다." : "캡처에 실패했습니다.");
      }
    } catch {
      setStatus("캡처에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const startCapture = () => {
    if (busy) return;
    if (delaySeconds === 0) {
      void takePicture();
      return;
    }
    // A countdown, as Windows shows one, so you can arrange what to capture.
    let remaining = delaySeconds;
    setCountdown(remaining);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        timerRef.current = null;
        void takePicture();
        return;
      }
      setCountdown(remaining);
      timerRef.current = window.setTimeout(tick, 1000);
    };
    timerRef.current = window.setTimeout(tick, 1000);
  };

  return (
    <div className="snip-app">
      <div className="snip-toolbar" role="toolbar" aria-label="캡처 도구 모음">
        <button
          className="snip-primary"
          disabled={busy || countdown !== null}
          onClick={startCapture}
          type="button"
        >
          <Camera aria-hidden="true" size={16} />새 캡처
        </button>
        <label>
          <span>모드</span>
          <select
            aria-label="캡처 모드"
            onChange={(event) => setMode(event.target.value as ScreenshotMode)}
            value={mode}
          >
            <option value="screen">전체 화면</option>
            <option value="window">활성 창</option>
          </select>
        </label>
        <label>
          <span>지연</span>
          <select
            aria-label="캡처 지연"
            onChange={(event) => setDelaySeconds(Number(event.target.value))}
            value={delaySeconds}
          >
            <option value={0}>지연 없음</option>
            <option value={3}>3초</option>
            <option value={5}>5초</option>
          </select>
        </label>
      </div>
      <p className="snip-status" role="status">
        {countdown !== null ? `${countdown}초 후 캡처합니다…` : busy ? "캡처 중…" : status}
      </p>
      {result?.content ? (
        <div className="snip-result">
          <img alt={`${result.name} 미리보기`} className="snip-preview" src={result.content} />
          <div className="snip-actions">
            <button onClick={() => openVfsEntry(result)} type="button">
              <ExternalLink aria-hidden="true" size={15} />
              사진 앱에서 열기
            </button>
            <button
              onClick={async () => {
                const copied = await copyImageToClipboard(result.content ?? "");
                setStatus(
                  copied
                    ? "클립보드에 복사했습니다."
                    : "클립보드 복사를 지원하지 않는 환경입니다.",
                );
              }}
              type="button"
            >
              <Clipboard aria-hidden="true" size={15} />
              복사
            </button>
          </div>
        </div>
      ) : (
        <div className="snip-empty" aria-hidden="true">
          {mode === "window" ? <AppWindow size={40} /> : <Monitor size={40} />}
          <span>PrintScreen 키로도 찍을 수 있습니다. Alt+PrintScreen은 활성 창만.</span>
        </div>
      )}
    </div>
  );
}
