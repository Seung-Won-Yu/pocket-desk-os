import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function isReachable(element: HTMLElement) {
  // offsetParent is null for display:none, and an aria-hidden subtree is not
  // exposed at all, so neither should take a turn in the Tab cycle.
  if (element.offsetParent === null && element.tagName !== "BODY") return false;
  return element.closest("[aria-hidden='true']") === null;
}

export function getDialogFocusableControls(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isReachable,
  );
}

export function trapDialogFocus(event: React.KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") return;
  const controls = getDialogFocusableControls(container);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Hands focus back to whatever opened a menu or dialog once it closes. Without
 * this, focus falls to <body> and the next Tab restarts at the top of the page.
 */
export function useReturnFocus() {
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    return () => {
      if (!previousFocus?.isConnected) return;
      // Closing a menu often hands off to something it just created — a rename
      // field, a dialog. Restore only if focus actually fell to nowhere, and do
      // it a frame later so the new target has already claimed it.
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && active !== document.body) return;
        previousFocus.focus();
      });
    };
  }, []);
}
