import { AppWindow, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AppIconTile from "../../components/AppIconTile";
import { appMetadata } from "../../apps/metadata";
import { type AppId, type DesktopItem } from "../../types";
import { type OpenWithChoice } from "../../vfs/openWith";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";

/**
 * 다른 앱 선택 — Windows' "이 파일을 열 때 사용할 앱". The list is the one
 * 설정 > 기본 앱 offers for this extension, and 항상 이 앱을 사용 writes the
 * same setting, so choosing here and choosing there are one decision.
 */
export function OpenWithDialog({
  canRemember,
  choices,
  extensionLabel,
  item,
  onCancel,
  onOpen,
}: {
  /** Whether 기본 앱 has a setting for this extension at all. */
  canRemember: boolean;
  choices: OpenWithChoice[];
  extensionLabel: string;
  item: DesktopItem;
  onCancel: () => void;
  onOpen: (appId: AppId, remember: boolean) => void;
}) {
  useReturnFocus();
  const [picked, setPicked] = useState<AppId>(choices[0]?.appId ?? "notepad");
  const [remember, setRemember] = useState(false);
  const firstChoiceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => firstChoiceRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="run-overlay" onPointerDown={onCancel}>
      <section
        aria-labelledby="open-with-title"
        aria-modal="true"
        className="run-dialog open-with-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          } else {
            trapDialogFocus(event, event.currentTarget);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="run-dialog-header">
          <AppIconTile accent="#0067c0" icon={AppWindow} size="medium" />
          <div>
            <p>PocketDesk</p>
            <h2 id="open-with-title">이 파일을 열 때 사용할 앱을 선택하세요</h2>
          </div>
          <button aria-label="대화 상자 닫기" onClick={onCancel} title="닫기" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <p className="name-conflict-summary">{item.name}</p>
        <div className="open-with-choices" role="radiogroup" aria-label="앱">
          {choices.map((choice, index) => {
            const app = appMetadata[choice.appId];
            return (
              <label
                className={`open-with-choice${picked === choice.appId ? " is-selected" : ""}`}
                key={choice.appId}
              >
                <input
                  checked={picked === choice.appId}
                  name="open-with-app"
                  onChange={() => setPicked(choice.appId)}
                  ref={index === 0 ? firstChoiceRef : undefined}
                  type="radio"
                  value={choice.appId}
                />
                <AppIconTile accent={app.accent} icon={app.icon} size="small" />
                <span>
                  <strong>{app.title}</strong>
                  {choice.isDefault && <small>현재 기본 앱</small>}
                </span>
              </label>
            );
          })}
        </div>
        {canRemember && (
          <label className="open-with-remember">
            <input
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              type="checkbox"
            />
            항상 이 앱을 사용하여 {extensionLabel} 파일 열기
          </label>
        )}
        <div className="run-actions">
          <button onClick={onCancel} type="button">
            취소
          </button>
          <button className="primary" onClick={() => onOpen(picked, remember)} type="button">
            확인
          </button>
        </div>
      </section>
    </div>
  );
}
