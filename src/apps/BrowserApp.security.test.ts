import { afterEach, describe, expect, it, vi } from "vitest";
import { isSameOriginTarget } from "./BrowserApp";

/** GitHub Pages puts every repo of an account on one origin. */
const PAGES_ORIGIN = "https://seung-won-yu.github.io";

function stubLocation(href: string) {
  vi.stubGlobal("window", {
    location: { href, origin: new URL(href).origin },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSameOriginTarget", () => {
  it("flags the app's own page", () => {
    stubLocation(`${PAGES_ORIGIN}/pocket-desk-os/`);
    expect(isSameOriginTarget(`${PAGES_ORIGIN}/pocket-desk-os/`)).toBe(true);
  });

  it("flags a sibling project on the same Pages account", () => {
    // This is the case that mattered: apple-burst is a different repo but the
    // same origin, so framing it with allow-scripts allow-same-origin would let
    // it script this app.
    stubLocation(`${PAGES_ORIGIN}/pocket-desk-os/`);
    expect(isSameOriginTarget(`${PAGES_ORIGIN}/apple-burst/`)).toBe(true);
  });

  it("flags a relative path", () => {
    stubLocation(`${PAGES_ORIGIN}/pocket-desk-os/`);
    expect(isSameOriginTarget("./index.html")).toBe(true);
    expect(isSameOriginTarget("/pocket-desk-os/")).toBe(true);
  });

  it("allows a genuinely third-party site", () => {
    stubLocation(`${PAGES_ORIGIN}/pocket-desk-os/`);
    expect(isSameOriginTarget("https://example.com/")).toBe(false);
    expect(isSameOriginTarget("https://developer.mozilla.org/ko/")).toBe(false);
  });

  it("treats a different port or scheme as a different origin", () => {
    stubLocation("http://127.0.0.1:5173/");
    expect(isSameOriginTarget("http://127.0.0.1:5173/x")).toBe(true);
    expect(isSameOriginTarget("http://127.0.0.1:4173/x")).toBe(false);
    expect(isSameOriginTarget("https://127.0.0.1:5173/x")).toBe(false);
  });

  it("does not mistake a lookalike host for the same origin", () => {
    stubLocation(`${PAGES_ORIGIN}/pocket-desk-os/`);
    expect(isSameOriginTarget("https://seung-won-yu.github.io.evil.test/")).toBe(false);
    expect(isSameOriginTarget("https://evil.seung-won-yu.github.io/")).toBe(false);
  });

  it("returns false rather than throwing on an unparseable value", () => {
    stubLocation(`${PAGES_ORIGIN}/pocket-desk-os/`);
    expect(isSameOriginTarget("http://")).toBe(false);
    expect(isSameOriginTarget("")).toBe(true);
  });
});
