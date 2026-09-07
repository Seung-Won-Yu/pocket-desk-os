// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StickyNote } from "lucide-react";
import { lazy, type ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppWindow } from "./WindowSlot";
import { type AppContentProps, type AppDefinition, type WindowInstance } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeInstance(id: string, overrides: Partial<WindowInstance> = {}): WindowInstance {
  return {
    appId: "notepad",
    desktopIndex: 0,
    height: 300,
    id,
    maximized: false,
    minimized: false,
    width: 400,
    x: 10,
    y: 10,
    z: 1,
    ...overrides,
  };
}

function makeApp(
  title: string,
  component: ComponentType<AppContentProps>,
  reload?: () => ComponentType<AppContentProps>,
): AppDefinition {
  return {
    accent: "#e8c447",
    component,
    icon: StickyNote,
    id: "notepad",
    reload,
    subtitle: "",
    title,
  } as unknown as AppDefinition;
}

const frameOps = {
  close: vi.fn(),
  focus: vi.fn(),
  minimize: vi.fn(),
  openSystemMenu: vi.fn(),
  setInteracting: vi.fn(),
  shake: vi.fn(),
  snapPreviewChange: vi.fn(),
  toggleMaximize: vi.fn(),
  update: vi.fn(),
};

function renderWindow(app: AppDefinition, instance = makeInstance("w1")) {
  return render(
    <AppWindow
      active
      app={app}
      contentProps={{} as Omit<AppContentProps, "windowId">}
      frameOps={frameOps}
      hasUnsavedChanges={false}
      instance={instance}
    />,
  );
}

describe("AppWindow", () => {
  it("shows nothing until the app's chunk arrives, then the app", async () => {
    let release: (() => void) | undefined;
    const Deferred = lazy(
      () =>
        new Promise<{ default: ComponentType<AppContentProps> }>((resolve) => {
          release = () => resolve({ default: () => <p>본문</p> });
        }),
    );
    renderWindow(makeApp("메모장", Deferred));

    /*
     * The frame waits with the app. A frame that mounted first was on screen
     * and deaf: a chord pressed at it reached no handler at all.
     */
    expect(document.querySelector(".window-frame")).toBeNull();
    release?.();
    expect(await screen.findByText("본문")).toBeVisible();
    expect(document.querySelector(".window-frame")).not.toBeNull();
  });

  it("keeps a failed chunk inside its own window and retries with a fresh one", async () => {
    // React logs a caught error; the boundary's own line is the interesting one.
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let attempt = 0;
    const reload = () => {
      attempt += 1;
      return attempt === 1
        ? lazy(() => Promise.reject(new Error("chunk gone")))
        : lazy(() => Promise.resolve({ default: () => <p>돌아왔다</p> }));
    };
    const failing = lazy(() => Promise.reject(new Error("chunk gone")));
    renderWindow(makeApp("메모장", failing, reload));

    // The window is still a window, titled, with the failure inside it.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("메모장을 불러오지 못했습니다.");
    expect(document.querySelector(".window-frame")).not.toBeNull();
    expect(logged).toHaveBeenCalled();

    // React.lazy remembers a rejected import forever, so the retry has to be a
    // new instance — the point of AppDefinition.reload.
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("돌아왔다")).toBeVisible();
  });

  it("one window's failure leaves the others alone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good = makeApp("계산기", () => <p>계산기 본문</p>);
    const bad = makeApp(
      "메모장",
      lazy(() => Promise.reject(new Error("chunk gone"))),
    );
    render(
      <>
        <AppWindow
          active
          app={good}
          contentProps={{} as Omit<AppContentProps, "windowId">}
          frameOps={frameOps}
          hasUnsavedChanges={false}
          instance={makeInstance("w1", { appId: "calculator" })}
        />
        <AppWindow
          active={false}
          app={bad}
          contentProps={{} as Omit<AppContentProps, "windowId">}
          frameOps={frameOps}
          hasUnsavedChanges={false}
          instance={makeInstance("w2")}
        />
      </>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("메모장");
    // The desktop used to go with it: one optional chunk took every window.
    expect(screen.getByText("계산기 본문")).toBeVisible();
    expect(document.querySelectorAll(".window-frame")).toHaveLength(2);
  });
});
