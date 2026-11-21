/** A jagged, curved lightning arc with exact target impact geometry.
 * Deterministic on every click; short-lived SVG paths only, no physics engine.
 */
export type LightningPoint = { x: number; y: number };
export type LightningGeometry = {
  main: string;
  filaments: string[];
  forks: string[];
  dendrites: string[];
  microDendrites: string[];
  start: LightningPoint;
  end: LightningPoint;
};

export const LIGHTNING_REACH_X = 116;
export const LIGHTNING_REACH_Y = 92;

/** The cursor is the emitter, and the distant tip is the only collision point.
 * Edge reflections keep the shot long enough to be useful near viewport edges.
 * This same projection drives both the visual reticle and the actual hit test.
 */
export function frontierLightningFarTip(
  origin: LightningPoint, viewport: { width: number; height: number },
): LightningPoint {
  const pad = 14;
  const limitX = Math.max(pad, viewport.width - pad);
  const limitY = Math.max(pad, viewport.height - pad);
  return {
    x: Math.round(Math.max(pad, Math.min(limitX,
      origin.x + (origin.x < LIGHTNING_REACH_X + pad ? LIGHTNING_REACH_X : -LIGHTNING_REACH_X)))),
    y: Math.round(Math.max(pad, Math.min(limitY,
      origin.y + (origin.y < LIGHTNING_REACH_Y + pad ? LIGHTNING_REACH_Y : -LIGHTNING_REACH_Y)))),
  };
}

export function frontierLightningGeometry(
  from: LightningPoint, to: LightningPoint, seed: number,
): LightningGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;
  // A deliberately bowed discharge, not an almost-straight zigzag.
  // Extra curvature gives the shot the feeling of an electric lash.
  const curve = Math.min(112, Math.max(42, distance * 0.62)) * (seed % 2 ? -1 : 1);
  const control = {
    x: (from.x + to.x) / 2 + nx * curve,
    y: (from.y + to.y) / 2 + ny * curve,
  };
  let noise = seed >>> 0;
  const random = () => {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    return noise / 0x100000000;
  };
  const steps = Math.min(28, Math.max(12, Math.round(distance / 7)));
  const points: LightningPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const anti = 1 - t;
    const coreX = anti * anti * from.x + 2 * anti * t * control.x + t * t * to.x;
    const coreY = anti * anti * from.y + 2 * anti * t * control.y + t * t * to.y;
    // Perpendicular electrical zigzags taper to zero at both endpoints.
    const kick = i === 0 || i === steps ? 0
      : (random() * 2 - 1) * Math.min(13, 4 + distance * 0.059) * Math.sin(Math.PI * t);
    points.push({
      x: Math.round(coreX + nx * kick),
      y: Math.round(coreY + ny * kick),
    });
  }
  const draw = (segments: LightningPoint[]) =>
    segments.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  // Two branching corona filaments wrap around the main electric conductor.
  // The endpoints of these are decorative; only 'end' can strike a creature.
  const filaments = [1, -1].map((side, k) => {
    const start = 2 + k * 2;
    const finish = Math.min(steps - 2, steps - 4 + k);
    const filament = points.slice(start, finish + 1).map((point, index) => {
      const t = index / Math.max(1, finish - start);
      const bend = side * (5 + 8 * Math.sin(Math.PI * t));
      return { x: Math.round(point.x + nx * bend), y: Math.round(point.y + ny * bend) };
    });
    return draw(filament);
  });
  // Branch structure is deterministic per shot. Five heavier secondary
  // channels sprout from the trunk, while dozens of narrower dendrites
  // fork off both trunk and secondary channels like natural lightning.
  const forkNodes = [0.18, 0.31, 0.48, 0.64, 0.82].map((fraction, i) => {
    const p = points[Math.floor(steps * fraction)];
    const sign = i % 2 ? -1 : 1;
    const reach = 23 + random() * 31;
    const along = (random() - 0.4) * reach * 0.8;
    const branch = {
      x: Math.round(p.x + nx * sign * reach + dx / distance * along),
      y: Math.round(p.y + ny * sign * reach + dy / distance * along),
    };
    return [p, {
      x: Math.round((p.x + branch.x) / 2 + (random() - 0.5) * 16),
      y: Math.round((p.y + branch.y) / 2 + (random() - 0.5) * 16),
    }, branch];
  });
  const forks = forkNodes.map(draw);

  const createBranch = (stem: LightningPoint, sign: number, length: number) => {
    const along = (random() - 0.35) * length * 0.72;
    const end = {
      x: Math.round(stem.x + nx * sign * length + (dx / distance) * along),
      y: Math.round(stem.y + ny * sign * length + (dy / distance) * along),
    };
    return [stem, {
      x: Math.round((stem.x + end.x) / 2 + (random() - .5) * 7),
      y: Math.round((stem.y + end.y) / 2 + (random() - .5) * 7),
    }, end];
  };

  const dendriteNodes = Array.from({ length: 16 }, (_, i) => {
    const fraction = .06 + i * .055;
    const stem = points[Math.max(1, Math.min(steps - 1, Math.floor(steps * fraction)))];
    return createBranch(stem, i % 3 ? -1 : 1, 11 + random() * 17);
  });
  const dendrites = dendriteNodes.map(draw);

  // Tertiary hairline spurs alternate between major forks and fresh
  // dendrites. Their side tips are expressly NOT collision candidates.
  const microDendrites = Array.from({ length: 24 }, (_, i) => {
    const source = i % 3 === 0
      ? forkNodes[i % forkNodes.length]
      : dendriteNodes[i % dendriteNodes.length];
    const stem = source[i % 2 ? 1 : 2];
    return draw(createBranch(stem, i % 4 < 2 ? 1 : -1, 4 + random() * 11));
  });
  return { main: draw(points), filaments, forks, dendrites, microDendrites,
    start: { ...points[0] }, end: { ...points[steps] } };
}
