import { access, readFile } from "node:fs/promises";
import { buildContentSecurityPolicy, SECURITY_HEADERS } from "./security-policy.mjs";

const requiredFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".gitignore",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "DEPLOYMENT.md",
  "docs/DEVELOPMENT-NOTES.md",
  "README.md",
  "index.html",
  "netlify.toml",
  "package-lock.json",
  "package.json",
  "public/.nojekyll",
  "public/brand/pocketdesk-icon-192.png",
  "public/brand/pocketdesk-icon-512.png",
  "public/brand/pocketdesk-mark.svg",
  "public/brand/pocketdesk-social.png",
  "public/llms.txt",
  "public/manifest.webmanifest",
  "public/robots.txt",
  "public/sw.js",
  "scripts/check-pages-build.mjs",
  "scripts/generate-pwa-icons.mjs",
  "scripts/generate-social-preview.mjs",
  "scripts/pwa-test.mjs",
  "scripts/smoke-test.mjs",
  "src/App.tsx",
  "src/components/PwaUpdatePrompt.tsx",
  "src/main.tsx",
  "src/pwa/registerServiceWorker.ts",
  "src/styles.css",
  "src/vite-env.d.ts",
  "tsconfig.json",
  "vercel.json",
  "vite.config.ts",
];

const requiredWallpapers = [
  "aurora-lake.jpg",
  "blue-ribbon.jpg",
  "dawn-lake.jpg",
  "glass-wave.jpg",
  "green-vista.jpg",
  "misty-peak.jpg",
  "moon-coast.jpg",
  "sunny-field.jpg",
].map((name) => `public/wallpapers/${name}`);

const textChecks = [
  ["package.json", '"build": "tsc -b && vite build"'],
  ["package.json", '"qa:pages"'],
  ["package.json", '"qa:pwa"'],
  ["package.json", '"qa:smoke"'],
  ["package.json", '"release:check"'],
  ["package.json", '"social:preview"'],
  [".github/workflows/ci.yml", "npm run qa:pages"],
  [".github/workflows/ci.yml", "npm run qa:pwa"],
  [".github/workflows/ci.yml", "npm run qa:smoke"],
  [".github/workflows/pages.yml", "actions/deploy-pages@v4"],
  [".github/workflows/pages.yml", "actions/upload-pages-artifact@v4"],
  [".github/workflows/pages.yml", "enablement: true"],
  [".github/workflows/pages.yml", "npm run qa:pages"],
  [".github/workflows/pages.yml", "VITE_BASE_PATH"],
  ["README.md", "Current Features"],
  ["README.md", "Development Roadmap"],
  ["README.md", "Persistence Keys"],
  ["DEPLOYMENT.md", "Release Checklist"],
  ["DEPLOYMENT.md", "GitHub Actions CI"],
  ["DEPLOYMENT.md", "Deploy GitHub Pages"],
  ["CHANGELOG.md", "0.1.0"],
  ["CONTRIBUTING.md", "Quality Gates"],
  ["vercel.json", '"buildCommand": "npm run build"'],
  ["netlify.toml", 'command = "npm run build"'],
  ["index.html", "og:image"],
  ["index.html", "application/ld+json"],
  ["public/manifest.webmanifest", "PocketDesk OS"],
  ["public/manifest.webmanifest", "brand/pocketdesk-social.png"],
  ["public/robots.txt", "Allow: /"],
  ["public/llms.txt", "PocketDesk OS"],
  // The build stamps a per-deploy id in place of the placeholder, so the source
  // must still carry the placeholder rather than a frozen version number.
  ["public/sw.js", "pocketdesk-os-__BUILD_ID__"],
  ["public/sw.js", "SKIP_WAITING"],
];

async function assertFileExists(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing required file: ${path}`);
  }
}

async function assertFileContains(path, expected) {
  const text = await readFile(path, "utf8");
  if (!text.includes(expected)) {
    throw new Error(`Missing "${expected}" in ${path}`);
  }
}

/**
 * The meta tag is generated from scripts/security-policy.mjs, but the hosting
 * configs carry the policy as literal text. Editing the policy without updating
 * them would silently leave Netlify and Vercel on an older one, so fail here.
 */
async function assertSecurityHeadersMatchPolicy() {
  const headerPolicy = buildContentSecurityPolicy({ header: true });

  for (const path of ["netlify.toml", "vercel.json"]) {
    const text = await readFile(path, "utf8");
    if (!text.includes(headerPolicy)) {
      throw new Error(
        `${path} does not carry the current Content-Security-Policy. ` +
          "Regenerate its headers from scripts/security-policy.mjs.",
      );
    }
    for (const key of Object.keys(SECURITY_HEADERS)) {
      if (!text.includes(key)) {
        throw new Error(`${path} is missing the ${key} header.`);
      }
    }
  }
}

async function runReleaseCheck() {
  const files = [...requiredFiles, ...requiredWallpapers];

  await Promise.all(files.map(assertFileExists));
  for (const [path, expected] of textChecks) {
    await assertFileContains(path, expected);
  }
  await assertSecurityHeadersMatchPolicy();

  console.log(
    `PocketDesk release check passed (${files.length} files, ${textChecks.length} text checks, ` +
      `${Object.keys(SECURITY_HEADERS).length} security headers)`,
  );
}

runReleaseCheck().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
