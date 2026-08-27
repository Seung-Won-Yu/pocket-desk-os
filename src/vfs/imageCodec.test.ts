import { describe, expect, it } from "vitest";
import {
  blobToDataUrl,
  bytesToDataUrl,
  dataUrlToBlob,
  dataUrlToBytes,
  isImageDataUrl,
} from "./imageCodec";

/** The 8-byte PNG signature is enough to exercise the round trip. */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DATA_URL = bytesToDataUrl(PNG_SIGNATURE, "image/png");

describe("isImageDataUrl", () => {
  it("accepts a base64 image data URL", () => {
    expect(isImageDataUrl(PNG_DATA_URL)).toBe(true);
    expect(isImageDataUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isImageDataUrl("data:image/svg+xml;base64,AAAA")).toBe(true);
  });

  it("rejects anything that is not one", () => {
    expect(isImageDataUrl("")).toBe(false);
    expect(isImageDataUrl("메모 내용")).toBe(false);
    expect(isImageDataUrl("data:text/plain;base64,AAAA")).toBe(false);
    // Not base64, so the bytes cannot be recovered.
    expect(isImageDataUrl("data:image/svg+xml,<svg/>")).toBe(false);
    expect(isImageDataUrl("https://example.com/a.png")).toBe(false);
  });

  it("accepts an empty payload", () => {
    expect(isImageDataUrl("data:image/png;base64,")).toBe(true);
  });
});

describe("dataUrlToBytes", () => {
  it("recovers the original bytes and media type", () => {
    const parsed = dataUrlToBytes(PNG_DATA_URL);
    expect(parsed?.type).toBe("image/png");
    expect(parsed && [...parsed.bytes]).toEqual([...PNG_SIGNATURE]);
  });

  it("returns null for a non-image data URL", () => {
    expect(dataUrlToBytes("data:text/plain;base64,AAAA")).toBeNull();
    expect(dataUrlToBytes("메모")).toBeNull();
  });

  it("returns null rather than throwing on a malformed payload", () => {
    // A single stray character cannot form a base64 quantum.
    expect(dataUrlToBytes("data:image/png;base64,A")).toBeNull();
  });
});

describe("bytesToDataUrl", () => {
  it("round-trips every byte value", () => {
    const all = new Uint8Array(256);
    for (let index = 0; index < 256; index += 1) all[index] = index;

    const parsed = dataUrlToBytes(bytesToDataUrl(all, "image/png"));
    expect(parsed && [...parsed.bytes]).toEqual([...all]);
  });

  it("round-trips a payload past the chunking boundary", () => {
    const large = new Uint8Array(0x8000 * 2 + 17).map((_, index) => index % 251);
    const parsed = dataUrlToBytes(bytesToDataUrl(large, "image/png"));
    expect(parsed?.bytes.length).toBe(large.length);
    expect(parsed && [...parsed.bytes.subarray(0, 8)]).toEqual([...large.subarray(0, 8)]);
    expect(parsed && [...parsed.bytes.subarray(-8)]).toEqual([...large.subarray(-8)]);
  });

  it("keeps the media type it was given", () => {
    expect(
      bytesToDataUrl(PNG_SIGNATURE, "image/webp").startsWith("data:image/webp;base64,"),
    ).toBe(true);
  });
});

describe("blob round trip", () => {
  it("stores the raw bytes, not the base64 text", async () => {
    const blob = dataUrlToBlob(PNG_DATA_URL);
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("image/png");
    // This is the whole point: the Blob is smaller than the string it replaces.
    expect(blob?.size).toBe(PNG_SIGNATURE.length);
    expect(blob!.size).toBeLessThan(PNG_DATA_URL.length);
  });

  it("comes back as the identical data URL", async () => {
    const blob = dataUrlToBlob(PNG_DATA_URL);
    expect(await blobToDataUrl(blob!)).toBe(PNG_DATA_URL);
  });

  it("falls back to png when a blob carries no type", async () => {
    const blob = new Blob([new Uint8Array(new ArrayBuffer(PNG_SIGNATURE.length))]);
    expect(await blobToDataUrl(blob)).toMatch(/^data:image\/png;base64,/);
  });

  it("returns null for content that is not an image data URL", () => {
    expect(dataUrlToBlob("메모 내용")).toBeNull();
  });
});
