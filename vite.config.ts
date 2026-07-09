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
  plugins: [react()],
});
