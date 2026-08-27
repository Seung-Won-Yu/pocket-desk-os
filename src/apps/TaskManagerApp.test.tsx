// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TaskManagerApp from "./TaskManagerApp";
import type { OpenWindowInfo } from "../types";

type Handlers = {
  closeWindow: ReturnType<typeof vi.fn>;
  focusWindow: ReturnType<typeof vi.fn>;
  playSound: ReturnType<typeof vi.fn>;
};

function makeWindowInfo(overrides: Partial<OpenWindowInfo> & Pick<OpenWindowInfo, "id">) {
  const info: OpenWindowInfo = {
    appId: "notepad",
    maximized: false,
    minimized: false,
    title: "메모장",
    ...overrides,
  };
  return info;
}

function renderTaskManager(openWindows: OpenWindowInfo[]) {
  const handlers: Handlers = {
    closeWindow: vi.fn(),
    focusWindow: vi.fn(),
    playSound: vi.fn(),
  };
  render(
    <TaskManagerApp
      closeWindow={handlers.closeWindow}
      focusWindow={handlers.focusWindow}
      openWindows={openWindows}
      playSound={handlers.playSound}
    />,
  );
  return { handlers, user: userEvent.setup() };
}

/** jsdom has no StorageManager, so the "브라우저 저장소" row needs one supplied. */
function stubStorageEstimate(estimate: StorageEstimate) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { estimate: () => Promise.resolve(estimate) },
  });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "storage");
  vi.restoreAllMocks();
});

describe("TaskManagerApp 프로세스 탭", () => {
  it("열린 창마다 한 행씩 그린다", () => {
    renderTaskManager([
      makeWindowInfo({ id: "win-notepad", title: "메모장" }),
      makeWindowInfo({ appId: "browser", id: "win-edge", title: "Microsoft Edge" }),
      makeWindowInfo({ appId: "calculator", id: "win-calc", title: "계산기" }),
    ]);

    // Header row plus one row per open window.
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("row", { name: /메모장/ })).toBeVisible();
    expect(screen.getByRole("row", { name: /Microsoft Edge/ })).toBeVisible();
    expect(screen.getByRole("row", { name: /계산기/ })).toBeVisible();
    expect(screen.getByText(/프로세스 3개/)).toBeVisible();
  });

  it("최소화된 창은 CPU 0.0%와 최소화됨 배지를 보여 준다", () => {
    renderTaskManager([makeWindowInfo({ id: "win-notepad", minimized: true })]);

    const row = screen.getByRole("row", { name: /메모장/ });
    expect(row).toHaveTextContent("최소화됨");
    expect(row).toHaveTextContent("0.0%");
  });

  it("행을 고르기 전에는 작업 끝내기를 누를 수 없다", async () => {
    const { user } = renderTaskManager([makeWindowInfo({ id: "win-notepad" })]);

    const endTask = screen.getByRole("button", { name: /작업 끝내기/ });
    expect(endTask).toBeDisabled();

    await user.click(screen.getByRole("row", { name: /메모장/ }));
    expect(endTask).toBeEnabled();
  });

  it("고른 행의 창 id로 closeWindow를 호출하고 선택을 비운다", async () => {
    const { handlers, user } = renderTaskManager([
      makeWindowInfo({ id: "win-notepad", title: "메모장" }),
      makeWindowInfo({ appId: "browser", id: "win-edge", title: "Microsoft Edge" }),
    ]);

    const row = screen.getByRole("row", { name: /Microsoft Edge/ });
    await user.click(row);
    expect(row).toHaveAttribute("aria-selected", "true");

    const endTask = screen.getByRole("button", { name: /작업 끝내기/ });
    await user.click(endTask);

    expect(handlers.closeWindow).toHaveBeenCalledTimes(1);
    expect(handlers.closeWindow).toHaveBeenCalledWith("win-edge");
    expect(handlers.playSound).toHaveBeenCalledWith("close");
    expect(endTask).toBeDisabled();
  });

  it("행을 두 번 누르면 그 창에 focusWindow를 호출한다", async () => {
    const { handlers, user } = renderTaskManager([
      makeWindowInfo({ id: "win-notepad", title: "메모장" }),
      makeWindowInfo({ appId: "browser", id: "win-edge", title: "Microsoft Edge" }),
    ]);

    await user.dblClick(screen.getByRole("row", { name: /메모장/ }));

    expect(handlers.focusWindow).toHaveBeenCalledTimes(1);
    expect(handlers.focusWindow).toHaveBeenCalledWith("win-notepad");
    expect(handlers.closeWindow).not.toHaveBeenCalled();
  });

  it("창이 하나도 없으면 빈 상태를 보여 준다", () => {
    renderTaskManager([]);

    expect(screen.getByText("실행 중인 앱이 없습니다.")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /작업 끝내기/ })).toBeDisabled();
    expect(screen.getByText(/프로세스 0개/)).toBeVisible();
  });
});

describe("TaskManagerApp 성능 탭", () => {
  it("성능 탭으로 바꾸면 CPU와 메모리 그래프를 그린다", async () => {
    const { user } = renderTaskManager([makeWindowInfo({ id: "win-notepad" })]);

    expect(screen.queryByRole("img", { name: "CPU 사용률 그래프" })).toBeNull();

    await user.click(screen.getByRole("tab", { name: "성능" }));

    expect(screen.getByRole("tab", { name: "성능" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "프로세스" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("img", { name: "CPU 사용률 그래프" })).toBeVisible();
    expect(screen.getByRole("img", { name: "메모리 사용률 그래프" })).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("성능 탭이 실행 중인 프로세스 개수를 센다", async () => {
    const { user } = renderTaskManager([
      makeWindowInfo({ id: "win-notepad", title: "메모장" }),
      makeWindowInfo({ appId: "browser", id: "win-edge", title: "Microsoft Edge" }),
    ]);

    await user.click(screen.getByRole("tab", { name: "성능" }));

    expect(screen.getByText("2개")).toBeVisible();
  });

  it("저장소를 측정할 수 없으면 그렇게 적는다", async () => {
    const { user } = renderTaskManager([]);

    await user.click(screen.getByRole("tab", { name: "성능" }));

    expect(screen.getByText("측정할 수 없음")).toBeVisible();
  });

  it("저장소 추정값이 있으면 사용량과 할당량을 적는다", async () => {
    stubStorageEstimate({ quota: 512 * 1024 * 1024, usage: 12 * 1024 * 1024 });
    const { user } = renderTaskManager([]);

    await user.click(screen.getByRole("tab", { name: "성능" }));

    expect(await screen.findByText("12 MB / 512 MB")).toBeVisible();
  });
});
