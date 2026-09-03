/**
 * A real screenshot of the desktop: the DOM is serialized into an SVG
 * <foreignObject>, drawn onto a canvas and read back as a PNG — the way
 * dom-to-image works, and the only way a page can picture itself. The picture
 * is what the browser lays out from the same CSS, minus what an SVG image
 * cannot do: backdrop blur and scrolled-away content.
 *
 * Nothing leaves the page. Every url() the picture needs (the wallpaper JPG,
 * any same-origin image) is fetched from this origin and inlined as a data
 * URL, because an SVG rendered as an image may not load external resources.
 */

export interface CaptureOptions {
  /** Elements to leave out of the picture (the capture tool's own window). */
  exclude?: (element: Element) => boolean;
  /** Device pixels per CSS pixel; defaults to the display's, capped at 2. */
  scale?: number;
}

export interface CapturedImage {
  dataUrl: string;
  height: number;
  width: number;
}

/** `스크린샷 2026-09-03 143012.png`, the name Windows gives a saved capture. */
export function getScreenshotFileName(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `스크린샷 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
}

const URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** Base64 without spreading a megabyte of bytes into one call's arguments. */
function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** Same-origin resources as data URLs, fetched once each. */
export function createResourceInliner(fetchImpl: typeof fetch = fetch) {
  const cache = new Map<string, Promise<string | null>>();
  return (url: string): Promise<string | null> => {
    if (url.startsWith("data:")) return Promise.resolve(url);
    let pending = cache.get(url);
    if (!pending) {
      pending = (async () => {
        try {
          const response = await fetchImpl(url);
          if (!response.ok) return null;
          const blob = await response.blob();
          return `data:${blob.type || "application/octet-stream"};base64,${toBase64(
            new Uint8Array(await blob.arrayBuffer()),
          )}`;
        } catch {
          return null;
        }
      })();
      cache.set(url, pending);
    }
    return pending;
  };
}

/** Every url() in a CSS text replaced through `inline`; ones it cannot fetch stay. */
export async function inlineCssUrls(
  cssText: string,
  inline: (url: string) => Promise<string | null>,
): Promise<string> {
  const matches = [...cssText.matchAll(URL_PATTERN)];
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const url = match[2];
      if (url.startsWith("data:") || url.startsWith("#")) return null;
      const inlined = await inline(url);
      return inlined ? { from: match[0], to: `url("${inlined}")` } : null;
    }),
  );
  let result = cssText;
  for (const replacement of replacements) {
    if (replacement) result = result.split(replacement.from).join(replacement.to);
  }
  return result;
}

/**
 * The document's stylesheet text, minus rules an SVG image cannot honour or
 * that would reach for the network (@font-face, @import). Cross-origin sheets
 * cannot be read and are skipped.
 */
export function collectStyleText(doc: Document = document) {
  const chunks: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      const text = rule.cssText;
      if (text.startsWith("@font-face") || text.startsWith("@import")) continue;
      chunks.push(text);
    }
  }
  return chunks.join("\n");
}

/**
 * An SVG image is drawn at time zero: every CSS animation sits at its first
 * keyframe, and the windows' open animation starts from opacity 0 — the first
 * capture was a flat navy rectangle. Animations and transitions are switched
 * off in the picture so everything paints at its resting style.
 */
export const CAPTURE_STYLE_OVERRIDES =
  "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";

/** The page's stylesheets plus the overrides a static picture needs. */
export function getCaptureStyleText(doc: Document = document) {
  return `${collectStyleText(doc)}\n${CAPTURE_STYLE_OVERRIDES}`;
}

function pairNodes(source: Element, clone: Element) {
  const from = [source, ...Array.from(source.querySelectorAll("*"))];
  const to = [clone, ...Array.from(clone.querySelectorAll("*"))];
  return from.map((node, index) => [node, to[index]] as const);
}

/**
 * Make a clone ready for serialization: drop what must not be pictured, turn
 * canvases into images, write form state into attributes (serialization only
 * sees attributes), and box off embeds that would try to load again.
 */
export function prepareCaptureClone(
  source: HTMLElement,
  options: CaptureOptions = {},
): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const removals: Element[] = [];
  for (const [from, to] of pairNodes(source, clone)) {
    if (!to) continue;
    if (
      from.tagName === "SCRIPT" ||
      from.tagName === "NOSCRIPT" ||
      from.tagName === "LINK" ||
      (options.exclude && from !== source && options.exclude(from))
    ) {
      removals.push(to);
      continue;
    }
    if (from instanceof HTMLCanvasElement) {
      const image = document.createElement("img");
      try {
        image.src = from.toDataURL("image/png");
      } catch {
        // A blank picture where a canvas the page cannot read would be.
      }
      image.setAttribute("alt", "");
      image.setAttribute("class", from.className);
      const style = from.getAttribute("style") ?? "";
      const rect = from.getBoundingClientRect();
      image.setAttribute("style", `${style};width:${rect.width}px;height:${rect.height}px`);
      to.replaceWith(image);
      continue;
    }
    if (
      from instanceof HTMLIFrameElement ||
      from instanceof HTMLVideoElement ||
      from instanceof HTMLAudioElement ||
      from instanceof HTMLObjectElement ||
      from instanceof HTMLEmbedElement
    ) {
      const box = document.createElement("span");
      const rect = from.getBoundingClientRect();
      box.setAttribute("class", from.className);
      box.setAttribute(
        "style",
        `display:block;width:${rect.width}px;height:${rect.height}px;background:rgba(255,255,255,0.08)`,
      );
      to.replaceWith(box);
      continue;
    }
    if (from instanceof HTMLInputElement && to instanceof HTMLInputElement) {
      if (from.type === "checkbox" || from.type === "radio") {
        if (from.checked) to.setAttribute("checked", "");
        else to.removeAttribute("checked");
      } else {
        to.setAttribute("value", from.value);
      }
    } else if (from instanceof HTMLTextAreaElement && to instanceof HTMLTextAreaElement) {
      to.textContent = from.value;
    } else if (from instanceof HTMLSelectElement && to instanceof HTMLSelectElement) {
      Array.from(to.options).forEach((option, index) => {
        if (index === from.selectedIndex) option.setAttribute("selected", "");
        else option.removeAttribute("selected");
      });
    }
  }
  for (const node of removals) node.remove();
  return clone;
}

/** Inline every image source and inline-style url() inside the clone. */
export async function inlineCloneResources(
  clone: HTMLElement,
  inline: (url: string) => Promise<string | null>,
) {
  const work: Promise<void>[] = [];
  for (const element of [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))]) {
    if (
      element instanceof HTMLImageElement &&
      element.src &&
      !element.src.startsWith("data:")
    ) {
      work.push(
        inline(element.src).then((inlined) => {
          if (inlined) element.setAttribute("src", inlined);
          else element.removeAttribute("src");
        }),
      );
    }
    const style = element.getAttribute("style");
    if (style && style.includes("url(") && !/url\(\s*['"]?data:/.test(style)) {
      work.push(
        inlineCssUrls(style, inline).then((next) => {
          element.setAttribute("style", next);
        }),
      );
    }
  }
  await Promise.all(work);
}

/** The SVG document that carries the clone, with the page's CSS embedded. */
export function buildSvgDocument(width: number, height: number, css: string, html: string) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<style><![CDATA[${css.replace(/]]>/g, "]]]]><![CDATA[>")}]]></style>` +
    `<foreignObject width="100%" height="100%">${html}</foreignObject></svg>`
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("스크린샷 이미지를 그릴 수 없습니다."));
    image.src = src;
  });
}

/** The SVG that pictures `root`, before it is drawn — exposed for inspection. */
export async function buildCaptureSvg(
  root: HTMLElement,
  options: CaptureOptions = {},
): Promise<{ height: number; svg: string; width: number }> {
  const rect = root.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const inline = createResourceInliner();

  const clone = prepareCaptureClone(root, options);
  // The root paints from where it sits; the picture is only the root, so it
  // paints from the origin at its own size. `isolation` keeps its negative
  // z-index layers above the wrapper's background, as the page's root does.
  clone.style.position = "absolute";
  clone.style.inset = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  clone.style.isolation = "isolate";
  await inlineCloneResources(clone, inline);
  // The root's background is written out resolved: the page paints its
  // wallpaper through nested custom properties, and the SVG renderer left that
  // chain unpainted even with the image inlined into the property.
  const rootStyle = getComputedStyle(root);
  if (rootStyle.backgroundImage && rootStyle.backgroundImage !== "none") {
    clone.style.backgroundImage = await inlineCssUrls(rootStyle.backgroundImage, inline);
    clone.style.backgroundSize = rootStyle.backgroundSize;
    clone.style.backgroundPosition = rootStyle.backgroundPosition;
    clone.style.backgroundRepeat = rootStyle.backgroundRepeat;
    clone.style.backgroundColor = rootStyle.backgroundColor;
  }
  const css = await inlineCssUrls(getCaptureStyleText(), inline);

  const body = getComputedStyle(document.body);
  // XMLSerializer writes the XHTML namespace on the root itself.
  const wrapper = document.createElement("div");
  wrapper.setAttribute(
    "style",
    `position:relative;width:${width}px;height:${height}px;overflow:hidden;` +
      `font-family:${body.fontFamily};font-size:${body.fontSize};color:${body.color};` +
      `background:${body.backgroundColor};line-height:${body.lineHeight}`,
  );
  wrapper.append(clone);
  const html = new XMLSerializer().serializeToString(wrapper);
  return { height, svg: buildSvgDocument(width, height, css, html), width };
}

/** Picture one element at its on-screen size. */
export async function captureElementToPng(
  root: HTMLElement,
  options: CaptureOptions = {},
): Promise<CapturedImage> {
  const { height, svg, width } = await buildCaptureSvg(root, options);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (typeof image.decode === "function") await image.decode().catch(() => undefined);
  // Images inside the foreignObject decode a beat after the SVG reports loaded.
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  const scale = options.scale ?? Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("캔버스를 만들 수 없습니다.");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/png"), height, width };
}
