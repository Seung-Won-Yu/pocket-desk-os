import { describe, expect, it } from "vitest";
import { getStartTileCommands } from "./startTileMenu";

describe("getStartTileCommands", () => {
  it("offers a folder only the one thing a folder can do", () => {
    expect(getStartTileCommands({ isFolder: true })).toEqual([
      { id: "ungroupFolder", label: "그룹 해제" },
    ]);
  });

  it("offers a pinned tile the way off 시작 and onto 작업 표시줄", () => {
    expect(getStartTileCommands({ pinnedToStart: true })).toEqual([
      { id: "open", label: "열기" },
      { id: "unpinFromStart", label: "시작 화면에서 제거" },
      { id: "pinToTaskbar", label: "작업 표시줄에 고정" },
    ]);
  });

  it("offers an app from 모든 앱 the way onto 시작", () => {
    expect(getStartTileCommands({}).map((command) => command.id)).toEqual([
      "open",
      "pinToStart",
      "pinToTaskbar",
    ]);
  });

  it("says 제거 for what is already on the taskbar", () => {
    expect(
      getStartTileCommands({ pinnedToStart: true, pinnedToTaskbar: true }).map(
        (command) => command.label,
      ),
    ).toEqual(["열기", "시작 화면에서 제거", "작업 표시줄에서 제거"]);
  });

  it("always leads with 열기 for an app", () => {
    expect(getStartTileCommands({ pinnedToTaskbar: true })[0].id).toBe("open");
  });
});
