import { Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AppIconTile from "../../components/AppIconTile";
import { WindowThumbnail } from "./WindowThumbnail";
import { trapDialogFocus, useReturnFocus } from "../dialogFocus";
import { getApp } from "../appCatalog";
import { formatWindowTitle } from "../windowTitle";
import { MAX_VIRTUAL_DESKTOPS } from "../constants";
import { MAX_DESKTOP_NAME_LENGTH, getDesktopName } from "../desktopNames";
import { getDesktopWorkArea } from "../windowGeometry";
import { type WindowInstance } from "../types";

/**
 * Task View: one card per virtual desktop, each holding scaled-down previews of
 * the windows that live on it. Mirrors the Win+Tab overview.
 */
export function TaskView({
  activeDesktopIndex,
  desktopCount,
  desktopNames,
  getDocumentLabel,
  onAddDesktop,
  onCloseDesktop,
  onCloseWindow,
  onDismiss,
  onMoveWindowToDesktop,
  onRenameDesktop,
  onSelectDesktop,
  onSelectWindow,
  windows,
}: {
  activeDesktopIndex: number;
  desktopCount: number;
  /** Only the names that were typed; the rest are numbered. */
  desktopNames: string[];
  getDocumentLabel: (windowId: string, appId: WindowInstance["appId"]) => string | undefined;
  onAddDesktop: () => void;
  onCloseDesktop: (index: number) => void;
  onCloseWindow: (windowId: string) => void;
  onDismiss: () => void;
  onMoveWindowToDesktop: (windowId: string, index: number) => void;
  onRenameDesktop: (index: number, name: string) => void;
  onSelectDesktop: (index: number) => void;
  onSelectWindow: (windowId: string) => void;
  windows: WindowInstance[];
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragOverDesktop, setDragOverDesktop] = useState<number | null>(null);
  // Which desktop is being renamed, and what has been typed so far.
  const [renamingDesktop, setRenamingDesktop] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  // Escape unmounts the field, which fires its own blur — and the blur commits.
  const cancelRenameRef = useRef(false);
  const [draggingWindowId, setDraggingWindowId] = useState<string | null>(null);

  // Closing this overlay hands focus back to whatever opened it; it used to
  // fall to <body>, so the next Tab restarted at the top of the desktop.
  useReturnFocus();

  useEffect(() => {
    if (renamingDesktop === null) return;
    const input = nameInputRef.current;
    input?.focus();
    input?.select();
  }, [renamingDesktop]);

  // Focus has to enter the overlay, or Tab keeps walking the desktop behind it.
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      // Only if nothing inside has it already: this frame can land after a
      // rename field has opened, and taking focus off it closes the field.
      const active = document.activeElement;
      if (active && rootRef.current?.contains(active)) return;
      rootRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  // A card is a picture of the work area, so window positions are measured
  // from that area's corner — which is not the screen's when the bar is on a
  // side, and every preview sat one bar-width too far right without this.
  const area = getDesktopWorkArea();

  const previewStyle = (item: WindowInstance) => {
    if (item.maximized) {
      return { height: "100%", left: 0, top: 0, width: "100%" };
    }
    return {
      height: `${(item.height / area.height) * 100}%`,
      left: `${((item.x - area.x) / area.width) * 100}%`,
      top: `${((item.y - area.y) / area.height) * 100}%`,
      width: `${(item.width / area.width) * 100}%`,
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
                className={`task-view-desktop${index === activeDesktopIndex ? " is-active" : ""}${
                  dragOverDesktop === index ? " is-drop-target" : ""
                }`}
                onClick={() => onSelectDesktop(index)}
                // Windows lets you drag a window card onto a desktop here.
                onDragEnter={(event) => {
                  if (!draggingWindowId) return;
                  event.preventDefault();
                  setDragOverDesktop(index);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setDragOverDesktop((current) => (current === index ? null : current));
                }}
                onDragOver={(event) => {
                  if (!draggingWindowId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  const windowId =
                    event.dataTransfer.getData("application/x-pocketdesk-window") ||
                    draggingWindowId;
                  setDragOverDesktop(null);
                  setDraggingWindowId(null);
                  if (!windowId) return;
                  event.preventDefault();
                  onMoveWindowToDesktop(windowId, index);
                }}
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
                  {getDesktopName(desktopNames, index)}
                  <em>{desktopWindows.length}개 창</em>
                </span>
              </button>
              {renamingDesktop === index ? (
                /*
                 * Windows 11 renames a desktop in place in Task View. The form
                 * sits outside the card's button — a control inside a control
                 * is not reachable.
                 */
                <form
                  className="task-view-desktop-rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRenameDesktop(index, nameDraft);
                    setRenamingDesktop(null);
                  }}
                >
                  <input
                    aria-label={`${getDesktopName(desktopNames, index)} 이름 바꾸기`}
                    maxLength={MAX_DESKTOP_NAME_LENGTH}
                    onBlur={() => {
                      if (cancelRenameRef.current) {
                        cancelRenameRef.current = false;
                        setRenamingDesktop(null);
                        return;
                      }
                      onRenameDesktop(index, nameDraft);
                      setRenamingDesktop(null);
                    }}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") return;
                      event.preventDefault();
                      // Escape keeps the name it had, so the blur must not write.
                      cancelRenameRef.current = true;
                      setRenamingDesktop(null);
                    }}
                    ref={nameInputRef}
                    value={nameDraft}
                  />
                </form>
              ) : (
                <button
                  aria-label={`${getDesktopName(desktopNames, index)} 이름 바꾸기`}
                  className="task-view-desktop-rename-button"
                  onClick={() => {
                    setNameDraft(desktopNames[index] ?? "");
                    setRenamingDesktop(index);
                  }}
                  title="이름 바꾸기"
                  type="button"
                >
                  <Pencil aria-hidden="true" size={12} />
                </button>
              )}
              {desktopCount > 1 && renamingDesktop !== index && (
                <button
                  aria-label={`${getDesktopName(desktopNames, index)} 닫기`}
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

      <div
        aria-label={`${getDesktopName(desktopNames, activeDesktopIndex)}의 창`}
        className="task-view-windows"
        role="group"
      >
        {windows.filter((item) => item.desktopIndex === activeDesktopIndex).length === 0 ? (
          <p className="task-view-empty">이 데스크톱에는 열린 창이 없습니다.</p>
        ) : (
          windows
            .filter((item) => item.desktopIndex === activeDesktopIndex)
            .sort((first, second) => second.z - first.z)
            .map((item) => {
              const app = getApp(item.appId);
              const documentLabel = getDocumentLabel(item.id, item.appId);
              const windowTitle = formatWindowTitle(app.title, documentLabel);
              return (
                <div
                  className={`task-view-card${draggingWindowId === item.id ? " is-dragging" : ""}`}
                  draggable={desktopCount > 1}
                  key={item.id}
                  onDragEnd={() => {
                    setDraggingWindowId(null);
                    setDragOverDesktop(null);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-pocketdesk-window", item.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingWindowId(item.id);
                  }}
                >
                  {/*
                   * Windows shows the window's own title and a preview of where
                   * it sits, not its pixel dimensions — a readout that told you
                   * nothing about which of two Notepad windows you were picking.
                   */}
                  <button
                    aria-label={`${windowTitle} 전환`}
                    onClick={() => onSelectWindow(item.id)}
                    type="button"
                  >
                    <span aria-hidden="true" className="task-view-card-preview">
                      {/* The window itself, as Task View shows it — an icon only
                          for a window that is not in the DOM right now. */}
                      <span className="task-view-card-shape is-picture">
                        <WindowThumbnail
                          accent={app.accent}
                          icon={app.icon}
                          instance={item}
                          size="small"
                        />
                      </span>
                    </span>
                    <span className="task-view-card-title">
                      <AppIconTile accent={app.accent} icon={app.icon} size="tiny" />
                      <strong>{windowTitle}</strong>
                    </span>
                    {item.minimized && <small>최소화됨</small>}
                  </button>
                  {/* Task View closes windows on Windows; this one could not. */}
                  <button
                    aria-label={`${windowTitle} 닫기`}
                    className="task-view-card-close"
                    onClick={() => onCloseWindow(item.id)}
                    type="button"
                  >
                    <X aria-hidden="true" size={13} />
                  </button>
                  {desktopCount > 1 && (
                    <label>
                      이동
                      <select
                        aria-label={`${formatWindowTitle(
                          getApp(item.appId).title,
                          getDocumentLabel(item.id, item.appId),
                        )} 이동`}
                        onChange={(event) =>
                          onMoveWindowToDesktop(item.id, Number(event.target.value))
                        }
                        value={item.desktopIndex}
                      >
                        {Array.from({ length: desktopCount }, (_, index) => (
                          <option key={index} value={index}>
                            {getDesktopName(desktopNames, index)}
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
