# Changelog

All notable changes to PocketDesk OS are documented here.

## Unreleased

### Added

- **주소 표시줄의 ">" 로 옆 폴더로 (그리고 Ctrl+Shift+N, Alt+Enter).** Windows turns each separator in the address bar into a way sideways: the chevron after 바탕 화면 lists what is inside 바탕 화면, so you reach a sibling of the folder you are in without walking back up first. The crumb that is on the current path carries a check. Measured: standing in 바탕 화면 > 문서, the chevron listed 게임 · 다운로드 · 문서 · 사진, picking 사진 moved the window straight there, and Escape closed the menu without moving anything.

  The menu hangs off the address _row_, not off the address bar, and is anchored at the chevron's measured offset — the bar clips its crumbs so a long path does not spill, and that clipped the menu out of sight entirely on the first try (it was in the DOM and readable, and invisible on screen). The smoke asserts the menu's box lies inside its window, which is the thing a text assertion could not have caught.

  Two chords Windows has and this did not: **Ctrl+Shift+N** makes a folder in the current folder (measured 5 rows → 6), and **Alt+Enter** opens 속성 for the selection. Both are in 설정 → 키보드 단축키 now, which reads from the same list the shell listens to.

- **파일 내용 검색 (탐색기, 시작 메뉴).** Windows Search reads an indexed text file, not only its name. Typing 둘째 into Explorer's box now finds `스모크.txt`, whose name contains no such word, and the row says why: the line the word was found on, under the name, with the word marked. The status bar reads 하위 폴더와 파일 내용까지 검색. 시작 메뉴 finds it too and names the source — `일치: 파일 내용 — 다음 주 화요일 회의 준비물 정리`.

  Measured on the built app: writing `echo 다음 주 화요일 회의 준비물 정리 > 할일.txt` in 명령 프롬프트 and then searching 회의 returned that one row with the snippet `다음 주 화요일 <mark>회의</mark> 준비물 정리`, and the same word found it from the Start menu. A name match still outranks a content match (content scores 40 against the lowest name score of 64), so typing a file's name never buries it under files that merely mention it.

  Only what is honestly text is read: a note's text and where a shortcut points. A drawing's content is a data URL and a `.zip` is base64 — scanning either would match on the encoding rather than on anything a person wrote. Each file is read to a 20,000-character cap, so a folder of long notes cannot lock the keystroke that typed the query, and the snippet's whitespace is collapsed _before_ the search so the marked characters are the ones actually shown.

  Explorer had in fact been searching inside notes already — by accident. Its match fields included the row's 세부 정보 line, and for a note that line **is** the file's text; for everything else it is a canned sentence, so searching 하위 폴더를 보관 returned every folder in the tree. The description is out of the match fields now and the content is searched on purpose, which is what makes the snippet possible.

- **탐색 창 폴더 트리.** Explorer's navigation pane was five fixed shortcuts side by side, so a folder you made yourself never appeared in it however deep you were standing inside it, and nothing in the pane said where the window was. It is the file system's own shape now: 바탕 화면 as the one root — because it is the one root; 문서, 사진, 게임 and 다운로드 are its children and Windows shows them that way — with a twisty on every branch that has one. Measured on the built app: making a folder inside 문서 gave 문서 a twisty (`aria-expanded="false"`), opening it put the folder at level 3, and double-clicking into it marked that row `aria-selected` and left the pane's single tab stop on it.

  It is a real `role="tree"`: one tab stop for the whole pane, Up/Down along the rows on screen, Right to open a closed branch then step into it, Left to close an open one then step out to the parent, Home/End to the ends, Enter to go there. The twisty is `aria-hidden` and clicked with the pointer — the treeitem itself is what the keyboard drives, so there is no interactive control nested inside one.

  The pane opens onto wherever the window goes by writing the ancestors into the expansion list **once**, when the folder changes — not by forcing them open on every render. Forcing them made an ancestor of the current folder impossible to collapse: the twisty closed it and the next render opened it straight back up (measured; Left on 바탕 화면 now leaves exactly one row). Expansion belongs to the window, so two Explorer windows can be looking at different parts of the same tree. Dropping a file onto any row still moves it there, at any depth.

- **파일 바꾸기 또는 건너뛰기.** Copying or moving onto a name the target folder already has now asks, with Windows' three answers: 대상 폴더의 파일 바꾸기, 이 파일 건너뛰기, 두 파일 모두 유지. The shell used to answer by itself — it silently picked the third one. 바꾸기 takes the row already there out of the way with its whole tree, so replacing a folder leaves no orphaned children (measured against IndexedDB: zero rows with a missing parent), and it is one 실행 취소 step: Ctrl+Z brought the replaced file back **with its own id** (`note-9146e5da…` → `note-8d494407…` → `note-9146e5da…`). 취소 and Escape leave both folders exactly as they were.

  One dialog answers the whole batch rather than asking per file — Windows' own 모든 항목에 적용 comes to the same thing, and asking six times for six files would be worse than either answer. Focus lands on the dialog itself, not on a choice: each answer is one keystroke away and one of them writes over a file, so an Enter pressed out of habit does nothing and Tab reaches 바꾸기 first, in Windows' order. 명령 프롬프트 never opens it — `copy` and `move` keep both files, because a batch file must not stop on a dialog.

- **다른 폴더로 복사하면 이름이 그대로 남는다.** The copy path ran every root copy through the copy-namer whether or not anything collided, so copying `문서/notes.txt` into `사진` — a folder with no `notes.txt` at all — produced `notes - 복사본.txt`. Measured before and after in the built app: `notes - 복사본.txt` → `notes.txt`. A copy pasted into the folder it came from is still `- 복사본`, which is the one case the copy-namer was written for.

- **파일 작업 실행 취소 (Ctrl+Z) · 다시 실행 (Ctrl+Y).** One stack for the whole shell, as in Windows: a rename typed in Explorer comes back with Ctrl+Z pressed on the desktop, and both right-click menus name the operation rather than saying only 실행 취소 — 실행 취소 — 이름 바꾸기, then 다시 실행 — 이름 바꾸기 once it is taken back. Covered: 새로 만들기, 이름 바꾸기, 이동, 복사·붙여넣기, 삭제, 휴지통 복원. Measured on the built app: rename → Ctrl+Z → `web-surf.url` → Ctrl+Y → `발표자료.url` → Ctrl+Z → `web-surf.url`; 새 폴더 → Ctrl+Z removed it; a file cut into 문서 → Ctrl+Z put it back on the desktop.

  The stack holds _snapshots of the rows an operation touched_, not an inverse written by hand for each command. A move knows how to undo itself only because it remembers each row's `parentId`; recording the before and after state of the touched rows says that for every operation at once, so a file operation added later gets 실행 취소 by going through the one recorder. Rows are shallow copies, so a file's content string is shared rather than duplicated.

  What is **not** undoable is deliberate, and matches Windows: an icon dragged across the desktop, an app saving its own document, and a permanent delete. A permanent delete goes further — every step naming one of the destroyed rows leaves the stack, because putting the row back would resurrect a file the user threw away on purpose (measured: 실행 취소 — 삭제 before 휴지통 비우기, a disabled 실행 취소 after). The stack is session state, so a reload starts clean with the files where the last operation left them.

  Two things had to change to make one action one step. A multi-select delete called the single-file delete once per file, which under the new recorder would have been one Ctrl+Z per file — deleting a selection is one write now, and its toast says `3개 항목 휴지통으로 이동`. And a drop onto the desktop was a move followed by a separate patch that set `showOnDesktop`; the redo would have known about the move only, so the icon would have landed in the desktop folder with no icon. The placement folds into the move.

- **탐색기의 이름 바꾸기가 두 번 커밋하던 것.** Found while measuring 실행 취소: pressing Enter on the rename box committed the name, and the unmounting field's `blur` committed it again — one keystroke, two `이름 변경됨` toasts (measured 2, now 1). The second rename was a no-op against the already-renamed row, so it left nothing on the undo stack, but it said so twice. Enter now marks the edit as committed, the way Escape already marked it as thrown away.

- **압축(ZIP) 파일로 압축 / 압축 풀기.** Explorer compresses a selection into one archive beside it, and opening a `.zip` — double-click, or 압축 풀기 from its menu — puts the contents back into a new folder named after the archive. The archive holds the file system's own shapes: a folder becomes a directory entry, a drawing becomes its PNG bytes, a text file becomes UTF-8 — so an archive made here opens in Windows Explorer, and the toast says plainly that it is stored rather than compressed (the shell has no compressor; the archive is one file, not a smaller one). A member the shell cannot put back as a file is named and refused rather than written as something it is not, and a member whose path would escape the folder it is extracted into is refused outright — on the way in as well as the way out. A `.zip` is typed 압축(ZIP) 폴더 and belongs to Explorer, so it no longer opened in 메모장 as base64. 압축 is offered for a system folder too — it only reads what it compresses, unlike 복사 and 삭제.
- **하위 폴더까지 검색.** Explorer's search box now searches the folder and everything under it, which is the point of searching rather than reading: it used to filter only what was already on screen, so a file one folder down was invisible. Each result says which folder it is in, under its name, and the status bar says the search went deeper.
- **탐색기의 포커스가 창을 벗어나지 않는다 — 규칙 하나로.** Focus falling out of the window when the element holding it disappears has gone wrong four times now: the address bar, adding a tab, closing one, and the address bar again — the fourth found by the accessibility gate on CI, where the machine is slow enough that the frame meant to put focus back ran before the commit that removed the field. Explorer now has one rule instead of a call at each site: after any commit where focus was _lost_ — nothing, or `<body>` — it goes back to the file list. Focus that _moved_ is left alone, so clicking the taskbar is not fought. The gate's own check presses Ctrl+L and Enter back to back now, with no pause to hide the race.

- **탐색기 그룹화 (정렬 → 그룹화): 유형, 수정한 날짜.** Grouping is a second sort applied _before_ the one that is set, not a different list: rows keep their order inside a group, headings are painted where the group changes, and the keyboard still walks one array by index — so nothing about selection or the arrow keys had to learn that grouping exists. Measured: grouping by 유형 produced 파일 폴더 and 인터넷 바로 가기 headings with the row count unchanged, arrow keys still moved the selection, and 없음 left the list exactly as it was. Dates fall in Explorer's own buckets — 오늘 / 어제 / 이번 주 초 / 이번 달 초 / 오래 전, with midnight belonging to today.
- **보내기 (파일 우클릭 → 보내기): 바탕 화면, 문서, 사진, 압축(ZIP) 폴더.** Every row is something the shell can already do, so nothing is offered that would only pretend to work. It copies, as Windows' Send to does — the original stays put (measured) — and it reports once, naming the folder: sending to 문서 used to raise the generic 붙여넣기 완료 toast _as well_, two for one action. The copy operation now takes a `silent` option for callers that report the outcome themselves. The submenu opens on click rather than toggling, because the pointer that reached the row had already opened it on hover and the click shut it again.

- **야간 조명 (빠른 설정, 설정 → 시스템).** A warm wash over the whole shell, with a strength slider. Measured on the built app, as the overlay's own alpha: 0 off, **0.168** at the default 40, **0.42** at 100 — warm enough to matter, never enough to hide the screen. The strength is remembered separately from the switch, so turning it off and on again comes back where it was (measured: off → 0, on → 0.42 again). Painted as a second overlay rather than a filter on the shell root: a filter would re-raster every window on each step of the slider.
- **그림판 텍스트 도구.** A click puts a field on the canvas at that point, in the colour and at the size the letters will land in; Enter commits them to the bitmap, Escape leaves the drawing untouched, and clicking again or changing tool puts down what was typed. One undo step for the whole word rather than one per keystroke, and saving commits a field still open rather than writing a picture without it. The type size comes from the same size control the brush uses, so one slider means "how big is what I am about to put down" for every tool.

  It does **not** commit on blur, and that is the measured part: the field mounts, focuses, and the window frame takes focus back a moment later when the click that opened the field activates the window. A blur commit put half a word on the bitmap and closed the field before a key was pressed — the trace read `focusin paint-text-input` → `focusout paint-text-input` → draft cleared, every time.

- **작업 표시줄 자동 숨기기, 작은 작업 표시줄 단추 (설정 → 개인 설정).** Both are settings about the work area, and the work area is what moves: measured at 1440×900, a maximized window is 852px tall normally, **868px** with small buttons, and the full **900px** with the bar hidden. A hidden bar keeps a 2px sliver on screen — the same thing Windows leaves to aim at — and comes back when the pointer reaches that edge, when the keyboard is in it, and while anything of its own is open (a menu that outlived its bar would hang over an empty edge). Small buttons thin the bar to 32px and take the clock, the search box and the tray down with it; a side bar only goes to 48px, because the two-line vertical clock still needs the width.

  A measured curiosity, recorded because the next person will hit it: the individual `translate` property moved this element **zero pixels** while the identical offset written as `transform` moved it exactly as asked. The auto-hide slide uses `transform`.

- **폴더 속성이 폴더 크기를 센다.** 속성 called the per-entry size helper, and a folder's own size is zero — so every folder reported **0 B**, however much was inside it. It now adds up everything underneath and says what that is: `19 B` and `파일 2개, 폴더 0개` for a folder holding a shortcut and a drawing. A minimum belongs to the thing being measured; a folder's size only means anything with the tree in hand.
- **숨김 특성 (속성 → 특성).** Windows' 숨김 checkbox, and it does what it says: the entry leaves Explorer and the desktop until 숨긴 항목 is on. A system folder cannot be hidden — 문서 would leave the sidebar while every path still ran through it. Ticking the box offers 숨긴 항목 보기 in the toast, so a file is never hidden with no way back.
- **폴더 옵션 (탐색기 → 보기 옵션): 파일 확장명, 숨긴 항목.** 숨긴 항목 starts off as in Windows; 파일 확장명 starts **on**, which Windows does not — here the extension is the association, not decoration (a `.url` opens the browser, a `.canvas` opens 그림판), so hiding it by default would hide the mechanism the shell exists to show and would quietly rewrite every saved desktop on its next load. Both belong to the shell rather than to one window, the way Windows applies them system-wide — the desktop shows names and entries too, and two Explorer windows disagreeing about which files exist would be worse than either answer. A rename typed against a hidden extension keeps it (`report` → `report.txt`), a folder never has a dot taken out of its name (`v1.2` stays `v1.2`), and searching still finds a file by the extension the list is not showing. Windows appends unconditionally here, which is why renaming to `report.txt` with extensions hidden famously produces `report.txt.txt`; that is a bug people work around, not a behaviour worth copying, so a name that already ends in the entry's own extension is left alone.
- **드라이브 속성 (내 PC → 우클릭, 또는 속성).** The pie Windows draws for a drive, off the same `navigator.storage.estimate()` the tile already showed — measured 4.2 MB used, 8.0 GB free, 0.1% — plus 종류 and 파일 시스템. A browser that will not estimate reports 알 수 없음 rather than a made-up total.

- **캘린더 일정.** The tray calendar's own comment used to read _"No agenda exists to show, and it says so instead of pretending"_ — picking a day changed nothing but a line of text. A day now has an agenda: what is on it, and a line to add something. An entry with a time gets a reminder; one without is all-day and gets none, and the agenda lists all-day first. The day is dotted on the grid, in its own colour beside the alarm dot so a day carrying both shows both. The reminder is the point — appointments live at the shell, not in a window, so it arrives whether or not anything is open, and one that came due while the tab was closed arrives as 놓친 일정. Writing down something that already happened does not set off a reminder for it. Entries survive a reload, and at the cap the oldest day is dropped rather than the new entry refused.
- **알림 센터가 열려 있는 동안에는 배너가 뜨지 않는다.** The banners and the notification centre are anchored to the same corner, and Windows raises no banner while the action centre is open — the panel is already showing the same notification. Ours did: a reminder arriving while the calendar was open sat on top of the panel and covered its 추가 button. The ones already up go with the panel when it opens, and none is raised until it closes; nothing is lost, since the entry is in the centre either way. Found by looking at a screenshot of the new feature, and the first fix only covered half of it — a banner raised _after_ the centre opened still landed on top, which is the case the screenshot had actually caught.

- **작업 표시줄 위치 (설정 → 개인 설정, 또는 작업 표시줄 우클릭 → 작업 표시줄 설정).** 왼쪽 / 위쪽 / 오른쪽 / 아래쪽 — and the work area goes with it, which is the whole point: a maximized window, the snap zones and the halves and thirds they produce, the desktop icon grid, every flyout, the toasts, Task View and the 실행 overlay all measure against the area the bar leaves rather than against the bottom of the screen. On a side edge the bar turns into a column — the Start button, the open apps and the tray stack down it, the search box narrows to its icon and unfolds beside the bar when you click it, and the running-app marks move to the edge the bar is against. The setting survives a reload, and is applied before the first paint so the bar never flashes at the bottom on the way to where it belongs.

  The bottom edge had been written into eight files as `window.innerHeight - APP_BAR_HEIGHT`, so there was no single thing to move. There is now: one work area, read from the same `data-taskbar` attribute the stylesheet keys on, and no caller subtracts the bar's own thickness by hand. Removing the copies turned up a bug that predates this: the work area floored itself at the minimum window size, which on a small viewport made it **larger than the screen** and pushed desktop icons off the bottom right. A minimum belongs to the thing being placed — a window has one, an icon does not — so the area is honest now and the snap patch carries the floor.

- **텍스트 크기 (설정 → 접근성).** 100 / 110 / 125 / 150%, applied as one multiplier on the root font size — which every `rem` in the stylesheet already read, so the whole shell and every app follow one setting: the taskbar clock, a window's title, a menu, a dialog, the lock screen. The chrome keeps its pixel sizes, the way Windows' own text-size slider works: the window buttons do not grow with the labels. 알람 및 시계 had been written in `px` and would have been the one app left behind, so its 21 text sizes are `rem` now too. Each choice shows itself at the size it sets, and the setting survives a reload.
- **집중 지원 (방해 금지).** A toggle in 빠른 설정 and in 설정 → 시스템: while it is on, a notification still arrives and still counts as unread — the toast is what is held back. The tray carries a moon so the quiet is something you can see rather than guess, and the notification centre says why it is quiet with the way out ("끄기") in the same line.
- **스냅 레이아웃 (Win+Z).** The flyout on a window's maximize button is now the Windows 11 picker: four whole-screen arrangements — 좌우 절반, 3분할, 넓은 왼쪽, 4분할 — with eleven places between them, each cell a miniature of where this window will go. The thirds are the point: no screen edge can mean "middle column", so dragging could never reach them. Win+Z opens the picker for the window in front, Escape closes it, and the arrows walk the cells. Picking one goes through the shell's own snap rather than writing geometry directly, so the window remembers it is snapped and Snap Assist offers the one place left over — after a 3분의 2 that is the remaining third, which it now knows.
- **데스크톱 이름 바꾸기.** A virtual desktop can be renamed in place in Task View, and the name replaces the number wherever the number was: the card, its ✕, the window-move list, and the taskbar's own Task View button. Escape keeps the old name, an empty name restores 데스크톱 N, and closing a desktop moves the names up with their desktops rather than handing one to whichever desktop slid into its place.
- **빠른 액세스.** A folder can be pinned to Explorer's sidebar from its own right-click menu, and unpinned from there or from the ✕ on the row. The pins belong to the shell, so every Explorer window shows the same ones and a reload keeps them — and a pinned folder that is deleted stops being a pin, without the delete path knowing anything about pins.

### Changed

- **A write that does not fit is refused before it is attempted.** The save limit is a budget for the whole file system, and only screenshots measured against it; an archive or an imported folder used to fail later, at the write. Anything that adds bytes is measured first and refused out loud with the space it needed and the space that is left.

## 0.15.1

0.15.0 confined a failed app chunk to its own window and offered 다시 시도
there. Measured against the deployed build, that button could not work.

### Fixed

- **다시 시도 on a failed chunk issued no request at all.** A retry was built on a fresh `React.lazy` per attempt — necessary, but not sufficient: the browser remembers a failed module for the life of the document, so re-importing the same URL resolves from that memory without touching the network (measured on the deployed build: 1 request before the retry, 1 after, and the window stayed in its error state). The reader view had carried the same button since 0.12 with the same flaw. Both offer **새로 고침** now and say why — which is a real recovery, since windows, files and settings are restored on load. The unused retry machinery is gone with it.
- Verified with that one chunk blocked on the deployed build: no crash screen, the other window kept its typed text, both windows still open, and the failed window names the app it could not load.

## 0.15.0

The round where the shell was measured instead of described. An accessibility
gate reads the markup of every app and shell surface and failed on three
defects that had shipped; every app became its own chunk, cutting the
JavaScript needed to reach the desktop by 38%; the note pad stopped writing to
storage on every keystroke; and the invariants the shell had only claimed —
that a drag re-renders nothing else, that a deferred app still opens offline,
that focus stays inside a window — are gates now. A deep review before the tag
found that one app failing to download would take the whole desktop, and that
is fixed too.

### Added

- **탭 화살표 이동과 가운데 클릭으로 탭 닫기.** Explorer's and Edge's tab strips answer Left, Right, Home and End — the strip is one tab stop, and the tab that gains it gains the focus, so the next arrow comes from the tab you can see rather than from an element that is no longer reachable. Up and Down stay with whatever surrounds the strip. Middle-clicking a tab closes it, as in every browser; on Explorer's last tab it closes the window, and on Edge's it goes home.
- **접근성 게이트 (`qa:a11y`).** A ninth gate opens all 17 apps, the Start menu (pinned and 모든 앱), the notification centre, quick settings, Task View and the desktop and taskbar menus, then reads the markup back against eleven ARIA rules: duplicate ids, a control nested inside a control, a `role="tablist"` whose children are not tabs, a tab or menu item with no such parent, a reference to an id that is not in the document, an unnamed control, a stray `aria-selected`, an image with no alt at all, and `role="none"` on something focusable. It also checks the one thing markup cannot show — that focus stays inside a window when the element holding it is removed — for the three Explorer actions where that broke before. The rules are a pure function with ten tests of their own, each written from the defect it would have caught.

### Fixed

- **The Explorer tab strip was not a tab strip.** Its `role="tablist"` held roleless `<div>` wrappers, 새 탭 and 새 창 — the tabs it declared were grandchildren of the list, and two of its children were not tabs at all. The tab element now carries the role itself, the strip's own buttons sit outside the list, and Edge's strip was built the same way and is fixed the same way.
- **An openable notification's ✕ was not a control.** The row was a `<button>` with the dismiss button nested inside it; a button's children are presentational, so assistive tech saw no ✕ at all — the only notifications anything could dismiss were the ones nothing could open. The row is an `<article>`, and what opens it is a button beside the ✕ rather than around it. (React renders this shape; the HTML parser would have refused it, which is why no validator ever saw it.)
- **절전 kept taking focus back, and never said how to wake.** The dark screen focused itself from a `ref` callback — a new function every render, so React re-ran it on every commit and the screen stole focus from whatever had it. It also claimed `role="button"`, which is both a lie (any key wakes it, not just Enter and Space) and a gag: a button's contents are presentational, so the one line telling the user how to wake the screen was never read out. It is a named region that focuses once, and it now listens for a key anywhere, so "아무 키나" is true even if focus has wandered.
- **작업 관리자's unselected tab pointed at a panel that was not there.** Only one panel is rendered at a time, so `aria-controls` on the other tab named a missing id. Its arrow keys moved the selection without moving the focus, too — the same stranded-tab-stop bug as the strips above, and 메모장's document tabs had it as well.
- **A horizontal tab strip swallowed Up and Down.** Explorer, Edge, 메모장 and 작업 관리자 all stepped the tab on the vertical arrows, taking the keys away from whatever the strip sat above. 알람 및 시계 already guarded against this; the guard is one helper now.

### Changed

- **매 앱이 자기 청크.** Every app is loaded when its first window opens, instead of shipping in the initial bundle: the JavaScript needed to reach the desktop went from 588,323 to 366,012 bytes (175.5 kB → 114.4 kB gzipped). The window waits for its app rather than appearing as a frame that is on screen and deaf — the first thing the smoke caught was a keyboard chord landing on a window whose app had not mounted yet. The service worker precaches every emitted asset from the build's own list, so a deferred app is still there offline.
- **스티커 메모 stopped writing on every keystroke.** Typing rewrote the whole note store to localStorage per keypress — a synchronous `JSON.stringify` plus `setItem` each time, measured at 18 writes and 4,224 bytes for 14 typed characters. One write per pause instead (300 ms, alongside the 250 ms the window state and the icon layout already use), flushed on pagehide, when the tab goes hidden, and on unmount: **1 write, 241 bytes** for the same 14 characters, and the text still survives a reload.
- **작업 관리자's memory graph plots the measurement.** The line was `22 + MB / 24 + jitter`, drawn as a percentage — a figure that matched neither the megabytes printed beside it nor any percentage of anything. It plots megabytes against a ceiling now, and the fake jitter is gone.
- **A version can no longer be tagged on an audit that never ran.** `audit:runtime` treats a registry outage as "not checked" and passes, because an outage is not a security result and must not fail every commit. `npm run qa:release` — `qa:all` plus `audit:runtime --strict` — is what a release runs, and strict refuses to pass an audit that did not happen.
- **The pinned-tile persistence tests now cover the code that runs.** They were written against an id-list API that tile folders replaced; that API read the entry format as a list of strings (which is empty) and nothing but its own test still called it. It is gone, and its assertions — order, uncapped growth, a pinned app that is no longer installed, a duplicate id — now run against the entry API, plus the v1 migration and folders.

### Fixed

- **One app failing to download took the whole desktop.** Suspense handles waiting, not failure: a rejected chunk import threw past it to the shell's root boundary, which unmounts everything — every other window's state gone because one app could not be fetched (a blocked request, or a stale tab asking for a hash a redeploy had replaced). Each window has its own boundary now: it stays a window, keeps its title, and says which app it could not load, while every other window carries on.
- **The tab strip was more than one tab stop.** Making each tab a roving stop left every tab's ✕ tabbable, so five tabs were six stops and tabbing through Explorer walked all of them. Only the tab holding the stop lends it to its own ✕ now — and the accessibility gate has a rule for it, so the next strip cannot get this wrong quietly.
- **A strip of one tab swallowed Left and Right.** With one tab there is nowhere to go, but the handler still called `preventDefault` and re-selected the tab it was on, taking the arrow keys from a single-tab Explorer, 메모장 or Edge.
- **A note could still be lost without a word.** The 20,000-character cap bounds one paste, not the whole origin's quota, and a refused write was swallowed: the user kept typing and the note was back to its last saved state after a reload. A refused write is reported now, once, the way a refused file write already was. The debounce also flushes on unmount — a crash elsewhere took the timer and the pagehide listener with it.
- **A capture could refuse while a good window was on screen.** The fallback subject was chosen by z-order from the window records, then looked for its frame; a window whose app is still arriving has a record and no frame, so the capture gave up with "캡처할 활성 창이 없습니다". It picks the topmost window that is actually in the DOM.
- **The accessibility gate could audit fewer apps than it claimed.** It waited a fixed 180 ms after each Start-menu click — fine when a click mounted an app in the same tick, unreliable now that a chunk is fetched first. A slow app dropped out of the audit silently. It waits for the window and then asserts all 17 frames are on screen.
- **A screenshot that stalled said nothing at all.** The `<img>` the capture draws through can neither load nor error for a big enough `foreignObject`, and the await simply never returned: no picture, no message, no console line — PrintScreen did nothing. It has a deadline now, and a stall is reported the way every other capture failure already was.
- **The capture could call another origin.** "Same-origin resources" was a comment above a function that fetched whatever a `url()` named. A stylesheet, an `<img>`, or an imported wallpaper the shell merely shows could have named any host — and this project documents its CSP as not being that boundary. The rule is in the code now.
- **The fold vector outlived its animation.** A minimize sets `--minimize-dx/dy` on the frame so it folds toward its taskbar button, and nothing ever removed them; the taskbar button moves whenever the bar's contents change, so the next motion could start from where the button used to be. The selector also matched any `data-app-id` in the bar, a jump-list row included.
- **시작 메뉴's folder flyout could outlive its folder.** A folder that drops to one app is flattened away, and 그룹 해제 removes it outright; either left a panel headed 폴더 open with nothing in it.
- **One wave of the hand shook a window three times.** Aero Shake reset its detector after firing and started counting again, so a long shake reached the reversal count over and over: minimize, restore, minimize. A shake now has a 500 ms cooldown — a second shake is a second gesture.
- **작업 표시줄 could leave the desktop dimmed.** Resting the pointer on the show-desktop strip peeks at the desktop; the bar going away mid-peek cleared its timer but never told the shell to stop peeking, leaving nothing on screen able to un-dim the windows. (The bar is always mounted today, so this was a trap set for the first change that unmounts it.)
- **Window pictures kept cloning a page nobody was looking at.** The taskbar preview re-takes its picture once a second, and a hidden tab still runs its intervals — a whole window frame cloned per second for no viewer. It skips the refresh while the page is hidden.
- **Two note windows overwrote each other.** Each computed its next store from the one it had rendered with, so whichever wrote second threw away the other's characters — and two windows opening in the same tick both bound themselves to the same note. The shell takes an updater now, not a value. A note is capped at 20,000 characters as well; an unbounded paste filled the localStorage quota, and the failed write meant the note was gone on the next reload.

## 0.14.0

The round where the desktop started showing itself. Windows are pictured
rather than iconified — in the taskbar, Alt+Tab, Task View and the snap
preview — the shell can take its own screenshot, a picture of your own can be
the wallpaper, and the things Windows lets you rearrange by hand now move.
Every behavior below was verified in a real browser, and the ones that could
be measured were measured before and after.

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

- **탐색기 주소 표시줄에 경로를 입력.** Ctrl+L, a double click on the address, or a click on its empty stretch turns the breadcrumbs into a path field holding `바탕 화면\문서`. Enter navigates — absolute or relative, either separator, any case, with `.` and `..` — a path that names no folder says so and stays put, and Escape puts the breadcrumbs back.
- **검색이 무엇에 맞았는지 표시.** The matched text is marked inside each name the search kept.
- **선택한 항목의 크기.** The status bar shows what the selection weighs beside its count, as Explorer does.
- **알림 센터에서 알림을 클릭하면 그 파일이 열립니다.** A screenshot notification opens the screenshot in 사진; a notification that is only a statement stays one.
- **점프 리스트의 그림은 그림으로.** A picture in an app's 최근 항목 shows itself.

- **끌어서 순서 바꾸기.** Pinned Start-menu tiles and pinned taskbar buttons rearrange by dragging one onto another, as Windows lets you; the tile being carried fades and the slot it will take is outlined.
- **알림을 하나씩 지우기.** Each row in the notification centre has its own dismiss, not only 모두 지우기.
- **폴더 우클릭: 새 창에서 열기.** Opens a second Explorer already showing that folder.
- **폴더 우클릭: 여기서 명령 프롬프트 열기.** 명령 프롬프트 starts in that folder — its prompt reads `…\\Desktop\\문서` from the first line — and a later request moves the open prompt there.

- **탐색기 진짜 탭.** Each tab keeps its own folder and its own back/forward history, as Windows 11 does; 새 탭 adds one at the folder on screen, a tab can be closed, and the window that held one label now holds a strip. 새 창 is its own button beside it.
- **시작 메뉴 타일 폴더.** Dropping a tile on the middle of another makes a folder — Windows 11 reads where the drop lands, so an edge still reorders. The folder tile shows the icons it holds, clicking it opens a flyout of its apps, and 그룹 해제 spills them back where the folder stood. The pinned area is stored as entries now and reads the old plain list of app ids.
- **설정 → 키보드 단축키.** Every key the shell listens for, grouped, from one list (`SHELL_SHORTCUTS`) rather than prose scattered through the UI. The list and the shell's handlers are still separate code, and the page says so; a review caught the list claiming a bare Win key that nothing handled — Win now opens the Start menu, as Windows does.
- **그림판 도형 채우기.** 사각형 and 타원 can be solid, not only outlines.
- **작업 관리자의 메모리는 이제 재는 값.** A process's memory was a hash of its window id: a Notepad window holding a novel read the same as an empty one. It is now a declared per-app baseline plus the measured bytes of the document that window has open.

- **탐색기 탭 키와 드래그.** Ctrl+T opens a tab, Ctrl+W closes it (the window itself when the last one goes), Ctrl+Tab and Ctrl+Shift+Tab walk them, and a tab can be dragged onto another to change the order. 폴더 우클릭 → 새 탭에서 열기 sits beside 새 창에서 열기.
- **시작 메뉴 폴더 이름 바꾸기.** A tile folder arrives as 폴더 1 and can be typed over from its flyout; Escape keeps the old name, and so does an empty one.
- **시계 우클릭 → 날짜 및 시간 조정.** The tray clock has its own menu, and 설정 opens straight at 시간 및 언어 — the shell can deep-link any 설정 page now.

- **A screenshot can no longer break every later save.** The capture's PNG went straight into the virtual file system, whose save limit is a budget for the _whole_ snapshot: a few captures on a large display exhausted it, after which every write — a saved note, a new folder — failed silently, and a reload lost the lot. A capture is now measured against what is left and refused out loud if it will not fit, and the picture itself is capped at 2.4M device pixels rather than following a 4K display's devicePixelRatio.
- **Dragging a window stopped re-rendering every other window again.** The Task Manager's new memory reading was a fresh function on every render, and it sat in the dependency list of the memo whose whole purpose is that a drag commit hands every window the same props object. The 0.13.0 invariant is restored (and the review that caught it is why the comment above that memo names the contract).
- **An arranged window stays arranged.** 창 계단식 배열 and the tiling modes left `snapZone` set, so the first resize or restart put the window back in its old snap box, undoing the arrangement.
- **Win+Shift+S opens the capture tool even while typing.** 메모장 was claiming that chord as its own 다른 이름으로 저장 and stopping the event. A Win-modified chord belongs to the shell, as it does in Windows, and apps now step aside for the list of them.
- **캡처 도구's 활성 창 mode works.** Clicking 새 캡처 makes the tool the active window, so the mode could only ever report that there was nothing to capture. It pictures the window that was active before the tool, or the topmost one if that has closed.
- **A deep-linked window no longer opens on the last request.** 여기서 명령 프롬프트 열기 left its request standing, so the next prompt opened plainly still started in that folder — and 설정 always opened at 시간 및 언어. An app now reports the request consumed.
- **Dismissing one notification no longer resurrects the badge.** The read marker pointed at the notification just dropped, and a marker that is missing was counted as "nothing read".
- **A search belongs to its tab.** A new Explorer tab inherited the previous tab's filter and looked empty.
- **A wallpaper must be a picture.** `resolveCustomWallpaper` put the file's content straight into a CSS `url()` without checking it was an image data URL — an imported backup could carry anything there.

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
