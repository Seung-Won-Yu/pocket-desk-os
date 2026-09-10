import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import AppIconTile from "../../components/AppIconTile";
import type { DesktopItem } from "../../types";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";

/**
 * Windows asks before a Shift+Delete, and it is the only delete it asks
 * about: the 휴지통 can give a file back, this cannot. The question is the
 * shell's rather than one window's, because the desktop and every 탐색기
 * window reach the same delete.
 */
export function PermanentDeleteDialog({
  items,
  onCancel,
  onConfirm,
}: {
  items: DesktopItem[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useReturnFocus();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 취소 holds the focus: the other button cannot be undone.
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const [first] = items;
  const subject =
    items.length === 1 ? `"${first?.name ?? ""}"` : `선택한 항목 ${items.length}개`;

  return (
    <div className="run-overlay" onPointerDown={onCancel}>
      <section
        aria-labelledby="permanent-delete-title"
        aria-modal="true"
        className="run-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="run-dialog-header">
          <AppIconTile accent="#e2564c" icon={AlertTriangle} size="medium" />
          <div>
            <p>PocketDesk</p>
            <h2 id="permanent-delete-title">항목을 완전히 삭제할까요?</h2>
          </div>
          <button aria-label="대화 상자 닫기" onClick={onCancel} title="닫기" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className="name-conflict-summary">
          {subject}을(를) 완전히 삭제합니다. 휴지통을 거치지 않으므로 되돌릴 수 없습니다.
        </p>
        <div className="run-actions">
          <button onClick={onCancel} ref={cancelRef} type="button">
            취소
          </button>
          <button className="file-danger" onClick={onConfirm} type="button">
            완전히 삭제
          </button>
        </div>
      </section>
    </div>
  );
}
