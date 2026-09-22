import { describe, expect, it } from "vitest";
import {
  FILE_MARQUEE_THRESHOLD,
  getFileMarqueeBounds,
  getFileMarqueeSelection,
  getFileMarqueeStyle,
  isFileMarqueeVisible,
  type FileMarqueeRow,
  type FileMarqueeState,
} from "./fileMarquee";

const createState = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  extra: Partial<FileMarqueeState> = {},
): FileMarqueeState => ({
  additive: false,
  base: [],
  currentX,
  currentY,
  pointerId: 1,
  startX,
  startY,
  ...extra,
});

const rows: FileMarqueeRow[] = [
  { bottom: 34, id: "a", left: 0, right: 700, top: 0 },
  { bottom: 68, id: "b", left: 0, right: 700, top: 34 },
  { bottom: 102, id: "c", left: 0, right: 700, top: 68 },
];

describe("getFileMarqueeBounds", () => {
  it("normalises a drag that runs up and to the left", () => {
    expect(getFileMarqueeBounds(createState(300, 200, 100, 50))).toEqual({
      bottom: 200,
      height: 150,
      left: 100,
      right: 300,
      top: 50,
      width: 200,
    });
  });

  it("reports an empty rectangle for a press that never moved", () => {
    expect(getFileMarqueeBounds(createState(40, 40, 40, 40))).toMatchObject({
      height: 0,
      width: 0,
    });
  });
});

describe("isFileMarqueeVisible", () => {
  it("treats a press with a twitch as a click, not a band", () => {
    expect(isFileMarqueeVisible(createState(10, 10, 15, 15))).toBe(false);
  });

  it("counts a band once either axis passes the threshold", () => {
    expect(isFileMarqueeVisible(createState(10, 10, 10 + FILE_MARQUEE_THRESHOLD + 1, 10))).toBe(
      true,
    );
    expect(isFileMarqueeVisible(createState(10, 10, 10, 10 + FILE_MARQUEE_THRESHOLD + 1))).toBe(
      true,
    );
  });
});

describe("getFileMarqueeStyle", () => {
  it("gives the box its geometry and nothing else", () => {
    expect(getFileMarqueeStyle(createState(100, 100, 140, 160))).toEqual({
      height: 60,
      left: 100,
      top: 100,
      width: 40,
    });
  });
});

describe("getFileMarqueeSelection", () => {
  it("takes every row the band touches, in list order", () => {
    expect(getFileMarqueeSelection(createState(600, 90, 20, 20), rows)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("takes a row the band only grazes", () => {
    expect(getFileMarqueeSelection(createState(10, 60, 40, 70), rows)).toEqual(["b", "c"]);
  });

  it("takes nothing while the drag is still a click", () => {
    expect(getFileMarqueeSelection(createState(10, 10, 13, 12), rows)).toEqual([]);
  });

  it("misses rows the band stops short of", () => {
    expect(getFileMarqueeSelection(createState(0, 0, 200, 30), rows)).toEqual(["a"]);
  });

  it("ignores rows to the side of a narrow band", () => {
    const columns: FileMarqueeRow[] = [
      { bottom: 100, id: "left", left: 0, right: 90, top: 0 },
      { bottom: 100, id: "right", left: 400, right: 490, top: 0 },
    ];
    expect(getFileMarqueeSelection(createState(120, 10, 300, 90), columns)).toEqual([]);
  });

  it("adds to the selection it started from when Ctrl is held", () => {
    const state = createState(10, 40, 200, 90, { additive: true, base: ["a"] });
    expect(getFileMarqueeSelection(state, rows)).toEqual(["a", "b", "c"]);
  });

  it("never lists a row the band re-covers twice", () => {
    const state = createState(10, 10, 200, 90, { additive: true, base: ["b"] });
    expect(getFileMarqueeSelection(state, rows)).toEqual(["b", "a", "c"]);
  });

  it("keeps an additive selection through a press that never became a band", () => {
    const state = createState(10, 10, 12, 12, { additive: true, base: ["c"] });
    expect(getFileMarqueeSelection(state, rows)).toEqual(["c"]);
  });

  it("clears a plain selection through a press that never became a band", () => {
    expect(getFileMarqueeSelection(createState(10, 10, 12, 12, { base: ["c"] }), rows)).toEqual(
      [],
    );
  });
});
