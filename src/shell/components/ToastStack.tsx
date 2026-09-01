import { type ToastMessage } from "../types";
import { BrandMark } from "./Branding";
import { X } from "lucide-react";

export function ToastStack({
  onDismiss,
  onHoldChange,
  toasts,
}: {
  onDismiss: (id: string) => void;
  /** Pointer or focus is on the toast — its auto-dismiss timer should wait. */
  onHoldChange?: (id: string, held: boolean) => void;
  toasts: ToastMessage[];
}) {
  return (
    <section aria-atomic="false" aria-label="알림" className="toast-stack" role="status">
      {toasts.map((toast) => (
        <article
          className={`toast toast-${toast.tone}`}
          key={toast.id}
          onBlurCapture={() => onHoldChange?.(toast.id, false)}
          onFocusCapture={() => onHoldChange?.(toast.id, true)}
          onPointerEnter={() => onHoldChange?.(toast.id, true)}
          onPointerLeave={() => onHoldChange?.(toast.id, false)}
        >
          <header className="toast-header">
            <BrandMark className="toast-app-mark" />
            <strong>PocketDesk</strong>
            <time dateTime={new Date(toast.createdAt).toISOString()}>지금</time>
            <button
              aria-label={`${toast.title} 알림 닫기`}
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </header>
          <div className="toast-body">
            <strong>{toast.title}</strong>
            {toast.detail && <small>{toast.detail}</small>}
          </div>
          {toast.actions.length > 0 && (
            <footer className="toast-actions">
              {toast.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    // The action first, then the dismissal — the handler may
                    // read state the dismissal path also touches.
                    toast.onAction?.(action.id);
                    onDismiss(toast.id);
                  }}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </footer>
          )}
        </article>
      ))}
    </section>
  );
}
