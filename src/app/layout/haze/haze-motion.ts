const RESOLUTION = 0.6;
export const FRAME_SAMPLES = 120;
const SLOW_FRAME_MS = 40;
const LONGEST_FRAME_MS = 1000;
const FULL_ENERGY_PX = 400;
const ENERGY_LEFT_PER_FRAME = 0.94;
const MS_PER_FRAME_AT_60_HZ = 1000 / 60;

/** Canvas size in device pixels; a low device pixel ratio lowers it further, a high one never raises it. */
export function renderSize(
  width: number,
  height: number,
  dpr: number,
): { width: number; height: number } {
  const scale = Math.min(dpr, 1) * RESOLUTION;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function ease(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/** Path of the light when no fine pointer can steer it. */
export function driftTarget(now: number, width: number, height: number): { x: number; y: number } {
  return {
    x: width * (0.55 + Math.sin(now * 0.00017) * 0.3),
    y: height * (0.4 + Math.cos(now * 0.00023) * 0.25),
  };
}

/** How strongly a fast pointer still stirs the haze, 0 to 1. Fades by time, so alike at any frame rate. */
export function pointerEnergy(energy: number, movedPx: number, elapsedMs: number): number {
  const faded = energy * ENERGY_LEFT_PER_FRAME ** (elapsedMs / MS_PER_FRAME_AT_60_HZ);
  return Math.min(1, faded + movedPx / FULL_ENERGY_PX);
}

/** Time since the last frame, or null for a pause of the whole page: it says nothing about the GPU. */
export function frameTime(now: number, previous: number): number | null {
  const time = now - previous;
  return time > LONGEST_FRAME_MS ? null : time;
}

export function isTooSlow(frameTimesMs: number[]): boolean {
  if (frameTimesMs.length < FRAME_SAMPLES) return false;
  const total = frameTimesMs.reduce((sum, ms) => sum + ms, 0);
  return total / frameTimesMs.length > SLOW_FRAME_MS;
}

/**
 * Asks until `done` says yes, at most `tries` more times, then goes on anyway: an answer that
 * never comes must not keep scheduling work for the life of the page.
 */
export function pollUntil(
  done: () => boolean,
  later: (next: () => void) => void,
  tries: number,
  then: () => void,
): void {
  if (done() || tries <= 0) {
    then();
    return;
  }
  later(() => pollUntil(done, later, tries - 1, then));
}
