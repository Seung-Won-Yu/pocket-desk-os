import { describe, expect, it } from "vitest";
import { SHAKE_MIN_SWING, SHAKE_WINDOW_MS, createShakeDetector } from "./aeroShake";

/** Feed a zig-zag of `swings` alternating moves of `amplitude`, `stepMs` apart. */
function zigzag(
  detector: ReturnType<typeof createShakeDetector>,
  swings: number,
  amplitude: number,
  stepMs: number,
) {
  let x = 100;
  let time = 0;
  const fired: number[] = [];
  detector.feed(x, time);
  for (let index = 0; index < swings; index += 1) {
    x += index % 2 === 0 ? amplitude : -amplitude;
    time += stepMs;
    if (detector.feed(x, time)) fired.push(index);
  }
  return fired;
}

describe("createShakeDetector", () => {
  it("fires once after three quick reversals with real travel", () => {
    const detector = createShakeDetector();
    // swing 0 sets the direction; swings 1, 2, 3 are reversals → fires on the 4th sample.
    expect(zigzag(detector, 6, 60, 60)).toEqual([3]);
  });

  it("ignores pointer jitter below the swing threshold", () => {
    const detector = createShakeDetector();
    expect(zigzag(detector, 12, SHAKE_MIN_SWING - 1, 40)).toEqual([]);
  });

  it("does not fire for a slow zig-zag while placing a window", () => {
    const detector = createShakeDetector();
    expect(zigzag(detector, 8, 80, SHAKE_WINDOW_MS)).toEqual([]);
  });

  it("a straight drag never fires, however far it goes", () => {
    const detector = createShakeDetector();
    let time = 0;
    for (let x = 0; x < 2000; x += 40) {
      expect(detector.feed(x, (time += 16))).toBe(false);
    }
  });

  it("reset forgets a half-finished shake", () => {
    const detector = createShakeDetector();
    expect(zigzag(detector, 3, 60, 60)).toEqual([]);
    detector.reset();
    expect(zigzag(detector, 3, 60, 60)).toEqual([]);
  });
});
