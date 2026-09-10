import { describe, expect, it } from "vitest";
import type { DesktopItem } from "../types";
import {
  applyFileUndoSide,
  createFileUndoStep,
  dropFileUndoSteps,
  EMPTY_FILE_UNDO_STATE,
  getFileRedoLabel,
  getFileUndoLabel,
  pushFileUndoStep,
  stepFileUndo,
} from "./fileUndo";

function makeItem(id: string, overrides: Partial<DesktopItem> = {}): DesktopItem {
  return {
    createdAt: 0,
    id,
    kind: "note",
    name: `${id}.txt`,
    parentId: "desktop",
    showOnDesktop: false,
    updatedAt: 0,
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe("createFileUndoStep", () => {
  it("records nothing when the list did not change", () => {
    const items = [makeItem("a"), makeItem("b")];
    expect(createFileUndoStep("이동", items, [...items])).toBeNull();
  });

  it("treats a missing key and an undefined value as the same state", () => {
    const before = [makeItem("a")];
    const after = [{ ...makeItem("a"), hidden: undefined, trashed: undefined }];
    expect(createFileUndoStep("속성", before, after)).toBeNull();
  });

  it("keeps only the rows that changed", () => {
    const before = [makeItem("a"), makeItem("b"), makeItem("c")];
    const after = [makeItem("a"), makeItem("b", { name: "새 이름.txt" }), makeItem("c")];
    const step = createFileUndoStep("이름 바꾸기", before, after);
    expect(step?.ids).toEqual(["b"]);
    expect(step?.before[0].item.name).toBe("b.txt");
    expect(step?.after[0].item.name).toBe("새 이름.txt");
  });

  it("records a created row on the after side only", () => {
    const step = createFileUndoStep(
      "새로 만들기",
      [makeItem("a")],
      [makeItem("a"), makeItem("b")],
    );
    expect(step?.before).toHaveLength(0);
    expect(step?.after.map((row) => row.item.id)).toEqual(["b"]);
  });
});

describe("applyFileUndoSide", () => {
  it("undoes a rename and redoes it", () => {
    const before = [makeItem("a"), makeItem("b")];
    const after = [makeItem("a"), makeItem("b", { name: "새 이름.txt" })];
    const step = createFileUndoStep("이름 바꾸기", before, after)!;
    const undone = applyFileUndoSide(after, step, "before");
    expect(undone.map((item) => item.name)).toEqual(["a.txt", "b.txt"]);
    expect(applyFileUndoSide(undone, step, "after").map((item) => item.name)).toEqual([
      "a.txt",
      "새 이름.txt",
    ]);
  });

  it("removes a created row on undo and puts it back at its old index on redo", () => {
    const before = [makeItem("a"), makeItem("c")];
    const after = [makeItem("a"), makeItem("b"), makeItem("c")];
    const step = createFileUndoStep("새로 만들기", before, after)!;
    const undone = applyFileUndoSide(after, step, "before");
    expect(undone.map((item) => item.id)).toEqual(["a", "c"]);
    expect(applyFileUndoSide(undone, step, "after").map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("is idempotent, so a double invoke cannot apply it twice", () => {
    const before = [makeItem("a")];
    const after = [makeItem("a"), makeItem("b")];
    const step = createFileUndoStep("새로 만들기", before, after)!;
    const once = applyFileUndoSide(after, step, "before");
    expect(applyFileUndoSide(once, step, "before")).toEqual(once);
  });

  it("brings a trashed tree back out of the 휴지통", () => {
    const before = [
      makeItem("folder", { kind: "folder" }),
      makeItem("child", { parentId: "folder" }),
    ];
    const after = before.map((item) => ({ ...item, trashed: true, trashedAt: 5 }));
    const step = createFileUndoStep("삭제", before, after)!;
    const undone = applyFileUndoSide(after, step, "before");
    expect(undone.every((item) => !item.trashed)).toBe(true);
  });
});

describe("the stack", () => {
  const step = (label: string, ids: string[]) => ({
    after: [],
    before: [],
    id: label,
    ids,
    label,
  });

  it("reports the label the menu shows", () => {
    const state = pushFileUndoStep(EMPTY_FILE_UNDO_STATE, step("이름 바꾸기", ["a"]));
    expect(getFileUndoLabel(state)).toBe("이름 바꾸기");
    expect(getFileRedoLabel(state)).toBeNull();
  });

  it("moves a step across on undo and back on redo", () => {
    const pushed = pushFileUndoStep(EMPTY_FILE_UNDO_STATE, step("이동", ["a"]));
    const undone = stepFileUndo(pushed, "undo")!;
    expect(getFileUndoLabel(undone.state)).toBeNull();
    expect(getFileRedoLabel(undone.state)).toBe("이동");
    const redone = stepFileUndo(undone.state, "redo")!;
    expect(getFileUndoLabel(redone.state)).toBe("이동");
  });

  it("drops the redo branch when a new operation lands", () => {
    const pushed = pushFileUndoStep(EMPTY_FILE_UNDO_STATE, step("이동", ["a"]));
    const undone = stepFileUndo(pushed, "undo")!.state;
    const next = pushFileUndoStep(undone, step("삭제", ["b"]));
    expect(getFileRedoLabel(next)).toBeNull();
    expect(getFileUndoLabel(next)).toBe("삭제");
  });

  it("keeps the stack bounded", () => {
    let state = EMPTY_FILE_UNDO_STATE;
    for (let index = 0; index < 30; index += 1) {
      state = pushFileUndoStep(state, step(`작업 ${index}`, [`item-${index}`]), 5);
    }
    expect(state.undo).toHaveLength(5);
    expect(getFileUndoLabel(state)).toBe("작업 29");
  });

  it("drops steps that touch a permanently deleted row", () => {
    let state = pushFileUndoStep(EMPTY_FILE_UNDO_STATE, step("이름 바꾸기", ["a"]));
    state = pushFileUndoStep(state, step("이동", ["b"]));
    const pruned = dropFileUndoSteps(state, ["a"]);
    expect(pruned.undo.map((entry) => entry.label)).toEqual(["이동"]);
  });

  it("leaves the stack alone when nothing it holds was deleted", () => {
    const state = pushFileUndoStep(EMPTY_FILE_UNDO_STATE, step("이동", ["a"]));
    expect(dropFileUndoSteps(state, ["z"])).toBe(state);
  });
});
