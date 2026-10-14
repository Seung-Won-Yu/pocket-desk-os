/**
 * Printing from a hidden frame. The host browser's own print pictures the
 * whole desktop — wallpaper, taskbar and every window — so an app that prints
 * builds the page it means in a frame of its own and prints that instead.
 * Built with DOM calls, never a markup string: the page's CSP requires Trusted
 * Types for HTML sinks.
 */

/**
 * Ctrl+P is the shell's: the window frame usually holds focus, not the app, so
 * a key handler inside the app would miss it, and an unhandled one goes to the
 * host browser. The shell asks the active window to print by its id.
 */
export const PRINT_EVENT = "pocket-desk-print";
/** The apps with something to print: a document or a picture. */
export const PRINTABLE_APP_IDS: readonly string[] = ["notepad", "paint", "photos"];

export function requestPrint(windowId: string, target: Window = window) {
  target.dispatchEvent(new CustomEvent(PRINT_EVENT, { detail: { windowId } }));
}

/** Runs `print` when the shell asks this window to print; returns the unsubscribe. */
export function onPrintRequest(windowId: string, print: () => void, target: Window = window) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<{ windowId?: string }>).detail?.windowId === windowId) print();
  };
  target.addEventListener(PRINT_EVENT, listener);
  return () => target.removeEventListener(PRINT_EVENT, listener);
}

export type PrintFrame = { frame: HTMLIFrameElement; page: Document; view: Window };

/**
 * A fresh frame of `className` with `css` in its head, the previous one of the
 * same kind removed first. The frame goes when the print dialog is done.
 */
export function openPrintFrame(
  { className, css, title }: { className: string; css: string; title: string },
  doc: Document = document,
): PrintFrame | null {
  doc.querySelectorAll(`iframe.${className}`).forEach((frame) => frame.remove());
  const frame = doc.createElement("iframe");
  frame.className = className;
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
    return null;
  }
  page.title = title;
  const style = page.createElement("style");
  style.textContent = css;
  page.head.append(style);
  view.addEventListener("afterprint", () => frame.remove(), { once: true });
  return { frame, page, view };
}

/**
 * Prints the frame and hands focus back to where it was. The frame has to hold
 * focus for its own print, and left holding it, every key after the dialog —
 * the shell's shortcuts included — went to an invisible page.
 */
export function printAndReturnFocus({ view }: PrintFrame, doc: Document = document) {
  const returnTo = doc.activeElement;
  view.focus();
  view.print();
  if (returnTo instanceof HTMLElement && returnTo.isConnected && returnTo !== doc.body) {
    returnTo.focus({ preventScroll: true });
  }
}

/**
 * A picture on its own page, as 사진 and 그림판 print by default: fitted to the
 * paper inside a 10mm margin, centred, never stretched past its own size.
 */
export function getImagePrintStyle() {
  return [
    "@page { margin: 10mm; }",
    "html, body { background: #fff; height: 100%; margin: 0; }",
    "body { align-items: center; display: flex; justify-content: center; }",
    "img { display: block; max-height: 100vh; max-width: 100%; object-fit: contain; }",
  ].join("\n");
}

/**
 * Prints the picture at `src` and resolves to whether it could. The print waits
 * for the picture to load — printing an empty frame would hand the dialog a
 * blank page — and gives up on one that will not.
 */
export async function printImage(
  { name, src }: { name: string; src: string },
  doc: Document = document,
) {
  const opened = openPrintFrame(
    { className: "image-print-frame", css: getImagePrintStyle(), title: name },
    doc,
  );
  if (!opened) return false;
  const { frame, page } = opened;
  const image = page.createElement("img");
  image.alt = name;
  const loaded = new Promise<boolean>((resolve) => {
    image.addEventListener("load", () => resolve(true), { once: true });
    image.addEventListener("error", () => resolve(false), { once: true });
  });
  image.src = src;
  page.body.append(image);
  if (!(await loaded) || !frame.isConnected) {
    frame.remove();
    return false;
  }
  printAndReturnFocus(opened, doc);
  return true;
}
