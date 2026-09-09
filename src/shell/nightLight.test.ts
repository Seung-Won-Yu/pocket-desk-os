// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_NIGHT_LIGHT_STRENGTH,
  MAX_NIGHT_LIGHT_STRENGTH,
  MIN_NIGHT_LIGHT_STRENGTH,
  clampStrength,
  getNightLightAlpha,
  loadNightLight,
  loadNightLightStrength,
  persistNightLight,
  persistNightLightStrength,
} from "./nightLight";

afterEach(() => {
  localStorage.clear();
});

describe("getNightLightAlpha", () => {
  it("paints nothing while it is off, whatever the strength", () => {
    expect(getNightLightAlpha(false, 100)).toBe(0);
    expect(getNightLightAlpha(false, MIN_NIGHT_LIGHT_STRENGTH)).toBe(0);
  });

  it("scales with the strength and stops short of opaque", () => {
    expect(getNightLightAlpha(true, 100)).toBeCloseTo(0.42);
    expect(getNightLightAlpha(true, 50)).toBeCloseTo(0.21);
    // Even at full warmth the screen stays readable.
    expect(getNightLightAlpha(true, 100)).toBeLessThan(0.5);
  });
});

describe("clampStrength", () => {
  it("keeps the slider inside its own range", () => {
    expect(clampStrength(0)).toBe(MIN_NIGHT_LIGHT_STRENGTH);
    expect(clampStrength(500)).toBe(MAX_NIGHT_LIGHT_STRENGTH);
    expect(clampStrength(42.6)).toBe(43);
  });

  it("falls back rather than passing a non-number through to the paint", () => {
    expect(clampStrength(Number.NaN)).toBe(DEFAULT_NIGHT_LIGHT_STRENGTH);
    expect(clampStrength(Number.POSITIVE_INFINITY)).toBe(DEFAULT_NIGHT_LIGHT_STRENGTH);
  });
});

describe("storage", () => {
  it("starts off, at the default warmth", () => {
    expect(loadNightLight()).toBe(false);
    expect(loadNightLightStrength()).toBe(DEFAULT_NIGHT_LIGHT_STRENGTH);
  });

  it("remembers the warmth separately from the switch", () => {
    persistNightLightStrength(80);
    persistNightLight(true);
    expect(loadNightLightStrength()).toBe(80);
    persistNightLight(false);
    // Turning it off and on again comes back where it was.
    expect(loadNightLightStrength()).toBe(80);
  });

  it("clamps a hand-edited strength instead of trusting it", () => {
    localStorage.setItem("pocket-desk-night-light-strength-v1", "9999");
    expect(loadNightLightStrength()).toBe(MAX_NIGHT_LIGHT_STRENGTH);
    localStorage.setItem("pocket-desk-night-light-strength-v1", "따뜻하게");
    expect(loadNightLightStrength()).toBe(DEFAULT_NIGHT_LIGHT_STRENGTH);
  });
});
