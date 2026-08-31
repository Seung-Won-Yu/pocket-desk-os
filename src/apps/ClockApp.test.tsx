// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClockApp from "./ClockApp";
import { createIdleClockTimer, type ClockAlarm, type ClockTimer } from "../shell/clock";

// 09:30 local on a fixed day, so "10:00" is always 오늘 and "09:00" always 내일.
const NOW = new Date(2026, 7, 31, 9, 30, 0, 0);

function Harness({ initialAlarms = [] as ClockAlarm[] }) {
  const [alarms, setAlarms] = useState<ClockAlarm[]>(initialAlarms);
  const [timer, setTimer] = useState<ClockTimer>(() => createIdleClockTimer());
  return (
    <ClockApp
      clockAlarms={alarms}
      clockTimer={timer}
      playSound={vi.fn()}
      updateClockAlarms={setAlarms}
      updateClockTimer={setTimer}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("알람", () => {
  it("adds an alarm, says when it rings, and toggling re-arms it", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("알람 시간"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("알람 이름"), { target: { value: "회의" } });
    fireEvent.click(screen.getByRole("button", { name: /알람 추가/ }));

    expect(screen.getByText("오늘 10:00에 울림")).toBeTruthy();
    expect(screen.getByText(/다음 알람: 오늘 10:00 · 회의/)).toBeTruthy();

    const toggle = screen.getByLabelText("알람 사용: 회의") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(screen.getByText("꺼짐")).toBeTruthy();
    expect(screen.getByText("예정된 알람이 없습니다.")).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.getByText("오늘 10:00에 울림")).toBeTruthy();
  });

  it("labels a passed wall-clock time as tomorrow and deletes on request", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("알람 시간"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: /알람 추가/ }));
    expect(screen.getByText("내일 09:00에 울림")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("알람 삭제: 09:00"));
    expect(
      screen.getByText("알람을 추가하면 창을 닫아도 셸이 시간에 맞춰 알립니다."),
    ).toBeTruthy();
  });
});

describe("타이머", () => {
  it("takes a preset, counts down while running, and pauses where it stands", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "타이머" }));

    expect(screen.getByRole("timer").textContent).toBe("05:00");
    fireEvent.click(screen.getByRole("button", { name: "1분" }));
    expect(screen.getByRole("timer").textContent).toBe("01:00");

    fireEvent.click(screen.getByRole("button", { name: /시작/ }));
    expect((screen.getByLabelText("타이머 시간 (분)") as HTMLInputElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("00:30");

    fireEvent.click(screen.getByRole("button", { name: /일시 정지/ }));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("00:30");

    fireEvent.click(screen.getByRole("button", { name: /초기화/ }));
    expect(screen.getByRole("timer").textContent).toBe("01:00");
    expect((screen.getByLabelText("타이머 시간 (분)") as HTMLInputElement).disabled).toBe(
      false,
    );
  });
});

describe("스톱워치", () => {
  it("runs, flags a lap, stops dead, and resets to zero", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "스톱워치" }));

    expect(screen.getByRole("timer").textContent).toBe("00:00.00");
    fireEvent.click(screen.getByRole("button", { name: /시작/ }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("00:05.00");

    fireEvent.click(screen.getByRole("button", { name: /플래그/ }));
    expect(screen.getByLabelText("플래그 기록")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /중지/ }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("00:05.00");

    fireEvent.click(screen.getByRole("button", { name: /초기화/ }));
    expect(screen.getByRole("timer").textContent).toBe("00:00.00");
  });
});
