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
    // A region, not a button: any key wakes it, and its one line of
    // instruction has to be readable, which a button's contents are not.
    const screenNode = screen.getByRole("region", { name: "절전 중" });
    expect(screenNode).toHaveTextContent("아무 키나 누르면 다시 켜집니다.");

    fireEvent.pointerMove(screenNode);
    expect(onWake).not.toHaveBeenCalled();
    now += SLEEP_WAKE_GRACE_MS;
    fireEvent.pointerMove(screenNode);
    expect(onWake).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(screenNode);
    expect(onWake).toHaveBeenCalledTimes(2);
  });

  it("takes focus once, not on every commit, and hears a key pressed elsewhere", () => {
    const onWake = vi.fn();
    const outside = document.createElement("button");
    document.body.append(outside);
    const view = render(<SleepScreen onWake={onWake} />);
    const screenNode = screen.getByRole("region", { name: "절전 중" });
    expect(document.activeElement).toBe(screenNode);

    // Something else takes focus; a re-render must not snatch it back.
    outside.focus();
    view.rerender(<SleepScreen onWake={onWake} />);
    expect(document.activeElement).toBe(outside);

    // "아무 키나" means any key, wherever focus happens to be.
    fireEvent.keyDown(outside, { key: "a" });
    expect(onWake).toHaveBeenCalledTimes(1);

    view.unmount();
    fireEvent.keyDown(document.body, { key: "b" });
    expect(onWake).toHaveBeenCalledTimes(1);
    outside.remove();
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
