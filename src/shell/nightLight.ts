import { NIGHT_LIGHT_KEY, NIGHT_LIGHT_STRENGTH_KEY } from "./constants";

/**
 * 야간 조명 — Windows' Night light: a warm wash over everything, so the screen
 * stops emitting the blue end of its light in the evening. The strength slider
 * is the same 0-100 Windows uses, and it is remembered separately from the
 * switch, so turning it off and on again comes back at the warmth you set.
 *
 * Painted the way the brightness dim already is: one overlay above the whole
 * shell, driven by a variable. It sits above the desktop and every window, and
 * takes no pointer events — a filter on the shell root would have been simpler
 * still, but it would also have re-rastered every window on each change.
 */
export const DEFAULT_NIGHT_LIGHT_STRENGTH = 40;
export const MIN_NIGHT_LIGHT_STRENGTH = 10;
export const MAX_NIGHT_LIGHT_STRENGTH = 100;

/** The alpha the warm overlay paints at. Full strength stays readable. */
export function getNightLightAlpha(enabled: boolean, strength: number) {
  if (!enabled) return 0;
  return (clampStrength(strength) / 100) * 0.42;
}

export function clampStrength(strength: number) {
  if (!Number.isFinite(strength)) return DEFAULT_NIGHT_LIGHT_STRENGTH;
  return Math.min(
    MAX_NIGHT_LIGHT_STRENGTH,
    Math.max(MIN_NIGHT_LIGHT_STRENGTH, Math.round(strength)),
  );
}

export function loadNightLight() {
  try {
    return localStorage.getItem(NIGHT_LIGHT_KEY) === "on";
  } catch {
    return false;
  }
}

export function persistNightLight(enabled: boolean) {
  try {
    localStorage.setItem(NIGHT_LIGHT_KEY, enabled ? "on" : "off");
  } catch {
    // The setting is lost, the session is not.
  }
}

export function loadNightLightStrength() {
  try {
    // Nothing stored is not "zero, clamped to the minimum" — it is the default.
    // Number(null) is 0, so reading the raw value first is what separates a
    // setting never touched from one deliberately turned all the way down.
    const stored = localStorage.getItem(NIGHT_LIGHT_STRENGTH_KEY);
    if (stored === null) return DEFAULT_NIGHT_LIGHT_STRENGTH;
    return clampStrength(Number(stored));
  } catch {
    return DEFAULT_NIGHT_LIGHT_STRENGTH;
  }
}

export function persistNightLightStrength(strength: number) {
  try {
    localStorage.setItem(NIGHT_LIGHT_STRENGTH_KEY, String(clampStrength(strength)));
  } catch {
    // Same.
  }
}
