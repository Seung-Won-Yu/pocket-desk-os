/**
 * 메모장 인쇄 (Ctrl+P). Printing went to the host browser, which pictured the
 * whole desktop — taskbar, windows and wallpaper — rather than the document.
 * The text is printed from a frame of its own instead, on Notepad's page: its
 * margins, the file name at the top and 페이지 N at the foot.
 */

import { openPrintFrame, printAndReturnFocus } from "./printFrame";

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
 * Prints `text` from a hidden frame and hands back whether it could. The text
 * goes in as text. The frame goes when the print dialog is done, or when the
 * next print replaces it.
 */
export function printNoteText(
  { font, name, text }: { font: NotePrintFont; name: string; text: string },
  doc: Document = document,
) {
  const opened = openPrintFrame(
    { className: "note-print-frame", css: getNotePrintStyle(name, font), title: name },
    doc,
  );
  if (!opened) return false;
  const body = opened.page.createElement("pre");
  body.textContent = text;
  opened.page.body.append(body);
  printAndReturnFocus(opened, doc);
  return true;
}
