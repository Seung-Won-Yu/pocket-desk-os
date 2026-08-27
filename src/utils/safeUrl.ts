/**
 * Only http and https ever reach an href, an iframe src, or a navigation.
 *
 * Everything the browser app displays can originate outside the app: a page
 * fetched through the reader proxy, a `.url` shortcut restored from a ZIP
 * backup, a value edited in the Registry Editor. Any of those could carry a
 * `javascript:` or `data:` URL, which would run on this origin — where the
 * user's files, and on a local build a real folder handle, are reachable.
 */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/** The URL as an absolute http(s) string, or null. Never throws. */
export function toSafeHttpUrl(value: string | null | undefined, base?: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const resolved = base ? new URL(trimmed, base) : new URL(trimmed);
    return SAFE_PROTOCOLS.has(resolved.protocol) ? resolved.toString() : null;
  } catch {
    return null;
  }
}

/** True when the value already names an http(s) URL. */
export function isSafeHttpUrl(value: string | null | undefined) {
  return toSafeHttpUrl(value) !== null;
}
