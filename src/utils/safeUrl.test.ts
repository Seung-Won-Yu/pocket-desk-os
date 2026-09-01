import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, resolveShortcutTarget, toSafeHttpUrl } from "./safeUrl";

describe("toSafeHttpUrl", () => {
  it("passes http and https through, normalized", () => {
    expect(toSafeHttpUrl("https://example.com")).toBe("https://example.com/");
    expect(toSafeHttpUrl("http://example.com/a?b=1#c")).toBe("http://example.com/a?b=1#c");
  });

  it("rejects every scheme that could execute or embed", () => {
    for (const value of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "blob:https://example.com/abc",
      "file:///etc/passwd",
      "about:blank",
      "chrome://settings",
    ]) {
      expect(toSafeHttpUrl(value), value).toBeNull();
    }
  });

  it("rejects a relative value when no base is given", () => {
    expect(toSafeHttpUrl("/path")).toBeNull();
    expect(toSafeHttpUrl("example.com")).toBeNull();
  });

  it("resolves a relative value against a base", () => {
    expect(toSafeHttpUrl("/b", "https://example.com/a")).toBe("https://example.com/b");
    expect(toSafeHttpUrl("c", "https://example.com/a/b")).toBe("https://example.com/a/c");
  });

  it("rejects a dangerous scheme even with a safe base", () => {
    // A base must never launder the scheme of the value itself.
    expect(toSafeHttpUrl("javascript:alert(1)", "https://example.com/")).toBeNull();
    expect(toSafeHttpUrl("data:text/html,x", "https://example.com/")).toBeNull();
  });

  it("rejects empty and non-string input without throwing", () => {
    expect(toSafeHttpUrl("")).toBeNull();
    expect(toSafeHttpUrl("   ")).toBeNull();
    expect(toSafeHttpUrl(null)).toBeNull();
    expect(toSafeHttpUrl(undefined)).toBeNull();
    expect(toSafeHttpUrl("http://")).toBeNull();
    expect(toSafeHttpUrl("://nope")).toBeNull();
  });

  it("does not treat a scheme-looking hostname as a scheme", () => {
    expect(toSafeHttpUrl("https://javascript.example.com/")).toBe(
      "https://javascript.example.com/",
    );
  });
});

describe("isSafeHttpUrl", () => {
  it("agrees with the resolver", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
  });
});

describe("resolveShortcutTarget", () => {
  it("accepts http(s) and gives a bare hostname its https", () => {
    expect(resolveShortcutTarget("https://example.com/a")).toBe("https://example.com/a");
    expect(resolveShortcutTarget("http://example.com")).toBe("http://example.com");
    expect(resolveShortcutTarget("example.com/스모크")).toBe("https://example.com/스모크");
    expect(resolveShortcutTarget("  example.com  ")).toBe("https://example.com");
  });

  it("refuses every other scheme and junk", () => {
    expect(resolveShortcutTarget("javascript:alert(1)")).toBeNull();
    expect(resolveShortcutTarget("data:text/html,hi")).toBeNull();
    expect(resolveShortcutTarget("ftp://example.com")).toBeNull();
    expect(resolveShortcutTarget("")).toBeNull();
    expect(resolveShortcutTarget("   ")).toBeNull();
  });
});
