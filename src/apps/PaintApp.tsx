import {
  Check,
  Eraser,
  FileText,
  FolderOpen,
  Minus,
  Paintbrush,
  Palette,
  Redo2,
  Save,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import FileDialog from "../components/FileDialog";
import type { DesktopItem } from "../types";
import { VFS_PICTURES_ID } from "../vfs/model";

type PaintTool = "brush" | "line" | "rect" | "ellipse";
const PAINT_SAVE_EVENT = "pocket-desk-save-paint";
const PAINT_OPEN_EVENT = "pocket-desk-open-paint";
const PAINT_SAVE_AS_EVENT = "pocket-desk-save-paint-as";

type CanvasEntry = {
  content?: string;
  id: string;
  name: string;
};

type PaintAppProps = {
  activeCanvasId: string;
  activeCanvasOpenKey: number;
  canvasEntries: CanvasEntry[];
  createVfsFolder: (parentId?: string) => DesktopItem;
  desktopItems: DesktopItem[];
  openVfsEntry: (item: DesktopItem) => void;
  savePaintImage: (
    content: string,
    options?: { existingItemId?: string; name?: string; parentId?: string },
  ) => DesktopItem;
};

const paintPalette = [
  "#0f6c81",
  "#111827",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#2563eb",
  "#7c3aed",
  "#ffffff",
];

const paintTools: Array<{ id: PaintTool; label: string }> = [
  { id: "brush", label: "브러시" },
  { id: "line", label: "선" },
  { id: "rect", label: "사각형" },
  { id: "ellipse", label: "타원" },
];

export default function PaintApp({
  activeCanvasId,
  activeCanvasOpenKey,
  canvasEntries,
  createVfsFolder,
  desktopItems,
  openVfsEntry,
  savePaintImage,
}: PaintAppProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const shapeSnapshot = useRef<ImageData | null>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const activeCanvas =
    canvasEntries.find((item) => item.id === activeCanvasId) ?? canvasEntries[0];
  const [tool, setTool] = useState<PaintTool>("brush");
  const [color, setColor] = useState("#0f6c81");
  const [size, setSize] = useState(5);
  const [saved, setSaved] = useState(false);
  const [ribbonTab, setRibbonTab] = useState<"home" | "view">("home");
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [historyState, setHistoryState] = useState({ redo: 0, undo: 0 });
  const [fileDialogMode, setFileDialogMode] = useState<"open" | "save" | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryState({ redo: 0, undo: 0 });

    if (!activeCanvas?.content) return;

    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = activeCanvas.content;
  }, [activeCanvas?.content, activeCanvas?.id, activeCanvasOpenKey]);

  const updateHistoryState = () => {
    setHistoryState({ redo: redoStack.current.length, undo: undoStack.current.length });
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current = [...undoStack.current.slice(-29), canvas.toDataURL("image/png")];
    redoStack.current = [];
    updateHistoryState();
  };

  const restoreSnapshot = (snapshot: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = snapshot;
  };

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawShape = (
    context: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();

    if (tool === "line") {
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    } else if (tool === "rect") {
      context.rect(from.x, from.y, to.x - from.x, to.y - from.y);
    } else if (tool === "ellipse") {
      const centerX = (from.x + to.x) / 2;
      const centerY = (from.y + to.y) / 2;
      const radiusX = Math.max(Math.abs(to.x - from.x) / 2, 1);
      const radiusY = Math.max(Math.abs(to.y - from.y) / 2, 1);
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    }

    context.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);

    if (tool !== "brush") {
      const from = shapeStart.current;
      const snapshot = shapeSnapshot.current;
      if (!from || !snapshot) return;
      context.putImageData(snapshot, 0, 0);
      drawShape(context, from, point);
      return;
    }

    const from = lastPoint.current ?? point;
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    pushUndoSnapshot();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSaved(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    savePaintImage(canvas.toDataURL("image/png"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1300);
  };

  useEffect(() => {
    const saveFromShortcut = () => save();
    window.addEventListener(PAINT_SAVE_EVENT, saveFromShortcut);
    return () => window.removeEventListener(PAINT_SAVE_EVENT, saveFromShortcut);
  }, [activeCanvas?.id, savePaintImage]);

  useEffect(() => {
    const openFromShortcut = () => setFileDialogMode("open");
    const saveAsFromShortcut = () => setFileDialogMode("save");
    window.addEventListener(PAINT_OPEN_EVENT, openFromShortcut);
    window.addEventListener(PAINT_SAVE_AS_EVENT, saveAsFromShortcut);
    return () => {
      window.removeEventListener(PAINT_OPEN_EVENT, openFromShortcut);
      window.removeEventListener(PAINT_SAVE_AS_EVENT, saveAsFromShortcut);
    };
  }, []);

  const saveAs = (result: { existingItem?: DesktopItem; name: string; parentId: string }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const item = savePaintImage(canvas.toDataURL("image/png"), {
      existingItemId: result.existingItem?.id,
      name: result.name,
      parentId: result.parentId,
    });
    openVfsEntry(item);
    setFileDialogMode(null);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current = [...redoStack.current, canvas.toDataURL("image/png")].slice(-30);
    restoreSnapshot(previous);
    updateHistoryState();
  };

  const redo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current = [...undoStack.current, canvas.toDataURL("image/png")].slice(-30);
    restoreSnapshot(next);
    updateHistoryState();
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    pushUndoSnapshot();
    drawing.current = true;
    const point = getPoint(event);
    lastPoint.current = point;
    shapeStart.current = point;
    shapeSnapshot.current = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current && tool !== "brush") {
      draw(event);
    }
    drawing.current = false;
    lastPoint.current = null;
    shapeStart.current = null;
    shapeSnapshot.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className="paint-app app-fill"
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key === "o") {
          event.preventDefault();
          event.stopPropagation();
          setFileMenuOpen(false);
          setFileDialogMode("open");
        } else if (key === "s" && event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          setFileMenuOpen(false);
          setFileDialogMode("save");
        }
      }}
    >
      <div className="paint-tabs">
        <button
          aria-expanded={fileMenuOpen}
          onClick={() => setFileMenuOpen((current) => !current)}
          type="button"
        >
          파일
        </button>
        <button
          aria-pressed={ribbonTab === "home"}
          className={ribbonTab === "home" ? "is-selected" : ""}
          onClick={() => {
            setRibbonTab("home");
            setFileMenuOpen(false);
          }}
          type="button"
        >
          홈
        </button>
        <button
          aria-pressed={ribbonTab === "view"}
          className={ribbonTab === "view" ? "is-selected" : ""}
          onClick={() => {
            setRibbonTab("view");
            setFileMenuOpen(false);
          }}
          type="button"
        >
          보기
        </button>
        <span className="canvas-file-label">
          <FileText aria-hidden="true" size={15} />
          {activeCanvas?.name ?? "새 그림"}
        </span>
      </div>
      {fileMenuOpen && (
        <div className="paint-file-menu" role="menu">
          <button
            onClick={() => {
              setFileDialogMode("open");
              setFileMenuOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            <FolderOpen aria-hidden="true" size={16} />
            열기
          </button>
          <button
            onClick={() => {
              save();
              setFileMenuOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            저장
          </button>
          <button
            onClick={() => {
              setFileDialogMode("save");
              setFileMenuOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            다른 이름으로 저장
          </button>
        </div>
      )}
      <div className="paint-ribbon">
        {ribbonTab === "home" ? (
          <>
            <div className="paint-ribbon-group paint-command-group">
              <div>
                <button aria-label="저장" onClick={save} title="저장" type="button">
                  <Save aria-hidden="true" size={18} />
                </button>
                <button
                  aria-label="실행 취소"
                  disabled={historyState.undo === 0}
                  onClick={undo}
                  title="실행 취소"
                  type="button"
                >
                  <Undo2 aria-hidden="true" size={18} />
                </button>
                <button
                  aria-label="다시 실행"
                  disabled={historyState.redo === 0}
                  onClick={redo}
                  title="다시 실행"
                  type="button"
                >
                  <Redo2 aria-hidden="true" size={18} />
                </button>
                <button
                  aria-label="모두 지우기"
                  onClick={clear}
                  title="모두 지우기"
                  type="button"
                >
                  <Eraser aria-hidden="true" size={18} />
                </button>
              </div>
              <small>파일 및 편집</small>
            </div>
            <div className="paint-ribbon-group">
              <div className="paint-tool-group" aria-label="그림 도구">
                {paintTools.map((option) => (
                  <button
                    aria-pressed={tool === option.id}
                    className={tool === option.id ? "is-selected" : ""}
                    key={option.id}
                    onClick={() => setTool(option.id)}
                    title={option.label}
                    type="button"
                  >
                    {option.id === "brush" && <Paintbrush aria-hidden="true" size={18} />}
                    {option.id === "line" && <Minus aria-hidden="true" size={18} />}
                    {option.id === "rect" && <Square aria-hidden="true" size={17} />}
                    {option.id === "ellipse" && (
                      <span aria-hidden="true" className="ellipse-tool-icon" />
                    )}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <small>도구 및 도형</small>
            </div>
            <div className="paint-ribbon-group paint-size-group">
              <label>
                <span>{size}px</span>
                <input
                  aria-label="붓 굵기"
                  max="22"
                  min="1"
                  onChange={(event) => setSize(Number(event.target.value))}
                  type="range"
                  value={size}
                />
              </label>
              <small>크기</small>
            </div>
            <div className="paint-ribbon-group paint-color-group">
              <div>
                <label>
                  <Palette aria-hidden="true" size={18} />
                  <input
                    aria-label="붓 색상"
                    onChange={(event) => setColor(event.target.value)}
                    type="color"
                    value={color}
                  />
                </label>
                <div className="paint-palette" aria-label="색상 팔레트">
                  {paintPalette.map((swatch) => (
                    <button
                      aria-label={`${swatch} 색상 선택`}
                      aria-pressed={color.toLowerCase() === swatch}
                      className={color.toLowerCase() === swatch ? "is-selected" : ""}
                      key={swatch}
                      onClick={() => setColor(swatch)}
                      style={{ "--swatch": swatch } as React.CSSProperties}
                      type="button"
                    />
                  ))}
                </div>
              </div>
              <small>색</small>
            </div>
          </>
        ) : (
          <div className="paint-ribbon-group paint-view-group">
            <div>
              <button
                aria-label="축소"
                disabled={zoom <= 50}
                onClick={() => setZoom((current) => Math.max(50, current - 10))}
                title="축소"
                type="button"
              >
                <ZoomOut aria-hidden="true" size={18} />
              </button>
              <input
                aria-label="확대/축소"
                max="160"
                min="50"
                onChange={(event) => setZoom(Number(event.target.value))}
                type="range"
                value={zoom}
              />
              <button
                aria-label="확대"
                disabled={zoom >= 160}
                onClick={() => setZoom((current) => Math.min(160, current + 10))}
                title="확대"
                type="button"
              >
                <ZoomIn aria-hidden="true" size={18} />
              </button>
              <button onClick={() => setZoom(100)} type="button">
                100%
              </button>
            </div>
            <small>확대/축소</small>
          </div>
        )}
        {saved && (
          <span className="saved-indicator">
            <Check aria-hidden="true" size={15} />
            저장됨
          </span>
        )}
      </div>
      <div className="paint-stage">
        <canvas
          aria-label="그림판 캔버스"
          className="paint-canvas"
          height="720"
          onPointerDown={startDrawing}
          onPointerLeave={() => {
            drawing.current = false;
            lastPoint.current = null;
            shapeStart.current = null;
            shapeSnapshot.current = null;
          }}
          onPointerMove={draw}
          onPointerUp={finishDrawing}
          ref={canvasRef}
          style={{ width: `${zoom}%` }}
          width="1120"
        />
      </div>
      <div className="paint-statusbar">
        <span>1120 × 720px</span>
        <span>{zoom}%</span>
      </div>
      {fileDialogMode && (
        <FileDialog
          allowedKinds={["canvas"]}
          createVfsFolder={createVfsFolder}
          defaultExtension="png"
          defaultName={
            activeCanvas?.name ? activeCanvas.name.replace(/\.[^.]+$/, ".png") : "새 그림.png"
          }
          fileTypeLabel="PNG 이미지 (*.png)"
          initialFolderId={
            desktopItems.find((item) => item.id === activeCanvas?.id)?.parentId ??
            VFS_PICTURES_ID
          }
          items={desktopItems}
          mode={fileDialogMode}
          onCancel={() => setFileDialogMode(null)}
          onOpen={(item) => {
            openVfsEntry(item);
            setFileDialogMode(null);
          }}
          onSave={saveAs}
          title={fileDialogMode === "open" ? "열기" : "다른 이름으로 저장"}
        />
      )}
    </div>
  );
}
