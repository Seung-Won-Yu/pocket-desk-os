/**
 * 슬라이드 쇼 for 사진. The viewer could step through pictures and never walk
 * through them by itself.
 */
export const SLIDESHOW_INTERVAL_MS = 3000;

/**
 * Where the show is after one tick. Wraps, because a slideshow that stops at
 * the end is a slide *sequence* — Windows' own loops.
 */
export function getNextSlideIndex(current: number, total: number) {
  if (total < 1) return 0;
  return (current + 1) % total;
}

/**
 * Whether a show can run at all. One picture is not a show, and neither is
 * none — Windows greys the button out rather than looping one image forever.
 */
export function canRunSlideshow(total: number) {
  return total > 1;
}
