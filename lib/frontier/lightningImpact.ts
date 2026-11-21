/** Hit-testing for the *tip* of a click-directed lightning bolt.
 * The actual visible glyph, not its generous button hitbox, defines a hit.
 * No nearest-neighbor attraction or implied interest on missed shots.
 */
export type LightningHitRect = { left: number; top: number; width: number; height: number };
export type LightningImpactPoint = { x: number; y: number };

export function lightningTipTouchesBubble(point: LightningImpactPoint, rect: LightningHitRect): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
      !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
      rect.width <= 0 || rect.height <= 0) return false;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // The visible bubble has a circular body. Corners of its rectangular
  // bounds must NOT pop on a near miss.
  const dx = (point.x - cx) / (rect.width / 2);
  const dy = (point.y - cy) / (rect.height / 2);
  return dx * dx + dy * dy <= 1;
}
