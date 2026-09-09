import { FILE_EXTENSIONS_KEY, HIDDEN_ITEMS_KEY } from "./constants";

/**
 * 폴더 옵션 — Windows' 보기 tab: 파일 확장명 and 숨긴 항목. They belong to the
 * shell rather than to one Explorer window, the way Windows applies them
 * system-wide: the desktop shows names and entries too, and two Explorer
 * windows disagreeing about which files exist would be worse than either
 * answer.
 *
 * 숨긴 항목 starts off, as in Windows. 파일 확장명 starts *on*, which Windows
 * does not: here the extension is not decoration, it is the association — a
 * `.url` opens the browser, a `.canvas` opens 그림판, a `.zip` is a folder
 * Explorer can open. Hiding it by default would hide the mechanism this shell
 * exists to demonstrate, and would quietly rewrite what every saved desktop
 * looks like on its next load. The toggle gives Windows' behaviour in a click.
 */

export function loadShowFileExtensions() {
  try {
    return localStorage.getItem(FILE_EXTENSIONS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function persistShowFileExtensions(show: boolean) {
  try {
    localStorage.setItem(FILE_EXTENSIONS_KEY, show ? "on" : "off");
  } catch {
    // A refused write costs the preference, not the session.
  }
}

export function loadShowHiddenItems() {
  try {
    return localStorage.getItem(HIDDEN_ITEMS_KEY) === "on";
  } catch {
    return false;
  }
}

export function persistShowHiddenItems(show: boolean) {
  try {
    localStorage.setItem(HIDDEN_ITEMS_KEY, show ? "on" : "off");
  } catch {
    // Same: the setting is lost, the session is not.
  }
}
