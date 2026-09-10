/**
 * Windows' drag modifiers. Holding Ctrl while dragging a file copies it
 * instead of moving it, and the cursor says so before the button comes up —
 * every drop here moved, whatever was held.
 *
 * Read at the moment of the event rather than at the start of the drag: the
 * modifier can be pressed and released mid-drag, and the pointer's badge is
 * expected to follow.
 */
export type VfsDragModifiers = {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/**
 * Ctrl copies, Shift moves, neither moves. Shift wins a tie because Windows
 * treats an explicit 이동 as the more deliberate of the two.
 */
export function getVfsDropEffect(event: VfsDragModifiers): "copy" | "move" {
  if (event.shiftKey) return "move";
  return event.ctrlKey || event.metaKey ? "copy" : "move";
}

export function isVfsCopyDrag(event: VfsDragModifiers) {
  return getVfsDropEffect(event) === "copy";
}
