// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_SCALE,
  TEXT_SCALES,
  isTextScale,
  loadFocusAssist,
  loadTextScale,
} from "./preferences";

afterEach(() => {
  localStorage.clear();
});

describe("loadTextScale", () => {
  it("reads a scale it offers, and falls back to 100% for anything else", () => {
    localStorage.setItem("pocket-desk-text-scale-v1", "125");
    expect(loadTextScale()).toBe(125);
    localStorage.setItem("pocket-desk-text-scale-v1", "137");
    expect(loadTextScale()).toBe(DEFAULT_TEXT_SCALE);
    localStorage.setItem("pocket-desk-text-scale-v1", "커다랗게");
    expect(loadTextScale()).toBe(DEFAULT_TEXT_SCALE);
    localStorage.removeItem("pocket-desk-text-scale-v1");
    expect(loadTextScale()).toBe(DEFAULT_TEXT_SCALE);
  });

  it("offers 100% first, and every choice is a real percentage", () => {
    expect(TEXT_SCALES[0]).toBe(100);
    expect(TEXT_SCALES.every((scale) => scale >= 100 && scale <= 200)).toBe(true);
    expect(isTextScale(150)).toBe(true);
    expect(isTextScale(101)).toBe(false);
  });
});

describe("loadFocusAssist", () => {
  it("is off unless it was turned on", () => {
    expect(loadFocusAssist()).toBe(false);
    localStorage.setItem("pocket-desk-focus-assist-v1", "on");
    expect(loadFocusAssist()).toBe(true);
    localStorage.setItem("pocket-desk-focus-assist-v1", "off");
    expect(loadFocusAssist()).toBe(false);
  });
});
