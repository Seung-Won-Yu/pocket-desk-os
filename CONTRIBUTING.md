# Contributing

PocketDesk OS is a React + Vite static web app. The project is intentionally small and self-contained so it can be deployed from a personal GitHub repository without backend infrastructure.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5177/`.

## Quality Gates

Run these before pushing:

```bash
npm run release:check
npm run build
npm run qa:smoke
```

`npm run release:check` verifies repository files needed for GitHub deployment, hosting config, PWA assets, CI, and docs.

`npm run qa:smoke` builds the app, starts a local production preview server, and checks core flows in Playwright:

- unlock desktop
- Start menu Pinned / All apps / Recent
- Start menu power menu restart and shut down
- Setup Center installation
- Python Lab execution
- Run dialog command execution
- Files extension association and `.url` Web Surf handoff
- Recycle Bin restore and empty flow
- taskbar hover/focus preview
- system tray Quick settings panel
- notification center history and clear-all
- window titlebar system menu
- taskbar pin/unpin
- window snapping
- mobile overflow

## Development Guidelines

- Keep the app static and browser-native unless a backend is explicitly needed.
- Prefer existing app patterns in `src/App.tsx` and `src/styles.css`.
- Keep UI controls dense, useful, and desktop-like.
- Use generated or self-owned assets only. Do not commit Microsoft-owned wallpapers, logos, or sounds.
- Keep persistence keys documented in `README.md` when adding localStorage or IndexedDB state.
- Add Playwright smoke coverage when a change touches a major user flow.

## Git Hygiene

This folder may start outside Git. To initialize it:

```bash
git init
git add .
git commit -m "feat: build PocketDesk OS web desktop"
```

Do not commit `node_modules/`, `dist/`, `.env`, `.playwright-cli/`, or test reports. These are covered by `.gitignore`.

## Release Notes

Update `CHANGELOG.md` when adding user-visible features, deployment changes, or new QA gates.
