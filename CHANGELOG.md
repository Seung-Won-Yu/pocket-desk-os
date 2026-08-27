# Changelog

All notable changes to PocketDesk OS are documented here.

## 0.10.0

Every finding from a behavioral audit that drove the real app and measured element geometry, plus a shipped regression.

### Fixed

- **Hiding a window destroyed everything its app held.** A minimized window returned null, so React unmounted the app. Measured across per-window minimize, `Win+M`, `Win+D` and a virtual-desktop switch: an unsaved Notepad draft, the calculator's display, 22 lines of terminal scrollback, 62 revealed minefield cells and 1481 painted pixels were all gone on restore. `Win+D` is meant to be a peek.
- **Closing Notepad discarded typed text with no prompt.** `closeWindow` now consults a per-window guard an app can register, so the ✕, Alt+F4, the window system menu and Task Manager's 작업 끝내기 all ask first.
- **Trusted Types broke the service worker**, which shipped in 0.9.0 — `register()` takes a script URL, so offline support was lost entirely. The URL now goes through a policy that vouches for this origin and this path only.
- **Settings clipped 86px with no way to scroll**, on the section shown at first open. Its grid grew past the window's content box, so the content pane never had a bounded track. Overflow is 0 and the pane scrolls.
- **The resize borders were dead.** `overflow: hidden` on the frame clipped the outer half off every handle: measured, only a 3px band strictly inside the frame responded, and 1px outside fell through to the desktop. The live band now straddles the border.
- **One shared 320×240 floor let apps be shrunk past their own UI** — the calculator lost its entire keypad with no way to reach it. Each app declares its own minimum.
- **Explorer's details view scrolled horizontally out of the box** and its column header could not follow, stranding labels over the wrong columns while filenames were sliced. Columns are flexible now: 470/525 became 718/718. The preview pane is off by default, as in Windows.
- **Both Explorer context menus landed 53px from the pointer**, and could be drawn past the viewport entirely — they are `position: fixed`, but the frame's `backdrop-filter` makes it their containing block.
- **The minefield resized as cells were revealed**, because its grid rows were implicit.
- **Chrome's own context menu appeared inside app content** — the Notepad editor and the Explorer file-list background and status bar. Nothing breaks the illusion faster.

### Added

- Notepad gained 실행 취소 with a real history (the controlled textarea had no native undo stack), 찾기 with match counts and F3 stepping, and a proper right-click menu.
- Explorer gained a folder-background menu and Backspace to navigate up.
- `npm run qa:all` runs every gate in one command, so a partial local check cannot stand in for a full one — which is how the Trusted Types regression reached a release.

## 0.9.0

Everything GitHub Pages can still enforce, plus two visible bugs.

### Fixed

- The minefield resized as cells were revealed. The grid declared columns but left rows implicit, so a row showing a number grew taller than an empty one; measured before the fix, revealing a cell split cell heights into 25.3px and 47.7px.
- Reader mode replaced a page silently. A site that sends `X-Frame-Options` cannot be shown in a window by anyone, so the text-only fallback read as a broken render. It now says the page could not be framed and offers the original in a real tab.
- Every GitHub Actions `uses:` named a moving tag. A compromised action release would have run inside the Pages job, which can publish to the live origin, and could have rewritten the bundle after it was verified. All are pinned to commits, and the release check fails on any mutable ref.
- The Pages workflow granted `pages: write` and `id-token: write` workflow-wide, so the build job — which runs npm lifecycle scripts and third-party actions — held a token that can publish. Those scopes now belong to the deploy job alone.

### Added

- `require-trusted-types-for 'script'` in the CSP, which turns every string-to-DOM sink into a runtime error. Verified across all fourteen apps with no violations.
- A CI gate on runtime dependency advisories, with dev-toolchain advisories reported but not blocking, since a build-tool finding never reaches the browser.
- `<meta name="referrer">` for parity with the header hosts get.

## 0.8.0

A security pass over the whole app, from an adversarial audit.

### Fixed

- Reader mode sent the full target address — query string, fragment and any embedded credentials — to a third-party proxy, and selected itself automatically for github.com, notion.so, openai.com and others. Opening an invitation or reset link in the Edge app therefore leaked its token. The reader URL now carries only scheme, host and path, and reader mode is never auto-selected for an address whose query would be handed over.
- The iframe granted `clipboard-read` and `clipboard-write` to every site browsed to. Chrome auto-grants the write, and attributes the read prompt to the top-level origin, so the user would see PocketDesk asking to read their clipboard. The `allow` list is gone.
- `allow-same-origin` is gone from the iframe sandbox. A load-time origin check cannot see a frame navigating itself to this origin afterwards, because the app can never read a cross-origin frame's location. Without the flag the frame is an opaque origin and the escape is impossible. `allow-downloads` and `allow-modals` went too.
- The service worker served `/assets/` cache-first and never revalidated, while `activate` evicted only caches with a different *name* — and that name was a hand-edited constant. A single cache write would have been served forever, offline included, outliving the fix to whatever caused it. The build now stamps a per-deploy id into the cache name.
- Every URL reaching an `href`, an image `src`, a navigation or the proxy passes a shared http(s) check. Stored bookmarks and history entries are dropped on load if their URL is not http(s), since the Registry Editor exposes those keys for editing.
- The CI workflow ran pull-request code with the repository's default token scope; it now takes `contents: read`.
- The dev server had no CSP, which made the build with real file access the weaker of the two.

### Added

- `frame-ancestors`, COOP, `Permissions-Policy`, `Referrer-Policy`, `nosniff`, `X-Frame-Options` and HSTS on Netlify and Vercel, generated from one definition the release check verifies has not drifted. GitHub Pages cannot set headers, so the app refuses to mount inside a frame instead.

### Notes

- CSP is not an exfiltration boundary here and is documented as such: the reader proxy fetches whatever URL it is handed, and no shipping browser directive restricts top-level navigation. The real defences are preventing code execution and not admitting sensitive data in the first place.

## 0.7.0

Closes two real security holes in the deployed site, and brings actual local files into Explorer on the developer's own machine.


### Added

- Import a real folder from the machine into Explorer, and write a folder's contents back out to disk. Gated to `localhost` — the deployed site never offers it, because the browser's permission prompt protects a granted handle from other sites but not from this app being compromised. The import skips credential-looking names, key stores and build directories, and caps item count, bytes and depth.
- A Content Security Policy on the production build. The deployed site previously had none.

### Fixed

- The Edge frame could escape its sandbox. `allow-scripts allow-same-origin` is safe for a cross-origin site, but GitHub Pages puts every repo of an account on one origin, and the Edge start page links to a sibling project there — a same-origin frame holding both flags can reach `parent.document`, delete its own sandbox attribute and take over this app's origin, files and permissions. Same-origin targets are no longer framed.

## 0.6.0

Completes the accessibility pass: every menu, grid and tab strip now behaves the way its ARIA role promises.


### Fixed

- `role="menu"` was used in 14 places with no arrow-key handling, which is worse than a plain button stack because a screen reader switches to form mode and passes the arrows through to nothing. A shared helper now supplies arrow, Home and End movement to every menu.
- Task Manager, Event Viewer and Registry Editor put a tab stop on every row; ten open windows added ten tab stops. Each grid is a single tab stop with the active row roving.
- Explorer's `role="listbox"` had N+1 tab stops, since both the container and every item button were focusable.
- Moving a desktop icon into a folder was pointer-only. The icon's context menu gained a 폴더로 이동 submenu.
- The Notepad and Task Manager tab strips declared `role="tablist"` without `aria-controls`, a `tabpanel`, roving tabindex, or Left/Right movement.
- Removed a redundant tab stop on the This PC content pane.
- The minefield placed every cell directly under `role="grid"` with no `role="row"`, and made each cell its own tab stop — 480 Tab presses to cross a hard board.
- Edge's settings flyout held a `<select>` inside `role="menu"` and used `aria-pressed` on `menuitem`, and had no Escape, outside-click close, arrow navigation or focus return despite its role.
- Two Edge live regions carried only an `aria-label`, which names a region rather than being announced as its contents, so nothing was read while a page loaded.

## 0.5.0

Snap Assist, drag between Explorer and the desktop, a keyboard-accessibility pass, and image storage that no longer pays the base64 tax.

### Added

- Snap Assist: snapping a window to one half offers the remaining windows on the other.
- Dragging in both directions between Explorer and the desktop.

### Changed

- Images are stored in IndexedDB as raw bytes rather than a base64 data URL, cutting their stored size by about a third. The conversion is confined to the storage boundary, so the model, the ZIP backup, and every app still see a data URL.

### Fixed

- The Start button listened on pointerdown only, so it could be focused but never activated from the keyboard; and focusing the taskbar search field opened the Start menu, which then stole focus.
- Escape did not close Task View or Snap Assist, neither of which let focus enter at all.
- Task Manager rows, Recycle Bin rows, and the This PC drive tile could only be opened by double-click.
- A focused control usually showed nothing: 44 rules cleared the focus outline and replaced it with a tint matching :hover, and in five places matching .is-selected. Minefield cells had no focus style at all.
- Menus and dialogs dropped focus to the page body when they closed instead of returning it to whatever opened them.
- Four modals declared aria-modal without trapping Tab or handling Escape.
- aria-selected sat on roles that do not support it in five places, and role="status" containers re-announced their whole contents on every change.

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
