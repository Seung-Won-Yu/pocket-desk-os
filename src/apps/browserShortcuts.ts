/**
 * 브라우저 단축키. The browser had none: no Ctrl+T, no Ctrl+W, no Ctrl+L, no
 * F5 — every one of them a mouse trip to the toolbar in a program people
 * mostly drive from the keyboard. These are Edge's, decided here from the key
 * alone so the table can be pinned without a page.
 */
export type BrowserShortcut =
  | { kind: "newTab" }
  | { kind: "closeTab" }
  | { kind: "focusAddress" }
  | { kind: "cycleTab"; delta: 1 | -1 }
  | { kind: "tabAt"; index: number | "last" }
  | { kind: "reload" }
  | { kind: "back" }
  | { kind: "forward" }
  | { kind: "bookmark" }
  | { kind: "history" };

type KeyLike = {
  altKey: boolean;
  code?: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
};

export function getBrowserShortcut(event: KeyLike): BrowserShortcut | null {
  const control = event.ctrlKey || event.metaKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (!control && !event.altKey) {
    if (event.key === "F5") return { kind: "reload" };
    if (event.key === "F6") return { kind: "focusAddress" };
    return null;
  }

  if (event.altKey && !control) {
    if (event.key === "ArrowLeft") return { kind: "back" };
    if (event.key === "ArrowRight") return { kind: "forward" };
    if (key === "d") return { kind: "focusAddress" };
    return null;
  }

  if (!control || event.altKey) return null;

  if (event.key === "Tab") return { kind: "cycleTab", delta: event.shiftKey ? -1 : 1 };
  if (event.key === "PageDown") return { kind: "cycleTab", delta: 1 };
  if (event.key === "PageUp") return { kind: "cycleTab", delta: -1 };
  if (event.shiftKey) return null;
  if (event.key === "F4") return { kind: "closeTab" };

  // Ctrl+1…8 go to that tab and Ctrl+9 to the last, read off the physical key.
  const digit =
    /^Digit([1-9])$/.exec(event.code ?? "")?.[1] ?? (/^[1-9]$/.test(key) ? key : null);
  if (digit) return { kind: "tabAt", index: digit === "9" ? "last" : Number(digit) - 1 };

  switch (key) {
    case "t":
      return { kind: "newTab" };
    case "w":
      return { kind: "closeTab" };
    case "l":
      return { kind: "focusAddress" };
    case "r":
      return { kind: "reload" };
    case "d":
      return { kind: "bookmark" };
    case "h":
      return { kind: "history" };
    default:
      return null;
  }
}

/** The tab a cycle or a number lands on, wrapping the way Edge's does. */
export function getShortcutTabIndex(
  shortcut: Extract<BrowserShortcut, { kind: "cycleTab" | "tabAt" }>,
  currentIndex: number,
  tabCount: number,
) {
  if (tabCount === 0) return -1;
  if (shortcut.kind === "cycleTab") {
    return (currentIndex + shortcut.delta + tabCount) % tabCount;
  }
  if (shortcut.index === "last") return tabCount - 1;
  return shortcut.index < tabCount ? shortcut.index : -1;
}
