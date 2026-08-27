/**
 * One definition of the site's security policy, imported by the Vite config and
 * checked against the hosting configs by the release check, so the meta tag and
 * the response headers cannot drift apart.
 */

/**
 * frame-src stays broad because framing arbitrary sites is what the Edge app is
 * for, but it is limited to https so a data: or blob: document can never be
 * framed. connect-src allows only the reader proxy the app actually calls.
 *
 * The dev server gets a policy too: that is where the local folder bridge is
 * enabled, so leaving it unrestricted would give the build with real file access
 * the weaker policy. Dev relaxes only what Vite needs — inline module preloads,
 * the HMR socket, and eval for the React refresh runtime.
 */
export function buildContentSecurityPolicy({ dev = false, header = false } = {}) {
  return [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    dev
      ? "connect-src 'self' ws: wss: https://r.jina.ai"
      : "connect-src 'self' https://r.jina.ai",
    "frame-src https:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    // A meta tag cannot express frame-ancestors, so it is header-only. Where it
    // is unavailable — GitHub Pages — src/main.tsx refuses to render in a frame.
    ...(header ? ["frame-ancestors 'none'"] : []),
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Response headers for hosts that can set them. Deliberately omits
 * Cross-Origin-Embedder-Policy: require-corp would block the cross-origin
 * iframe the Edge app exists to show.
 */
export const SECURITY_HEADERS = {
  "Content-Security-Policy": buildContentSecurityPolicy({ header: true }),
  "Cross-Origin-Opener-Policy": "same-origin",
  // The app needs none of these; denying them stops a framed site asking too.
  "Permissions-Policy":
    "accelerometer=(), camera=(), fullscreen=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), serial=(), hid=(), bluetooth=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Matters once a custom domain is used; the default Netlify and Vercel hosts
  // and github.io are already HSTS-preloaded.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};
