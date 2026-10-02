// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getNotePrintStyle, printNoteText, toCssString } from "./notePrint";

const font = { family: "Consolas, monospace", size: "14px", tabSize: "8" };

/** Every frame window the code under test reaches, with its print() caught. */
function catchPrints() {
  const printed: Array<{ text: string; title: string }> = [];
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    "contentWindow",
  )!;
  vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockImplementation(function (
    this: HTMLIFrameElement,
  ) {
    const view = descriptor.get!.call(this) as Window | null;
    if (view) {
      // jsdom implements neither; a browser's frame window has both.
      view.focus = () => {};
      view.print = () => {
        printed.push({
          text: view.document.body.textContent ?? "",
          title: view.document.title,
        });
      };
    }
    return view;
  });
  // jsdom's CSS parser predates @page margin boxes and reports the sheet as
  // unparseable; a browser lays them out (Chrome 131 on).
  vi.spyOn(console, "error").mockImplementation(() => {});
  return printed;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("toCssString", () => {
  it("quotes any file name safely", () => {
    expect(toCssString("notes.txt")).toBe('"notes.txt"');
    expect(toCssString('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(toCssString("줄\n바꿈")).toBe('"줄\\a 바꿈"');
  });
});

describe("getNotePrintStyle", () => {
  it("puts Notepad's margins, the file name and the page number on the page", () => {
    const css = getNotePrintStyle("회의록.txt", font);
    expect(css).toContain("margin: 25mm 20mm;");
    expect(css).toContain('@top-center { content: "회의록.txt";');
    expect(css).toContain('content: "페이지 " counter(page);');
    expect(css).toContain("white-space: pre-wrap;");
    expect(css).toContain("font-family: Consolas, monospace;");
  });
});

describe("printNoteText", () => {
  it("prints the document's text, as text, from a frame of its own", () => {
    const printed = catchPrints();
    const text = "첫 줄\n<script>alert(1)</script>\n\t들여쓴 줄";
    expect(printNoteText({ font, name: "notes.txt", text })).toBe(true);
    expect(printed).toEqual([{ text, title: "notes.txt" }]);
    const frame = document.querySelector<HTMLIFrameElement>("iframe.note-print-frame")!;
    expect(frame.contentDocument!.querySelector("script")).toBeNull();
    expect(frame.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps one frame, and lets it go once the dialog is done", () => {
    catchPrints();
    printNoteText({ font, name: "a.txt", text: "a" });
    printNoteText({ font, name: "b.txt", text: "b" });
    const frames = document.querySelectorAll<HTMLIFrameElement>("iframe.note-print-frame");
    expect(frames).toHaveLength(1);
    frames[0].contentWindow!.dispatchEvent(new Event("afterprint"));
    expect(document.querySelectorAll("iframe.note-print-frame")).toHaveLength(0);
  });
});
