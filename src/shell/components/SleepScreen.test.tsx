// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SLEEP_WAKE_GRACE_MS, ShellGate, SleepScreen } from "./ShellScreens";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SleepScreen", () => {
  it("wakes on a key or a press, and on a pointer move only after the grace period", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onWake = vi.fn();
    render(<SleepScreen onWake={onWake} />);
    const screenNode = screen.getByRole("button", { name: "절전 중" });

    fireEvent.pointerMove(screenNode);
    expect(onWake).not.toHaveBeenCalled();
    now += SLEEP_WAKE_GRACE_MS;
    fireEvent.pointerMove(screenNode);
    expect(onWake).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screenNode, { key: "a" });
    fireEvent.pointerDown(screenNode);
    expect(onWake).toHaveBeenCalledTimes(3);
  });

  it("the gate shows the dark screen for the sleeping phase and the lock screen carries the custom wallpaper", () => {
    const view = render(
      <ShellGate
        clock24h
        onPowerOn={vi.fn()}
        onUnlock={vi.fn()}
        onWake={vi.fn()}
        phase="sleeping"
        userName="est"
        wallpaper="ribbon"
      />,
    );
    expect(document.querySelector(".sleep-screen")).not.toBeNull();
    view.unmount();

    render(
      <ShellGate
        clock24h
        customWallpaperImage="data:image/png;base64,AAAA"
        onPowerOn={vi.fn()}
        onUnlock={vi.fn()}
        phase="locked"
        userName="est"
        wallpaper="ribbon"
      />,
    );
    const lock = document.querySelector<HTMLElement>('[aria-label="PocketDesk 잠금 화면"]');
    expect(lock?.style.getPropertyValue("--wallpaper-image")).toBe(
      'url("data:image/png;base64,AAAA")',
    );
  });
});
