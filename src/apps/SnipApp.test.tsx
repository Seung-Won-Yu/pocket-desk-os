// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnipApp from "./SnipApp";
import { type DesktopItem } from "../types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shot: DesktopItem = {
  content: "data:image/png;base64,AAAA",
  createdAt: 0,
  id: "shot-1",
  kind: "canvas",
  name: "스크린샷 2026-09-03 143012.png",
  parentId: "vfs-system-pictures",
  showOnDesktop: false,
  updatedAt: 0,
  x: 0,
  y: 0,
};

describe("SnipApp", () => {
  it("captures the chosen mode and shows the saved picture with its name", async () => {
    const captureScreenshot = vi.fn(async () => shot);
    const openVfsEntry = vi.fn();
    render(
      <SnipApp
        captureScreenshot={captureScreenshot}
        copyImageToClipboard={vi.fn(async () => true)}
        openVfsEntry={openVfsEntry}
      />,
    );
    fireEvent.change(screen.getByLabelText("캡처 모드"), { target: { value: "window" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "새 캡처" }));
    });
    expect(captureScreenshot).toHaveBeenCalledWith("window");
    expect(screen.getByRole("status").textContent).toContain(shot.name);
    expect((screen.getByAltText(`${shot.name} 미리보기`) as HTMLImageElement).src).toBe(
      shot.content,
    );
    fireEvent.click(screen.getByRole("button", { name: "사진 앱에서 열기" }));
    expect(openVfsEntry).toHaveBeenCalledWith(shot);
  });

  it("counts down a delayed capture before taking it", async () => {
    vi.useFakeTimers();
    const captureScreenshot = vi.fn(async () => shot);
    render(
      <SnipApp
        captureScreenshot={captureScreenshot}
        copyImageToClipboard={vi.fn(async () => true)}
        openVfsEntry={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("캡처 지연"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "새 캡처" }));
    expect(screen.getByRole("status").textContent).toContain("3초 후");
    expect(captureScreenshot).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(captureScreenshot).toHaveBeenCalledWith("screen");
  });

  it("says when there is no active window to capture", async () => {
    render(
      <SnipApp
        captureScreenshot={vi.fn(async () => null)}
        copyImageToClipboard={vi.fn(async () => false)}
        openVfsEntry={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("캡처 모드"), { target: { value: "window" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "새 캡처" }));
    });
    expect(screen.getByRole("status").textContent).toContain("활성 창이 없습니다");
  });
});
