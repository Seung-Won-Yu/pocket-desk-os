# Changelog

All notable changes to PocketDesk OS are documented here.

## 0.4.0

One shared clipboard, a Photos viewer, taskbar search, Settings that change real behavior, two system apps built on the desktop's own data, and the first component tests.


### Added

- One system clipboard shared by every window, replacing the separate Explorer and desktop clipboards, plus cut alongside copy and `Ctrl+C` / `Ctrl+X` / `Ctrl+V` / `Ctrl+A` on the desktop.
- Photos, a viewer for image files, with prev/next, zoom and fit-to-window, rotation, rename, and delete. Double-clicking a PNG opens it instead of Paint.
- A taskbar search field driving the same query as the Start menu.
- Settings sections that change real behavior: 계정 sets the user name the lock screen and `%USERNAME%` read, 시간 및 언어 switches the clock to 24-hour, and 앱 assigns the default app per file extension.
- Event Viewer, building its log from the VFS's own timestamps and the open-window list.
- Registry Editor, reading and writing the real `localStorage` the desktop stores its settings in.
- `Win+M` to minimize every window and `Win+L` to lock.
- jsdom and Testing Library, so components can be rendered in tests.

### Fixed

- Paint's Save As and Open, and Notepad's tabs and Open, routed through the file-type association, so saving a PNG in Paint would have handed the user to Photos. They now select the entry in place.
- The Start menu's pinned grid capped at nine apps, silently dropping apps as the catalog grew.
- Photos committed a rename twice when confirmed with Enter, because moving focus blurred the still-mounted input and re-entered the commit.

## 0.3.0

Shell scripting over the virtual file system — variables, wildcards, pipes, and batch files — and the last untested module brought under test.

### Added

- Shell environment variables: `set NAME=value`, `set NAME=` to clear, bare `set` to list, and `%NAME%` expansion, alongside built-in `%CD%`, `%USERNAME%`, `%COMPUTERNAME%`, `%DATE%`, `%TIME%`, and `%USERPROFILE%`.
- Wildcard arguments (`*`, `?`) for `dir`, `del`, `copy`, and `move`. File commands never sweep folders into a match.
- Pipelines: `dir | find memo`, with `find`, `findstr`, `sort`, and `more` as downstream filters.
- Batch files: run a stored `.bat` by name or with `call`. Each line executes on its own commit, so it sees what the previous line wrote to the file system.
- `^` escaping so `>` and `|` can be written literally, which is what makes a batch file able to create files.
- Unit tests for the IndexedDB snapshot validator, previously the only untested module.

### Fixed

- `persistVfsEntries` threw synchronously when validation failed, so the caller's `.catch()` never ran and a storage-limit breach surfaced as an unhandled error instead of a notification.
- `rd` and `rmdir` now accept a folder; `del` keeps cmd's file-only behaviour.

### Changed

- The snapshot validator counts content bytes with a shared `TextEncoder` instead of allocating a `Blob` per entry on every save.

## 0.2.0

Desktop shell split into modules, a working command prompt, task manager, and virtual desktops, plus the project's first automated unit tests.


### Added

- Command Prompt: a working shell over the IndexedDB file system with `dir`, `cd`, `type`, `echo` redirection, `md`, `del`, `copy`, `move`, `ren`, `tree`, `find`, `start`, `tasklist`, `taskkill`, and `systeminfo`, plus command history and Tab completion.
- Task Manager with a per-window process list, End task, and CPU and memory graphs.
- Virtual desktops with Task View (Win+Tab), desktop switching (Win+Ctrl+Left/Right), and moving windows between desktops.
- Quarter snap layouts and Win+Arrow stepping from half to quarter to maximized.
- Eight-edge window resizing.
- Right-click shell menu on the taskbar and Start button.
- Ctrl+Shift+Esc for Task Manager and Win+I for Settings.
- Vitest unit tests for the file system model, ZIP backup, format helpers, and shell logic.
- ESLint and Prettier, wired into CI alongside the unit tests.
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

### Changed

- Split the desktop shell out of `App.tsx` into `src/shell/`, cutting the file from 5365 to about 2100 lines.
- Moved `typescript`, `vite`, and `@vitejs/plugin-react` from dependencies to devDependencies.
- Notepad's Markdown preview is now reachable from the View menu and defaults on for `.md` files.
- Replaced File Explorer's type-filtered locations with a real parent-child folder hierarchy.
- Grouped folders before files and localized file type labels to match Korean Windows Explorer.
- Extracted every built-in app into an independent feature module.
- Reduced `App.tsx` to focus on the desktop shell, window management, and shared application state.
- Moved app metadata, wallpaper data, format helpers, and shared types into owned modules.
- Upgraded the service worker to precache production bundles and wait for user-approved updates.

### Fixed

- Serialized IndexedDB writes with atomic transactions, schema metadata, migration indexes, and failure reporting.
- Hardened ZIP restore against malformed headers, unsupported compression, invalid UTF-8, duplicate entries, oversized data, and CRC mismatches.
- Prevented service worker activation from deleting unrelated origin caches.
- Applied the 48-character name cap before the uniqueness check, so a truncated candidate can no longer collapse back into the name it was avoiding, and no longer cuts into the file extension.
- Stopped name truncation from splitting a surrogate pair and leaving a broken character.
- Guarded `clampWindowSystemMenuPosition` against non-finite coordinates, matching its sibling clamp helpers.
- Kept one null entry in persisted window state from discarding the whole restored session.
- Stopped the Run dialog from treating an unregistered program name such as `winword.exe` as a web address.
- Removed the hardcoded nine-app limit that kept newly added apps out of the Start menu's pinned grid.
- Made `echo text > sub\file.txt` and `md a\b` honour the folder part of the path instead of writing into the current directory.
- Let `rd` and `rmdir` delete a folder tree; they previously refused every folder, while `del` keeps cmd's file-only behaviour.
- Fixed folders created from the shell keeping the name "새 폴더", because the follow-up rename could not see the entry it had just created.
- Fixed Task View swallowing its own clicks: the desktop's rubber-band selection captured the pointer before the button received it.

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
