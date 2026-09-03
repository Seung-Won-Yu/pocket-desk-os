// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowSlot, type WindowFrameOps } from "./WindowSlot";
import { getApp } from "../appCatalog";
import type { AppContentProps, WindowInstance } from "../types";

/*
 * The render-count contract the performance review asked for: dragging one
 * window must not re-render another window's app. These tests pin the memo
 * boundary directly — with counting app components standing in for real
 * ones, a parent re-render that changes nothing about window B renders B's
 * app zero additional times, while a change that does reach B is honored.
 */

afterEach(cleanup);

function makeInstance(id: string, overrides: Partial<WindowInstance> = {}): WindowInstance {
  return {
    appId: "calculator",
    desktopIndex: 0,
    height: 400,
    id,
    maximized: false,
    minimized: false,
    width: 500,
    x: 40,
    y: 40,
    z: 1,
    ...overrides,
  };
}

function makeFrameOps(): WindowFrameOps {
  return {
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
}

/** Only the props a counting stand-in app reads; the rest are irrelevant here. */
function makeContentProps(): Omit<AppContentProps, "windowId"> {
  return {} as Omit<AppContentProps, "windowId">;
}

function countingApp(counter: { renders: number }) {
  return function CountingApp() {
    counter.renders += 1;
    return <div data-testid="counting-app" />;
  };
}

describe("WindowSlot memo contract", () => {
  it("a parent re-render that changes nothing about a window renders its app zero times", () => {
    const counter = { renders: 0 };
    const app = { ...getApp("calculator"), component: countingApp(counter) };
    const frameOps = makeFrameOps();
    const contentProps = makeContentProps();
    const instance = makeInstance("win-b");

    const view = render(
      <WindowSlot
        active={false}
        app={app}
        contentProps={contentProps}
        frameOps={frameOps}
        hasUnsavedChanges={false}
        instance={instance}
      />,
    );
    expect(counter.renders).toBe(1);

    // Same references, new parent render — the shape of every drag commit for
    // the windows that are not being dragged.
    view.rerender(
      <WindowSlot
        active={false}
        app={app}
        contentProps={contentProps}
        frameOps={frameOps}
        hasUnsavedChanges={false}
        instance={instance}
      />,
    );
    expect(counter.renders).toBe(1);
  });

  it("a change to this window's own instance still reaches it", () => {
    const counter = { renders: 0 };
    const app = { ...getApp("calculator"), component: countingApp(counter) };
    const frameOps = makeFrameOps();
    const contentProps = makeContentProps();

    const view = render(
      <WindowSlot
        active={false}
        app={app}
        contentProps={contentProps}
        frameOps={frameOps}
        hasUnsavedChanges={false}
        instance={makeInstance("win-a")}
      />,
    );
    view.rerender(
      <WindowSlot
        active={false}
        app={app}
        contentProps={contentProps}
        frameOps={frameOps}
        hasUnsavedChanges={false}
        instance={makeInstance("win-a", { x: 120 })}
      />,
    );
    expect(counter.renders).toBe(2);
  });

  it("new shared content props reach every window — memo never serves stale data", () => {
    const counter = { renders: 0 };
    const app = { ...getApp("calculator"), component: countingApp(counter) };
    const frameOps = makeFrameOps();
    const instance = makeInstance("win-a");

    const view = render(
      <WindowSlot
        active={false}
        app={app}
        contentProps={makeContentProps()}
        frameOps={frameOps}
        hasUnsavedChanges={false}
        instance={instance}
      />,
    );
    view.rerender(
      <WindowSlot
        active={false}
        app={app}
        contentProps={makeContentProps()}
        frameOps={frameOps}
        hasUnsavedChanges={false}
        instance={instance}
      />,
    );
    expect(counter.renders).toBe(2);
  });
});
