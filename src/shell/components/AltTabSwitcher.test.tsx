// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AltTabSwitcher } from "./AltTabSwitcher";
import { type WindowInstance } from "../types";

afterEach(cleanup);

function win(id: string, appId: WindowInstance["appId"], z: number): WindowInstance {
  return {
    appId,
    desktopIndex: 0,
    height: 400,
    id,
    maximized: false,
    minimized: false,
    width: 600,
    x: 0,
    y: 0,
    z,
  };
}

describe("AltTabSwitcher", () => {
  it("clicking a window's picture selects that window", () => {
    const onSelect = vi.fn();
    render(
      <AltTabSwitcher
        onSelect={onSelect}
        selectedWindowId="a"
        windows={[win("a", "notepad", 2), win("b", "calculator", 1)]}
      />,
    );
    const items = screen.getAllByRole("button");
    expect(items).toHaveLength(2);
    fireEvent.click(items[1]);
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(items[0].getAttribute("aria-current")).toBe("true");
  });
});
