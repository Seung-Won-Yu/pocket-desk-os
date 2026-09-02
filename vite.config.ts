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
 * Stamps the service worker with two build facts it cannot learn at runtime:
 * a per-build cache id (without it the cache name only changed when someone
 * remembered to edit a constant, so a poisoned cache entry outlived the deploy
 * that was supposed to replace it), and the complete list of emitted assets.
 * The list is what makes code splitting safe here — the worker used to find
 * assets only by scanning index.html, and a lazily imported chunk is never
 * referenced there, so it would have been missing offline until the user had
 * opened that view online once.
 */
function serviceWorkerCacheIdPlugin(): Plugin {
  const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? String(Date.now());
  let emittedAssets: string[] = [];
  return {
    apply: "build",
    generateBundle(_options, bundle) {
      emittedAssets = Object.keys(bundle)
        .filter((fileName) => fileName.startsWith("assets/"))
        .sort();
    },
    name: "pocketdesk-sw-cache-id",
    async writeBundle(options) {
      const { readFile, writeFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const target = join(options.dir ?? "dist", "sw.js");
      const source = await readFile(target, "utf8");
      const assetList = JSON.stringify(emittedAssets);
      await writeFile(
        target,
        source
          .replaceAll("__BUILD_ID__", buildId)
          .replace(/const BUNDLED_ASSETS = \[\];[^\n]*/, `const BUNDLED_ASSETS = ${assetList};`),
      );
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
    // The shell ships as one main bundle plus deliberately split chunks (the
    // reader view's Markdown stack); the service worker precaches every emitted
    // asset from the build's own list, so a split chunk is present offline.
    // This raises the size warning to match that decision.
    chunkSizeWarningLimit: 700,
  },
  plugins: [react(), contentSecurityPolicyPlugin(), serviceWorkerCacheIdPlugin()],
});
