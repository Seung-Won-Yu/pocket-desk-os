import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(path = "/") {
  if (!path || path === ".") return "/";
  if (path === "./") return "./";

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
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
  plugins: [react()],
});
