import { describe, expect, it } from "vitest";
import {
  CLIPBOARD_ENTRY_MAX_LENGTH,
  CLIPBOARD_HISTORY_LIMIT,
  describeClipboardEntry,
  insertClipboardText,
  pushClipboardEntry,
  removeClipboardEntry,
  type ClipboardHistoryEntry,
} from "./clipboardHistory";

const entry = (id: string, text: string, at = 0): ClipboardHistoryEntry => ({ at, id, text });

describe("pushClipboardEntry", () => {
  it("puts the newest copy first", () => {
    const history = pushClipboardEntry([entry("a", "처음")], "나중", 5, "b");
    expect(history.map((item) => item.text)).toEqual(["나중", "처음"]);
  });

  it("ignores a copy that is only whitespace", () => {
    const history = [entry("a", "처음")];
    expect(pushClipboardEntry(history, "   \n\t ", 5, "b")).toBe(history);
  });

  it("moves a repeat to the top instead of listing it twice", () => {
    const history = pushClipboardEntry(
      [entry("a", "처음"), entry("b", "다음")],
      "처음",
      9,
      "c",
    );
    expect(history.map((item) => item.text)).toEqual(["처음", "다음"]);
    expect(history[0].at).toBe(9);
  });

  it("keeps only the last ten", () => {
    let history: ClipboardHistoryEntry[] = [];
    for (let index = 0; index < CLIPBOARD_HISTORY_LIMIT + 4; index += 1) {
      history = pushClipboardEntry(history, `복사 ${index}`, index, `id-${index}`);
    }
    expect(history).toHaveLength(CLIPBOARD_HISTORY_LIMIT);
    expect(history[0].text).toBe(`복사 ${CLIPBOARD_HISTORY_LIMIT + 3}`);
  });

  it("cuts a copy too long to be worth keeping whole", () => {
    const [kept] = pushClipboardEntry([], "가".repeat(CLIPBOARD_ENTRY_MAX_LENGTH + 50), 0, "a");
    expect(kept.text).toHaveLength(CLIPBOARD_ENTRY_MAX_LENGTH);
  });
});

describe("removeClipboardEntry", () => {
  it("takes one row out and leaves the rest", () => {
    expect(
      removeClipboardEntry([entry("a", "처음"), entry("b", "다음")], "a").map(
        (item) => item.id,
      ),
    ).toEqual(["b"]);
  });
});

describe("describeClipboardEntry", () => {
  it("collapses the newlines into one line", () => {
    expect(describeClipboardEntry("한 줄\n두 줄\n\n세 줄")).toBe("한 줄 두 줄 세 줄");
  });

  it("cuts a long line with an ellipsis", () => {
    expect(describeClipboardEntry("가".repeat(100))).toBe(`${"가".repeat(79)}…`);
  });

  it("leaves a short line alone", () => {
    expect(describeClipboardEntry("  짧은 글  ")).toBe("짧은 글");
  });
});

describe("insertClipboardText", () => {
  it("drops the text in at the caret", () => {
    expect(insertClipboardText("가나다", 2, 2, "XY")).toEqual({ caret: 4, value: "가나XY다" });
  });

  it("replaces what was selected", () => {
    expect(insertClipboardText("가나다라", 1, 3, "-")).toEqual({ caret: 2, value: "가-라" });
  });

  it("clamps a caret past the end", () => {
    expect(insertClipboardText("가나", 99, 99, "!")).toEqual({ caret: 3, value: "가나!" });
  });

  it("treats a backwards range as a caret", () => {
    expect(insertClipboardText("가나다", 2, 1, "X")).toEqual({ caret: 3, value: "가나X다" });
  });
});
