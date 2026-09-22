/**
 * 시작 메뉴 항목 메뉴. The tile's menu offered one command — 시작 화면에서
 * 제거 — whether the tile was pinned or listed under 모든 앱, and said nothing
 * about the taskbar. Windows' own menu answers three questions: open it, is it
 * on 시작, is it on 작업 표시줄. Which of those are offered is decided here.
 */
export type StartTileCommandId =
  | "open"
  | "pinToStart"
  | "unpinFromStart"
  | "pinToTaskbar"
  | "unpinFromTaskbar"
  | "ungroupFolder";

export type StartTileCommand = { id: StartTileCommandId; label: string };

export type StartTileTarget = {
  /** A folder of tiles, which is neither an app nor pinnable to the taskbar. */
  isFolder?: boolean;
  pinnedToStart?: boolean;
  pinnedToTaskbar?: boolean;
};

export function getStartTileCommands(target: StartTileTarget): StartTileCommand[] {
  // A folder lives only on 시작; the one thing to do with it is take it apart.
  if (target.isFolder) return [{ id: "ungroupFolder", label: "그룹 해제" }];

  return [
    { id: "open", label: "열기" },
    target.pinnedToStart
      ? { id: "unpinFromStart", label: "시작 화면에서 제거" }
      : { id: "pinToStart", label: "시작 화면에 고정" },
    target.pinnedToTaskbar
      ? { id: "unpinFromTaskbar", label: "작업 표시줄에서 제거" }
      : { id: "pinToTaskbar", label: "작업 표시줄에 고정" },
  ];
}
