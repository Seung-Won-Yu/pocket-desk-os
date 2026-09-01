// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskView } from "./TaskView";
import type { WindowInstance } from "../types";
import type { AppId } from "../../types";

function makeWindow(id: string, appId: AppId, overrides: Partial<WindowInstance> = {}) {
  const instance: WindowInstance = {
    appId,
    desktopIndex: 0,
    height: 480,
    id,
    maximized: false,
    minimized: false,
    width: 640,
    x: 40,
    y: 40,
    z: 1,
    ...overrides,
  };
  return instance;
}

function renderTaskView(overrides: Partial<Parameters<typeof TaskView>[0]> = {}) {
  const handlers = {
    getDocumentLabel: vi.fn(() => undefined) as (
      windowId: string,
      appId: AppId,
    ) => string | undefined,
    onAddDesktop: vi.fn(),
    onCloseDesktop: vi.fn(),
    onCloseWindow: vi.fn(),
    onDismiss: vi.fn(),
    onMoveWindowToDesktop: vi.fn(),
    onSelectDesktop: vi.fn(),
    onSelectWindow: vi.fn(),
  };
  const user = userEvent.setup();
  render(
    <TaskView
      activeDesktopIndex={0}
      desktopCount={1}
      windows={[makeWindow("win-notes", "notepad")]}
      {...handlers}
      {...overrides}
    />,
  );
  return { handlers, user };
}

afterEach(cleanup);

describe("TaskView 창 카드", () => {
  it("픽셀 치수 대신 창 제목을 보여준다", () => {
    renderTaskView({ getDocumentLabel: () => "notes.txt" });

    expect(screen.getByRole("button", { name: "notes.txt - 메모장 전환" })).toBeVisible();
    // Windows never shows a window's pixel size here; it told you nothing about
    // which of two Notepad windows a card belonged to.
    expect(screen.queryByText(/640 × 480/)).toBeNull();
  });

  it("같은 앱의 두 창이 창 단위 문서 라벨로 구분된다", () => {
    renderTaskView({
      getDocumentLabel: ((windowId: string) =>
        windowId === "win-a" ? "회의록.txt" : "메모.txt") as (
        windowId: string,
        appId: AppId,
      ) => string | undefined,
      windows: [makeWindow("win-a", "notepad"), makeWindow("win-b", "notepad")],
    });

    expect(screen.getByText("회의록.txt - 메모장")).toBeTruthy();
    expect(screen.getByText("메모.txt - 메모장")).toBeTruthy();
  });

  it("문서가 없으면 앱 이름만 쓴다", () => {
    renderTaskView();

    expect(screen.getByRole("button", { name: "메모장 전환" })).toBeVisible();
  });

  it("카드에서 창을 닫는다", async () => {
    const { handlers, user } = renderTaskView({ getDocumentLabel: () => "notes.txt" });

    await user.click(screen.getByRole("button", { name: "notes.txt - 메모장 닫기" }));

    expect(handlers.onCloseWindow).toHaveBeenCalledWith("win-notes");
    // Closing a card must not also switch to the window it just closed.
    expect(handlers.onSelectWindow).not.toHaveBeenCalled();
  });

  it("최소화된 창만 최소화됨으로 표시한다", () => {
    const { user: _user } = renderTaskView({
      windows: [
        makeWindow("win-notes", "notepad"),
        makeWindow("win-calc", "calculator", { minimized: true }),
      ],
    });

    expect(screen.getAllByText("최소화됨")).toHaveLength(1);
  });
});
