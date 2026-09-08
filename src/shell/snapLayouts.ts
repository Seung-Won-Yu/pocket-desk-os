import { type SnapZone } from "./types";

/**
 * 스냅 레이아웃 — the flyout Windows 11 shows when you rest on a window's
 * maximize button (or press Win+Z): a few whole-screen arrangements, each cell
 * a place to put this window. Dragging to an edge still gives the halves and
 * quarters; the picker is how the thirds are reachable at all, since there is
 * no screen edge that means "middle column".
 *
 * A layout is a grid of cells over a 6×2 board, so every arrangement below —
 * halves, thirds, two-thirds plus a third, quarters — lands on whole tracks.
 */

export type SnapLayoutCell = {
  /** Grid tracks, 1-based, over a 6-column, 2-row board. */
  columnSpan: number;
  columnStart: number;
  label: string;
  rowSpan: number;
  rowStart: number;
  zone: SnapZone;
};

export type SnapLayout = {
  cells: SnapLayoutCell[];
  id: string;
  label: string;
};

export const SNAP_LAYOUT_COLUMNS = 6;
export const SNAP_LAYOUT_ROWS = 2;

export const SNAP_LAYOUTS: SnapLayout[] = [
  {
    cells: [
      {
        columnSpan: 3,
        columnStart: 1,
        label: "왼쪽 절반",
        rowSpan: 2,
        rowStart: 1,
        zone: "left",
      },
      {
        columnSpan: 3,
        columnStart: 4,
        label: "오른쪽 절반",
        rowSpan: 2,
        rowStart: 1,
        zone: "right",
      },
    ],
    id: "halves",
    label: "좌우 절반",
  },
  {
    cells: [
      {
        columnSpan: 2,
        columnStart: 1,
        label: "왼쪽 3분의 1",
        rowSpan: 2,
        rowStart: 1,
        zone: "left-third",
      },
      {
        columnSpan: 2,
        columnStart: 3,
        label: "가운데 3분의 1",
        rowSpan: 2,
        rowStart: 1,
        zone: "center-third",
      },
      {
        columnSpan: 2,
        columnStart: 5,
        label: "오른쪽 3분의 1",
        rowSpan: 2,
        rowStart: 1,
        zone: "right-third",
      },
    ],
    id: "thirds",
    label: "3분할",
  },
  {
    cells: [
      {
        columnSpan: 4,
        columnStart: 1,
        label: "왼쪽 3분의 2",
        rowSpan: 2,
        rowStart: 1,
        zone: "left-two-thirds",
      },
      {
        columnSpan: 2,
        columnStart: 5,
        label: "오른쪽 3분의 1",
        rowSpan: 2,
        rowStart: 1,
        zone: "right-third",
      },
    ],
    id: "wide-left",
    label: "넓은 왼쪽",
  },
  {
    cells: [
      {
        columnSpan: 3,
        columnStart: 1,
        label: "왼쪽 위",
        rowSpan: 1,
        rowStart: 1,
        zone: "top-left",
      },
      {
        columnSpan: 3,
        columnStart: 4,
        label: "오른쪽 위",
        rowSpan: 1,
        rowStart: 1,
        zone: "top-right",
      },
      {
        columnSpan: 3,
        columnStart: 1,
        label: "왼쪽 아래",
        rowSpan: 1,
        rowStart: 2,
        zone: "bottom-left",
      },
      {
        columnSpan: 3,
        columnStart: 4,
        label: "오른쪽 아래",
        rowSpan: 1,
        rowStart: 2,
        zone: "bottom-right",
      },
    ],
    id: "quarters",
    label: "4분할",
  },
];

/** Every cell in the picker, in reading order — the order the arrows walk. */
export function getSnapLayoutCells(): SnapLayoutCell[] {
  return SNAP_LAYOUTS.flatMap((layout) => layout.cells);
}

/**
 * The one zone left over after snapping to `zone`, where Snap Assist offers
 * the other windows. Only for arrangements with exactly one hole: after a
 * third or a quarter there are two places left, and Windows does not guess.
 */
export function getSnapZoneComplement(zone: SnapZone): SnapZone | null {
  if (zone === "left") return "right";
  if (zone === "right") return "left";
  if (zone === "left-two-thirds") return "right-third";
  if (zone === "right-two-thirds") return "left-third";
  if (zone === "left-third") return "right-two-thirds";
  if (zone === "right-third") return "left-two-thirds";
  return null;
}
