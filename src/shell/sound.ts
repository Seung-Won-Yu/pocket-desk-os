import { type SoundEffectName } from "../types";
import { type SoundStep } from "./types";

export function createPocketDeskAudioContext() {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  try {
    return new AudioContextConstructor();
  } catch {
    return null;
  }
}

/**
 * `volume` is 0-100. The tray slider used to be a mute toggle wearing a
 * slider's clothes: it only ever reported 0 or 72 back, so any value the user
 * dragged to sprang straight back.
 */
export function playPocketDeskSound(
  audioContext: AudioContext,
  effect: SoundEffectName,
  volume = 100,
) {
  if (audioContext.state === "closed") return;
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => undefined);
  }

  const steps = getPocketDeskSoundSteps(effect);
  const startTime = audioContext.currentTime + 0.012;

  steps.forEach((step) => {
    const noteStart = startTime + (step.offset ?? 0);
    const noteEnd = noteStart + step.duration;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = step.type ?? "sine";
    oscillator.frequency.setValueAtTime(step.frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    const level = Math.max(0.0002, step.gain * (volume / 100));
    gain.gain.exponentialRampToValueAtTime(level, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.018);
  });
}

export function getPocketDeskSoundSteps(effect: SoundEffectName): SoundStep[] {
  const effects: Record<SoundEffectName, SoundStep[]> = {
    click: [{ duration: 0.045, frequency: 520, gain: 0.014, type: "triangle" }],
    close: [
      { duration: 0.055, frequency: 420, gain: 0.015, type: "triangle" },
      { duration: 0.07, frequency: 260, gain: 0.012, offset: 0.035, type: "sine" },
    ],
    error: [
      { duration: 0.065, frequency: 190, gain: 0.018, type: "sawtooth" },
      { duration: 0.1, frequency: 130, gain: 0.014, offset: 0.045, type: "triangle" },
    ],
    minimize: [
      { duration: 0.045, frequency: 520, gain: 0.012, type: "triangle" },
      { duration: 0.06, frequency: 330, gain: 0.01, offset: 0.03, type: "triangle" },
    ],
    open: [
      { duration: 0.045, frequency: 440, gain: 0.014, type: "sine" },
      { duration: 0.08, frequency: 660, gain: 0.015, offset: 0.035, type: "triangle" },
    ],
    success: [
      { duration: 0.045, frequency: 660, gain: 0.012, type: "sine" },
      { duration: 0.085, frequency: 880, gain: 0.014, offset: 0.04, type: "triangle" },
    ],
    toggle: [{ duration: 0.06, frequency: 610, gain: 0.012, type: "square" }],
    unlock: [
      { duration: 0.045, frequency: 390, gain: 0.014, type: "sine" },
      { duration: 0.055, frequency: 585, gain: 0.014, offset: 0.04, type: "sine" },
      { duration: 0.09, frequency: 780, gain: 0.012, offset: 0.08, type: "triangle" },
    ],
  };

  return effects[effect];
}
