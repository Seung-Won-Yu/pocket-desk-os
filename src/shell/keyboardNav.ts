/**
 * `role="menu"` and `role="grid"` promise a keyboard model that Tab alone does
 * not provide: arrows move between items, Home and End jump to the ends, and
 * the whole widget is a single tab stop. These helpers supply that model so the
 * roles stay honest.
 */

const MENU_ITEM_SELECTOR =
  '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

function isReachable(element: HTMLElement) {
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
    return false;
  }
  return element.offsetParent !== null;
}

/**
 * Arrow, Home and End navigation for a menu, driven straight off the DOM
 * because menus render their items in too many shapes to index by hand.
 */
export function handleMenuKeyboard(event: React.KeyboardEvent, container: HTMLElement) {
  const navigationKeys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!navigationKeys.includes(event.key)) return;

  const items = Array.from(container.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter(
    isReachable,
  );
  if (items.length === 0) return;

  event.preventDefault();
  event.stopPropagation();

  const active = document.activeElement;
  const currentIndex = items.findIndex((item) => item === active);
  const next = getNextRovingIndex(event.key, currentIndex, items.length);
  if (next === null) return;
  items[next].focus();
}

/**
 * The index a roving-focus widget should move to, or null when the key does not
 * navigate. `columns` above 1 makes Up and Down step a whole row, for a grid.
 * A currentIndex of -1 means nothing is focused yet, so any key enters at an end.
 */
export function getNextRovingIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
  columns = 1,
): number | null {
  if (itemCount <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;

  const step =
    key === "ArrowRight"
      ? 1
      : key === "ArrowLeft"
        ? -1
        : key === "ArrowDown"
          ? columns
          : key === "ArrowUp"
            ? -columns
            : 0;
  if (step === 0) return null;
  if (currentIndex < 0) return step > 0 ? 0 : itemCount - 1;

  const next = currentIndex + step;
  // Row steps clamp rather than wrap, so Down on the last row stays put instead
  // of teleporting to the opposite corner.
  if (Math.abs(step) === columns && columns > 1) {
    return next >= 0 && next < itemCount ? next : currentIndex;
  }
  return (next + itemCount) % itemCount;
}

/**
 * The neighbour of a freely positioned icon in one direction. The desktop lays
 * its icons out by coordinate, not in a list, so stepping an index moved the
 * selection to whatever happened to be next in the DOM — usually sideways when
 * the user pressed Down. Picks the nearest icon that actually lies that way,
 * preferring ones aligned with the current column or row.
 */
export function getNeighbourByPosition(
  nodes: HTMLElement[],
  currentIndex: number,
  key: string,
): HTMLElement | null {
  if (nodes.length === 0) return null;

  const inReadingOrder = [...nodes].sort((first, second) => {
    const a = first.getBoundingClientRect();
    const b = second.getBoundingClientRect();
    return a.top - b.top || a.left - b.left;
  });
  if (key === "Home") return inReadingOrder[0] ?? null;
  if (key === "End") return inReadingOrder[inReadingOrder.length - 1] ?? null;

  const current = nodes[currentIndex]?.getBoundingClientRect();
  if (!current) return inReadingOrder[0] ?? null;

  const axis = key === "ArrowUp" || key === "ArrowDown" ? "y" : "x";
  const forward = key === "ArrowDown" || key === "ArrowRight";

  const candidates = nodes
    .map((node) => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => {
      const delta = axis === "y" ? rect.top - current.top : rect.left - current.left;
      return forward ? delta > 1 : delta < -1;
    });
  if (candidates.length === 0) return null;

  return candidates.reduce((closest, item) => {
    // Distance along the travel axis dominates; drift across it only breaks ties.
    const score = ({ rect }: { rect: DOMRect }) =>
      axis === "y"
        ? Math.abs(rect.top - current.top) + Math.abs(rect.left - current.left) * 2
        : Math.abs(rect.left - current.left) + Math.abs(rect.top - current.top) * 2;
    return score(item) < score(closest) ? item : closest;
  }).node;
}
