// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getImagePrintStyle,
  onPrintRequest,
  openPrintFrame,
  printImage,
  requestPrint,
} from "./printFrame";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Every frame window the code under test reaches, with its print() caught. */
function catchPrints() {
  const printed: Array<{ src: string | null; title: string }> = [];
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    "contentWindow",
  )!;
  vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockImplementation(function (
    this: HTMLIFrameElement,
  ) {
    const view = descriptor.get!.call(this) as Window | null;
    if (view) {
      // jsdom implements neither; a browser's frame window has both. Focusing
      // the frame window takes focus off the page, as it does in a browser.
      view.focus = () => this.focus();
      view.print = () => {
        printed.push({
          src: view.document.querySelector("img")?.getAttribute("src") ?? null,
          title: view.document.title,
        });
      };
    }
    return view;
  });
  return printed;
}

/** jsdom loads no pictures; this settles the one in the frame either way. */
async function finishLoading(outcome: "load" | "error") {
  await Promise.resolve();
  const frame = document.querySelector<HTMLIFrameElement>("iframe.image-print-frame")!;
  frame.contentDocument!.querySelector("img")!.dispatchEvent(new Event(outcome));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("openPrintFrame", () => {
  it("builds a hidden, unfocusable frame with the page's CSS and title", () => {
    catchPrints();
    const opened = openPrintFrame({
      className: "x-print-frame",
      css: "p { color: red; }",
      title: "보고서",
    });
    expect(opened).not.toBeNull();
    const frame = document.querySelector<HTMLIFrameElement>("iframe.x-print-frame")!;
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.tabIndex).toBe(-1);
    expect(opened!.page.title).toBe("보고서");
    expect(opened!.page.head.querySelector("style")?.textContent).toBe("p { color: red; }");
  });

  it("replaces a frame of its own kind and leaves other kinds alone", () => {
    catchPrints();
    openPrintFrame({ className: "a-print-frame", css: "", title: "a" });
    openPrintFrame({ className: "b-print-frame", css: "", title: "b" });
    openPrintFrame({ className: "a-print-frame", css: "", title: "a2" });
    expect(document.querySelectorAll("iframe.a-print-frame")).toHaveLength(1);
    expect(document.querySelectorAll("iframe.b-print-frame")).toHaveLength(1);
  });
});

describe("getImagePrintStyle", () => {
  it("fits the picture inside the page margin without stretching it", () => {
    const css = getImagePrintStyle();
    expect(css).toContain("@page { margin: 10mm; }");
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("object-fit: contain");
    expect(css).not.toMatch(/(?<!max-)width: 100%/);
  });
});

describe("printImage", () => {
  it("prints the picture once it has loaded, and not before", async () => {
    const printed = catchPrints();
    const result = printImage({ name: "sunset.png", src: PIXEL });
    await Promise.resolve();
    expect(printed).toEqual([]);
    await finishLoading("load");
    expect(await result).toBe(true);
    expect(printed).toEqual([{ src: PIXEL, title: "sunset.png" }]);
  });

  it("prints nothing and lets the frame go when the picture will not load", async () => {
    const printed = catchPrints();
    const result = printImage({ name: "broken.png", src: "data:image/png;base64,AAAA" });
    await finishLoading("error");
    expect(await result).toBe(false);
    expect(printed).toEqual([]);
    expect(document.querySelectorAll("iframe.image-print-frame")).toHaveLength(0);
  });

  it("hands focus back to where it was once the dialog is done", async () => {
    catchPrints();
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const result = printImage({ name: "a.png", src: PIXEL });
    await finishLoading("load");
    await result;
    expect(document.activeElement).toBe(button);
  });

  it("drops the frame once the dialog is done", async () => {
    catchPrints();
    const result = printImage({ name: "a.png", src: PIXEL });
    await finishLoading("load");
    await result;
    const frame = document.querySelector<HTMLIFrameElement>("iframe.image-print-frame")!;
    frame.contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(document.querySelectorAll("iframe.image-print-frame")).toHaveLength(0);
  });
});

describe("print requests", () => {
  it("reach only the window they name", () => {
    const printed: string[] = [];
    const stopA = onPrintRequest("window-a", () => printed.push("a"));
    const stopB = onPrintRequest("window-b", () => printed.push("b"));
    requestPrint("window-b");
    expect(printed).toEqual(["b"]);
    stopA();
    stopB();
    requestPrint("window-b");
    expect(printed).toEqual(["b"]);
  });
});
