/**
 * The blob: URLs the shell makes for pictures, each with the data URL it was
 * made from. A screen capture has to inline every url() it pictures, and the
 * page's CSP refuses to fetch a blob: URL (`connect-src` names no `blob:`) —
 * measured: with a picture as the wallpaper, PrintScreen's fetch was refused
 * and the capture came out one flat navy. The capture reads the source here
 * instead, which needs no request at all.
 */
const sources = new Map<string, string>();

export function registerObjectUrlSource(url: string, dataUrl: string) {
  sources.set(url, dataUrl);
}

export function forgetObjectUrlSource(url: string) {
  sources.delete(url);
}

export function getObjectUrlSource(url: string) {
  return sources.get(url) ?? null;
}
