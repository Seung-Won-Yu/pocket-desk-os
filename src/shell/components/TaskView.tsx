import { Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import AppIconTile from "../../components/AppIconTile";
import { trapDialogFocus } from "../dialogFocus";
import { getApp } from "../appCatalog";
import { APP_BAR_HEIGHT, MAX_VIRTUAL_DESKTOPS } from "../constants";
import { type WindowInstance } from "../types";

/**
 * Task View: one card per virtual desktop, each holding scaled-down previews of
 * the windows that live on it. Mirrors the Win+Tab overview.
 */
export function TaskView({
  activeDesktopIndex,
  desktopCount,
  onAddDesktop,
  onCloseDesktop,
  onDismiss,
  onMoveWindowToDesktop,
  onSelectDesktop,
  onSelectWindow,
  windows,
}: {
  activeDesktopIndex: number;
  desktopCount: number;
  onAddDesktop: () => void;
  onCloseDesktop: (index: number) => void;
  onDismiss: () => void;
  onMoveWindowToDesktop: (windowId: string, index: number) => void;
  onSelectDesktop: (index: number) => void;
  onSelectWindow: (windowId: string) => void;
  windows: WindowInstance[];
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Focus has to enter the overlay, or Tab keeps walking the desktop behind it.
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => rootRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const workAreaWidth = Math.max(320, window.innerWidth);
  const workAreaHeight = Math.max(240, window.innerHeight - APP_BAR_HEIGHT);

  const previewStyle = (item: WindowInstance) => {
    if (item.maximized) {
      return { height: "100%", left: 0, top: 0, width: "100%" };
    }
    return {
      height: `${(item.height / workAreaHeight) * 100}%`,
      left: `${(item.x / workAreaWidth) * 100}%`,
      top: `${(item.y / workAreaHeight) * 100}%`,
      width: `${(item.width / workAreaWidth) * 100}%`,
    };
  };

  return (
    <div
      aria-label="작업 보기"
      aria-modal="true"
      className="task-view"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDismiss();
          return;
        }
        trapDialogFocus(event, event.currentTarget);
      }}
      ref={rootRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="task-view-desktops">
        {Array.from({ length: desktopCount }, (_, index) => {
          const desktopWindows = windows.filter((item) => item.desktopIndex === index);
          return (
            <div className="task-view-desktop-slot" key={index}>
              <button
                aria-current={index === activeDesktopIndex}
                className={`task-view-desktop${index === activeDesktopIndex ? " is-active" : ""}`}
                onClick={() => onSelectDesktop(index)}
                type="button"
              >
                <span aria-hidden="true" className="task-view-thumbs">
                  {desktopWindows.map((item) => (
                    <span
                      className="task-view-thumb"
                      key={item.id}
                      style={{ ...previewStyle(item), zIndex: item.z }}
                    >
                      <AppIconTile
                        accent={getApp(item.appId).accent}
                        icon={getApp(item.appId).icon}
                        size="small"
                      />
                    </span>
                  ))}
                </span>
                <span className="task-view-desktop-label">
                  데스크톱 {index + 1}
                  <em>{desktopWindows.length}개 창</em>
                </span>
              </button>
              {desktopCount > 1 && (
                <button
                  aria-label={`데스크톱 ${index + 1} 닫기`}
                  className="task-view-desktop-close"
                  onClick={() => onCloseDesktop(index)}
                  title="데스크톱 닫기"
                  type="button"
                >
                  <X aria-hidden="true" size={13} />
                </button>
              )}
            </div>
          );
        })}
        {desktopCount < MAX_VIRTUAL_DESKTOPS && (
          <button className="task-view-add" onClick={onAddDesktop} type="button">
            <Plus aria-hidden="true" size={22} />새 데스크톱
          </button>
        )}
      </div>

      <div className="task-view-windows" aria-label={`데스크톱 ${activeDesktopIndex + 1}의 창`}>
        {windows.filter((item) => item.desktopIndex === activeDesktopIndex).length === 0 ? (
          <p className="task-view-empty">이 데스크톱에는 열린 창이 없습니다.</p>
        ) : (
          windows
            .filter((item) => item.desktopIndex === activeDesktopIndex)
            .sort((first, second) => second.z - first.z)
            .map((item) => {
              const app = getApp(item.appId);
              return (
                <div className="task-view-card" key={item.id}>
                  <button onClick={() => onSelectWindow(item.id)} type="button">
                    <AppIconTile accent={app.accent} icon={app.icon} size="large" />
                    <strong>{app.title}</strong>
                    <small>
                      {item.maximized
                        ? "최대화"
                        : `${Math.round(item.width)} × ${Math.round(item.height)}`}
                      {item.minimized ? " · 최소화됨" : ""}
                    </small>
                  </button>
                  {desktopCount > 1 && (
                    <label>
                      이동
                      <select
                        onChange={(event) =>
                          onMoveWindowToDesktop(item.id, Number(event.target.value))
                        }
                        value={item.desktopIndex}
                      >
                        {Array.from({ length: desktopCount }, (_, index) => (
                          <option key={index} value={index}>
                            데스크톱 {index + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
