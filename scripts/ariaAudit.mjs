/**
 * A structural ARIA audit of a live document.
 *
 * The shell had three separate defects that no gate could see: a
 * `role="tablist"` whose children were not tabs, a dismiss button nested
 * inside another button (so assistive tech never saw it at all), and a dark
 * screen claiming `role="button"` while any key woke it. All three were found
 * by reading the markup, which means a machine can find the next one.
 *
 * This is one self-contained function on purpose: the gate hands it straight
 * to `page.evaluate`, so it may not close over anything outside itself.
 */
export function auditAria(rootSelector = "body") {
  const root = document.querySelector(rootSelector);
  if (!root) return [{ detail: rootSelector, rule: "missing-root" }];

  /*
   * Roles whose children the platform hides: their content becomes the name
   * and nothing inside can be a control. `tab` is deliberately absent — ARIA
   * 1.3 dropped presentational children from it so a tab can carry its own ✕,
   * which is how every browser's tab strip is built.
   */
  const PRESENTATIONAL_PARENTS = [
    "a[href]",
    "button",
    '[role="button"]',
    '[role="checkbox"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="progressbar"]',
    '[role="radio"]',
    '[role="slider"]',
    '[role="switch"]',
  ].join(",");

  const FOCUSABLE =
    'a[href], area[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

  // aria-selected is meaningful on these and nowhere else.
  const SELECTABLE_ROLES = [
    "columnheader",
    "gridcell",
    "option",
    "row",
    "rowheader",
    "tab",
    "treeitem",
  ];

  const REFERENCE_ATTRIBUTES = [
    "aria-activedescendant",
    "aria-controls",
    "aria-describedby",
    "aria-details",
    "aria-errormessage",
    "aria-labelledby",
    "aria-owns",
  ];

  const defects = [];
  const where = (element) => {
    const parts = [element.tagName.toLowerCase()];
    if (element.id) parts.push(`#${element.id}`);
    if (element.classList.length > 0) parts.push(`.${[...element.classList].join(".")}`);
    const role = element.getAttribute("role");
    if (role) parts.push(`[role=${role}]`);
    const text = (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (text) parts.push(`"${text}"`);
    const frame = element.closest("[data-app-id]");
    if (frame) parts.push(`in ${frame.getAttribute("data-app-id")}`);
    return parts.join(" ");
  };
  const report = (rule, element, detail = "") => {
    defects.push({ detail: detail ? `${where(element)} — ${detail}` : where(element), rule });
  };

  /**
   * Anything the accessibility tree does not contain cannot have an
   * accessibility defect: hidden subtrees, inert ones, and the window pictures
   * the taskbar and Alt+Tab paint, which are clones of real frames.
   */
  const isExcluded = (element) => {
    if (element.closest('[aria-hidden="true"], [inert], .window-thumbnail-clone')) return true;
    const style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
    return style ? style.display === "none" || style.visibility === "hidden" : false;
  };

  const isFocusable = (element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("tabindex") === "-1") return false;
    if (element.matches('input[type="hidden"]')) return false;
    return element.matches(FOCUSABLE);
  };

  /** Enough of the accessible-name algorithm to tell "named" from "unnamed". */
  const getAccessibleName = (element) => {
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
      if (text) return text;
    }
    const label = element.getAttribute("aria-label")?.trim();
    if (label) return label;

    if (element.id) {
      // Read the attribute rather than building a selector: an id may hold
      // characters a selector would have to escape, and CSS.escape is not
      // everywhere this function runs.
      const forLabel = [...document.querySelectorAll("label[for]")].find(
        (candidate) => candidate.getAttribute("for") === element.id,
      );
      if (forLabel?.textContent?.trim()) return forLabel.textContent.trim();
    }
    const wrappingLabel = element.closest("label");
    if (wrappingLabel?.textContent?.trim()) return wrappingLabel.textContent.trim();

    if (element.matches("img")) {
      const alt = element.getAttribute("alt");
      if (alt !== null) return alt.trim();
    }
    if (element.matches('input[type="button"], input[type="submit"], input[type="reset"]')) {
      const value = element.getAttribute("value")?.trim();
      if (value) return value;
    }
    // Content is a name only for roles that take one from content; every role
    // this audit checks does, so the visible text counts.
    const own = [...element.childNodes]
      .filter((node) => !(node instanceof Element) || !node.matches('[aria-hidden="true"]'))
      .map((node) => node.textContent ?? "")
      .join(" ")
      .trim();
    if (own) return own;

    const title = element.getAttribute("title")?.trim();
    if (title) return title;
    const placeholder = element.getAttribute("placeholder")?.trim();
    return placeholder ?? "";
  };

  const elements = [root, ...root.querySelectorAll("*")].filter(
    (element) => element instanceof Element && !isExcluded(element),
  );

  // 1. Two elements answering to the same id break every reference to it.
  const seenIds = new Map();
  for (const element of elements) {
    if (!element.id) continue;
    const first = seenIds.get(element.id);
    if (first) report("duplicate-id", element, `id "${element.id}" is also on ${where(first)}`);
    else seenIds.set(element.id, element);
  }

  for (const element of elements) {
    const role = element.getAttribute("role");

    // 2. A control inside a control: the inner one is not reachable.
    if (element.matches(PRESENTATIONAL_PARENTS)) {
      for (const inner of element.querySelectorAll(FOCUSABLE)) {
        if (isFocusable(inner) && !isExcluded(inner)) {
          report("nested-interactive", element, `contains ${where(inner)}`);
        }
      }
    }

    // 3-6. Roles that only mean something in the right company.
    if (role === "tablist") {
      for (const child of element.children) {
        if (isExcluded(child)) continue;
        if (child.getAttribute("role") !== "tab") {
          report("tablist-children", element, `child ${where(child)} is not a tab`);
        }
      }
    }
    if (role === "tab" && !element.parentElement?.closest('[role="tablist"]')) {
      report("orphan-tab", element, "no tablist above it");
    }
    if (
      role &&
      ["menuitem", "menuitemcheckbox", "menuitemradio"].includes(role) &&
      !element.parentElement?.closest('[role="menu"], [role="menubar"]')
    ) {
      report("orphan-menuitem", element, "no menu above it");
    }
    if (role === "option" && !element.parentElement?.closest('[role="listbox"]')) {
      report("orphan-option", element, "no listbox above it");
    }

    // 7. A reference to an id that is not there names nothing.
    for (const attribute of REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      for (const id of value.split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) {
          report("dangling-reference", element, `${attribute} points at missing id "${id}"`);
        }
      }
    }
    if (element.matches("label[for]")) {
      const target = element.getAttribute("for");
      if (target && !document.getElementById(target)) {
        report("dangling-reference", element, `for points at missing id "${target}"`);
      }
    }

    // 8. A control with no name is a control nobody can ask for.
    if (isFocusable(element) && !getAccessibleName(element)) {
      report("missing-name", element);
    }

    // 9. aria-selected on something that is not selectable is noise.
    if (element.hasAttribute("aria-selected") && !SELECTABLE_ROLES.includes(role ?? "")) {
      report("aria-selected-misplaced", element, `role "${role ?? "(none)"}" has no selection`);
    }

    // 10. An image with no alt at all is read out as its file name.
    if (
      element.matches("img") &&
      !element.hasAttribute("alt") &&
      role !== "presentation" &&
      role !== "none"
    ) {
      report("image-without-alt", element);
    }

    // 11. "This is not an element" cannot be said about something focusable.
    if ((role === "presentation" || role === "none") && isFocusable(element)) {
      report("presentation-conflict", element, "focusable, so the role cannot hold");
    }
  }

  return defects;
}
