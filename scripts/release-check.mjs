import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".gitignore",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "DEPLOYMENT.md",
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
  "scripts/smoke-test.mjs",
  "src/App.tsx",
  "src/main.tsx",
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
  ["package.json", '"qa:smoke"'],
  ["package.json", '"release:check"'],
  ["package.json", '"social:preview"'],
  [".github/workflows/ci.yml", "npm run qa:pages"],
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
  ["public/sw.js", "pocketdesk-os-v2"],
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

async function runReleaseCheck() {
  const files = [...requiredFiles, ...requiredWallpapers];

  await Promise.all(files.map(assertFileExists));
  for (const [path, expected] of textChecks) {
    await assertFileContains(path, expected);
  }

  console.log(`PocketDesk release check passed (${files.length} files, ${textChecks.length} text checks)`);
}

runReleaseCheck().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
