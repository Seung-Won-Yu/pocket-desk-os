/**
 * Aero Shake: grab a title bar and shake it side to side, and every other
 * window minimizes; shake again and they come back. The detector watches the
 * pointer's horizontal motion during a title-bar drag and fires once it has
 * reversed direction enough times, quickly enough, with real travel between
 * reversals — a slow zig-zag while placing a window is not a shake.
 */

/** Direction changes needed — three swings back and forth, as Windows wants. */
export const SHAKE_REVERSALS = 3;
/** Travel between reversals that counts as a swing, not pointer jitter. */
export const SHAKE_MIN_SWING = 24;
/** The whole shake has to happen inside this window. */
export const SHAKE_WINDOW_MS = 600;
/**
 * After a shake fires, the samples that keep arriving are the same gesture
 * still finishing. Without this, one long shake reached the reversal count
 * again and again: minimize, restore, minimize, from a single wave of the
 * hand. A new shake is a new gesture, and a gesture takes a moment to start.
 */
export const SHAKE_COOLDOWN_MS = 500;

export interface ShakeDetector {
  /** Feed one pointer sample; true exactly when a shake completes. */
  feed: (x: number, time: number) => boolean;
  reset: () => void;
}

export function createShakeDetector(): ShakeDetector {
  let anchorX: number | null = null;
  let direction = 0;
  let reversals: number[] = [];
  let firedAt: number | null = null;

  const reset = () => {
    anchorX = null;
    direction = 0;
    reversals = [];
  };

  return {
    feed(x, time) {
      if (firedAt !== null) {
        if (time - firedAt < SHAKE_COOLDOWN_MS) return false;
        firedAt = null;
      }
      if (anchorX === null) {
        anchorX = x;
        return false;
      }
      const delta = x - anchorX;
      if (Math.abs(delta) < SHAKE_MIN_SWING) return false;
      const nextDirection = Math.sign(delta);
      // Moved far enough in some direction: this is the new turning point.
      anchorX = x;
      if (direction !== 0 && nextDirection !== direction) {
        reversals = [...reversals.filter((at) => time - at <= SHAKE_WINDOW_MS), time];
        if (reversals.length >= SHAKE_REVERSALS) {
          reset();
          firedAt = time;
          return true;
        }
      }
      direction = nextDirection;
      return false;
    },
    reset,
  };
}
