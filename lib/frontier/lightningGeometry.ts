/** A jagged, curved lightning arc with exact target impact geometry.
 * Deterministic on every click; short-lived SVG paths only, no physics engine.
 */
export type LightningPoint = { x: number; y: number };
export type LightningGeometry = {
  main: string;
  forks: string[];
  end: LightningPoint;
};

export function frontierLightningGeometry(
  from: LightningPoint, to: LightningPoint, seed: number,
): LightningGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;
  const curve = Math.min(57, Math.max(22, distance * 0.24)) * (seed % 2 ? -1 : 1);
  const control = {
    x: (from.x + to.x) / 2 + nx * curve,
    y: (from.y + to.y) / 2 + ny * curve,
  };
  let noise = seed >>> 0;
  const random = () => {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    return noise / 0x100000000;
  };
  const steps = Math.min(24, Math.max(9, Math.round(distance / 10)));
  const points: LightningPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const anti = 1 - t;
    const coreX = anti * anti * from.x + 2 * anti * t * control.x + t * t * to.x;
    const coreY = anti * anti * from.y + 2 * anti * t * control.y + t * t * to.y;
    // Perpendicular electrical zigzags taper to zero at both endpoints.
    const kick = i === 0 || i === steps ? 0
      : (random() * 2 - 1) * Math.min(16, 6 + distance * 0.065) * Math.sin(Math.PI * t);
    points.push({
      x: Math.round(coreX + nx * kick),
      y: Math.round(coreY + ny * kick),
    });
  }
  const draw = (segments: LightningPoint[]) =>
    segments.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const forks = [0.37, 0.66, 0.84].map((fraction, i) => {
    const p = points[Math.floor(steps * fraction)];
    const sign = i % 2 ? -1 : 1;
    const angle = (random() - 0.5) * 0.45;
    const reach = 23 + random() * 21;
    const branch = {
      x: Math.round(p.x + nx * sign * reach + dx / distance * reach * angle),
      y: Math.round(p.y + ny * sign * reach + dy / distance * reach * angle),
    };
    return draw([p, {
      x: Math.round((p.x + branch.x) / 2 + (random() - 0.5) * 12),
      y: Math.round((p.y + branch.y) / 2 + (random() - 0.5) * 12),
    }, branch]);
  });
  return { main: draw(points), forks, end: { ...points[steps] } };
}
