import { Globe2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import AppIconTile from "../../components/AppIconTile";
import { resolveShortcutTarget } from "../../utils/safeUrl";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";

/**
 * Windows' 새로 만들기 > 바로 가기 wizard, sized to what a browser desktop can
 * honestly do: an address plus a display name, validated to http(s) before
 * anything is written. Reuses the Run dialog's frame styles on purpose — it is
 * the same species of small modal.
 */
export function ShortcutDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, target: string) => void;
}) {
  useReturnFocus();
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const target = resolveShortcutTarget(address);
    if (!target) {
      setError("http 또는 https 주소만 바로 가기로 만들 수 있습니다.");
      return;
    }
    onCreate(name, target);
  };

  return (
    <div className="run-overlay" onPointerDown={onClose}>
      <form
        aria-labelledby="shortcut-dialog-title"
        aria-modal="true"
        className="run-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <div className="run-dialog-header">
          <AppIconTile accent="#5a9cf8" icon={Globe2} size="medium" />
          <div>
            <p>PocketDesk</p>
            <h2 id="shortcut-dialog-title">인터넷 바로 가기 만들기</h2>
          </div>
          <button
            aria-label="바로 가기 만들기 닫기"
            onClick={onClose}
            title="닫기"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <label className="run-input-row">
          <span>위치</span>
          <input
            aria-label="항목 위치"
            onChange={(event) => {
              setAddress(event.target.value);
              setError("");
            }}
            placeholder="https://example.com"
            ref={inputRef}
            spellCheck={false}
            value={address}
          />
        </label>
        <label className="run-input-row">
          <span>이름</span>
          <input
            aria-label="바로 가기 이름"
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder="바로 가기 이름 (선택)"
            spellCheck={false}
            value={name}
          />
        </label>
        {error && (
          <p className="shortcut-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="run-actions">
          <button onClick={onClose} type="button">
            취소
          </button>
          <button disabled={!address.trim()} type="submit">
            만들기
          </button>
        </div>
      </form>
    </div>
  );
}
