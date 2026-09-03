import { APP_BAR_HEIGHT } from "./constants";
import { type WindowInstance } from "./types";

/**
 * Real window thumbnails, the way the Windows taskbar, Alt+Tab and Task View
 * show a picture of each window rather than its program's icon.
 *
 * There is no way to rasterize a DOM subtree here, so a thumbnail is a deep
 * clone of the live frame, scaled down with a transform. The clone is inert,
 * hidden from assistive tech and stripped of every identity attribute — it is
 * a picture, and must never answer for the window it pictures.
 */

export const WINDOW_SNAPSHOT_CLASS = "window-thumbnail-clone";

type FrameGeometry = Pick<WindowInstance, "height" | "maximized" | "width">;

/**
 * The size the frame paints at. A minimized frame is 0×0 in the DOM, and a
 * maximized one is inset to the work area, so the geometry comes from the
 * window record rather than from measuring the element.
 */
export function getWindowFrameSize(
  instance: FrameGeometry,
  viewport = { height: window.innerHeight, width: window.innerWidth },
) {
  if (instance.maximized) {
    return {
      height: Math.max(1, viewport.height - APP_BAR_HEIGHT),
      width: Math.max(1, viewport.width),
    };
  }
  return { height: Math.max(1, instance.height), width: Math.max(1, instance.width) };
}

/** The live frame for a window — never one of its own thumbnails. */
export function findLiveWindowFrame(
  windowId: string,
  root: ParentNode = document,
): HTMLElement | null {
  const frames = root.querySelectorAll<HTMLElement>(
    `.window-frame[data-window-id="${windowId}"]`,
  );
  for (const frame of frames) {
    if (
      !frame.classList.contains(WINDOW_SNAPSHOT_CLASS) &&
      !frame.closest(`.${WINDOW_SNAPSHOT_CLASS}`)
    ) {
      return frame;
    }
  }
  return null;
}

/**
 * Classes that describe a moment (an animation, a hidden state, focus), not
 * the window. `is-active` goes too: Windows thumbnails show no focus, and the
 * active window must stay the only `.window-frame.is-active` on the page.
 */
const TRANSIENT_FRAME_CLASSES = [
  "is-active",
  "is-minimized",
  "is-minimizing",
  "is-closing",
  "is-interacting",
];

/** Attributes through which a clone could be mistaken for the real thing. */
const IDENTITY_ATTRIBUTES = ["id", "data-window-id", "data-app-id", "tabindex", "for", "name"];

function pairDescendants<T extends Element>(
  source: Element,
  clone: Element,
  selector: string,
): Array<[T, T]> {
  const from = source.querySelectorAll<T>(selector);
  const to = clone.querySelectorAll<T>(selector);
  const pairs: Array<[T, T]> = [];
  for (let index = 0; index < Math.min(from.length, to.length); index += 1) {
    pairs.push([from[index], to[index]]);
  }
  return pairs;
}

/**
 * cloneNode copies attributes, not state: a textarea's typed text, a range's
 * position and a checkbox's tick all live on the element object.
 */
function copyFormState(source: Element, clone: Element) {
  for (const [from, to] of pairDescendants<HTMLElement>(
    source,
    clone,
    "input, textarea, select",
  )) {
    if (from instanceof HTMLInputElement && to instanceof HTMLInputElement) {
      if (from.type === "checkbox" || from.type === "radio") to.checked = from.checked;
      else to.value = from.value;
    } else if (from instanceof HTMLTextAreaElement && to instanceof HTMLTextAreaElement) {
      to.value = from.value;
    } else if (from instanceof HTMLSelectElement && to instanceof HTMLSelectElement) {
      to.selectedIndex = from.selectedIndex;
    }
  }
}

/** A cloned canvas is blank; the drawing has to be painted across. */
function copyCanvasPixels(source: Element, clone: Element) {
  for (const [from, to] of pairDescendants<HTMLCanvasElement>(source, clone, "canvas")) {
    try {
      to.width = from.width;
      to.height = from.height;
      const context = typeof to.getContext === "function" ? to.getContext("2d") : null;
      context?.drawImage(from, 0, 0);
    } catch {
      // A tainted or zero-sized canvas stays blank in the picture.
    }
  }
}

/**
 * Embedded documents and media would load (and play) again inside the copy;
 * they become empty boxes of the same size.
 */
function neutralizeEmbeds(source: Element, clone: Element) {
  const selector = "iframe, video, audio, object, embed";
  for (const [from, to] of pairDescendants<HTMLElement>(source, clone, selector)) {
    const box = document.createElement("span");
    box.className = "window-thumbnail-embed";
    const rect = from.getBoundingClientRect();
    box.style.display = "block";
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    to.replaceWith(box);
  }
}

/**
 * Scroll offsets are state too, and they only apply once the clone is laid
 * out — so this runs after the clone is in the document.
 */
export function syncScrollOffsets(source: Element, clone: Element) {
  for (const [from, to] of pairDescendants<Element>(source, clone, "*")) {
    if (from.scrollTop || from.scrollLeft) {
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
    }
  }
}

export interface WindowSnapshot {
  clone: HTMLElement;
  source: HTMLElement;
}

/**
 * A picture of the window: its frame cloned, positioned at the origin at the
 * size the window paints at, and made inert. Returns null when the window is
 * not in the DOM (another virtual desktop).
 */
export function snapshotWindowFrame(
  windowId: string,
  instance: FrameGeometry,
  root: ParentNode = document,
): WindowSnapshot | null {
  const source = findLiveWindowFrame(windowId, root);
  if (!source) return null;

  const clone = source.cloneNode(true) as HTMLElement;
  for (const element of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
    for (const attribute of IDENTITY_ATTRIBUTES) element.removeAttribute(attribute);
  }
  clone.classList.remove(...TRANSIENT_FRAME_CLASSES);
  clone.classList.add(WINDOW_SNAPSHOT_CLASS);
  clone.removeAttribute("aria-label");
  clone.removeAttribute("role");
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");

  const size = getWindowFrameSize(instance);
  Object.assign(clone.style, {
    animation: "none",
    backdropFilter: "none",
    boxShadow: "none",
    height: `${size.height}px`,
    inset: "auto",
    left: "0px",
    maxHeight: "none",
    maxWidth: "none",
    pointerEvents: "none",
    position: "absolute",
    top: "0px",
    transform: "none",
    transition: "none",
    visibility: "visible",
    width: `${size.width}px`,
    zIndex: "auto",
  } satisfies Partial<CSSStyleDeclaration>);

  copyFormState(source, clone);
  copyCanvasPixels(source, clone);
  neutralizeEmbeds(source, clone);
  return { clone, source };
}
