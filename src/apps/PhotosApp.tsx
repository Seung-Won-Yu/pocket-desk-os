import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Images,
  Maximize2,
  Pencil,
  RotateCcw,
  RotateCw,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { DesktopItem } from "../types";
import { clamp } from "../utils/format";

/** "Open this picture in 사진" — a fresh id per request so the same picture opens twice. */
export type PhotosLaunchRequest = { id: string; itemId: string };

type PhotosAppProps = {
  photosLaunchRequest: PhotosLaunchRequest | null;
  reportDocument: (
    windowId: string,
    ref: { itemId?: string; title?: string } | undefined,
  ) => void;
  activeCanvasId: string;
  activeCanvasOpenKey: number;
  canvasEntries: DesktopItem[];
  deleteVfsEntry: (itemId: string) => void;
  notify: (toast: { detail?: string; title: string; tone?: "info" | "success" }) => void;
  openApp: (appId: "paint") => void;
  activateVfsEntry: (item: DesktopItem) => void;
  playSound: (effect: "click" | "error" | "open" | "success" | "toggle") => void;
  renameVfsEntry: (itemId: string, name: string) => void;
  savePaintImage: (
    content: string,
    options?: { existingItemId?: string; name?: string; parentId?: string },
  ) => DesktopItem;
  windowId: string;
};

type PhotoSize = {
  height: number;
  width: number;
};

const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 1.25;
/** Mirrors the `.photos-stage` padding so "창에 맞춤" lands inside the scroller. */
const STAGE_PADDING = 16;

export default function PhotosApp({
  reportDocument,
  activeCanvasId,
  activeCanvasOpenKey,
  canvasEntries,
  deleteVfsEntry,
  notify,
  openApp,
  activateVfsEntry,
  photosLaunchRequest,
  playSound,
  renameVfsEntry,
  savePaintImage,
  windowId,
}: PhotosAppProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRenameRef = useRef(false);
  const [viewingId, setViewingId] = useState(photosLaunchRequest?.itemId ?? activeCanvasId);
  const [zoomMode, setZoomMode] = useState<"custom" | "fit">("fit");
  const [customZoom, setCustomZoom] = useState(100);
  const [naturalSize, setNaturalSize] = useState<PhotoSize | null>(null);
  const [stageSize, setStageSize] = useState<PhotoSize>({ height: 0, width: 0 });
  const [loadFailed, setLoadFailed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const sortedEntries = useMemo(
    () =>
      [...canvasEntries].sort((first, second) =>
        first.name.localeCompare(second.name, "ko", { numeric: true, sensitivity: "base" }),
      ),
    [canvasEntries],
  );
  const total = sortedEntries.length;
  const foundIndex = sortedEntries.findIndex((item) => item.id === viewingId);
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;
  const currentEntry = sortedEntries[currentIndex];
  const stageId = `photos-stage-${windowId}`;

  useEffect(() => {
    setViewingId(activeCanvasId);
  }, [activeCanvasId, activeCanvasOpenKey]);

  useEffect(() => {
    if (photosLaunchRequest) setViewingId(photosLaunchRequest.itemId);
  }, [photosLaunchRequest]);

  useEffect(() => {
    viewerRef.current?.focus({ preventScroll: true });
  }, [activeCanvasOpenKey]);

  useEffect(() => {
    reportDocument(windowId, currentEntry ? { itemId: currentEntry.id } : undefined);
  }, [currentEntry?.id, reportDocument, windowId]);

  useEffect(() => {
    setNaturalSize(null);
    setLoadFailed(false);
    setZoomMode("fit");
    setCustomZoom(100);
    setRenaming(false);
  }, [currentEntry?.content, currentEntry?.id, activeCanvasOpenKey]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      setStageSize({
        height: Math.max(0, stage.clientHeight - STAGE_PADDING * 2),
        width: Math.max(0, stage.clientWidth - STAGE_PADDING * 2),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!renaming) return;
    const input = renameInputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(0, input.value.replace(/\.[^.]+$/, "").length);
  }, [renaming]);

  const hasPhoto = Boolean(currentEntry?.content) && !loadFailed;
  const boxWidth = naturalSize?.width ?? 0;
  const boxHeight = naturalSize?.height ?? 0;
  const fitZoom =
    boxWidth > 0 && boxHeight > 0 && stageSize.width > 0 && stageSize.height > 0
      ? clamp(
          Math.floor(Math.min(stageSize.width / boxWidth, stageSize.height / boxHeight) * 100),
          MIN_ZOOM,
          MAX_ZOOM,
        )
      : 100;
  const zoom = zoomMode === "fit" ? fitZoom : customZoom;
  const displayWidth = naturalSize ? Math.round((naturalSize.width * zoom) / 100) : 0;
  const displayHeight = naturalSize ? Math.round((naturalSize.height * zoom) / 100) : 0;
  const frameStyle: React.CSSProperties = naturalSize
    ? { height: `${displayHeight}px`, width: `${displayWidth}px` }
    : {};
  const imageStyle: React.CSSProperties = {
    transform: "translate(-50%, -50%)",
    ...(naturalSize ? { height: `${displayHeight}px`, width: `${displayWidth}px` } : {}),
  };

  const focusViewer = () => viewerRef.current?.focus({ preventScroll: true });

  const applyZoom = (next: number) => {
    setZoomMode("custom");
    setCustomZoom(clamp(Math.round(next), MIN_ZOOM, MAX_ZOOM));
  };

  const zoomIn = () => applyZoom(zoom * ZOOM_STEP);

  const zoomOut = () => applyZoom(zoom / ZOOM_STEP);

  const fitToWindow = () => {
    setZoomMode("fit");
    setCustomZoom(100);
  };

  /*
   * Rotation is written into the file, the way the Windows photo viewer saves
   * it — so Explorer, Paint and the next session all see the turned image. It
   * used to be a CSS transform on the <img>, which quietly evaporated the
   * moment the reader moved to another photo and never reached the file.
   */
  const rotationInFlightRef = useRef(false);
  const canvasEntriesRef = useRef(canvasEntries);
  canvasEntriesRef.current = canvasEntries;

  const rotateBy = (degrees: number) => {
    if (!hasPhoto || !currentEntry?.content) return;
    /*
     * The decode is asynchronous, so a fast second click used to read the same
     * source as the first — two presses, one quarter turn — and a save could
     * land after its entry had been deleted, which made savePaintImage mint a
     * brand-new file and steal the active canvas. One rotation runs at a time,
     * and a save whose target vanished is abandoned.
     */
    if (rotationInFlightRef.current) return;
    rotationInFlightRef.current = true;
    const targetId = currentEntry.id;

    const source = new Image();
    const finish = () => {
      rotationInFlightRef.current = false;
    };
    source.onerror = finish;
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalHeight;
      canvas.height = source.naturalWidth;
      const context = canvas.getContext("2d");
      if (!context) return finish();

      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((degrees * Math.PI) / 180);
      context.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
      const rotated = canvas.toDataURL("image/png");
      // An oversized source can exceed the canvas area limit, and toDataURL
      // then returns a blank result — writing that over the photo would
      // destroy it to no purpose.
      if (
        rotated.length > 24 &&
        canvasEntriesRef.current.some((entry) => entry.id === targetId)
      ) {
        savePaintImage(rotated, { existingItemId: targetId });
        playSound("toggle");
      }
      finish();
    };
    source.src = currentEntry.content;
  };

  const goToOffset = (offset: number) => {
    if (total < 2) return;
    const next = sortedEntries[(currentIndex + offset + total) % total];
    if (!next) return;
    playSound("click");
    setViewingId(next.id);
  };

  const openInPaint = () => {
    if (!currentEntry) return;
    playSound("open");
    activateVfsEntry(currentEntry);
    openApp("paint");
  };

  const startRename = () => {
    if (!currentEntry) return;
    cancelRenameRef.current = false;
    setDraftName(currentEntry.name);
    setRenaming(true);
  };

  const commitRename = () => {
    // setRenaming(false) has not flushed yet, so focusViewer() blurs the still
    // mounted input and re-enters through its onBlur. Claim the commit first.
    if (cancelRenameRef.current) return;
    cancelRenameRef.current = true;

    setRenaming(false);
    focusViewer();
    if (!currentEntry) return;

    const nextName = draftName.trim();
    if (!nextName) {
      playSound("error");
      notify({
        detail: "파일 이름은 비워 둘 수 없습니다.",
        title: "이름을 바꾸지 못했습니다",
        tone: "info",
      });
      return;
    }
    if (nextName === currentEntry.name) return;

    renameVfsEntry(currentEntry.id, nextName);
    playSound("success");
    notify({
      detail: `${currentEntry.name} → ${nextName}`,
      title: "이름을 바꿨습니다",
      tone: "success",
    });
  };

  const submitRename = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitRename();
  };

  const cancelRename = () => {
    cancelRenameRef.current = true;
    setRenaming(false);
    focusViewer();
  };

  const deleteCurrent = () => {
    if (!currentEntry) return;
    const nextEntry = sortedEntries[(currentIndex + 1) % total];
    deleteVfsEntry(currentEntry.id);
    playSound("click");
    notify({
      detail: "휴지통에서 다시 복원할 수 있습니다.",
      title: `${currentEntry.name}을(를) 삭제했습니다`,
      tone: "info",
    });
    setViewingId(nextEntry && nextEntry.id !== currentEntry.id ? nextEntry.id : "");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (renaming || event.altKey || event.ctrlKey || event.metaKey) return;

    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (event.key === "ArrowLeft") {
      handled();
      goToOffset(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      handled();
      goToOffset(1);
      return;
    }

    // Delete is how the Windows photo viewer deletes; it did nothing here.
    if (event.key === "Delete") {
      handled();
      deleteCurrent();
      return;
    }

    if (!hasPhoto) return;

    if (event.key === "+" || event.key === "=") {
      handled();
      zoomIn();
      return;
    }

    if (event.key === "-" || event.key === "_") {
      handled();
      zoomOut();
      return;
    }

    if (event.key === "0") {
      handled();
      fitToWindow();
    }
  };

  const renderStage = () => {
    if (total === 0) {
      return (
        <div className="photos-placeholder">
          <ImageOff aria-hidden="true" size={42} />
          <strong>사진이 없습니다</strong>
          <p>그림판에서 그림을 저장하면 이곳에 나타납니다.</p>
        </div>
      );
    }

    if (!currentEntry?.content) {
      return (
        <div className="photos-placeholder">
          <Images aria-hidden="true" size={42} />
          <strong>아직 그리지 않은 그림입니다</strong>
          <p>{currentEntry?.name}에 저장된 이미지가 없습니다. 그림판에서 그려 보세요.</p>
          <button className="photos-command" onClick={openInPaint} type="button">
            <Pencil aria-hidden="true" size={15} />
            <span>편집</span>
          </button>
        </div>
      );
    }

    if (loadFailed) {
      return (
        <div className="photos-placeholder">
          <ImageOff aria-hidden="true" size={42} />
          <strong>사진을 열 수 없습니다</strong>
          <p>{currentEntry.name}의 이미지 데이터가 손상되었습니다.</p>
        </div>
      );
    }

    return (
      <div className="photos-frame" style={frameStyle}>
        <img
          alt={currentEntry.name}
          className={`photos-image${naturalSize ? " is-ready" : ""}`}
          draggable={false}
          onError={() => setLoadFailed(true)}
          onLoad={(event) =>
            setNaturalSize({
              height: event.currentTarget.naturalHeight,
              width: event.currentTarget.naturalWidth,
            })
          }
          /*
           * The reset above clears the measured size, but a cached image that is
           * already decoded fires no second `load`, so the photo stayed at
           * opacity 0 for good — the viewer went blank after a round trip to
           * Paint and only came back by navigating away and back.
           */
          ref={(node) => {
            if (!node || naturalSize || !node.complete || node.naturalWidth === 0) return;
            setNaturalSize({ height: node.naturalHeight, width: node.naturalWidth });
          }}
          src={currentEntry.content}
          style={imageStyle}
        />
      </div>
    );
  };

  return (
    <div className="photos-app app-fill" onKeyDown={handleKeyDown}>
      <div className="photos-toolbar">
        <div className="photos-file">
          <Images aria-hidden="true" size={16} />
          {renaming ? (
            <form className="photos-rename" onSubmit={submitRename}>
              <input
                aria-label="사진 이름"
                onBlur={() => {
                  if (cancelRenameRef.current) {
                    cancelRenameRef.current = false;
                    return;
                  }
                  commitRename();
                }}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  cancelRename();
                }}
                ref={renameInputRef}
                value={draftName}
              />
            </form>
          ) : (
            <strong title={currentEntry?.name}>{currentEntry?.name ?? "사진 없음"}</strong>
          )}
        </div>
        <div aria-label="확대/축소" className="photos-toolbar-group" role="group">
          <button
            aria-label="축소"
            disabled={!hasPhoto || zoom <= MIN_ZOOM}
            onClick={zoomOut}
            title="축소 (-)"
            type="button"
          >
            <ZoomOut aria-hidden="true" size={17} />
          </button>
          {/* The zoom buttons are locked without a photo, so the readout must not
              keep claiming a magnification for an image nobody is looking at. */}
          <span className="photos-zoom-value">{hasPhoto ? `${zoom}%` : "—"}</span>
          <button
            aria-label="확대"
            disabled={!hasPhoto || zoom >= MAX_ZOOM}
            onClick={zoomIn}
            title="확대 (+)"
            type="button"
          >
            <ZoomIn aria-hidden="true" size={17} />
          </button>
          <button
            aria-label="창에 맞춤"
            className={zoomMode === "fit" ? "is-selected" : ""}
            aria-pressed={zoomMode === "fit"}
            disabled={!hasPhoto}
            onClick={fitToWindow}
            title="창에 맞춤 (0)"
            type="button"
          >
            <Maximize2 aria-hidden="true" size={16} />
          </button>
        </div>
        <span aria-hidden="true" className="photos-toolbar-separator" />
        <div aria-label="회전" className="photos-toolbar-group" role="group">
          <button
            aria-label="왼쪽으로 회전"
            disabled={!hasPhoto}
            onClick={() => rotateBy(-90)}
            title="왼쪽으로 회전"
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="오른쪽으로 회전"
            disabled={!hasPhoto}
            onClick={() => rotateBy(90)}
            title="오른쪽으로 회전"
            type="button"
          >
            <RotateCw aria-hidden="true" size={16} />
          </button>
        </div>
        <span aria-hidden="true" className="photos-toolbar-separator" />
        <div className="photos-toolbar-group photos-toolbar-actions">
          <button
            aria-label="편집"
            className="photos-command"
            disabled={!currentEntry}
            onClick={openInPaint}
            title="그림판에서 편집"
            type="button"
          >
            <Pencil aria-hidden="true" size={15} />
            <span>편집</span>
          </button>
          <button
            aria-label="이름 바꾸기"
            className="photos-command"
            disabled={!currentEntry || renaming}
            onClick={startRename}
            title="이름 바꾸기"
            type="button"
          >
            <Type aria-hidden="true" size={15} />
            <span>이름 바꾸기</span>
          </button>
          <button
            aria-label="삭제"
            className="photos-command photos-danger"
            disabled={!currentEntry}
            onClick={deleteCurrent}
            title="삭제"
            type="button"
          >
            <Trash2 aria-hidden="true" size={15} />
            <span>삭제</span>
          </button>
        </div>
      </div>
      <div
        className="photos-viewer"
        onPointerDown={() => {
          if (!renaming) focusViewer();
        }}
        ref={viewerRef}
        tabIndex={0}
      >
        <button
          aria-controls={stageId}
          aria-label="이전 사진"
          className="photos-nav is-prev"
          disabled={total < 2}
          onClick={() => goToOffset(-1)}
          title="이전 사진 (←)"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div className="photos-stage" id={stageId} ref={stageRef}>
          {renderStage()}
        </div>
        <button
          aria-controls={stageId}
          aria-label="다음 사진"
          className="photos-nav is-next"
          disabled={total < 2}
          onClick={() => goToOffset(1)}
          title="다음 사진 (→)"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={22} />
        </button>
      </div>
      <div className="photos-statusbar">
        <span>{currentEntry?.name ?? "선택한 사진 없음"}</span>
        <span>
          {naturalSize ? `${naturalSize.width} × ${naturalSize.height}px` : "크기 정보 없음"}
        </span>
        <span>{hasPhoto ? `${zoom}%` : "—"}</span>
        {/* Windows Photos shows no position while the stage holds no image, so an
            empty library, an undrawn canvas and a broken file all drop the
            indicator instead of counting the placeholder as a photo. */}
        {hasPhoto && <span>{`${currentIndex + 1} / ${total}`}</span>}
      </div>
    </div>
  );
}
