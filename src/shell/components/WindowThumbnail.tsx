import { type ComponentProps, useLayoutEffect, useRef, useState } from "react";
import AppIconTile from "../../components/AppIconTile";
import { getWindowFrameSize, snapshotWindowFrame, syncScrollOffsets } from "../windowSnapshot";
import { type WindowInstance } from "../types";

type TileProps = ComponentProps<typeof AppIconTile>;

/**
 * A picture of a window for the taskbar preview, Alt+Tab and Task View: the
 * live frame cloned and scaled to fit this box. Falls back to the app's icon
 * tile when the window is not in the DOM (it lives on another virtual desktop).
 *
 * The clone is managed imperatively inside an element React never renders
 * children into, so React's reconciliation and the DOM copy stay apart.
 */
export function WindowThumbnail({
  accent,
  icon,
  instance,
  refreshMs = 0,
  size = "large",
}: {
  accent: TileProps["accent"];
  icon: TileProps["icon"];
  instance: WindowInstance;
  /** Re-take the picture this often while shown (0 = once). */
  refreshMs?: number;
  size?: TileProps["size"];
}) {
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const { height, id, maximized, width } = instance;

  // Layout effect: the picture is in place before the first paint, so the
  // icon fallback never flashes for a window that is right there in the DOM.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const takePicture = () => {
      const snapshot = snapshotWindowFrame(id, { height, maximized, width });
      box.replaceChildren();
      if (!snapshot) {
        setHasSnapshot(false);
        return;
      }
      const frame = getWindowFrameSize({ height, maximized, width });
      const rect = box.getBoundingClientRect();
      const boxWidth = rect.width || box.clientWidth;
      const boxHeight = rect.height || box.clientHeight;
      if (!boxWidth || !boxHeight) {
        setHasSnapshot(false);
        return;
      }
      const scale = Math.min(boxWidth / frame.width, boxHeight / frame.height, 1);
      const stage = document.createElement("span");
      stage.className = "window-thumbnail-stage";
      stage.style.width = `${Math.round(frame.width * scale)}px`;
      stage.style.height = `${Math.round(frame.height * scale)}px`;
      snapshot.clone.style.transformOrigin = "top left";
      snapshot.clone.style.transform = `scale(${scale})`;
      stage.append(snapshot.clone);
      box.append(stage);
      syncScrollOffsets(snapshot.source, snapshot.clone);
      setHasSnapshot(true);
    };

    takePicture();
    const timer = refreshMs > 0 ? window.setInterval(takePicture, refreshMs) : 0;
    return () => {
      if (timer) window.clearInterval(timer);
      box.replaceChildren();
    };
  }, [height, id, maximized, refreshMs, width]);

  return (
    <span className={`window-thumbnail${hasSnapshot ? " has-snapshot" : ""}`}>
      <span aria-hidden="true" className="window-thumbnail-box" ref={boxRef} />
      {!hasSnapshot && <AppIconTile accent={accent} icon={icon} size={size} />}
    </span>
  );
}
