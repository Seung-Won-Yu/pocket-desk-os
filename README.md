# PocketDesk OS

Browser-based desktop OS prototype built with React and Vite.

## Project Guide

- [Deployment](./DEPLOYMENT.md): GitHub repository setup and static hosting steps.
- [Contributing](./CONTRIBUTING.md): local setup, quality gates, and development notes.
- [Changelog](./CHANGELOG.md): user-facing feature and release history.
- CI: `.github/workflows/ci.yml` runs the Playwright smoke QA on pushes to `main` and pull requests.
- Deploy: `.github/workflows/pages.yml` can publish `dist/` to GitHub Pages from `main`.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5177/`.

## Build

```bash
npm run build
```

## QA

```bash
npm run release:check
npm run qa:pages
npm run qa:smoke
```

`release:check` verifies the GitHub/deploy-critical files, PWA assets, hosting config, CI workflow, and docs are present.

`qa:pages` builds with the GitHub Pages base path and verifies the `dist/` asset URLs plus public metadata files.

`qa:smoke` builds the app, starts a local Vite preview server, and runs a Playwright smoke test for the Start menu, power menu, Setup Center, Python Lab, Run dialog, file associations, Recycle Bin, taskbar previews, system tray panel, notification center, window system menu, taskbar pinning, window snapping, and mobile overflow.

The same smoke QA runs in GitHub Actions through `.github/workflows/ci.yml`.

## Deploy

This project is ready for static hosting from `dist/`.

- Vercel: import the Git repository. `vercel.json` sets `npm run build` and `dist`.
- Netlify: import the Git repository. `netlify.toml` sets `npm run build` and `dist`.
- GitHub Pages: enable Pages with GitHub Actions as the source. The Pages workflow calculates the correct Vite base path for both `<user>.github.io` and project repositories.
- PWA files are included in `public/`, so `manifest.webmanifest`, `sw.js`, `.nojekyll`, `robots.txt`, `llms.txt`, wallpapers, social preview, and install icons are copied during build.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for GitHub repository setup, GitHub Pages, Vercel, Netlify, and manual static hosting steps.

## Assets

```bash
npm run icons
npm run social:preview
```

Regenerates the PocketDesk PWA PNG icons from `scripts/generate-pwa-icons.mjs`.
Regenerates the 1200x630 social/PWA screenshot from the built PocketDesk app.

## Current Features

- Desktop shell with icons, start menu, taskbar, system tray, and draggable/resizable windows.
- PocketDesk OS product name with a custom brand mark used in the boot screen, lock screen, taskbar, About app, favicon, and install icons.
- Unified glass-tile app icon style across the desktop, Start menu, search results, taskbar, window titles, and Alt+Tab switcher.
- Window state persistence: opened apps, position, size, z-order, minimized, and maximized state are stored in `localStorage`.
- Desktop icon layout persistence: icon positions can be dragged and restored across reloads.
- Desktop right-click menu for creating folders, creating notes, and jumping to wallpaper settings.
- Start menu search with app aliases, desktop item results, empty states, and Enter-to-open.
- Toast notifications for desktop creation, saves, theme changes, wallpaper changes, and layout resets, with recent alerts retained in the notification center.
- Boot screen, lock screen, and Start menu power menu with lock, restart, shut down, and power-on simulation.
- Keyboard shortcuts: `Alt+Tab` cycles windows, `Esc` closes transient UI, and `Ctrl+S` saves Notes.
- Run dialog with app commands, classic aliases such as `calc` and `mspaint`, install prompts, and URL/search handoff to Web Surf.
- Window snapping: drag a window to the left, right, or top screen edge, or use `Ctrl+Alt+Arrow` for quick snapping.
- Window titlebar system menu with restore, move-to-center, minimize, maximize, and close actions.
- Pinned taskbar apps with right-click pin/unpin and persistent pinned app layout.
- Taskbar hover/focus previews for open and pinned apps.
- System tray Quick settings panel with Wi-Fi status, sound toggle, volume slider, battery status, notification center, and Settings shortcut.
- Windows-style Start menu with Pinned apps, All apps, search, and Recent file shortcuts.
- IndexedDB-backed virtual file system for Desktop folders, notes, shortcuts, and app files.
- Multiple note files with per-file content and tabs in Notes.
- Sketch Pad PNG save flow that stores drawings as reopenable VFS image files.
- Files app actions for opening, renaming, and deleting VFS entries.
- File extension associations in Files: `.txt`/`.md` open with Notes, `.png`/`.canvas` with Sketch Pad, `.url` with Web Surf, and `.game` with Minefield.
- Recycle Bin app for restoring deleted VFS entries or permanently emptying them.
- ZIP backup export/import for the IndexedDB virtual file system.
- Settings app with theme, wallpaper selection, and window layout reset.
- Setup Center for installing PocketDesk web packages, with official Python and VS Code download links for real desktop installers.
- Apps: browser, minesweeper, calculator, paint, notes, files, recycle bin, setup center, python lab, code studio, settings, about.
- Eight original generated wallpaper assets inspired by classic OS wallpapers. No Microsoft wallpaper files are included.
- PWA manifest, service worker, 192/512px install icons, robots file, `llms.txt`, and social preview image for browser app installation and public sharing support.
- Subtle Web Audio system sounds for window, lock, save, and success moments with a Settings toggle.
- Deployment-ready GitHub Pages, Vercel, and Netlify configuration, GitHub Actions CI, and `.gitignore` for repository cleanup.
- Release readiness check for required repository files, hosting config, PWA assets, CI, and docs.
- Web Surf home screen with bookmarks, history, and selectable search engines.
- Minefield difficulty levels, elapsed timer, flag count, and per-difficulty best records.
- Calc keyboard input, standard/scientific modes, and common scientific functions.
- Sketch Pad undo/redo, brush/shape tools, swatch palette, and PNG download/export.
- Notes tabs with autosave status and Markdown preview.
- Python Lab with a lightweight browser-side Python-style console for small scripts.
- Code Studio with explorer, tabs, editor, terminal, and HTML preview.

## Development Roadmap

### 1. OS Feel

- [x] Wallpaper gallery
- [x] Window position, size, and open-app state persistence
- [x] Desktop icon drag layout persistence
- [x] Desktop right-click menu: new folder, new note, change background
- [x] Improved start menu search
- [x] Toast notifications
- [x] Notification center history and clear-all action
- [x] Boot and lock screen
- [x] Start menu power menu with restart and shut down simulation
- [x] Keyboard shortcuts: Alt+Tab, Esc, Ctrl+S
- [x] Run dialog for app commands and URL/search handoff
- [x] Window snapping with edge preview and Ctrl+Alt+Arrow shortcuts
- [x] Window titlebar system menu
- [x] Pinned taskbar apps with right-click pin/unpin
- [x] Taskbar hover/focus previews
- [x] System tray Quick settings panel
- [x] Start menu Pinned, All apps, and Recent file sections

### 2. Virtual File System

- [x] IndexedDB-backed files and folders
- [x] Multiple note files
- [x] Save paint canvas as an image file
- [x] Open, rename, delete from file explorer
- [x] File extension association display and `.url` Web Surf handoff
- [x] Recycle Bin restore and empty flow
- [x] ZIP export/import

### 3. App Upgrades

- [x] Browser bookmarks, history, home page, and search engine selection
- [x] Paint undo/redo, shapes, palette, PNG export
- [x] Minesweeper difficulty, timer, and best records
- [x] Calculator keyboard input and scientific mode
- [x] Notes tabs, autosave, and Markdown preview
- [x] Setup Center package installation flow
- [x] Python Lab and Code Studio installable apps

### 4. Product Polish

- [x] OS naming and logo pass
- [x] Unified app icon style
- [x] Subtle sound effects
- [x] PWA install support
- [x] Deployment setup
- [x] GitHub deployment checklist
- [x] Public sharing metadata and social preview image
- [x] Release readiness check command
- [x] GitHub Pages base-path build check
- [x] Playwright smoke QA command
- [x] GitHub Actions CI workflow
- [x] Changelog and contribution guide

## Persistence Keys

- `pocket-desk-theme`
- `pocket-desk-wallpaper`
- `pocket-desk-windows-v1`
- `pocket-desk-icons-v1`
- `pocket-desk-desktop-items-v1` (legacy migration source)
- `pocket-desk-note`
- `pocket-desk-mines-best-records-v1`
- `pocket-desk-installed-packages-v1`
- `pocket-desk-code-studio-files-v1`
- `pocket-desk-taskbar-pinned-v1`

## IndexedDB Stores

- `pocket-desk-vfs` / `entries`: virtual files, folders, shortcuts, and app file records.
