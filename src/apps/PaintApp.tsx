import {
  Check,
  Eraser,
  FileText,
  FolderOpen,
  Minus,
  Paintbrush,
  PaintBucket,
  Palette,
  Pipette,
  Redo2,
  Save,
  Scaling,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { trapDialogFocus } from "../shell/dialogFocus";
import { useEffect, useRef, useState } from "react";
import {
  getResizedDimensions,
  PAINT_MAX_DIMENSION,
  PAINT_MIN_DIMENSION,
  toHexColor,
} from "./paintTools";
import type React from "react";
import FileDialog from "../components/FileDialog";
import type { DesktopItem } from "../types";
import { VFS_PICTURES_ID } from "../vfs/model";
import { handleMenuKeyboard } from "../shell/keyboardNav";

type PaintTool = "brush" | "eraser" | "fill" | "line" | "rect" | "ellipse" | "text" | "picker";
const PAINT_SAVE_EVENT = "pocket-desk-save-paint";
const PAINT_OPEN_EVENT = "pocket-desk-open-paint";
const PAINT_SAVE_AS_EVENT = "pocket-desk-save-paint-as";
/** The bitmap's own size; the display scales from it, never from the window. */
const PAINT_CANVAS_WIDTH = 1120;
const PAINT_CANVAS_HEIGHT = 720;

const PAINT_UNDO_EVENT = "pocket-desk-undo-paint";
const PAINT_REDO_EVENT = "pocket-desk-redo-paint";

type CanvasEntry = {
  content?: string;
  id: string;
  name: string;
};

type PaintAppProps = {
  activeCanvasId: string;
  closeWindow: (windowId: string) => void;
  registerCloseGuard: (windowId: string, guard: (() => boolean) | null) => void;
  windowId: string;
  activeCanvasOpenKey: number;
  canvasEntries: CanvasEntry[];
  createVfsFolder: (parentId?: string) => DesktopItem;
  desktopItems: DesktopItem[];
  activateVfsEntry: (item: DesktopItem) => void;
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
  { id: "eraser", label: "지우개" },
  { id: "fill", label: "채우기" },
  { id: "line", label: "선" },
  { id: "rect", label: "사각형" },
  { id: "ellipse", label: "타원" },
  { id: "text", label: "텍스트" },
  { id: "picker", label: "스포이드" },
];

/**
 * The type size the 텍스트 tool writes at. Paint ties it to the same size
 * control the brush uses rather than adding a second one, so the slider means
 * "how big is what I am about to put down" for every tool.
 */
export function getPaintTextSize(brushSize: number) {
  return Math.round(Math.max(1, brushSize) * 4 + 10);
}

/**
 * Paint's paint-bucket: every pixel connected to the click that shares its
 * colour takes the fill colour. Scanline flood so a full-canvas fill stays a
 * few milliseconds instead of a recursion.
 */
export function floodFill(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
): boolean {
  const { width, height } = context.canvas;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return false;

  // Every colour this app hands out is #rrggbb (the palette and the colour
  // input), so parsing beats bouncing through a probe canvas — which also
  // keeps this function testable where no real canvas exists.
  const parsed = /^#([0-9a-f]{6})$/i.exec(fillColor);
  if (!parsed) return false;
  const fr = parseInt(parsed[1].slice(0, 2), 16);
  const fg = parseInt(parsed[1].slice(2, 4), 16);
  const fb = parseInt(parsed[1].slice(4, 6), 16);

  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const start = at(x0, y0);
  const [tr, tg, tb, ta] = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  if (tr === fr && tg === fg && tb === fb && ta === 255) return false;

  const matches = (index: number) =>
    data[index] === tr &&
    data[index + 1] === tg &&
    data[index + 2] === tb &&
    data[index + 3] === ta;
  const paint = (index: number) => {
    data[index] = fr;
    data[index + 1] = fg;
    data[index + 2] = fb;
    data[index + 3] = 255;
  };

  const stack: Array<[number, number]> = [[x0, y0]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    let left = x;
    while (left >= 0 && matches(at(left, y))) left -= 1;
    left += 1;
    let spanUp = false;
    let spanDown = false;
    let cursor = left;
    while (cursor < width && matches(at(cursor, y))) {
      paint(at(cursor, y));
      if (y > 0) {
        const up = matches(at(cursor, y - 1));
        if (up && !spanUp) {
          stack.push([cursor, y - 1]);
          spanUp = true;
        } else if (!up) {
          spanUp = false;
        }
      }
      if (y < height - 1) {
        const down = matches(at(cursor, y + 1));
        if (down && !spanDown) {
          stack.push([cursor, y + 1]);
          spanDown = true;
        } else if (!down) {
          spanDown = false;
        }
      }
      cursor += 1;
    }
  }
  context.putImageData(image, 0, 0);
  return true;
}

export default function PaintApp({
  activeCanvasId,
  closeWindow,
  registerCloseGuard,
  windowId,
  activeCanvasOpenKey,
  canvasEntries,
  createVfsFolder,
  desktopItems,
  activateVfsEntry,
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
  /** What the eyedropper hands the canvas back to once it has picked. */
  const toolBeforePicker = useRef<PaintTool | null>(null);
  const [resizeDraft, setResizeDraft] = useState<{
    height: string;
    keepAspect: boolean;
    width: string;
  } | null>(null);
  /*
   * 텍스트: a click places the caret and a field appears over the canvas at
   * that spot. Nothing is on the bitmap until it is committed, so Escape leaves
   * the drawing exactly as it was and undo has one step to take, not one per
   * keystroke.
   */
  const [textDraft, setTextDraft] = useState<{ value: string; x: number; y: number } | null>(
    null,
  );
  const textDraftRef = useRef(textDraft);
  textDraftRef.current = textDraft;
  const [color, setColor] = useState("#0f6c81");
  const [size, setSize] = useState(5);
  // Windows' Paint fills a shape with the second colour; here one switch says
  // whether 사각형/타원 are outlines or solids.
  const [fillShapes, setFillShapes] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ribbonTab, setRibbonTab] = useState<"home" | "view">("home");
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [historyState, setHistoryState] = useState({ redo: 0, undo: 0 });
  const [fileDialogMode, setFileDialogMode] = useState<"open" | "save" | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    height: PAINT_CANVAS_HEIGHT,
    width: PAINT_CANVAS_WIDTH,
  });
  const [dirty, setDirty] = useState(false);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const dirtyRef = useRef(false);
  const flushRef = useRef<(() => void) | null>(null);
  const closePromptRef = useRef<HTMLButtonElement | null>(null);

  const markDirty = () => {
    dirtyRef.current = true;
    setDirty(true);
  };

  const loadedCanvasIdRef = useRef<string | null>(null);
  const loadedContentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    /*
     * The document can be swapped out from under this app — the photo viewer's
     * 편집 button does exactly that — and the canvas was simply repainted with
     * the new file, taking the unsaved drawing with it. Write the old one back
     * to its own file first.
     */
    const previousId = loadedCanvasIdRef.current;
    if (previousId && previousId !== activeCanvas?.id && dirtyRef.current) {
      savePaintImage(canvas.toDataURL("image/png"), { existingItemId: previousId });
    }
    loadedCanvasIdRef.current = activeCanvas?.id ?? null;
    loadedContentRef.current = activeCanvas?.content;
    dirtyRef.current = false;
    setDirty(false);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryState({ redo: 0, undo: 0 });

    if (!activeCanvas?.content) {
      canvas.width = PAINT_CANVAS_WIDTH;
      canvas.height = PAINT_CANVAS_HEIGHT;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      setCanvasSize({ height: PAINT_CANVAS_HEIGHT, width: PAINT_CANVAS_WIDTH });
      return;
    }

    const image = new Image();
    image.onload = () => {
      /*
       * Paint sizes its canvas to the document. Drawing every image into a
       * fixed 1120×720 stretched a rotated portrait photo — 720×1120 became
       * 1120×720 the moment Paint saved it, squashing the photo for good.
       */
      canvas.width = image.naturalWidth || PAINT_CANVAS_WIDTH;
      canvas.height = image.naturalHeight || PAINT_CANVAS_HEIGHT;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      setCanvasSize({ height: canvas.height, width: canvas.width });
    };
    image.src = activeCanvas.content;
    // Keyed on the document, not its bytes: saving rewrites `content`, and
    // re-running here wiped the undo stack every time the drawing was saved.
  }, [activeCanvas?.id, activeCanvasOpenKey]);

  /*
   * Another app can write the open document — the photo viewer's rotation does.
   * With the load keyed on the id alone, this canvas kept the pre-rotation
   * bitmap and its next flush quietly overwrote the rotation. A clean canvas
   * follows the file; unsaved strokes win, as they do when a file changes
   * under any editor.
   */
  useEffect(() => {
    if (!activeCanvas || activeCanvas.content === loadedContentRef.current) return;
    if (dirtyRef.current) return;

    loadedContentRef.current = activeCanvas.content;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !activeCanvas.content) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth || PAINT_CANVAS_WIDTH;
      canvas.height = image.naturalHeight || PAINT_CANVAS_HEIGHT;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      setCanvasSize({ height: canvas.height, width: canvas.width });
    };
    image.src = activeCanvas.content;
    // The dirty guard replaces `content` in the dependency list on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCanvas?.content]);

  const updateHistoryState = () => {
    markDirty();
    setHistoryState({ redo: redoStack.current.length, undo: undoStack.current.length });
  };

  const pushUndoSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current = [...undoStack.current.slice(-29), canvas.toDataURL("image/png")];
    redoStack.current = [];
    updateHistoryState();
  };

  const restoreInFlightRef = useRef(false);

  const restoreSnapshot = (snapshot: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    restoreInFlightRef.current = true;
    const image = new Image();
    const finish = () => {
      restoreInFlightRef.current = false;
    };
    image.onerror = finish;
    image.onload = () => {
      // A snapshot carries the size it was taken at. Undoing 크기 조정 means
      // putting the canvas back to that size, not stretching the old picture
      // over the new one.
      if (image.width !== canvas.width || image.height !== canvas.height) {
        canvas.width = image.width;
        canvas.height = image.height;
        setCanvasSize({ height: image.height, width: image.width });
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      finish();
    };
    image.src = snapshot;
  };

  /*
   * getBoundingClientRect forces layout, and drawing calls this per
   * pointermove. The canvas box only changes with zoom or a window resize,
   * neither of which can happen mid-stroke — so the rect is read once per
   * stroke (pointerdown clears the cache) and reused for every sample.
   */
  const strokeRectRef = useRef<DOMRect | null>(null);
  useEffect(() => {
    strokeRectRef.current = null;
  }, [zoom]);
  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = strokeRectRef.current ?? canvas.getBoundingClientRect();
    strokeRectRef.current = rect;
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

    if (fillShapes && (tool === "rect" || tool === "ellipse")) {
      context.fillStyle = color;
      context.fill();
    }
    context.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);

    if (tool !== "brush" && tool !== "eraser") {
      const from = shapeStart.current;
      const snapshot = shapeSnapshot.current;
      if (!from || !snapshot) return;
      context.putImageData(snapshot, 0, 0);
      drawShape(context, from, point);
      return;
    }

    const from = lastPoint.current ?? point;
    // The eraser is the brush dipped in the paper: Paint erases to the
    // background colour, and this canvas's paper is white.
    context.strokeStyle = tool === "eraser" ? "#ffffff" : color;
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
    markDirty();
  };

  const save = () => {
    // Saving with text still in the field would write a picture without it.
    commitTextRef.current();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const savedContent = canvas.toDataURL("image/png");
    savePaintImage(savedContent);
    loadedContentRef.current = savedContent;
    dirtyRef.current = false;
    setDirty(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1300);
  };

  /*
   * The shell unmounts a window's app when its virtual desktop goes away, and a
   * reload drops it too. Notepad already flushes its draft on the way out; this
   * did not, so switching desktops or reloading came back to a blank canvas
   * with the drawing gone and nothing said about it.
   */
  flushRef.current = () => {
    if (!dirtyRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    savePaintImage(canvas.toDataURL("image/png"));
    dirtyRef.current = false;
  };

  useEffect(() => () => flushRef.current?.(), []);

  /*
   * Windows asks before throwing a drawing away. Every close path goes through
   * the shell's guard — the ✕, Alt+F4, the system menu, the taskbar, Task
   * Manager — so returning false holds the window open until the user answers.
   */
  useEffect(() => {
    if (!dirty) {
      registerCloseGuard(windowId, null);
      return;
    }

    registerCloseGuard(windowId, () => {
      setFileMenuOpen(false);
      setClosePromptOpen(true);
      return false;
    });
    return () => registerCloseGuard(windowId, null);
  }, [dirty, registerCloseGuard, windowId]);

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

  const closeAfterSave = () => {
    save();
    dirtyRef.current = false;
    setClosePromptOpen(false);
    registerCloseGuard(windowId, null);
    closeWindow(windowId);
  };

  const closeWithoutSaving = () => {
    // The unmount flush would otherwise write the drawing the user just chose
    // to discard.
    dirtyRef.current = false;
    setClosePromptOpen(false);
    registerCloseGuard(windowId, null);
    closeWindow(windowId);
  };

  const saveAs = (result: { existingItem?: DesktopItem; name: string; parentId: string }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const item = savePaintImage(canvas.toDataURL("image/png"), {
      existingItemId: result.existingItem?.id,
      name: result.name,
      parentId: result.parentId,
    });
    activateVfsEntry(item);
    setFileDialogMode(null);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    // A restore still decoding means toDataURL would capture the stale frame;
    // held-down Ctrl+Z used to fill the redo stack with copies of it.
    if (restoreInFlightRef.current) return;
    if (!canvas || undoStack.current.length === 0) return;
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current = [...redoStack.current, canvas.toDataURL("image/png")].slice(-30);
    restoreSnapshot(previous);
    updateHistoryState();
  };

  const redo = () => {
    const canvas = canvasRef.current;
    if (restoreInFlightRef.current) return;
    if (!canvas || redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current = [...undoStack.current, canvas.toDataURL("image/png")].slice(-30);
    restoreSnapshot(next);
    updateHistoryState();
  };

  useEffect(() => {
    const undoFromShortcut = () => undo();
    const redoFromShortcut = () => redo();
    window.addEventListener(PAINT_UNDO_EVENT, undoFromShortcut);
    window.addEventListener(PAINT_REDO_EVENT, redoFromShortcut);
    return () => {
      window.removeEventListener(PAINT_UNDO_EVENT, undoFromShortcut);
      window.removeEventListener(PAINT_REDO_EVENT, redoFromShortcut);
    };
  });

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;

    strokeRectRef.current = null;
    const point = getPoint(event);

    if (tool === "picker") {
      /*
       * Paint's eyedropper takes the colour and hands the canvas back to the
       * tool you were using — picking is something you do in the middle of
       * drawing, not a mode you sit in.
       */
      const pixel = context.getImageData(point.x, point.y, 1, 1).data;
      setColor(toHexColor(pixel[0], pixel[1], pixel[2], pixel[3]));
      setTool(toolBeforePicker.current ?? "brush");
      toolBeforePicker.current = null;
      return;
    }

    if (tool === "text") {
      // A second click while typing puts the first text down and starts again.
      commitTextRef.current();
      setTextDraft({ value: "", x: point.x, y: point.y });
      return;
    }

    if (tool === "fill") {
      /*
       * Snapshot first — undo needs the pre-fill bitmap — but a click on an
       * area already the fill colour changes nothing, and it used to dirty the
       * document, clear the redo stack and arm the unload warning anyway.
       */
      const before = canvas.toDataURL("image/png");
      if (!floodFill(context, point.x, point.y, color)) return;
      undoStack.current = [...undoStack.current.slice(-29), before];
      redoStack.current = [];
      updateHistoryState();
      return;
    }

    pushUndoSnapshot();
    drawing.current = true;
    lastPoint.current = point;
    shapeStart.current = point;
    shapeSnapshot.current = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);
  };

  const openResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setResizeDraft({
      height: String(canvas.height),
      keepAspect: true,
      width: String(canvas.width),
    });
  };

  /**
   * 크기 조정 redraws the bitmap into a canvas of the new size — the picture
   * is scaled, not cropped, which is what Paint's own 크기 조정 does. One undo
   * step, taken before the canvas is resized.
   */
  const applyResize = (next: { height: number; width: number }) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (next.width === canvas.width && next.height === canvas.height) {
      setResizeDraft(null);
      return;
    }
    pushUndoSnapshot();
    const source = document.createElement("canvas");
    source.width = canvas.width;
    source.height = canvas.height;
    source.getContext("2d")?.drawImage(canvas, 0, 0);
    canvas.width = next.width;
    canvas.height = next.height;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, next.width, next.height);
    setCanvasSize({ height: next.height, width: next.width });
    setResizeDraft(null);
    markDirty();
  };

  const commitText = () => {
    const draft = textDraftRef.current;
    setTextDraft(null);
    if (!draft) return;
    const value = draft.value.trim();
    if (!value) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    pushUndoSnapshot();
    context.save();
    context.fillStyle = color;
    context.textBaseline = "top";
    context.font = `${getPaintTextSize(size)}px Inter, system-ui, sans-serif`;
    context.fillText(value, draft.x, draft.y);
    context.restore();
    markDirty();
  };
  // The commit outlives the render that armed it: a click elsewhere on the
  // canvas, or the tool changing, has to put down what was already typed.
  const commitTextRef = useRef(commitText);
  commitTextRef.current = commitText;

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current && tool !== "brush" && tool !== "eraser") {
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
        <div
          className="paint-file-menu"
          role="menu"
          onKeyDown={(event) => handleMenuKeyboard(event, event.currentTarget)}
        >
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
                <button
                  aria-label="크기 조정"
                  onClick={openResize}
                  title="크기 조정"
                  type="button"
                >
                  <Scaling aria-hidden="true" size={18} />
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
                    onClick={() => {
                      // Switching tools with text half-typed puts it down,
                      // rather than dropping what was written.
                      commitTextRef.current();
                      setTool(option.id);
                    }}
                    title={option.label}
                    type="button"
                  >
                    {option.id === "brush" && <Paintbrush aria-hidden="true" size={18} />}
                    {option.id === "eraser" && <Eraser aria-hidden="true" size={18} />}
                    {option.id === "fill" && <PaintBucket aria-hidden="true" size={18} />}
                    {option.id === "line" && <Minus aria-hidden="true" size={18} />}
                    {option.id === "rect" && <Square aria-hidden="true" size={17} />}
                    {option.id === "ellipse" && (
                      <span aria-hidden="true" className="ellipse-tool-icon" />
                    )}
                    {option.id === "picker" && <Pipette aria-hidden="true" size={17} />}
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
              <label className="paint-fill-toggle">
                <input
                  checked={fillShapes}
                  onChange={(event) => setFillShapes(event.target.checked)}
                  type="checkbox"
                />
                <span>도형 채우기</span>
              </label>
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
      <div
        className="paint-stage"
        // The stage scrolls when zoomed past the window; a scroll mid-stroke
        // moves the canvas under a cached rect.
        onScroll={() => {
          strokeRectRef.current = null;
        }}
      >
        <div className="paint-canvas-wrap" data-text-draft={textDraft ? "on" : "off"}>
          <canvas
            aria-label="그림판 캔버스"
            className="paint-canvas"
            height={PAINT_CANVAS_HEIGHT}
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
            /*
             * The zoom is anchored to the bitmap, so 100% means one bitmap pixel
             * per CSS pixel — what 100% means in Paint. It used to be a
             * percentage of the stage, so the status bar claimed 100% while the
             * real scale was 71%, and maximizing the window silently rescaled
             * the drawing to 126% with the readout unchanged.
             */
            style={{ width: `${Math.round((canvasSize.width * zoom) / 100)}px` }}
            width={PAINT_CANVAS_WIDTH}
          />
          {textDraft && (
            <input
              aria-label="캔버스에 넣을 텍스트"
              autoFocus
              className="paint-text-input"
              /*
               * No commit on blur. Measured: the field mounts, focuses, and the
               * window frame takes focus back a moment later when the click
               * that opened it activates the window — a blur commit put half a
               * word on the bitmap and closed the field before a key was
               * pressed. Enter commits, Escape cancels, and clicking on the
               * canvas again or changing tool puts down what is there.
               */
              onChange={(event) =>
                setTextDraft((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitText();
                  return;
                }
                if (event.key !== "Escape") return;
                // Escape leaves the bitmap exactly as it was.
                event.preventDefault();
                setTextDraft(null);
                canvasRef.current?.focus();
              }}
              style={{
                color,
                fontSize: `${Math.round((getPaintTextSize(size) * zoom) / 100)}px`,
                left: `${Math.round((textDraft.x * zoom) / 100)}px`,
                top: `${Math.round((textDraft.y * zoom) / 100)}px`,
              }}
              value={textDraft.value}
            />
          )}
        </div>
      </div>
      <div className="paint-statusbar">
        <span>{`${canvasSize.width} × ${canvasSize.height}px`}</span>
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
            activateVfsEntry(item);
            setFileDialogMode(null);
          }}
          onSave={saveAs}
          title={fileDialogMode === "open" ? "열기" : "다른 이름으로 저장"}
        />
      )}

      {resizeDraft && (
        <div className="note-close-overlay" onPointerDown={() => setResizeDraft(null)}>
          <section
            aria-label="크기 조정"
            aria-modal="true"
            className="paint-resize-dialog"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setResizeDraft(null);
                return;
              }
              trapDialogFocus(event, event.currentTarget);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <h2>크기 조정</h2>
            <p>그림 전체를 새 크기에 맞춰 다시 그립니다.</p>
            <label>
              <span>가로</span>
              <input
                autoFocus
                max={PAINT_MAX_DIMENSION}
                min={PAINT_MIN_DIMENSION}
                onChange={(event) =>
                  setResizeDraft((current) => {
                    if (!current) return current;
                    const next = getResizedDimensions(
                      canvasSize,
                      { height: Number(current.height), width: Number(event.target.value) },
                      current.keepAspect,
                      "width",
                    );
                    return {
                      ...current,
                      height: current.keepAspect ? String(next.height) : current.height,
                      width: event.target.value,
                    };
                  })
                }
                type="number"
                value={resizeDraft.width}
              />
              <span>픽셀</span>
            </label>
            <label>
              <span>세로</span>
              <input
                max={PAINT_MAX_DIMENSION}
                min={PAINT_MIN_DIMENSION}
                onChange={(event) =>
                  setResizeDraft((current) => {
                    if (!current) return current;
                    const next = getResizedDimensions(
                      canvasSize,
                      { height: Number(event.target.value), width: Number(current.width) },
                      current.keepAspect,
                      "height",
                    );
                    return {
                      ...current,
                      height: event.target.value,
                      width: current.keepAspect ? String(next.width) : current.width,
                    };
                  })
                }
                type="number"
                value={resizeDraft.height}
              />
              <span>픽셀</span>
            </label>
            <label className="paint-resize-aspect">
              <input
                checked={resizeDraft.keepAspect}
                onChange={(event) =>
                  setResizeDraft((current) =>
                    current ? { ...current, keepAspect: event.target.checked } : current,
                  )
                }
                type="checkbox"
              />
              가로 세로 비율 유지
            </label>
            <footer>
              <button onClick={() => setResizeDraft(null)} type="button">
                취소
              </button>
              <button
                className="is-primary"
                onClick={() =>
                  applyResize(
                    getResizedDimensions(
                      canvasSize,
                      {
                        height: Number(resizeDraft.height),
                        width: Number(resizeDraft.width),
                      },
                      false,
                      "width",
                    ),
                  )
                }
                type="button"
              >
                확인
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Windows asks before throwing a drawing away; this closed in silence. */}
      {closePromptOpen && (
        <div className="note-close-overlay">
          <section
            aria-label="저장 확인"
            aria-modal="true"
            onKeyDown={(event) => trapDialogFocus(event, event.currentTarget)}
            role="alertdialog"
          >
            <strong>{activeCanvas?.name ?? "제목 없음"}의 변경 내용을 저장하시겠습니까?</strong>
            <p>저장하지 않으면 지금까지 그린 내용이 사라집니다.</p>
            <div>
              <button
                className="is-primary"
                onClick={closeAfterSave}
                ref={closePromptRef}
                type="button"
              >
                저장
              </button>
              <button onClick={closeWithoutSaving} type="button">
                저장 안 함
              </button>
              <button onClick={() => setClosePromptOpen(false)} type="button">
                취소
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
