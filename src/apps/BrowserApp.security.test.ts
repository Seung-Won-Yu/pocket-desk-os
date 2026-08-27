import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBrowserReaderUrl,
  isSameOriginTarget,
  normalizeBrowserBookmark,
  normalizeBrowserHistoryEntry,
  normalizeUrl,
  readerWouldLeakQuery,
} from "./BrowserApp";

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

describe("normalizeUrl", () => {
  it("keeps an explicit http(s) address", () => {
    expect(normalizeUrl("https://example.com/a")).toBe("https://example.com/a");
  });

  it("prefixes a bare hostname with https without canonicalizing it", () => {
    // The address bar must keep showing what the user typed, so no trailing
    // slash is added.
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("never returns a scheme that could execute", () => {
    // The old implementation only neutralized these by accident, because the
    // https:// prefix made them unparseable. Now the scheme is checked.
    for (const value of [
      "javascript:alert(1)",
      "javascript:fetch('https://evil.test')",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.com/x",
    ]) {
      const result = normalizeUrl(value);
      expect(result.startsWith("https://"), `${value} -> ${result}`).toBe(true);
      expect(result.toLowerCase()).not.toContain("javascript:");
      expect(result.toLowerCase()).not.toContain("vbscript:");
      // A rejected scheme becomes a search query, never a navigation target.
      expect(result).toContain("q=");
    }
  });

  it("falls back to search for plain text", () => {
    expect(normalizeUrl("날씨")).toContain("q=");
  });
});

describe("stored browser entries", () => {
  it("restores an ordinary bookmark", () => {
    const bookmark = normalizeBrowserBookmark({
      createdAt: 1,
      id: "b1",
      title: "예시",
      url: "https://example.com/",
    });
    expect(bookmark?.url).toBe("https://example.com/");
  });

  it("drops a bookmark whose URL could execute", () => {
    // The Registry Editor exposes this key, so the value is attacker-controlled.
    for (const url of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"]) {
      expect(normalizeBrowserBookmark({ id: "b", title: "t", url }), url).toBeNull();
    }
  });

  it("drops a history entry whose URL could execute", () => {
    expect(
      normalizeBrowserHistoryEntry({ id: "h", title: "t", url: "javascript:alert(1)" }),
    ).toBeNull();
    expect(
      normalizeBrowserHistoryEntry({ id: "h", title: "t", url: "https://example.com/" })?.url,
    ).toBe("https://example.com/");
  });

  it("still rejects malformed shapes", () => {
    expect(normalizeBrowserBookmark(null)).toBeNull();
    expect(normalizeBrowserBookmark({ title: "t" })).toBeNull();
    expect(normalizeBrowserBookmark({ url: "https://example.com" })).toBeNull();
  });
});

describe("reader mode does not hand secrets to the proxy", () => {
  it("strips the query string from an ordinary page", () => {
    // A query string can carry an invite, reset or session token, and the reader
    // service fetches the address server-side.
    const readerUrl = getBrowserReaderUrl(
      "https://github.com/orgs/acme/invitation?via_email=1&token=abc123",
    );
    expect(readerUrl).not.toContain("token");
    expect(readerUrl).not.toContain("abc123");
    expect(readerUrl).toBe("https://r.jina.ai/https://github.com/orgs/acme/invitation");
  });

  it("strips embedded credentials", () => {
    const readerUrl = getBrowserReaderUrl("https://user:pa55w0rd@example.com/private");
    expect(readerUrl).not.toContain("pa55w0rd");
    expect(readerUrl).not.toContain("user");
    expect(readerUrl).toBe("https://r.jina.ai/https://example.com/private");
  });

  it("strips the fragment", () => {
    expect(getBrowserReaderUrl("https://example.com/a#secret-anchor")).toBe(
      "https://r.jina.ai/https://example.com/a",
    );
  });

  it("keeps only the q parameter for a search page, where the query is the content", () => {
    const readerUrl = getBrowserReaderUrl(
      "https://duckduckgo.com/?q=날씨&session=should-not-leak",
    );
    expect(readerUrl).not.toContain("should-not-leak");
    expect(readerUrl).toContain(encodeURIComponent("날씨"));
  });

  it("refuses a scheme it must not hand over", () => {
    expect(getBrowserReaderUrl("javascript:alert(1)")).toBeNull();
    expect(getBrowserReaderUrl("file:///etc/passwd")).toBeNull();
    expect(getBrowserReaderUrl("")).toBeNull();
  });
});

describe("readerWouldLeakQuery", () => {
  it("flags a URL whose query or credentials would be sent", () => {
    expect(readerWouldLeakQuery("https://example.com/a?token=1")).toBe(true);
    expect(readerWouldLeakQuery("https://user:pw@example.com/a")).toBe(true);
  });

  it("does not flag a plain page or a search page", () => {
    expect(readerWouldLeakQuery("https://example.com/a")).toBe(false);
    expect(readerWouldLeakQuery("https://example.com/a#anchor")).toBe(false);
    // A search URL's query is the content the user asked to read.
    expect(readerWouldLeakQuery("https://duckduckgo.com/?q=날씨")).toBe(false);
  });

  it("does not flag an unusable value", () => {
    expect(readerWouldLeakQuery("javascript:alert(1)")).toBe(false);
  });
});
