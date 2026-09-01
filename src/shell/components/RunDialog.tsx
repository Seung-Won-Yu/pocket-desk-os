import AppIconTile from "../../components/AppIconTile";
import { runCommandSuggestions } from "../constants";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";
import { SquareTerminal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

export function RunDialog({
  onClose,
  onExecute,
}: {
  onClose: () => void;
  onExecute: (command: string) => void;
}) {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useReturnFocus();

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onExecute(command);
  };

  const chooseSuggestion = (value: string) => {
    setCommand(value);
    inputRef.current?.focus();
  };

  return (
    <div className="run-overlay" onPointerDown={onClose}>
      <form
        aria-labelledby="run-dialog-title"
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
          <AppIconTile accent="#78d6ff" icon={SquareTerminal} size="medium" />
          <div>
            <p>PocketDesk</p>
            <h2 id="run-dialog-title">실행</h2>
          </div>
          <button aria-label="실행 창 닫기" onClick={onClose} title="닫기" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <label className="run-input-row">
          <span>열기</span>
          <input
            aria-label="열기"
            onChange={(event) => setCommand(event.target.value)}
            ref={inputRef}
            spellCheck={false}
            value={command}
          />
        </label>
        <div aria-label="실행 명령어" className="run-suggestions" role="group">
          {runCommandSuggestions.map((suggestion) => (
            <button
              key={suggestion.command}
              onClick={() => chooseSuggestion(suggestion.command)}
              type="button"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
        <div className="run-actions">
          <button onClick={onClose} type="button">
            취소
          </button>
          <button disabled={!command.trim()} type="submit">
            확인
          </button>
        </div>
      </form>
    </div>
  );
}
