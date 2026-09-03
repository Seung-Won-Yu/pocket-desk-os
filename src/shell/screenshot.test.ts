// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCaptureSvg,
  buildSvgDocument,
  collectStyleText,
  createResourceInliner,
  getCaptureStyleText,
  getScreenshotFileName,
  inlineCloneResources,
  inlineCssUrls,
  prepareCaptureClone,
} from "./screenshot";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("getScreenshotFileName", () => {
  it("names the file the way Windows does", () => {
    expect(getScreenshotFileName(new Date(2026, 8, 3, 14, 30, 12))).toBe(
      "스크린샷 2026-09-03 143012.png",
    );
  });
});

describe("inlineCssUrls", () => {
  it("replaces fetchable urls, leaves data urls and failures alone", async () => {
    const inline = vi.fn(async (url: string) =>
      url === "/wallpapers/a.jpg" ? "data:image/jpeg;base64,AAA" : null,
    );
    const css = `.a{background:url("/wallpapers/a.jpg")} .b{background:url(/missing.png)} .c{background:url(data:image/png;base64,BBB)}`;
    expect(await inlineCssUrls(css, inline)).toBe(
      `.a{background:url("data:image/jpeg;base64,AAA")} .b{background:url(/missing.png)} .c{background:url(data:image/png;base64,BBB)}`,
    );
    expect(inline).toHaveBeenCalledTimes(2);
  });
});

describe("collectStyleText", () => {
  it("keeps rules and drops font-face and import rules", () => {
    const style = document.createElement("style");
    style.textContent = `@font-face { font-family: X; src: url(/x.woff2); } .desktop { color: red; }`;
    document.head.append(style);
    const text = collectStyleText();
    expect(text).toContain(".desktop");
    expect(text).not.toContain("font-face");
  });
});

describe("prepareCaptureClone", () => {
  it("drops excluded elements and scripts, boxes embeds, and writes form state as attributes", () => {
    document.body.innerHTML = `
      <main class="desktop">
        <script>window.x = 1</script>
        <article class="window-frame" data-app-id="snip"><p>tool</p></article>
        <article class="window-frame" data-app-id="notepad">
          <textarea></textarea>
          <input type="text" />
          <input type="checkbox" />
          <select><option>a</option><option>b</option></select>
          <iframe src="about:blank" title="x"></iframe>
        </article>
      </main>`;
    const root = document.querySelector<HTMLElement>(".desktop")!;
    (root.querySelector("textarea") as HTMLTextAreaElement).value = "typed";
    (root.querySelector('input[type="text"]') as HTMLInputElement).value = "hello";
    (root.querySelector('input[type="checkbox"]') as HTMLInputElement).checked = true;
    (root.querySelector("select") as HTMLSelectElement).selectedIndex = 1;

    const clone = prepareCaptureClone(root, {
      exclude: (element) => element.matches('.window-frame[data-app-id="snip"]'),
    });
    expect(clone.querySelector("script")).toBeNull();
    expect(clone.querySelector('[data-app-id="snip"]')).toBeNull();
    expect(clone.querySelector('[data-app-id="notepad"]')).not.toBeNull();
    expect(clone.querySelector("iframe")).toBeNull();
    expect(clone.querySelector("textarea")!.textContent).toBe("typed");
    expect(clone.querySelector('input[type="text"]')!.getAttribute("value")).toBe("hello");
    expect(clone.querySelector('input[type="checkbox"]')!.hasAttribute("checked")).toBe(true);
    expect(clone.querySelectorAll("option")[1].hasAttribute("selected")).toBe(true);
    // The source is untouched.
    expect(root.querySelector("script")).not.toBeNull();
    expect(root.querySelector('[data-app-id="snip"]')).not.toBeNull();
  });
});

describe("inlineCloneResources", () => {
  it("inlines image sources and inline-style urls", async () => {
    const clone = document.createElement("div");
    clone.innerHTML = `<img src="http://localhost/brand/icon.png" /><span style="background-image: url(/wallpapers/w.jpg)"></span>`;
    await inlineCloneResources(clone, async (url) => `data:x;base64,${url.length}`);
    expect(clone.querySelector("img")!.getAttribute("src")).toMatch(/^data:x;base64,/);
    expect(clone.querySelector("span")!.getAttribute("style")).toContain('url("data:x;base64,');
  });
});

describe("createResourceInliner", () => {
  it("fetches each url once and returns null for failures", async () => {
    // Byte bodies, not Blobs: under jsdom, Node's Response stringifies a jsdom Blob.
    const fetchImpl = vi.fn(async (url: string) =>
      url === "/ok"
        ? new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-type": "image/jpeg" },
            status: 200,
          })
        : new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;
    const inline = createResourceInliner(fetchImpl);
    const [first, second, missing] = await Promise.all([
      inline("/ok"),
      inline("/ok"),
      inline("/no"),
    ]);
    expect(first).toBe("data:image/jpeg;base64,AQID");
    expect(second).toBe(first);
    expect(missing).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(await inline("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
  });
});

describe("buildSvgDocument", () => {
  it("wraps the html in a foreignObject with the css embedded", () => {
    const svg = buildSvgDocument(
      10,
      20,
      ".a{color:red}",
      '<div xmlns="http://www.w3.org/1999/xhtml">x</div>',
    );
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"');
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain(".a{color:red}");
  });
});

describe("getCaptureStyleText", () => {
  it("appends the overrides that freeze animations at their resting style", () => {
    const style = document.createElement("style");
    style.textContent = ".window-frame { animation: window-open 180ms both; }";
    document.head.append(style);
    const text = getCaptureStyleText();
    expect(text).toContain(".window-frame");
    expect(text).toContain("animation: none !important");
  });

  it("serializes an HTML wrapper with the XHTML namespace once", () => {
    const wrapper = document.createElement("div");
    wrapper.append(document.createElement("span"));
    const html = new XMLSerializer().serializeToString(wrapper);
    expect(html.startsWith('<div xmlns="http://www.w3.org/1999/xhtml">')).toBe(true);
    expect(html.split("http://www.w3.org/1999/xhtml").length - 1).toBe(1);
  });
});

describe("buildCaptureSvg", () => {
  it("writes the root's wallpaper out as an inlined, resolved background", async () => {
    const root = document.createElement("main");
    root.className = "desktop";
    root.style.backgroundImage = 'url("/wallpapers/blue-ribbon.jpg")';
    root.innerHTML = "<p>hello</p>";
    document.body.append(root);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
    );

    const { svg } = await buildCaptureSvg(root);
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain("data:image/jpeg;base64,AQID");
    expect(svg).not.toContain("/wallpapers/blue-ribbon.jpg");
    // The picture is only the root, painted from the origin.
    expect(svg).toMatch(/position: absolute; inset: 0(px)?;/);
    root.remove();
  });
});
