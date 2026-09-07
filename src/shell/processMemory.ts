import { type AppId } from "../types";

/**
 * What a window is holding, in megabytes.
 *
 * The figure used to be a hash of the window id: stable, but a fiction — a
 * Notepad window with a novel in it read the same as an empty one. The part
 * that can be known is now measured: the bytes of the document the window says
 * it has open. The rest is a declared per-app baseline, the cost of the app's
 * own chrome, which no browser will ever tell us.
 */

/** Baseline megabytes per app — the window and its controls, not its document. */
const APP_BASELINE_MB: Partial<Record<AppId, number>> = {
  browser: 96,
  files: 48,
  minesweeper: 28,
  paint: 72,
  photos: 64,
  snip: 40,
  taskmanager: 36,
  terminal: 30,
};

const DEFAULT_BASELINE_MB = 24;
/** A maximized window paints a bigger surface, and that costs. */
const MAXIMIZED_SURCHARGE_MB = 16;

export function estimateProcessMemoryMb(
  appId: AppId,
  documentBytes: number,
  maximized: boolean,
): number {
  const baseline = APP_BASELINE_MB[appId] ?? DEFAULT_BASELINE_MB;
  const document = Math.max(0, documentBytes) / (1024 * 1024);
  return Math.round(baseline + document + (maximized ? MAXIMIZED_SURCHARGE_MB : 0));
}
