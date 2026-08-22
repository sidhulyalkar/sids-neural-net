let scrollVelocityPxPerMs = 0;
let updatedAt = 0;

/** Shared by the existing predictive-scroll observer and the local sequence model. */
export function setFrontierScrollVelocity(value: number, at = performance.now()): void {
  if (!Number.isFinite(value)) return;
  scrollVelocityPxPerMs = Math.max(-4, Math.min(4, value));
  updatedAt = at;
}

export function getFrontierScrollVelocity(at = typeof performance !== 'undefined' ? performance.now() : 0): number {
  // A velocity sample is only meaningful while the user's scrolling gesture is
  // current. Do not let one fast flick attenuate evidence several seconds later.
  if (!updatedAt || at - updatedAt > 420) return 0;
  return scrollVelocityPxPerMs;
}

export function resetFrontierScrollVelocity(): void {
  scrollVelocityPxPerMs = 0;
  updatedAt = 0;
}

/**
 * Slow reading preserves implicit evidence; fast pass-through scrolling reduces
 * it. Explicit likes/dislikes/saves never use this attenuation.
 */
export function readingPaceFactor(velocityPxPerMs: number): number {
  const speed = Math.abs(velocityPxPerMs);
  if (speed <= 0.12) return 1;
  return Math.max(0.38, 1 / (1 + speed * 0.78));
}
