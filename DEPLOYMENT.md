# PocketDesk OS Deployment

This project is a static React/Vite app. Build output is written to `dist/` and can be deployed to Vercel, Netlify, GitHub Pages, or any static host.

## Preflight

```bash
npm install
npm run release:check
npm run qa:pages
npm run build
npm run qa:smoke
```

Expected result:

- TypeScript build passes.
- Release readiness check passes.
- GitHub Pages base-path build check passes.
- Vite creates `dist/`.
- Playwright smoke QA passes.
- `dist/manifest.webmanifest`, `dist/sw.js`, `dist/.nojekyll`, `dist/robots.txt`, `dist/llms.txt`, wallpapers, brand icons, and the social preview image are present.

## GitHub Actions CI

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests.

The workflow:

- installs dependencies with `npm ci`
- runs `npm run release:check`
- runs `npm run qa:pages`

Use this as the merge/deploy gate once the project is pushed to GitHub.

`.github/workflows/pages.yml` runs on pushes to `main` and manual dispatches when GitHub Pages is configured to use GitHub Actions.

The Pages workflow:

- installs dependencies with `npm ci`
- runs `npm run release:check`
- verifies a Pages bundle with the correct `VITE_BASE_PATH`
- uploads and deploys `dist/` with GitHub Pages Actions

`npm run release:check` is a local pre-push guard for required repository files, PWA assets, hosting config, CI workflow, and docs. It does not replace `npm run qa:smoke`.

## GitHub Repository Setup

If this folder is not already a Git repository:

```bash
git init
git add .
git commit -m "feat: build PocketDesk OS web desktop"
git branch -M main
git remote add origin https://github.com/<your-name>/<your-repo>.git
git push -u origin main
```

If GitHub CLI is available and authenticated:

```bash
gh auth status
gh repo create pocket-desk-os --public --source=. --remote=origin --push
```

Use `--private` instead of `--public` if the repository should stay private.

If the repository already exists:

```bash
git status
git add src/App.tsx src/styles.css README.md DEPLOYMENT.md CHANGELOG.md CONTRIBUTING.md .github public scripts package.json package-lock.json vercel.json netlify.toml .gitignore index.html tsconfig.json vite.config.ts
git commit -m "feat: polish PocketDesk OS desktop experience"
git push
```

Do not commit:

- `node_modules/`
- `dist/`
- `.env` or `.env.*`
- `.playwright-cli/`
- test reports

These are already covered by `.gitignore`.

If the first commit used the wrong local author identity, set the repository author before pushing and amend:

```bash
git config user.name "<your GitHub name>"
git config user.email "<your GitHub email>"
git commit --amend --reset-author
```

## Vercel

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Keep the detected framework as Vite.
4. Confirm:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Deploy.

`vercel.json` already includes the SPA rewrite and cache headers for the manifest and service worker.

## Netlify

1. Push the project to GitHub.
2. Import the repository in Netlify.
3. Confirm:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy.

`netlify.toml` already includes the SPA redirect and headers for the manifest and service worker.

## GitHub Pages

GitHub Pages can host the built `dist/` folder through the included `Deploy GitHub Pages` workflow.

1. Push the project to GitHub on the `main` branch.
2. Open repository Settings.
3. Go to Pages.
4. Set Source to `GitHub Actions`.
5. Run the `Deploy GitHub Pages` workflow or push to `main`.

The workflow automatically calculates the Vite base path:

- Repositories named `<user>.github.io` build with `/`.
- Project repositories build with `/<repo>/`.

For a manual Pages-style local build, set `VITE_BASE_PATH`:

```bash
VITE_BASE_PATH=/your-repo/ npm run build
```

## Release Checklist

- [ ] `npm run build` passes locally.
- [ ] `npm run release:check` passes locally.
- [ ] `npm run qa:pages` passes locally.
- [ ] `npm run qa:smoke` passes locally.
- [ ] GitHub Actions CI is green on `main`.
- [ ] `CHANGELOG.md` reflects the release.
- [ ] Open the production preview with `npm run preview`.
- [ ] Confirm boot screen, lock screen, desktop icons, Start menu, taskbar, and windows render.
- [ ] Confirm Start menu power menu can restart, shut down, and power on.
- [ ] Confirm Start menu shows Pinned, All apps, and Recent sections.
- [ ] Confirm Setup Center can install Python Lab and Code Studio.
- [ ] Confirm Python Lab `Run` prints output.
- [ ] Confirm Run opens `calc` and URL/search commands hand off to Web Surf.
- [ ] Confirm Files shows Open with associations and `.url` entries open in Web Surf.
- [ ] Confirm Files deletion moves entries to Recycle Bin, restore works, and empty removes entries.
- [ ] Confirm taskbar hover/focus previews appear for open windows.
- [ ] Confirm system tray opens Quick settings and Settings shortcut works.
- [ ] Confirm notification center keeps recent alerts and Clear all empties them.
- [ ] Confirm window titlebar right-click system menu can move a window to center.
- [ ] Confirm taskbar pin/unpin works with right-click.
- [ ] Confirm window snapping works by dragging to the left, right, and top edges.
- [ ] Confirm `manifest.webmanifest` and `sw.js` load with HTTP 200 after deploy.
- [ ] Confirm `robots.txt`, `llms.txt`, and `brand/pocketdesk-social.png` load with HTTP 200 after deploy.
