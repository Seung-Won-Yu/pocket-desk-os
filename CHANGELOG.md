# Changelog

All notable changes to PocketDesk OS are documented here.

## Unreleased

### Changed

- Replaced File Explorer's type-filtered locations with a real parent-child folder hierarchy.
- Grouped folders before files and localized file type labels to match Korean Windows Explorer.
- Extracted every built-in app into an independent feature module.
- Reduced `App.tsx` to focus on the desktop shell, window management, and shared application state.
- Moved app metadata, wallpaper data, format helpers, and shared types into owned modules.
- Upgraded the service worker to precache production bundles and wait for user-approved updates.

### Added

- Added independent multi-window File Explorer instances with taskbar window counts and previews.
- Added Windows-style common Open and Save As dialogs with folder history, breadcrumbs, search, file filtering, new folders, extension handling, and overwrite confirmation.
- Connected Notepad and Paint to persistent VFS open/save flows and `Ctrl+O`, `Ctrl+S`, and `Ctrl+Shift+S` shortcuts.
- Added Playwright coverage for independent Explorer windows and Notepad/Paint file dialog workflows.
- Added Documents, Pictures, and Games system folders with safe migration for existing IndexedDB data.
- Added Explorer back, forward, up, breadcrumb navigation, folder creation, recursive copy, and drag-and-drop moves.
- Added recursive folder deletion, Recycle Bin tree restore, and permanent tree deletion.
- Added Playwright coverage for folder navigation, drag moves, and folder-tree restore.
- Windows-style update prompt with controlled service worker activation.
- Automated PWA test covering service worker control, bundle precaching, offline reload, and tray status.
- Reader-first routing and a recovery panel for websites that block iframe embedding.

### Fixed

- Serialized IndexedDB writes with atomic transactions, schema metadata, migration indexes, and failure reporting.
- Hardened ZIP restore against malformed headers, unsupported compression, invalid UTF-8, duplicate entries, oversized data, and CRC mismatches.
- Prevented service worker activation from deleting unrelated origin caches.

## 0.1.0

Initial deploy-ready web desktop prototype.

### Added

- Browser-based desktop shell with wallpaper, desktop icons, taskbar, system tray, Start menu, boot screen, and lock screen.
- Start menu power menu with lock, restart, shut down, and power-on simulation.
- Draggable, resizable, minimizable, maximizable, persistent app windows.
- Edge window snapping with visual preview and `Ctrl+Alt+Arrow` shortcuts.
- Window titlebar system menu with restore, minimize, maximize, and close actions.
- Run dialog for app commands, classic aliases, and URL/search handoff.
- Persistent pinned taskbar apps with a right-click context menu.
- Taskbar hover/focus previews for open and pinned apps.
- System tray quick settings with real network status, sound toggle, and Settings shortcut.
- Notification center history with a clear-all action.
- Windows-style Start menu with pinned apps, all apps, search, and recommended files.
- Browser app with bookmarks, history, quick links, selectable search engines, and reliable new-tab opening.
- Minesweeper with difficulty levels, timer, flags, and best records.
- Calculator with keyboard input, standard mode, and scientific functions.
- Paint with brush, shape tools, swatches, undo/redo, PNG save, and PNG download.
- Notepad with multiple files, tabs, autosave status, and Markdown preview.
- File Explorer backed by IndexedDB with type filters, open, rename, delete, ZIP export, and ZIP import.
- File associations for `.txt`, `.md`, `.png`, `.canvas`, `.url`, and `.game` entries.
- Recycle Bin with restore and confirmation before permanent deletion.
- Settings with functional personalization, system, and sound sections.
- Desktop selection regression protection and a shell recovery screen.
- Windows-style desktop icon sizes, name/type/date sorting, refresh, and grid alignment.
- Windows-style single-click selection, double-click launch, desktop file rename/copy/paste/delete/context menu/properties, and collision-free icon placement.
- Show Desktop taskbar target plus `Win+E`, `Win+R`, `Win+D`, `Alt+F4`, desktop `F2`, `Enter`, and `Delete` shortcuts.
- File Explorer sorting, details/list/icon views, multi-selection, and keyboard operations.
- File Explorer text-file creation, persistent copy/paste, file context menus, and properties.
- Original generated wallpaper set and custom PocketDesk brand icons.
- PWA manifest, service worker, and install icons.
- Public sharing metadata, `robots.txt`, `llms.txt`, and generated social preview image.
- Vercel and Netlify static hosting configuration.
- GitHub Pages deployment workflow with automatic Pages base path handling.
- Release readiness check command for GitHub/deploy-critical files and docs.
- GitHub Actions CI workflow, GitHub Pages build check, and Playwright smoke QA command.

### Notes

- PocketDesk OS does not run native Windows `.exe` installers inside the browser.
- Browser state is local to the device through `localStorage` and IndexedDB.
