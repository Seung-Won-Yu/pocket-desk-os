import { useLayoutEffect, useState } from "react";
import { dataUrlToBlob } from "../vfs/imageCodec";
import { forgetObjectUrlSource, registerObjectUrlSource } from "./objectUrlSources";

/**
 * A picture's data URL handed to CSS as a blob: URL. Chrome drops a custom
 * property whose value is over 2 MiB — measured: a 2.1 MB value read back
 * empty where `background-image` took it whole — and a full-screen screenshot
 * PNG is 2.4 MB, so `--wallpaper-image` silently kept the preset and
 * 바탕 화면 배경으로 설정 did nothing for one. A blob: URL is a few dozen
 * characters whatever the picture weighs.
 *
 * A layout effect, so the URL is in place before the first paint: the lock
 * screen showed the preset for a frame otherwise.
 */
export function useImageObjectUrl(dataUrl: string | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useLayoutEffect(() => {
    const blob = dataUrl ? dataUrlToBlob(dataUrl) : null;
    if (!dataUrl || !blob) {
      setObjectUrl(null);
      return;
    }
    // jsdom has no object URLs; the data URL itself is right for small pictures.
    if (typeof URL.createObjectURL !== "function") {
      setObjectUrl(dataUrl);
      return;
    }
    const url = URL.createObjectURL(blob);
    // So a screen capture can picture it without fetching it.
    registerObjectUrlSource(url, dataUrl);
    setObjectUrl(url);
    return () => {
      forgetObjectUrlSource(url);
      URL.revokeObjectURL(url);
    };
  }, [dataUrl]);

  return objectUrl;
}
