// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  WINDOW_SNAPSHOT_CLASS,
  findLiveWindowFrame,
  getWindowFrameSize,
  snapshotWindowFrame,
  syncScrollOffsets,
} from "./windowSnapshot";

afterEach(() => {
  document.body.innerHTML = "";
});

function mountFrame(extraClass = "") {
  document.body.innerHTML = `
    <div class="window-layer">
      <article class="window-frame is-active ${extraClass}" data-app-id="notepad" data-window-id="w1"
        id="window-w1" aria-label="메모.txt - 메모장" tabindex="-1"
        style="left: 40px; top: 30px; width: 640px; height: 480px; z-index: 7;">
        <div class="window-titlebar"><button id="close-w1" aria-label="닫기">x</button></div>
        <div class="window-content">
          <textarea id="text" aria-label="본문"></textarea>
          <input type="checkbox" />
          <input type="range" min="0" max="10" value="0" />
          <select><option>a</option><option>b</option></select>
          <iframe src="about:blank" title="frame"></iframe>
          <div class="scroller"></div>
        </div>
      </article>
    </div>`;
  const frame = document.querySelector<HTMLElement>(".window-frame")!;
  (frame.querySelector("textarea") as HTMLTextAreaElement).value = "typed, not an attribute";
  (frame.querySelector('input[type="checkbox"]') as HTMLInputElement).checked = true;
  (frame.querySelector('input[type="range"]') as HTMLInputElement).value = "7";
  (frame.querySelector("select") as HTMLSelectElement).selectedIndex = 1;
  return frame;
}

const geometry = { height: 480, maximized: false, width: 640 };

describe("getWindowFrameSize", () => {
  it("uses the record's size for a normal window and the work area when maximized", () => {
    expect(getWindowFrameSize(geometry)).toEqual({ height: 480, width: 640 });
    expect(
      getWindowFrameSize({ ...geometry, maximized: true }, { height: 820, width: 1280 }),
    ).toEqual({ height: 772, width: 1280 });
  });
});

describe("snapshotWindowFrame", () => {
  it("returns null for a window that is not in the DOM", () => {
    mountFrame();
    expect(snapshotWindowFrame("missing", geometry)).toBeNull();
  });

  it("clones the frame as an inert picture with no identity left on it", () => {
    mountFrame("is-minimized");
    const snapshot = snapshotWindowFrame("w1", geometry);
    expect(snapshot).not.toBeNull();
    const { clone } = snapshot!;

    expect(clone.classList.contains(WINDOW_SNAPSHOT_CLASS)).toBe(true);
    expect(clone.classList.contains("is-minimized")).toBe(false);
    expect(clone.classList.contains("is-active")).toBe(false);
    expect(clone.getAttribute("aria-hidden")).toBe("true");
    expect(clone.hasAttribute("inert")).toBe(true);
    expect(clone.getAttribute("data-app-id")).toBeNull();
    expect(clone.getAttribute("data-window-id")).toBeNull();
    expect(clone.getAttribute("aria-label")).toBeNull();
    // No descendant keeps an id or tabindex that could collide with the real one.
    expect(clone.querySelector("[id], [tabindex], [data-app-id]")).toBeNull();

    // Painted at the window's own size, at the origin, without the frame's motion.
    expect(clone.style.width).toBe("640px");
    expect(clone.style.height).toBe("480px");
    expect(clone.style.left).toBe("0px");
    expect(clone.style.top).toBe("0px");
    expect(clone.style.visibility).toBe("visible");
    expect(clone.style.animation).toBe("none");
  });

  it("copies form state cloneNode leaves behind and neutralizes embeds", () => {
    mountFrame();
    const { clone } = snapshotWindowFrame("w1", geometry)!;
    expect((clone.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "typed, not an attribute",
    );
    expect((clone.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(
      true,
    );
    expect((clone.querySelector('input[type="range"]') as HTMLInputElement).value).toBe("7");
    expect((clone.querySelector("select") as HTMLSelectElement).selectedIndex).toBe(1);
    expect(clone.querySelector("iframe")).toBeNull();
    expect(clone.querySelector(".window-thumbnail-embed")).not.toBeNull();
  });

  it("never picks a thumbnail as the live frame, even one that kept its attributes", () => {
    mountFrame();
    const live = findLiveWindowFrame("w1");
    const decoy = live!.cloneNode(true) as HTMLElement;
    decoy.classList.add(WINDOW_SNAPSHOT_CLASS);
    document.body.prepend(decoy);
    expect(findLiveWindowFrame("w1")).toBe(live);
  });

  it("syncs scroll offsets pairwise after the clone is in the document", () => {
    const frame = mountFrame();
    const scroller = frame.querySelector<HTMLElement>(".scroller")!;
    Object.defineProperty(scroller, "scrollTop", { value: 120, writable: true });
    const { clone, source } = snapshotWindowFrame("w1", geometry)!;
    document.body.append(clone);
    const cloneScroller = clone.querySelector<HTMLElement>(".scroller")!;
    let applied = 0;
    Object.defineProperty(cloneScroller, "scrollTop", {
      get: () => applied,
      set: (value: number) => {
        applied = value;
      },
    });
    syncScrollOffsets(source, clone);
    expect(applied).toBe(120);
  });
});
