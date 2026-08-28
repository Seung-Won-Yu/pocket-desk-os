import { Bomb, Check, Flag, History, RotateCcw, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { trapDialogFocus } from "../shell/dialogFocus";
import { getNextRovingIndex } from "../shell/keyboardNav";

type MinesDifficultyId = "easy" | "medium" | "hard";

type MinesDifficulty = {
  cols: number;
  id: MinesDifficultyId;
  label: string;
  mines: number;
  rows: number;
};

type MineCell = {
  adjacent: number;
  flagged: boolean;
  id: string;
  mine: boolean;
  revealed: boolean;
};

type MinesweeperAppProps = {
  growWindow: (windowId: string, delta: { width: number; height: number }) => void;
  playSound: (effect: "error" | "success") => void;
  windowId: string;
};

const MINES_BEST_RECORDS_KEY = "pocket-desk-mines-best-records-v1";

const minesDifficulties: MinesDifficulty[] = [
  { cols: 9, id: "easy", label: "초급", mines: 10, rows: 9 },
  { cols: 16, id: "medium", label: "중급", mines: 40, rows: 16 },
  { cols: 30, id: "hard", label: "고급", mines: 99, rows: 16 },
];

export default function MinesweeperApp({
  growWindow,
  playSound,
  windowId,
}: MinesweeperAppProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [difficultyId, setDifficultyId] = useState<MinesDifficultyId>("easy");
  const difficulty = getMinesDifficulty(difficultyId);

  /*
   * Windows resizes its Minesweeper window to the board. The 고급 grid needs
   * 461px of the 438px this window opens with, so 32 of its 480 cells started
   * outside the frame — a third of the last two columns, in a game that is
   * pure global inference.
   */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    // A hidden or maximized window has no size to read and cannot grow anyway;
    // measuring one produced an overflow the shell could never satisfy.
    if (!stage || stage.clientWidth === 0 || stage.clientHeight === 0) return;
    growWindow(windowId, {
      height: stage.scrollHeight - stage.clientHeight,
      width: stage.scrollWidth - stage.clientWidth,
    });
    // growWindow is stable; listing it here would only re-run this on every
    // render of the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyId, windowId]);
  const [board, setBoard] = useState(() => createMineBoard(difficulty));
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [boardReady, setBoardReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [detonatedIndex, setDetonatedIndex] = useState<number | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const resultDialogRef = useRef<HTMLElement | null>(null);
  // role="grid" promises a single tab stop with arrow keys inside it. Without a
  // roving target every cell was its own tab stop — 480 of them on expert.
  const [activeIndex, setActiveIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // The result dialog is modal, so focus has to move into it or the board
  // behind stays the Tab target.
  useEffect(() => {
    if (!resultVisible) return;
    const frameId = window.requestAnimationFrame(() => resultDialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [resultVisible]);
  const [newBest, setNewBest] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [bestRecords, setBestRecords] = useState<Record<MinesDifficultyId, number | null>>(() =>
    loadMinesBestRecords(),
  );

  useEffect(() => {
    if (!started || status !== "playing") return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [started, status]);

  useEffect(() => {
    localStorage.setItem(MINES_BEST_RECORDS_KEY, JSON.stringify(bestRecords));
  }, [bestRecords]);

  const reset = () => {
    setBoard(createMineBoard(difficulty));
    setStatus("playing");
    setBoardReady(false);
    setStarted(false);
    setElapsedSeconds(0);
    setDetonatedIndex(null);
    setResultVisible(false);
    setNewBest(false);
    setFlagMode(false);
    setActiveIndex(0);
  };

  const changeDifficulty = (nextDifficultyId: MinesDifficultyId) => {
    const nextDifficulty = getMinesDifficulty(nextDifficultyId);
    setDifficultyId(nextDifficulty.id);
    setBoard(createMineBoard(nextDifficulty));
    setStatus("playing");
    setBoardReady(false);
    setStarted(false);
    setElapsedSeconds(0);
    setDetonatedIndex(null);
    setResultVisible(false);
    setNewBest(false);
    setFlagMode(false);
    setActiveIndex(0);
  };

  const finishWin = (completedBoard: MineCell[]) => {
    const completedTime = Math.max(elapsedSeconds, 1);
    const currentBest = bestRecords[difficulty.id];
    const hasNewBest = currentBest === null || completedTime < currentBest;

    setBoard(
      completedBoard.map((cell) =>
        cell.mine ? { ...cell, flagged: true, revealed: false } : cell,
      ),
    );
    setStatus("won");
    setStarted(false);
    setElapsedSeconds(completedTime);
    setDetonatedIndex(null);
    setResultVisible(true);
    setNewBest(hasNewBest);
    playSound("success");

    if (hasNewBest) {
      setBestRecords((current) => ({ ...current, [difficulty.id]: completedTime }));
    }
  };

  const finishLoss = (failedBoard: MineCell[], explodedIndex: number) => {
    setBoard(
      failedBoard.map((cell) =>
        cell.mine && !cell.flagged ? { ...cell, revealed: true } : cell,
      ),
    );
    setStatus("lost");
    setStarted(false);
    setDetonatedIndex(explodedIndex);
    setResultVisible(true);
    setNewBest(false);
    playSound("error");
  };

  const reveal = (index: number) => {
    if (status !== "playing") return;
    let activeBoard = board;
    let target = activeBoard[index];
    if (!target || target.flagged) return;

    if (target.revealed) {
      if (target.adjacent === 0) return;
      const neighbors = getNeighbors(index, difficulty);
      const adjacentFlags = neighbors.filter(
        (neighbor) => activeBoard[neighbor]?.flagged,
      ).length;
      if (adjacentFlags !== target.adjacent) return;

      const explodedNeighbor = neighbors.find(
        (neighbor) => activeBoard[neighbor]?.mine && !activeBoard[neighbor]?.flagged,
      );
      if (explodedNeighbor !== undefined) {
        finishLoss(activeBoard, explodedNeighbor);
        return;
      }

      let chordedBoard = activeBoard;
      neighbors.forEach((neighbor) => {
        if (!chordedBoard[neighbor]?.flagged) {
          chordedBoard = revealSafeCells(chordedBoard, neighbor, difficulty);
        }
      });
      setBoard(chordedBoard);
      if (chordedBoard.every((cell) => cell.mine || cell.revealed)) {
        finishWin(chordedBoard);
      }
      return;
    }

    if (!boardReady) {
      activeBoard = createMineBoard(difficulty, index).map((cell, cellIndex) => ({
        ...cell,
        flagged: board[cellIndex]?.flagged ?? false,
      }));
      target = activeBoard[index];
      setBoardReady(true);
    }

    setStarted(true);

    if (target.mine) {
      finishLoss(activeBoard, index);
      return;
    }

    const next = revealSafeCells(activeBoard, index, difficulty);
    setBoard(next);

    if (next.every((cell) => cell.mine || cell.revealed)) {
      finishWin(next);
    }
  };

  const toggleFlagAt = (index: number) => {
    if (status !== "playing") return;
    setBoard((current) =>
      current.map((cell, cellIndex) =>
        cellIndex === index && !cell.revealed ? { ...cell, flagged: !cell.flagged } : cell,
      ),
    );
  };

  const toggleFlag = (event: ReactMouseEvent, index: number) => {
    event.preventDefault();
    toggleFlagAt(index);
  };

  const activateCell = (index: number) => {
    if (flagMode) {
      toggleFlagAt(index);
      return;
    }
    reveal(index);
  };

  const resultDialogOpen = status !== "playing" && resultVisible;
  // A difficulty change swaps the board size, so keep the roving target inside
  // it: a target past the end would leave the board with no tab stop at all.
  const rovingIndex = Math.min(activeIndex, board.length - 1);

  const focusCellAt = (index: number) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-mine-index="${index}"]`)?.focus();
  };

  /**
   * Arrow, Home and End movement for the board. Enter and Space are left to the
   * cells themselves, which are buttons and already activate on both — reveal,
   * or plant a flag while flag mode is on.
   */
  const handleBoardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // The result dialog is modal, so the board behind it must stay inert.
    if (resultDialogOpen) return;
    const nextIndex = getNextRovingIndex(event.key, rovingIndex, board.length, difficulty.cols);
    if (nextIndex === null) return;
    // Arrows would otherwise scroll the stage out from under the board.
    event.preventDefault();
    setActiveIndex(nextIndex);
    focusCellAt(nextIndex);
  };

  const flagCount = board.filter((cell) => cell.flagged).length;
  const remainingMines = difficulty.mines - flagCount;
  const wrongFlagCount = board.filter((cell) => cell.flagged && !cell.mine).length;
  const bestRecord = bestRecords[difficulty.id];
  const displayedBestRecord = status === "won" && newBest ? elapsedSeconds : bestRecord;

  return (
    <div className="mines-app">
      <div className="mines-scorebar">
        <div className="mines-counter">
          <Bomb aria-hidden="true" size={17} />
          <span>
            <small>남은 지뢰</small>
            <strong>{formatMineCounter(remainingMines)}</strong>
          </span>
        </div>
        <button
          aria-label="새 게임"
          className="mines-face"
          onClick={reset}
          title="새 게임"
          type="button"
        >
          {status === "won" ? "😎" : status === "lost" ? "😵" : "🙂"}
        </button>
        <div className="mines-counter is-time">
          <History aria-hidden="true" size={17} />
          <span>
            <small>시간</small>
            <strong>{formatDuration(elapsedSeconds)}</strong>
          </span>
        </div>
      </div>
      <div className="mines-commandbar">
        <label>
          <span>난이도</span>
          <select
            aria-label="지뢰찾기 난이도"
            onChange={(event) => changeDifficulty(event.target.value as MinesDifficultyId)}
            value={difficulty.id}
          >
            {minesDifficulties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span>
          {difficulty.cols} × {difficulty.rows}
        </span>
        <button
          aria-label="깃발 모드"
          aria-pressed={flagMode}
          className="mines-flag-mode"
          onClick={() => setFlagMode((current) => !current)}
          title="깃발 모드"
          type="button"
        >
          <Flag aria-hidden="true" size={14} />
        </button>
        <span>
          {status === "lost" && wrongFlagCount > 0
            ? `잘못된 깃발 ${wrongFlagCount}`
            : `깃발 ${flagCount}`}
        </span>
        <span className="mines-best">
          최고 {bestRecord === null ? "--" : formatDuration(bestRecord)}
        </span>
      </div>
      <div className={`mines-stage is-${status}`} ref={stageRef}>
        <div
          aria-colcount={difficulty.cols}
          aria-label={`지뢰찾기 ${difficulty.label} 보드`}
          aria-readonly={status !== "playing"}
          aria-rowcount={difficulty.rows}
          className="mine-grid"
          onKeyDown={handleBoardKeyDown}
          ref={gridRef}
          role="grid"
          style={
            {
              "--mine-cols": difficulty.cols,
              "--mine-font-size":
                difficulty.id === "hard"
                  ? "0.55rem"
                  : difficulty.id === "medium"
                    ? "0.7rem"
                    : "1rem",
              "--mine-gap":
                difficulty.id === "hard" ? "1px" : difficulty.id === "medium" ? "2px" : "4px",
              "--mine-radius":
                difficulty.id === "hard" ? "2px" : difficulty.id === "medium" ? "3px" : "4px",
              "--mine-rows": difficulty.rows,
            } as CSSProperties
          }
        >
          {Array.from({ length: difficulty.rows }, (_, rowIndex) => (
            // A grid may not hold cells directly, and a screen reader reads
            // coordinates off the rows. `display: contents` drops the wrapper
            // box so every cell stays a direct item of the CSS grid.
            <div
              aria-rowindex={rowIndex + 1}
              key={`mine-row-${rowIndex}`}
              role="row"
              style={{ display: "contents" }}
            >
              {board
                .slice(rowIndex * difficulty.cols, (rowIndex + 1) * difficulty.cols)
                .map((cell, columnIndex) => {
                  const index = rowIndex * difficulty.cols + columnIndex;

                  return (
                    <button
                      aria-colindex={columnIndex + 1}
                      aria-label={`${index + 1}번 칸${
                        cell.flagged
                          ? status === "lost" && !cell.mine
                            ? ", 잘못된 깃발"
                            : ", 깃발"
                          : cell.revealed
                            ? `, ${cell.mine ? "지뢰" : cell.adjacent}`
                            : ""
                      }`}
                      aria-rowindex={rowIndex + 1}
                      className={`mine-cell ${cell.revealed ? "is-open" : ""} ${
                        cell.flagged && !cell.revealed ? "is-flagged" : ""
                      } ${cell.revealed && cell.mine ? "is-mine" : ""} ${
                        cell.revealed && cell.adjacent > 0 ? `mine-number-${cell.adjacent}` : ""
                      } ${
                        status === "lost" && cell.flagged && !cell.mine ? "is-wrong-flag" : ""
                      } ${detonatedIndex === index ? "is-detonated" : ""}`}
                      data-mine-index={index}
                      disabled={status !== "playing"}
                      key={cell.id}
                      onClick={() => activateCell(index)}
                      onContextMenu={(event) => toggleFlag(event, index)}
                      // However focus arrives — Tab, a click, an arrow key —
                      // that cell becomes the one tab stop the board keeps.
                      onFocus={() => setActiveIndex(index)}
                      role="gridcell"
                      tabIndex={index === rovingIndex ? 0 : -1}
                      type="button"
                    >
                      {status === "lost" && cell.flagged && !cell.mine ? (
                        <X aria-hidden="true" size={17} />
                      ) : cell.flagged && !cell.revealed ? (
                        <Flag aria-hidden="true" size={15} />
                      ) : cell.revealed && cell.mine ? (
                        <Bomb aria-hidden="true" size={16} />
                      ) : cell.revealed && cell.adjacent > 0 ? (
                        cell.adjacent
                      ) : null}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
        {resultDialogOpen && (
          <div className="mines-result-overlay">
            <section
              aria-labelledby="mines-result-title"
              aria-modal="true"
              className={`mines-result-dialog is-${status}`}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setResultVisible(false);
                  return;
                }
                trapDialogFocus(event, event.currentTarget);
              }}
              ref={resultDialogRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="mines-result-heading">
                <span className="mines-result-icon">
                  {status === "won" ? (
                    <Check aria-hidden="true" size={22} />
                  ) : (
                    <Bomb aria-hidden="true" size={22} />
                  )}
                </span>
                <span>
                  <h2 id="mines-result-title">
                    {status === "won" ? "게임 완료" : "게임 종료"}
                  </h2>
                  <p>
                    {status === "won"
                      ? "모든 지뢰를 찾았습니다."
                      : wrongFlagCount > 0
                        ? `지뢰를 밟았습니다. 잘못된 깃발 ${wrongFlagCount}개`
                        : "지뢰를 밟았습니다."}
                  </p>
                </span>
              </div>
              {newBest && <strong className="mines-new-record">새 최고 기록</strong>}
              <dl className="mines-result-stats">
                <div>
                  <dt>난이도</dt>
                  <dd>{difficulty.label}</dd>
                </div>
                <div>
                  <dt>시간</dt>
                  <dd>{formatDuration(elapsedSeconds)}</dd>
                </div>
                <div>
                  <dt>최고 기록</dt>
                  <dd>
                    {displayedBestRecord === null ? "--" : formatDuration(displayedBestRecord)}
                  </dd>
                </div>
              </dl>
              <div className="mines-result-actions">
                <button autoFocus className="is-primary" onClick={reset} type="button">
                  <RotateCcw aria-hidden="true" size={15} />
                  다시 플레이
                </button>
                <button onClick={() => setResultVisible(false)} type="button">
                  보드 보기
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function getMinesDifficulty(difficultyId: MinesDifficultyId) {
  return (
    minesDifficulties.find((difficulty) => difficulty.id === difficultyId) ??
    minesDifficulties[0]
  );
}

function loadMinesBestRecords(): Record<MinesDifficultyId, number | null> {
  const fallback: Record<MinesDifficultyId, number | null> = {
    easy: null,
    hard: null,
    medium: null,
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(MINES_BEST_RECORDS_KEY) ?? "{}") as Partial<
      Record<MinesDifficultyId, unknown>
    >;

    return {
      easy: normalizeBestRecord(parsed.easy),
      hard: normalizeBestRecord(parsed.hard),
      medium: normalizeBestRecord(parsed.medium),
    };
  } catch {
    return fallback;
  }
}

function normalizeBestRecord(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function createMineBoard(difficulty: MinesDifficulty, safeStartIndex?: number): MineCell[] {
  const size = difficulty.rows * difficulty.cols;
  const excludedPositions = new Set<number>();

  if (safeStartIndex !== undefined) {
    excludedPositions.add(safeStartIndex);
    getNeighbors(safeStartIndex, difficulty).forEach((index) => excludedPositions.add(index));
  }

  const candidates = Array.from({ length: size }, (_, index) => index).filter(
    (index) => !excludedPositions.has(index),
  );

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  const minePositions = new Set(candidates.slice(0, difficulty.mines));

  return Array.from({ length: size }, (_, index) => ({
    adjacent: getNeighbors(index, difficulty).filter((neighbor) => minePositions.has(neighbor))
      .length,
    flagged: false,
    id: `cell-${index}`,
    mine: minePositions.has(index),
    revealed: false,
  }));
}

function revealSafeCells(
  board: MineCell[],
  startIndex: number,
  difficulty: MinesDifficulty,
): MineCell[] {
  const next = board.map((cell) => ({ ...cell }));
  const stack = [startIndex];
  const seen = new Set<number>();

  while (stack.length) {
    const index = stack.pop()!;
    if (seen.has(index)) continue;
    seen.add(index);
    const cell = next[index];
    if (!cell || cell.mine || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) {
      getNeighbors(index, difficulty).forEach((neighbor) => stack.push(neighbor));
    }
  }

  return next;
}

function getNeighbors(index: number, difficulty: MinesDifficulty) {
  const row = Math.floor(index / difficulty.cols);
  const column = index % difficulty.cols;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + colOffset;
      if (
        nextRow >= 0 &&
        nextRow < difficulty.rows &&
        nextColumn >= 0 &&
        nextColumn < difficulty.cols
      ) {
        neighbors.push(nextRow * difficulty.cols + nextColumn);
      }
    }
  }

  return neighbors;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/*
 * Windows drives this readout with three seven-segment digits, so 99 mines read
 * 099 and the counter never changes width as it counts down. Two digits made it
 * jump between 100 and 99 on the 고급 board.
 */
function formatMineCounter(value: number) {
  if (value < 0) {
    return `-${Math.min(99, Math.abs(value)).toString().padStart(2, "0")}`;
  }
  return Math.min(999, value).toString().padStart(3, "0");
}
