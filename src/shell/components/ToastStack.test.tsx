// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastStack } from "./ToastStack";
import type { ToastMessage } from "../types";

function makeToast(overrides: Partial<ToastMessage> = {}): ToastMessage {
  return {
    actions: [],
    createdAt: 0,
    detail: "",
    id: "toast-1",
    title: "알림",
    tone: "info",
    ...overrides,
  };
}

afterEach(cleanup);

describe("ToastStack actions", () => {
  it("runs the clicked action and then dismisses the toast", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ToastStack
        onDismiss={onDismiss}
        toasts={[
          makeToast({
            actions: [
              { id: "snooze", label: "다시 알림 (5분)" },
              { id: "dismiss", label: "해제" },
            ],
            onAction,
            title: "알람",
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 알림 (5분)" }));
    expect(onAction).toHaveBeenCalledWith("snooze");
    expect(onDismiss).toHaveBeenCalledWith("toast-1");
  });

  it("renders no action row for a plain statement toast", () => {
    render(<ToastStack onDismiss={vi.fn()} toasts={[makeToast()]} />);
    expect(document.querySelector(".toast-actions")).toBeNull();
  });
});
