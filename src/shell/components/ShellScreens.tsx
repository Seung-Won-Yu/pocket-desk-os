import { type WallpaperName } from "../../types";
import { getWallpaperStyle } from "../../wallpapers";
import { type ShellPhase } from "../types";
import { BrandMark, StartGlyph } from "./Branding";
import { Power, UserRound, Volume2, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ShellGate({
  clock24h,
  customWallpaperImage = null,
  onPowerOn,
  onUnlock,
  onWake,
  phase,
  userName,
  wallpaper,
}: {
  clock24h: boolean;
  /** The user's own picture as wallpaper, if one is set; the lock screen shows it too. */
  customWallpaperImage?: string | null;
  onPowerOn: () => void;
  onUnlock: () => void;
  /** 절전 ends on the first input; the lock screen comes back, as on Windows. */
  onWake?: () => void;
  phase: ShellPhase;
  userName: string;
  wallpaper: WallpaperName;
}) {
  if (phase === "booting") {
    return (
      <section className="shell-gate shell-boot" aria-label="부팅 화면">
        <div className="boot-windows-mark">
          <StartGlyph />
        </div>
        <span aria-hidden="true" className="boot-spinner" />
      </section>
    );
  }

  if (phase === "shutdown") {
    return <ShutdownScreen onPowerOn={onPowerOn} />;
  }

  if (phase === "sleeping") {
    return <SleepScreen onWake={onWake ?? (() => undefined)} />;
  }

  return (
    <LockScreen
      clock24h={clock24h}
      customWallpaperImage={customWallpaperImage}
      onUnlock={onUnlock}
      userName={userName}
      wallpaper={wallpaper}
    />
  );
}

/** How long after the display goes dark before a pointer move counts as waking it. */
export const SLEEP_WAKE_GRACE_MS = 400;

/**
 * 절전: the display goes dark and stays dark until a key or a click — a
 * pointer move counts too, but only after a moment, so the hand still on the
 * mouse does not wake it straight away.
 */
export function SleepScreen({ onWake }: { onWake: () => void }) {
  const armedAtRef = useRef(0);
  useEffect(() => {
    armedAtRef.current = performance.now();
  }, []);
  const wakeOnMove = () => {
    if (performance.now() - armedAtRef.current >= SLEEP_WAKE_GRACE_MS) onWake();
  };
  return (
    <section
      aria-label="절전 중"
      className="shell-gate sleep-screen"
      onKeyDown={onWake}
      onPointerDown={onWake}
      onPointerMove={wakeOnMove}
      ref={(node) => node?.focus()}
      role="button"
      tabIndex={0}
    >
      <span className="sr-only">아무 키나 누르면 다시 켜집니다.</span>
    </section>
  );
}

export function ShutdownScreen({ onPowerOn }: { onPowerOn: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => buttonRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <section className="shell-gate shutdown-screen" aria-label="PocketDesk 전원 꺼짐">
      <div className="shutdown-panel">
        <BrandMark />
        <strong>PocketDesk OS</strong>
        <small>전원이 꺼져 있습니다</small>
        <button onClick={onPowerOn} ref={buttonRef} type="button">
          <Power aria-hidden="true" size={17} />
          전원 켜기
        </button>
      </div>
    </section>
  );
}

export function LockScreen({
  clock24h,
  onUnlock,
  userName,
  customWallpaperImage = null,
  wallpaper,
}: {
  clock24h: boolean;
  onUnlock: () => void;
  userName: string;
  customWallpaperImage?: string | null;
  wallpaper: WallpaperName;
}) {
  const lockRef = useRef<HTMLElement>(null);
  const signInButtonRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [signInVisible, setSignInVisible] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const unlockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => lockRef.current?.focus());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!signInVisible) return;
    const frameId = window.requestAnimationFrame(() => signInButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [signInVisible]);

  useEffect(
    () => () => {
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    },
    [],
  );

  const beginUnlock = () => {
    if (unlocking) return;
    setUnlocking(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    unlockTimerRef.current = window.setTimeout(onUnlock, reduceMotion ? 0 : 220);
  };

  const unlockFromKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && signInVisible) {
      event.preventDefault();
      setSignInVisible(false);
      lockRef.current?.focus();
      return;
    }

    if (
      !signInVisible &&
      (event.key === "Enter" || event.key === " " || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      setSignInVisible(true);
    }
  };

  return (
    <section
      aria-label={signInVisible ? "PocketDesk 로그인" : "PocketDesk 잠금 화면"}
      className={`shell-gate lock-screen wallpaper-${wallpaper} ${
        signInVisible ? "is-sign-in" : ""
      } ${unlocking ? "is-unlocking" : ""}`}
      onClick={() => {
        if (!signInVisible) setSignInVisible(true);
      }}
      onKeyDown={unlockFromKey}
      ref={lockRef}
      style={getWallpaperStyle(wallpaper, customWallpaperImage)}
      tabIndex={0}
    >
      {signInVisible ? (
        <>
          <div aria-hidden="true" className="lock-sign-in-backdrop" />
          <div className="sign-in-panel">
            <span className="sign-in-avatar">
              <UserRound aria-hidden="true" size={48} strokeWidth={1.45} />
            </span>
            <strong>{userName}</strong>
            <button
              disabled={unlocking}
              onClick={beginUnlock}
              ref={signInButtonRef}
              type="button"
            >
              로그인
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="lock-time">
            <time dateTime={now.toISOString()}>
              {now.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                hour12: !clock24h,
                minute: "2-digit",
              })}
            </time>
            <span>
              {now.toLocaleDateString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </span>
          </div>
          <small className="lock-hint">클릭하거나 위로 밀어 로그인</small>
        </>
      )}
      <div className="lock-system-status" role="group" aria-label="네트워크와 소리 상태">
        <span className="sr-only">시스템 상태 아이콘</span>
        <Wifi aria-hidden="true" size={17} />
        <Volume2 aria-hidden="true" size={17} />
      </div>
    </section>
  );
}
