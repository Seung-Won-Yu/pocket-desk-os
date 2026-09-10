import { Copy, FileWarning, SkipForward, X } from "lucide-react";
import { useEffect, useRef } from "react";
import AppIconTile from "../../components/AppIconTile";
import {
  describeVfsNameConflicts,
  type VfsConflictChoice,
  type VfsNameConflict,
} from "../../vfs/nameConflicts";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";

/**
 * Windows' 파일 바꾸기 또는 건너뛰기. The shell used to answer this question by
 * itself — it renamed the incoming file to "- 복사본" and said nothing — which
 * is one of the three answers, silently chosen.
 *
 * One dialog covers the whole batch rather than asking per file: Windows' own
 * 모든 항목에 적용 does the same, and asking six times for six files would be
 * worse than either answer.
 */
export function NameConflictDialog({
  conflicts,
  mode,
  onCancel,
  onChoose,
  targetName,
}: {
  conflicts: VfsNameConflict[];
  mode: "copy" | "move";
  onCancel: () => void;
  onChoose: (choice: VfsConflictChoice) => void;
  targetName: string;
}) {
  useReturnFocus();
  const dialogRef = useRef<HTMLElement>(null);

  /*
   * Focus lands on the dialog itself, not on a choice. Every answer here is
   * one keystroke from happening and one of them writes over a file, so an
   * Enter pressed out of habit must do nothing; Tab reaches 바꾸기 first, in
   * the order Windows lists them.
   */
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const summary = describeVfsNameConflicts(conflicts);
  const count = conflicts.length;
  const verb = mode === "copy" ? "복사" : "이동";

  return (
    <div className="run-overlay" onPointerDown={onCancel}>
      <section
        aria-labelledby="name-conflict-title"
        aria-modal="true"
        className="run-dialog name-conflict-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="run-dialog-header">
          <AppIconTile accent="#e8b339" icon={FileWarning} size="medium" />
          <div>
            <p>PocketDesk</p>
            <h2 id="name-conflict-title">파일 바꾸기 또는 건너뛰기</h2>
          </div>
          <button aria-label="대화 상자 닫기" onClick={onCancel} title="닫기" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className="name-conflict-summary">
          {count === 1
            ? `${targetName} 폴더에 이미 "${summary}" 항목이 있습니다.`
            : `${targetName} 폴더에 같은 이름의 항목이 ${count}개 있습니다 — ${summary}.`}
        </p>
        <div className="name-conflict-choices">
          <button
            className="name-conflict-choice"
            onClick={() => onChoose("replace")}
            type="button"
          >
            <FileWarning aria-hidden="true" size={18} />
            <span>
              <strong>대상 폴더의 파일 바꾸기</strong>
              <small>
                {count === 1 ? "있던 항목을" : `있던 항목 ${count}개를`} 새 항목으로 바꿉니다.
              </small>
            </span>
          </button>
          <button
            className="name-conflict-choice"
            onClick={() => onChoose("skip")}
            type="button"
          >
            <SkipForward aria-hidden="true" size={18} />
            <span>
              <strong>{count === 1 ? "이 파일 건너뛰기" : `${count}개 파일 건너뛰기`}</strong>
              <small>있던 항목을 그대로 두고 {verb}하지 않습니다.</small>
            </span>
          </button>
          <button
            className="name-conflict-choice"
            onClick={() => onChoose("keepBoth")}
            type="button"
          >
            <Copy aria-hidden="true" size={18} />
            <span>
              <strong>두 파일 모두 유지</strong>
              <small>새 항목의 이름 뒤에 "- 복사본"을 붙입니다.</small>
            </span>
          </button>
        </div>
        <div className="run-actions">
          <button onClick={onCancel} type="button">
            취소
          </button>
        </div>
      </section>
    </div>
  );
}
