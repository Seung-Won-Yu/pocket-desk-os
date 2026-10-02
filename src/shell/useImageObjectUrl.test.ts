// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getObjectUrlSource } from "./objectUrlSources";
import { useImageObjectUrl } from "./useImageObjectUrl";

const PNG = "data:image/png;base64,AQID";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useImageObjectUrl", () => {
  it("hands CSS a blob: URL, remembers its source, and lets it go after", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: () => {
          const url = `blob:${window.location.origin}/${created.length}`;
          created.push(url);
          return url;
        },
        revokeObjectURL: (url: string) => revoked.push(url),
      }),
    );
    const { rerender, result } = renderHook(({ source }) => useImageObjectUrl(source), {
      initialProps: { source: PNG as string | null },
    });
    expect(result.current).toBe(created[0]);
    expect(getObjectUrlSource(created[0])).toBe(PNG);

    rerender({ source: null });
    expect(result.current).toBeNull();
    expect(revoked).toEqual([created[0]]);
    expect(getObjectUrlSource(created[0])).toBeNull();
  });

  it("is nothing for a value that is not a picture", () => {
    const { result } = renderHook(() => useImageObjectUrl("javascript:alert(1)"));
    expect(result.current).toBeNull();
  });
});
