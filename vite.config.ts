import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(path = "/") {
  if (!path || path === ".") return "/";
  if (path === "./") return "./";

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

/**
 * Shipped as a <meta> tag because GitHub Pages serves static files and cannot set
 * response headers. Applied only to the production build: the dev server injects
 * inline <style> blocks and HMR machinery that a policy this strict would block.
 *
 * frame-src has to stay broad — framing arbitrary sites is what the Edge app is
 * for — but it is limited to https, so a data: or blob: document can never be
 * framed. connect-src allows only the reader proxy the Edge app actually calls.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://r.jina.ai",
  "frame-src https:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "upgrade-insecure-requests",
].join("; ");

function contentSecurityPolicyPlugin(): Plugin {
  return {
    apply: "build",
    name: "pocketdesk-csp",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`,
      );
    },
  };
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  build: {
    // The service worker precaches only the assets it finds referenced in
    // index.html, so route-level code splitting would leave a lazily loaded app
    // missing offline until the user had opened it online at least once. The
    // desktop ships as one bundle on purpose; this raises the size warning to
    // match that decision rather than silencing a surprise.
    chunkSizeWarningLimit: 700,
  },
  plugins: [react(), contentSecurityPolicyPlugin()],
});
