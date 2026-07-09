import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const defaultBasePath = `/${packageJson.name}/`;
const basePath = normalizeBasePath(process.env.VITE_BASE_PATH ?? defaultBasePath);

function normalizeBasePath(value) {
  if (!value || value === ".") return "/";
  if (value === "./") return "./";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function assertFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing Pages build file: ${path}`);
  }
}

function assertContains(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
}

await run(npmCommand, ["run", "build"], {
  env: {
    ...process.env,
    VITE_BASE_PATH: basePath,
  },
});

const indexHtml = await readFile("dist/index.html", "utf8");

if (basePath !== "./") {
  assertContains(indexHtml, `${basePath}assets/`, "Pages asset base path");
  assertContains(indexHtml, `${basePath}manifest.webmanifest`, "Pages manifest URL");
  assertContains(indexHtml, `${basePath}brand/pocketdesk-social.png`, "Pages social image URL");
}

await Promise.all([
  assertFile("dist/.nojekyll"),
  assertFile("dist/brand/pocketdesk-social.png"),
  assertFile("dist/llms.txt"),
  assertFile("dist/manifest.webmanifest"),
  assertFile("dist/robots.txt"),
  assertFile("dist/sw.js"),
]);

console.log(`PocketDesk GitHub Pages build check passed (${basePath})`);
