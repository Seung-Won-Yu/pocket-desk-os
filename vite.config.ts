import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildContentSecurityPolicy } from "./scripts/security-policy.mjs";

function normalizeBasePath(path = "/") {
  if (!path || path === ".") return "/";
  if (path === "./") return "./";

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

/**
 * The policy itself lives in scripts/security-policy.mjs so the meta tag here and
 * the response headers in netlify.toml / vercel.json share one definition.
 */
/**
 * Stamps the service worker's cache name with a per-build id. Without it the
 * cache name only changed when someone remembered to edit a constant, so a
 * poisoned cache entry outlived the deploy that was supposed to replace it.
 */
function serviceWorkerCacheIdPlugin(): Plugin {
  const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? String(Date.now());
  return {
    apply: "build",
    generateBundle(_options, bundle) {
      void bundle;
    },
    name: "pocketdesk-sw-cache-id",
    async writeBundle(options) {
      const { readFile, writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const target = join(options.dir ?? "dist", "sw.js");
      const source = await readFile(target, "utf8");
      await writeFile(target, source.replaceAll("__BUILD_ID__", buildId));
    },
  };
}

function contentSecurityPolicyPlugin(): Plugin {
  let dev = false;
  return {
    configResolved(config) {
      dev = config.command === "serve";
    },
    name: "pocketdesk-csp",
    transformIndexHtml(html) {
      const policy = buildContentSecurityPolicy({ dev });
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
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
  plugins: [react(), contentSecurityPolicyPlugin(), serviceWorkerCacheIdPlugin()],
});
