// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastStack } from "./ToastStack";
import type { ToastMessage } from "../types";

function makeToast(overrides: Partial<ToastMessage> = {}): ToastMessage {
  return {
    actions: [],
    createdAt: 0,
    image: "",
    openItemId: "",
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

  it("reports pointer and focus holds so the dismiss timer can wait", () => {
    const onHoldChange = vi.fn();
    render(
      <ToastStack
        onDismiss={vi.fn()}
        onHoldChange={onHoldChange}
        toasts={[makeToast({ actions: [{ id: "a", label: "확인" }], onAction: vi.fn() })]}
      />,
    );

    const article = document.querySelector(".toast");
    if (!article) throw new Error("toast not rendered");
    fireEvent.pointerEnter(article);
    expect(onHoldChange).toHaveBeenLastCalledWith("toast-1", true);
    fireEvent.pointerLeave(article);
    expect(onHoldChange).toHaveBeenLastCalledWith("toast-1", false);
    fireEvent.focus(screen.getByRole("button", { name: "확인" }));
    expect(onHoldChange).toHaveBeenLastCalledWith("toast-1", true);
  });

  it("renders no action row for a plain statement toast", () => {
    render(<ToastStack onDismiss={vi.fn()} toasts={[makeToast()]} />);
    expect(document.querySelector(".toast-actions")).toBeNull();
  });
});
