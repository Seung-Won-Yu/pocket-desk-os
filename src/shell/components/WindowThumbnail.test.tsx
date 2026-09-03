// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { StickyNote } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowThumbnail } from "./WindowThumbnail";
import { type WindowInstance } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const instance: WindowInstance = {
  appId: "notepad",
  desktopIndex: 0,
  height: 400,
  id: "w1",
  maximized: false,
  minimized: false,
  width: 800,
  x: 10,
  y: 20,
  z: 3,
};

function mountLiveFrame(text = "hello") {
  const layer = document.createElement("div");
  layer.className = "window-layer";
  layer.innerHTML = `
    <article class="window-frame" data-app-id="notepad" data-window-id="w1" style="width: 800px; height: 400px;">
      <textarea aria-label="본문"></textarea>
    </article>`;
  document.body.append(layer);
  (layer.querySelector("textarea") as HTMLTextAreaElement).value = text;
  return layer;
}

function sizeBoxes(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const rect = {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      toJSON: () => ({}),
      top: 0,
      width: 0,
      x: 0,
      y: 0,
    };
    if (this.classList.contains("window-thumbnail-box")) {
      return { ...rect, height, width } as DOMRect;
    }
    return rect as DOMRect;
  });
}

describe("WindowThumbnail", () => {
  it("shows the icon tile when the window is not in the DOM", () => {
    render(<WindowThumbnail accent="#e8c447" icon={StickyNote} instance={instance} />);
    expect(document.querySelector(".window-thumbnail .app-icon-tile")).not.toBeNull();
    expect(document.querySelector(".window-thumbnail-clone")).toBeNull();
  });

  it("scales a clone of the live frame to fit the box, and takes no icon", () => {
    mountLiveFrame();
    sizeBoxes(200, 200);
    render(<WindowThumbnail accent="#e8c447" icon={StickyNote} instance={instance} />);

    const clone = document.querySelector<HTMLElement>(
      ".window-thumbnail-box .window-thumbnail-clone",
    );
    expect(clone).not.toBeNull();
    // 800×400 into 200×200: width is the limit → 0.25.
    expect(clone!.style.transform).toBe("scale(0.25)");
    const stage = clone!.parentElement!;
    expect(stage.style.width).toBe("200px");
    expect(stage.style.height).toBe("100px");
    expect((clone!.querySelector("textarea") as HTMLTextAreaElement).value).toBe("hello");
    expect(document.querySelector(".window-thumbnail .app-icon-tile")).toBeNull();
    expect(document.querySelector(".window-thumbnail.has-snapshot")).not.toBeNull();
  });

  it("re-takes the picture on the refresh interval and cleans up on unmount", () => {
    vi.useFakeTimers();
    const layer = mountLiveFrame("first");
    sizeBoxes(100, 100);
    const view = render(
      <WindowThumbnail
        accent="#e8c447"
        icon={StickyNote}
        instance={instance}
        refreshMs={500}
      />,
    );
    const textarea = () =>
      document.querySelector(".window-thumbnail-clone textarea") as HTMLTextAreaElement;
    expect(textarea().value).toBe("first");

    (layer.querySelector("textarea") as HTMLTextAreaElement).value = "second";
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(textarea().value).toBe("second");
    expect(document.querySelectorAll(".window-thumbnail-clone")).toHaveLength(1);

    view.unmount();
    expect(document.querySelector(".window-thumbnail-clone")).toBeNull();
  });
});
