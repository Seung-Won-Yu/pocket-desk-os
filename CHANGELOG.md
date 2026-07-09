# Changelog

All notable changes to PocketDesk OS are documented here.

## 0.1.0

Initial deploy-ready web desktop prototype.

### Added

- Browser-based desktop shell with wallpaper, desktop icons, taskbar, system tray, Start menu, boot screen, and lock screen.
- Start menu power menu with lock, restart, shut down, and power-on simulation.
- Draggable, resizable, minimizable, maximizable, persistent app windows.
- Edge window snapping with visual preview and `Ctrl+Alt+Arrow` shortcuts.
- Window titlebar system menu with restore, move-to-center, minimize, maximize, and close actions.
- Run dialog for app commands, classic aliases, install prompts, and Web Surf URL/search handoff.
- Persistent pinned taskbar apps with right-click pin/unpin.
- Taskbar hover/focus previews for open and pinned apps.
- System tray Quick settings panel with sound controls and Settings shortcut.
- Notification center history inside Quick settings with clear-all action.
- Windows-style Start menu with Pinned apps, All apps, search, and Recent file shortcuts.
- Web Surf browser app with bookmarks, history, quick links, and selectable search engines.
- Minefield game with difficulty levels, timer, flags, and best records.
- Calculator with keyboard input, standard mode, and scientific functions.
- Sketch Pad with brush, shape tools, swatches, undo/redo, PNG save, and PNG download.
- Notes with multiple files, tabs, autosave status, and Markdown preview.
- Files app backed by an IndexedDB virtual file system with open, rename, delete, ZIP export, and ZIP import.
- File extension associations in Files with Open with badges and `.url` handoff to Web Surf.
- Recycle Bin app for deleted VFS entries with restore, permanent delete, and empty actions.
- Setup Center for installing PocketDesk web packages.
- Python Lab installable app with a lightweight browser-side Python-style console.
- Code Studio installable app with explorer, tabs, editor, terminal, and HTML preview.
- Settings app for theme, wallpaper, window layout, icon layout, and system sound controls.
- Original generated wallpaper set and custom PocketDesk brand icons.
- PWA manifest, service worker, and install icons.
- Public sharing metadata, `robots.txt`, `llms.txt`, and generated social preview image.
- Vercel and Netlify static hosting configuration.
- GitHub Pages deployment workflow with automatic Pages base path handling.
- Release readiness check command for GitHub/deploy-critical files and docs.
- GitHub Actions CI workflow and Playwright smoke QA command.

### Notes

- PocketDesk OS does not run native Windows `.exe` installers inside the browser.
- Setup Center links to official Python and VS Code desktop download pages, while PocketDesk-installed apps run as browser-native web apps.
- Browser state is local to the device through `localStorage` and IndexedDB.
