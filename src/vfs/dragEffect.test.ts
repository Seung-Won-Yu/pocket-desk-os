import { describe, expect, it } from "vitest";
import { getVfsDropEffect, isVfsCopyDrag } from "./dragEffect";

const drag = (overrides: Partial<Parameters<typeof getVfsDropEffect>[0]> = {}) => ({
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("getVfsDropEffect", () => {
  it("moves when nothing is held", () => {
    expect(getVfsDropEffect(drag())).toBe("move");
  });

  it("copies on Ctrl", () => {
    expect(getVfsDropEffect(drag({ ctrlKey: true }))).toBe("copy");
  });

  it("copies on Cmd, for the same hand on a Mac", () => {
    expect(getVfsDropEffect(drag({ metaKey: true }))).toBe("copy");
  });

  it("moves on Shift", () => {
    expect(getVfsDropEffect(drag({ shiftKey: true }))).toBe("move");
  });

  it("lets an explicit 이동 win over Ctrl", () => {
    expect(getVfsDropEffect(drag({ ctrlKey: true, shiftKey: true }))).toBe("move");
  });
});

describe("isVfsCopyDrag", () => {
  it("agrees with the effect", () => {
    expect(isVfsCopyDrag(drag({ ctrlKey: true }))).toBe(true);
    expect(isVfsCopyDrag(drag())).toBe(false);
  });
});
