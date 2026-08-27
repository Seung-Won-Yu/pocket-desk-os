/**
 * Images are held in the model as `data:image/png;base64,...` strings, which is
 * what Paint produces, what the ZIP backup serializes, and what an <img> src
 * takes. Base64 costs a third more bytes than the PNG it wraps, so the storage
 * layer swaps that string for the raw bytes on the way into IndexedDB and swaps
 * it back on the way out. Nothing above `storage.ts` sees a Blob.
 */
const IMAGE_DATA_URL_PATTERN = /^data:(image\/[a-z0-9+.-]+);base64,([A-Za-z0-9+/=]*)$/i;

export function isImageDataUrl(value: string) {
  return IMAGE_DATA_URL_PATTERN.test(value);
}

export function dataUrlToBytes(
  value: string,
): { bytes: Uint8Array<ArrayBuffer>; type: string } | null {
  const match = IMAGE_DATA_URL_PATTERN.exec(value);
  if (!match) return null;

  const [, type, base64] = match;
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes, type };
}

export function bytesToDataUrl(bytes: Uint8Array, type: string) {
  // Chunked so a multi-megabyte image cannot blow the argument limit of apply().
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

export function dataUrlToBlob(value: string): Blob | null {
  const parsed = dataUrlToBytes(value);
  if (!parsed) return null;
  return new Blob([parsed.bytes], { type: parsed.type });
}

export async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return bytesToDataUrl(bytes, blob.type || "image/png");
}
