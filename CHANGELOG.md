# Changelog

All notable changes to PocketDesk OS are documented here.

## Unreleased

### Added

- **스티커 메모.** A Sticky Notes app: each window is one note in five colours, titled after its first line, and the notes live in shell state so they survive a reload and reopen with the windows that showed them. 새 메모 opens another window holding a different note; 메모 삭제 removes the note and its window together.
- **Picture files show their picture.** A `.canvas` drawing with pixels renders those pixels as its icon — on the desktop, in Explorer's rows and in its large-icon view — letterboxed rather than cropped, so a sketch in a corner still shows.
- **The snap preview is a picture of the window.** Dragging a window to an edge shows that window, scaled into the space it will take, instead of an empty tinted rectangle — and Snap Assist's candidates show the windows themselves too.
- **A 사진 window is named after the picture it opened.** Its title fell back to 그림판's document until the window reported itself, so the toast's 열기 briefly showed "QA 그림.png - 사진" over the screenshot it had just opened.
- **A screenshot notification carries the screenshot.** The toast shows the picture it just saved. The notification centre's copy keeps the words only: a screenshot is a megabyte of data URL, and three of them overflowed the persisted history — the failed write threw inside a React effect and took the rest of that commit's work with it (the toast's 열기 opened the wrong picture). That write can no longer throw either.
- **The Start menu's 추천 shows pictures.** A drawing or a screenshot appears as itself in the recommended list.
- **The tray calendar dots the days an alarm rings.** Picking such a day lists the times instead of "일정 없음".
- **절전.** The Start menu's power menu gains 절전: the display goes dark and stays dark until a key, a click, or — after a moment — a pointer move; the lock screen comes back, as on Windows.
- **Alt+Tab pictures are clickable.** Clicking a window's picture in the switcher switches to it, the way the Windows switcher allows.
- **The lock screen shows your wallpaper.** A picture set as the desktop background is the lock screen's background too.
- **The recycle bin looks full when it is.** The desktop icon changes when something is in the bin, and its name says how many items.
- **바탕 화면 배경으로 설정.** A picture file — a drawing, a screenshot — becomes the wallpaper from Explorer's right-click menu, the desktop icon's menu, or 사진's toolbar. Only the file's id is kept; the pixels come from the file, so deleting it (or picking a preset in 설정) puts the preset back. 설정 shows when a picture is in use and offers 기본 배경으로.
- **Real screenshots.** PrintScreen pictures the desktop — the live DOM serialized into an SVG and drawn onto a canvas, wallpaper and drawings included — and saves the PNG into 사진 as `스크린샷 2026-09-03 143012.png`, with a toast whose 열기 opens it in 사진. Alt+PrintScreen pictures the active window alone. 캡처 도구 (Win+Shift+S, or `snip` in 실행) is the button for keyboards without PrintScreen: whole screen or active window, an optional 3/5-second countdown, a preview, 사진 앱에서 열기 and 복사 to the clipboard. The tool never appears in its own picture. What an SVG image cannot draw — backdrop blur, scrolled-away content — is the one difference from the screen.
- **Aero Shake.** Grab a title bar and shake it side to side (three quick reversals) and every other window on the desktop minimizes; shake again and they come back. A slow zig-zag while placing a window, or pointer jitter, does not count.
- **Task View drags windows between desktops.** A window card can be dragged onto a desktop thumbnail to move it there; the desktop lights up as a drop target. The 이동 select stays for keyboard and assistive tech.
- **Explorer's details pane previews text.** Selecting a text file shows its first 14 lines under the file's details, the way the Windows preview pane does; pictures already showed their pixels there.
- **Aero Peek.** Resting the pointer on a window's taskbar thumbnail shows that window alone, in place, with every other window faded to a ghost — a minimized one comes back to its spot for the look. Resting on the show-desktop strip at the right end of the taskbar fades every window so the desktop shows through; a press still toggles show desktop.
- **창 계단식 배열 · 창 위아래 정렬 · 창 나란히 정렬.** The taskbar's right-click menu arranges the visible windows of the current desktop the way Windows does: cascaded one title bar apart with the front window in front, stacked into rows, or tiled side by side into columns (a grid past three), edge to edge with no overlap. Minimized windows and other desktops are left alone.
- **Window previews are pictures of the windows.** The taskbar hover card, Alt+Tab and Task View show each window itself — a scaled, inert clone of the live frame with its typed text, drawn pixels and scroll position — where an app icon used to stand in. The taskbar card lays out title-over-picture per window and refreshes while it is up; a window on another virtual desktop keeps the icon.

### Fixed

- **The runtime-audit gate survives a registry outage without going blind.** `npm audit --omit=dev --audit-level=high` calls an endpoint npm is retiring; it answered 503, then 400, then 500, then an HTML error page, and CI failed on all of them. The gate now reads `npm audit --json` and tells the two cases apart: a high or critical advisory fails the build, and a transport failure is reported as skipped, in as many words, rather than passing quietly.

- **A window comes back the way it left.** Restoring a minimized window — from the taskbar, Alt+Tab, show desktop, or a second Aero Shake — unfolds it from its taskbar button, the minimize animation played backwards.
- **A window minimizes into its taskbar button.** The minimize animation flies towards the app's button, as Windows folds a window away, instead of sinking in place.
- **새 데스크톱 no longer switches to the new desktop.** Task View creates it and stays where you are, as Windows does — switching moved you away from the windows you were about to drag over.
- **The taskbar preview card no longer closes when the pointer enters it.** The app button listened with mouse events and the card with pointer events; pointer events dispatch first, so the card's "stay open" ran before the button's "hide in 220ms" was armed, and the card vanished under the pointer every time — its close and switch buttons were unreachable by mouse. Both sides use pointer events now.
- **Pressing the desktop takes focus off the windows.** Like Windows, a click on the bare desktop or one of its icons deactivates the foreground window — its title bar goes quiet, its taskbar button stops being current, and Ctrl+V, Delete and Enter address the desktop while windows stay open. Clicking the window or its taskbar button gives it back; closing or minimizing the active window hands focus to the next window instead of the desktop.

## 0.13.0

The round where the desktop learned to be touched, heard, and measured. Every behavior below was verified in a real browser — and for the performance work, against numbers taken before and after, on the deployed site as well as locally.

### Added

- **Toasts that answer back.** Notifications carry buttons the way Windows toasts do: clicking one runs its action and dismisses the toast, a toast asking a question stays up longer than one stating a fact, and the timer waits while the pointer or keyboard focus is on it. The first user is the alarm — 다시 알림 (5분) re-arms the ring five minutes out whatever its weekly schedule says, and it works with the clock window closed because the handler lives in the shell scheduler that fired it.
- **cmd's power verbs.** `shutdown /s`, `/r`, `/l` and `logoff` route through the exact same paths as the Start menu's power buttons, so unsaved work still gets its question first.
- **Touch that operates the desktop.** Measured on a phone-sized touch-only browser: the title bar owns its touches (a drag used to move a window −8px before the browser reclaimed the gesture), a half-second hold is the touch right click everywhere a context menu exists, and the narrow-screen taskbar no longer pins its tray over the app buttons where taps could not reach it. Resize handles, double-tap open, Paint touch drawing and the volume slider all measured working.
- **Windows named per window.** Two windows of one app finally sound different: Explorer is titled after its folder, Edge after its page, the prompt after its working directory, and Alt+Tab, Task View, the taskbar preview and the title bar all use that per-window name. The accessible name of every window frame is its real title.

### Fixed

- **Accessibility, three audits deep.** An axe sweep across twelve shell states ends at zero violations. A screen reader now hears Alt+Tab cycle and the keyboard move/resize mode (both used to mount their live region together with its text, which most readers ignore), can read the time off the tray clock (its label had hidden the clock), and is told when the maximize button will restore instead. Notepad's menu bar moves focus into its menus; the Start menu's power submenu joins the Escape hierarchy and takes focus on open; minimizing hands focus to the app's taskbar button instead of dropping it on the page; the taskbar preview card survives Tab entering it. Desktop icon labels over a photo wallpaper measured 1.77:1 and now carry a dark outline shadow; the near-white Run and rename fields wear a dark focus ring; and the taskbar's window-count badge had been hidden by its own parent's rule.
- **Sixty synchronous writes a second.** Dragging a window ran a JSON.stringify + localStorage write on every pointermove (61 per 60-move drag); dragging a file icon re-encoded every file's content and rewrote the entire IndexedDB store per move (60 database opens). Both persist once per pause now, with a pagehide flush, and the VFS write queue coalesces a burst into a single write of the newest snapshot. The debounce is allowed for icon geometry only — the release gate itself proved why, when an Explorer copy vanished under a reload inside the window; structural changes write immediately.
- **A dragged window re-rendered every other window.** The shell had no React.memo anywhere and re-created 33 of every app's props each render. Each window now renders through a memoized slot whose props are reference-stable: a MutationObserver on a non-dragged window records 0 mutations for a whole drag. The frame time turned out to be the other windows resampling their backdrop blur under the moving one — the blur pauses for the gesture (a `:has()` attempt measured worse than nothing) — taking the four-window p95 from 24ms to 17ms locally and 10.5ms on the deployed site.
- **The reader view's Markdown stack left the initial bundle.** Roughly a quarter of shipped source served one view most sessions never open; it loads lazily now (main bundle 192 → 158 kB gzip). The service worker learns every emitted asset from the build itself, so the split chunk is precached and imports offline — the PWA gate verifies that with the network switched off.

### Testing

- 780 unit tests across 30 files — new suites for the toast action row, snooze semantics, the shutdown command, the memo boundary (a parent re-render with equal props renders an app zero times), the write coalescer (a 100-call burst performs at most two writes), the geometry-only persist rule, per-window titles in Task View, and preview-card focus retention. The smoke suite gained a touch-only section, a shell-fired-timer scenario, jump list, world clock, downloads, the shortcut wizard, `shutdown /l`, and two Explorer windows carrying two names; the PWA gate asserts the split chunk is cached and importable offline.

- **The release gate itself caught one more round.** A pre-tag review and runtime audit found: a failed reader chunk load unmounting the entire desktop (now confined to the reader view, with retry); a window vanishing mid-drag leaving its listeners, the snap preview and every window's paused blur stuck; a transient VFS read failure being followed by the defaults overwriting the user's files (writes are sealed after a failed read); a folder created in the same tick as a reload never reaching a transaction because every write opened the database first (the connection is held for the page's lifetime, and the app's own PWA-update reload waits for the in-flight write); a toast held forever after being pushed out by the cap; a long-press click suppressor that could eat the next tap; and a preview card that still refused the pointer. All fixed and re-measured before this tag.

## 0.12.0

The round where the shell learned to keep time and to remember what you use. Every behavior below was measured in a real browser before shipping — the headline measurement: an alarm set with its app window closed rang 387ms after its minute, on the deployed site.

### Added

- **알람 및 시계** — built as a shell service, not a window feature. Alarms and the timer live in shell state as absolute deadlines and a shell scheduler fires them whether or not the app window exists; both survive a reload, a deadline that passed while the tab was closed is delivered as 놓친 알람, and nothing rings on the lock screen or after power-off — it waits for unlock. Alarms repeat on weekdays (one-shot otherwise, exactly like Windows), the timer pauses where it stands and refuses length edits mid-run, the stopwatch keeps centiseconds and 플래그 laps, and 세계 시계 does real timezone math through Intl — London is -8시간 in August and -9시간 in January without a hand-maintained offset table.
- **Taskbar jump lists** — right-clicking an app button lists the documents that app would open, newest first, grouped by the same rule a double-click uses (the file-type default app wins). Recency is real use: the shell stamps every open, so picking a document moves it up, while a terminal-written file still surfaces before anyone has opened it.
- **다운로드, and Edge that can fill it** — a fourth system folder that old profiles gain automatically (backdated, so a 만든 날짜 sort doesn't lie about its age). Edge's 페이지 다운로드 saves the reader view's actual content as Markdown — which Notepad's preview renders — or, outside reader view, the address as a .url shortcut, because a cross-origin frame can't honestly be saved as anything else.
- **새로 만들기 > 인터넷 바로 가기** — the desktop wizard, validating to http(s) before anything is written. The same rule now guards the write side of every shortcut: a target the shell would refuse to open is refused at creation.
- **Start search that says where files live** — results show the real folder chain (텍스트 문서 · 바탕 화면 > 문서), the chain itself matches, and the 바탕화면 keyword stopped returning the whole disk.

### Fixed

- The scheduler fired on the lock screen and with the power off — a sound over a black screen, the toast under the gate, the alarm consumed. It waits now.
- Editing a disabled alarm's time armed it, per keystroke, at intermediate times the user never chose. Rescheduling preserves the on/off state.
- The clock app's inputs killed the global focus ring the stylesheet documents as load-bearing; stopwatch flags renumbered themselves past the 99-lap cap; the display tick kept building Intl formatters in minimized windows — ring restored, laps carry their own numbers, formatters cached and the tick stops while hidden.
- Opening a file honored the default-app override for choosing the app but not the document pointer — a txt defaulted to the terminal silently swapped Notepad's open file. Only the app that actually opens moves its pointer. The terminal's own `echo x > 파일.txt` did the same document-yanking with a toast per redirect; it writes silently now, like cmd.
- A web page's title becomes a filename through one shared sanitizer that also strips control and bidi-override characters, and a reader download over 2MB is refused instead of wedging the whole VFS behind its shared quota. While the reader is still fetching, the download button waits instead of silently saving a .url.
- Smoke assertions that hardcoded Explorer row counts broke the day a fourth system folder existed; they measure the live list now.

### Testing

- 763 unit tests across 27 files — new suites for clock scheduling and the timer state machine, world-clock timezone reads against fixed instants, repeat-day scheduling across the week wrap, jump-list grouping and recency, recent-opens capping, the VFS hierarchy migration (including the upgrade path that adds 다운로드 to existing profiles), filename sanitizing, and shortcut-target validation. The smoke suite pins the shell-fired timer with its window closed, the jump list opening a document, the world clock rendering a live reading, Edge's download landing where search can find it, and the shortcut wizard refusing ftp://.

## 0.11.0

Two behavioral audits and two adversarial reviews, every finding reproduced in a real browser before the fix and re-measured after. The theme: gestures that existed but produced the wrong result, state the shell forgot, and readouts that reported numbers nothing computed.

### Fixed

- **The shell could crash itself.** A window-growth request that could never be satisfied — a maximized Minesweeper asking for room — looped React past its update depth and the error boundary replaced the whole desktop. The session, not a document, was the blast radius.
- **Two windows of one document destroyed each other's work.** The taskbar's new-window paths opened a second Notepad on the same shell-level note, and one window's 850ms autosave overwrote the other's unsaved text with no prompt. Multi-instance is now declared per app and only where per-window state is genuinely window-local.
- **Paint had no idea its work was unsaved.** Closing the window, switching virtual desktops, or the photo viewer's 편집 swapping the document all discarded the drawing in silence. It now tracks dirty state, flushes on the way out, registers the shell's close guard, and the page warns before unload while any window holds unsaved work.
- **Notepad lost the last 850ms of typing** when the reader switched documents inside the window — the autosave timer had not fired and the incoming document replaced the text. The outgoing document is flushed first.
- **Every subtraction in the calculator answered Error.** The tokenizer read the minus as a sign because the left operand was still in the digit buffer. `%` divided the whole expression by 100 instead of reading the pending operand; 1/x, x² and √ had the same fault; standard mode applied operator precedence Windows reserves for the scientific one (`2+3×4` is 20 there, not 14); every fault printed the single word "Error".
- **Alt+Tab could not reach most windows.** Focusing on every press re-sorted the candidate list, so Tab bounced between the two newest windows however many were open. The order now freezes for the hold and commits on release — and the idle timer that self-committed after 1.2 seconds is gone; only losing the page commits early.
- **Snapped windows did not survive a resize or a reload**, coming back 8px inside their own edges and 18px short of the taskbar, and every window drifted 2px when a control near the screen edge took focus. Restoring a maximized window teleported it; the window controls' pointerdown was being read as a drag.
- **The keyboard could not do what the mouse could.** Alt+Space existed nowhere; 이동/크기 조정 did not exist at all, and the resize handles are hidden from assistive technology — a keyboard user could not move or resize a window, period. Both exist now, arrow-driven, Enter to commit, Escape to put the window back, and the mode's keys are taken in the capture phase so an app that binds Escape cannot swallow the cancel. Desktop icons and the taskbar are one tab stop each with arrow movement; Tab in Notepad inserts a tab instead of walking onto the taskbar; Ctrl+A works on a Mac; Paint answers Ctrl+Z/Y; the photo viewer answers Delete; Task Manager ends the selected task with Delete; the registry answers Delete/F2/F5.
- **The Event Viewer was a live mirror wearing a log's clothes.** Closing a window deleted its "process started" record; maximizing one rewrote the text of an event claiming a past timestamp; the 보안 channel could never fill. The shell now keeps an append-only, size-capped, persisted log: window open/close, logon, lock, power-off.
- **다시 시작 and 시스템 종료 left every app running.** Both now close every window through the same guards the ✕ uses, so unsaved work gets its question first — and the question appears on top of the desktop, not under the Start menu that asked it.
- **The shell forgot which desktop you were on and what it had told you.** The active virtual desktop and the notification backlog now survive a reload; the action centre renders everything its own header counts; a badge on the tray clock says notifications arrived.
- **Readouts stopped inventing numbers.** Task Manager showed two CPU figures for one moment and a process table frozen since mount; the tray volume slider was a mute toggle that sprang back from any value; the lock screen ignored the 24-hour clock setting; the lock screen and Start menu showed a name baked into the build instead of the 설정 account name; Paint's zoom claimed 100% while rendering at 71% — and silently rescaled with the window. The photo viewer went blank after a round trip to Paint; its title bar named the first photo forever; its counter claimed `1 / 1` of an image it was not showing.
- **Explorer grew up.** Column headers sort (크기 included), type-ahead jumps, Home/End and Shift ranges select, a cut item dims, F2 preselects the base name instead of the extension, forbidden filename characters are refused with the Windows error, the file menu no longer opens 속성 under the taskbar, and ↓ in icon view moves down instead of sideways.
- **Edge had no tabs and a habit of blank pages.** The tab strip was one hardcoded tab; tabs are real now, each with its own address, view mode and history. A frame blocked by the site's own policy fires no error event, so the recovery offer appears on its own — at the bottom, dismissible per address, instead of covering pages that rendered fine.

### Added

- Task View cards carry the window's title over a proportional placement preview, and close their window in place.
- The taskbar hover preview is interactive: one entry per window, switch or close from the card. A jump-list 새 창 and middle-click open another instance of multi-instance apps.
- Paint gained the two tools it was half made of — an eraser and a scanline paint bucket — plus a zoom anchored to the bitmap. Photo rotation is written into the file, as the Windows viewer saves it.
- The Start menu's 고정됨 is a real, persisted list: unpin from a tile's menu, pin from 모든 앱. Search finds apps by the names people type (`notepad`, `mspaint`); 설정 검색 shows results without hiding the navigation.
- The desktop makes folders from 새로 만들기, moves a whole multi-selection in one drag, extends selection with Shift, and 새로 고침 re-snaps to the grid it claims to keep.
- 창 배치 초기화 restores geometry instead of ending every process it could find.

- **The release gate itself caught one more round.** A pre-tag review and runtime audit found: Shift+Tab deleting the selected text (unrecoverable, autosave pending); Paint stretching the portrait file a rotation had just written; rotations racing themselves; save prompts asked of minimized windows rendering invisibly, so Task Manager's 작업 끝내기 looked like it did nothing; an unguarded event-log write that let a storage-quota failure take down the desktop; the volume slider never reaching playback and fresh profiles booting muted; the Start tile menu displaced and clipped by its own containing block. All fixed and re-measured before this tag.

### Testing

- 710 unit tests across 23 files (calculator, Task View, event log, flood fill, and Notepad Tab suites are new), plus browser-measured smoke assertions for each behavior above. Two CI-only failures were both test nondeterminism — a drag test that trusted collation order, a role query that raced a hover card's grace timer — fixed by naming targets exactly.

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
- The service worker served `/assets/` cache-first and never revalidated, while `activate` evicted only caches with a different _name_ — and that name was a hand-edited constant. A single cache write would have been served forever, offline included, outliving the fix to whatever caused it. The build now stamps a per-deploy id into the cache name.
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
