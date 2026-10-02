/**
 * 메모장 인쇄 (Ctrl+P). Printing went to the host browser, which pictured the
 * whole desktop — taskbar, windows and wallpaper — rather than the document.
 * The text is printed from a frame of its own instead, on Notepad's page: its
 * margins, the file name at the top and 페이지 N at the foot.
 */

export type NotePrintFont = { family: string; size: string; tabSize: string };

/** Any text as a CSS string literal: quotes, backslashes and controls escaped. */
export function toCssString(value: string) {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '"' || char === "\\") out += `\\${char}`;
    else if (code < 0x20 || code === 0x7f) out += `\\${code.toString(16)} `;
    else out += char;
  }
  return `"${out}"`;
}

/**
 * The print page's CSS. Notepad's 페이지 설정 defaults: 20mm either side, 25mm
 * top and bottom, the header the file name and the footer the page number.
 * Lines wrap at the page edge whether or not 자동 줄 바꿈 is on, as Notepad's
 * printout does — a line running off the paper would simply be lost.
 */
export function getNotePrintStyle(name: string, font: NotePrintFont) {
  return [
    "@page {",
    "  margin: 25mm 20mm;",
    `  @top-center { content: ${toCssString(name)}; font-family: ${font.family}; font-size: 9pt; }`,
    `  @bottom-center { content: "페이지 " counter(page); font-family: ${font.family}; font-size: 9pt; }`,
    "}",
    "html, body { background: #fff; color: #000; margin: 0; }",
    "pre {",
    `  font-family: ${font.family};`,
    `  font-size: ${font.size};`,
    "  line-height: 1.4;",
    "  margin: 0;",
    "  overflow-wrap: anywhere;",
    `  tab-size: ${font.tabSize};`,
    "  white-space: pre-wrap;",
    "}",
  ].join("\n");
}

/**
 * Prints `text` from a hidden frame and hands back whether it could. The frame
 * is built with DOM calls, never a markup string: the page's CSP requires
 * Trusted Types for HTML sinks, and the text goes in as text either way. It
 * goes when the print dialog is done, or when the next print replaces it.
 */
export function printNoteText(
  { font, name, text }: { font: NotePrintFont; name: string; text: string },
  doc: Document = document,
) {
  doc.querySelectorAll("iframe.note-print-frame").forEach((frame) => frame.remove());
  const frame = doc.createElement("iframe");
  frame.className = "note-print-frame";
  frame.title = "인쇄";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  doc.body.append(frame);

  const view = frame.contentWindow;
  const page = frame.contentDocument;
  if (!view || !page) {
    frame.remove();
    return false;
  }
  page.title = name;
  const style = page.createElement("style");
  style.textContent = getNotePrintStyle(name, font);
  page.head.append(style);
  const body = page.createElement("pre");
  body.textContent = text;
  page.body.append(body);

  view.addEventListener("afterprint", () => frame.remove(), { once: true });
  view.focus();
  view.print();
  return true;
}
