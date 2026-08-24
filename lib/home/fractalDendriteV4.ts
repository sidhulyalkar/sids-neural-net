import * as base from './fractalDendrite';

export type Vec2 = base.Vec2;
export type Dimensions = base.Dimensions;
export type FractalPath = base.FractalPath;
export type FractalTree = base.FractalTree;
export type FractalProfile = base.FractalProfile;
export type FractalMorphologyId = base.FractalMorphologyId;
export type FractalViewportGeometry = base.FractalViewportGeometry;

export const clamp = base.clamp;
export const seededRng = base.seededRng;
export const theoreticalSelfSimilarDimension = base.theoreticalSelfSimilarDimension;
export const getFractalViewportGeometry = base.getFractalViewportGeometry;
export const unitVectorFromCenter = base.unitVectorFromCenter;
export const FRACTAL_PROFILES = base.FRACTAL_PROFILES;

const TWO_PI = Math.PI * 2;
const REMOVED_MORPHOLOGIES = new Set(['mycelial', 'aurora']);

type CuratedId = Exclude<FractalMorphologyId, 'mycelial' | 'aurora'>;

type WeightedId = readonly [CuratedId, number];

function weightedPick(items: readonly WeightedId[], seed: string): CuratedId {
  const rng = seededRng(seed);
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [id, weight] of items) {
    cursor -= weight;
    if (cursor <= 0) return id;
  }
  return items[items.length - 1]?.[0] ?? 'radial';
}

function parseForced(seed: string): { requested?: string; entropy: string } {
  const match = /^force:([a-z-]+):(.*)$/.exec(seed);
  return match ? { requested: match[1], entropy: match[2] || 'review' } : { entropy: seed };
}

function chooseCuratedMorphology(dimensions: Dimensions, seed: string): CuratedId {
  const { requested, entropy } = parseForced(seed);
  if (requested && !REMOVED_MORPHOLOGIES.has(requested) && requested in FRACTAL_PROFILES) {
    return requested as CuratedId;
  }

  const aspect = dimensions.width / Math.max(1, dimensions.height);
  if (dimensions.width < 480) {
    return weightedPick(
      [
        ['halo', 0.27],
        ['apical', 0.24],
        ['echidna', 0.2],
        ['spiraloid', 0.17],
        ['pixel-ghost', 0.07],
        ['echo-nest', 0.05],
      ],
      `${entropy}:v4-mobile`
    );
  }
  if (aspect > 2.25) {
    return weightedPick(
      [
        ['tectonic', 0.31],
        ['fan', 0.22],
        ['coral', 0.15],
        ['echo-nest', 0.14],
        ['radial', 0.09],
        ['echidna', 0.09],
      ],
      `${entropy}:v4-cinema`
    );
  }
  if (aspect > 1.62) {
    return weightedPick(
      [
        ['fan', 0.2],
        ['coral', 0.18],
        ['tectonic', 0.17],
        ['radial', 0.14],
        ['echo-nest', 0.12],
        ['spiraloid', 0.08],
        ['echidna', 0.07],
        ['halo', 0.04],
      ],
      `${entropy}:v4-wide`
    );
  }
  if (aspect < 0.84) {
    return weightedPick(
      [
        ['halo', 0.27],
        ['apical', 0.24],
        ['echidna', 0.2],
        ['spiraloid', 0.17],
        ['coral', 0.07],
        ['echo-nest', 0.05],
      ],
      `${entropy}:v4-portrait`
    );
  }
  return weightedPick(
    [
      ['coral', 0.2],
      ['radial', 0.18],
      ['fan', 0.14],
      ['echo-nest', 0.14],
      ['spiraloid', 0.11],
      ['tectonic', 0.09],
      ['echidna', 0.08],
      ['halo', 0.04],
      ['pixel-ghost', 0.02],
    ],
    `${entropy}:v4-balanced`
  );
}

function contain(point: Vec2, tree: FractalTree): Vec2 {
  return {
    x: clamp(point.x, tree.edgeMargin, tree.center.x * 2 - tree.edgeMargin),
    y: clamp(point.y, tree.edgeMargin, tree.usableBottom - tree.edgeMargin * 0.35),
  };
}

function organicWarp(point: Vec2, tree: FractalTree, phaseA: number, phaseB: number, strength: number): Vec2 {
  const dx = point.x - tree.center.x;
  const dy = point.y - tree.center.y;
  const nx = dx / Math.max(1, tree.radiusX);
  const ny = dy / Math.max(1, tree.radiusY);
  const radial = clamp(Math.hypot(nx, ny), 0, 1.2);
  const angle = Math.atan2(ny, nx);
  const envelope = Math.pow(radial, 0.72) * Math.pow(Math.max(0, 1 - radial * 0.08), 1.3);
  const curl = Math.sin(angle * 2.7 + phaseA + radial * 4.2) * 0.58 + Math.sin(angle * 5.1 - phaseB) * 0.24;
  const drift = Math.sin(nx * 4.4 + phaseB) * Math.cos(ny * 3.2 - phaseA);
  const tangentX = -Math.sin(angle);
  const tangentY = Math.cos(angle);
  const ampX = tree.radiusX * strength * envelope;
  const ampY = tree.radiusY * strength * envelope;
  return contain(
    {
      x: point.x + tangentX * ampX * curl + ampX * drift * 0.16,
      y: point.y + tangentY * ampY * curl + ampY * drift * 0.11,
    },
    tree
  );
}

function applyAsymmetry(tree: FractalTree, seed: string): FractalTree {
  if (tree.morphology.id === 'radial' || tree.morphology.id === 'pixel-ghost' || tree.morphology.id === 'echo-nest') {
    return tree;
  }
  const rng = seededRng(`v4-organic-warp:${seed}:${tree.morphology.id}`);
  const phaseA = rng() * TWO_PI;
  const phaseB = rng() * TWO_PI;
  const strengthByMorph: Partial<Record<FractalMorphologyId, number>> = {
    coral: 0.048,
    fan: 0.038,
    apical: 0.044,
    spiraloid: 0.032,
    halo: 0.027,
    echidna: 0.034,
  };
  const strength = strengthByMorph[tree.morphology.id] ?? 0.035;
  const warpedEndpoints = new Map<string, Vec2>();
  for (const [id, endpoint] of tree.endpoints) {
    warpedEndpoints.set(id, organicWarp(endpoint, tree, phaseA, phaseB, strength * 0.58));
  }
  return {
    ...tree,
    paths: tree.paths.map((path) => ({
      ...path,
      points: path.points.map((point, index) => {
        if (path.depth === 0 && index === 0) return point;
        const localStrength = path.depth === 0 ? strength * 0.72 : strength * (1 + path.depth * 0.11);
        return organicWarp(point, tree, phaseA + path.depth * 0.23, phaseB + path.depth * 0.17, localStrength);
      }),
    })),
    endpoints: warpedEndpoints,
  };
}

function linePoint(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function perimeterDestination(index: number, count: number, tree: FractalTree): Vec2 {
  const angle = -Math.PI / 2 + (index / count) * TWO_PI;
  return contain(
    {
      x: tree.center.x + Math.cos(angle) * tree.radiusX * 0.96,
      y: tree.center.y + Math.sin(angle) * tree.radiusY * 0.96,
    },
    tree
  );
}

function faultPolyline(tree: FractalTree, rng: () => number, yBias: number, phase: number): Vec2[] {
  const points: Vec2[] = [];
  const steps = tree.extremeWide ? 34 : 27;
  let walk = 0;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    walk = walk * 0.68 + (rng() - 0.5) * tree.radiusY * 0.075;
    const ridge = Math.sin(t * Math.PI * 2.2 + phase) * tree.radiusY * 0.075;
    const micro = Math.sin(t * Math.PI * 7.1 + phase * 0.7) * tree.radiusY * 0.018;
    points.push(
      contain(
        {
          x: tree.edgeMargin + t * (tree.center.x * 2 - tree.edgeMargin * 2),
          y: tree.center.y + yBias * tree.radiusY + ridge + micro + walk,
        },
        tree
      )
    );
  }
  return points;
}

function nearestPointOnPolyline(polyline: Vec2[], target: Vec2): Vec2 {
  let best = polyline[0] ?? target;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of polyline) {
    const next = distance(point, target);
    if (next < bestDistance) {
      best = point;
      bestDistance = next;
    }
  }
  return best;
}

function buildTectonicV4(dimensions: Dimensions, seed: string, destinationIds: string[]): FractalTree {
  const geometry = getFractalViewportGeometry(dimensions);
  const morphology: FractalProfile = {
    ...FRACTAL_PROFILES.tectonic,
    label: 'tectonic rift',
    pathBudget: 900,
    recursionDepth: 5,
    terminalShrink: 0.6,
    dimensionHint: 1.58,
  };
  const scaffold = base.buildAdaptiveFractalTree(dimensions, `force:radial:${seed}:tectonic-scaffold`, destinationIds);
  const tree: FractalTree = { ...scaffold, ...geometry, morphology, paths: [], endpoints: new Map() };
  const rng = seededRng(`tectonic-v4:${seed}:${dimensions.width}x${dimensions.height}`);
  const faults = [
    faultPolyline(tree, rng, -0.2, rng() * TWO_PI),
    faultPolyline(tree, rng, 0.04, rng() * TWO_PI),
    faultPolyline(tree, rng, 0.25, rng() * TWO_PI),
  ];

  faults.forEach((fault, faultIndex) => {
    tree.paths.push({
      id: `fault-${faultIndex}`,
      ownerId: '__ambient__',
      depth: 1,
      points: fault,
      width: faultIndex === 1 ? 1.45 : 0.82,
      alpha: faultIndex === 1 ? 0.48 : 0.27,
      renderMode: 'stroke',
      glow: faultIndex === 1 ? 0.34 : 0.12,
    });

    for (let index = 2; index < fault.length - 2; index += faultIndex === 1 ? 2 : 3) {
      if (rng() < 0.23) continue;
      const start = fault[index];
      const prev = fault[index - 1];
      const next = fault[index + 1];
      const tangent = Math.atan2(next.y - prev.y, next.x - prev.x);
      const side = rng() < 0.5 ? -1 : 1;
      const length = tree.radiusY * (0.09 + rng() * 0.12);
      const angle = tangent + side * (Math.PI / 2 + (rng() - 0.5) * 0.54);
      const elbow = contain(
        {
          x: start.x + Math.cos(angle) * length * (0.48 + rng() * 0.12),
          y: start.y + Math.sin(angle) * length * (0.48 + rng() * 0.12),
        },
        tree
      );
      const end = contain(
        {
          x: elbow.x + Math.cos(angle + (rng() - 0.5) * 0.72) * length * 0.56,
          y: elbow.y + Math.sin(angle + (rng() - 0.5) * 0.72) * length * 0.56,
        },
        tree
      );
      tree.paths.push({
        id: `stress-${faultIndex}-${index}`,
        ownerId: '__ambient__',
        depth: 2,
        points: [start, elbow, end],
        width: 0.54,
        alpha: 0.28,
        renderMode: 'stroke',
      });
      if (rng() > 0.42) {
        const childAngle = angle + side * (0.7 + rng() * 0.55);
        const childEnd = contain(
          {
            x: end.x + Math.cos(childAngle) * length * 0.42,
            y: end.y + Math.sin(childAngle) * length * 0.42,
          },
          tree
        );
        tree.paths.push({
          id: `stress-child-${faultIndex}-${index}`,
          ownerId: '__ambient__',
          depth: 3,
          points: [end, childEnd],
          width: 0.34,
          alpha: 0.2,
          renderMode: 'stroke',
        });
      }
    }
  });

  destinationIds.forEach((ownerId, index) => {
    const endpoint = perimeterDestination(index, destinationIds.length, tree);
    tree.endpoints.set(ownerId, endpoint);
    let anchor = faults[0][0];
    let bestDistance = Number.POSITIVE_INFINITY;
    faults.forEach((fault) => {
      const candidate = nearestPointOnPolyline(fault, endpoint);
      const d = distance(candidate, endpoint);
      if (d < bestDistance) {
        anchor = candidate;
        bestDistance = d;
      }
    });
    const bend = contain(
      {
        x: anchor.x * 0.58 + endpoint.x * 0.42 + (rng() - 0.5) * tree.radiusX * 0.035,
        y: anchor.y * 0.58 + endpoint.y * 0.42 + (rng() - 0.5) * tree.radiusY * 0.07,
      },
      tree
    );
    tree.paths.push({
      id: `primary-${ownerId}`,
      ownerId,
      depth: 0,
      points: [anchor, bend, endpoint],
      width: 2.1,
      alpha: 0.68,
      renderMode: 'stroke',
      glow: 0.3,
    });
  });

  return tree;
}

type PolygonKind = 'triangle' | 'rhombus' | 'hexagon';

function polygon(center: Vec2, rx: number, ry: number, rotation: number, kind: PolygonKind): Vec2[] {
  if (kind === 'rhombus') {
    const local = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    return local.map(({ x, y }) => {
      const px = x * rx;
      const py = y * ry;
      return {
        x: center.x + px * Math.cos(rotation) - py * Math.sin(rotation),
        y: center.y + px * Math.sin(rotation) + py * Math.cos(rotation),
      };
    });
  }
  const sides = kind === 'hexagon' ? 6 : 3;
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation - Math.PI / 2 + (index / sides) * TWO_PI;
    return { x: center.x + Math.cos(angle) * rx, y: center.y + Math.sin(angle) * ry };
  });
}

function closed(points: Vec2[]): Vec2[] {
  if (points.length === 0) return points;
  return [...points, points[0]];
}

function addMatteHatching(tree: FractalTree, center: Vec2, rx: number, ry: number, rotation: number, key: string, alpha: number): void {
  const count = clamp(Math.round(ry / 9), 4, 12);
  for (let index = 1; index < count; index += 1) {
    const f = index / count;
    const yLocal = (f * 2 - 1) * ry * 0.78;
    const half = rx * (0.18 + 0.72 * (1 - Math.abs(f * 2 - 1)));
    const a = { x: -half, y: yLocal };
    const b = { x: half, y: yLocal };
    const rotate = (p: Vec2): Vec2 => contain(
      {
        x: center.x + p.x * Math.cos(rotation) - p.y * Math.sin(rotation),
        y: center.y + p.x * Math.sin(rotation) + p.y * Math.cos(rotation),
      },
      tree
    );
    tree.paths.push({
      id: `matte-${key}-${index}`,
      ownerId: '__ambient__',
      depth: 4,
      points: [rotate(a), rotate(b)],
      width: index % 3 === 0 ? 0.7 : 0.45,
      alpha: alpha * (index % 2 === 0 ? 1 : 0.72),
      renderMode: 'stroke',
    });
  }
}

function buildEchoNestV4(dimensions: Dimensions, seed: string, destinationIds: string[]): FractalTree {
  const geometry = getFractalViewportGeometry(dimensions);
  const morphology: FractalProfile = {
    ...FRACTAL_PROFILES['echo-nest'],
    label: 'echo nest · matte lattice',
    pathBudget: 760,
    recursionDepth: 5,
    dimensionHint: 1.51,
  };
  const scaffold = base.buildAdaptiveFractalTree(dimensions, `force:radial:${seed}:nest-scaffold`, destinationIds);
  const tree: FractalTree = { ...scaffold, ...geometry, morphology, paths: [], endpoints: new Map() };
  const rng = seededRng(`echo-nest-v4:${seed}:${dimensions.width}x${dimensions.height}`);
  const kinds: PolygonKind[] = ['triangle', 'rhombus', 'rhombus', 'hexagon'];
  const layers = geometry.compact ? 20 : geometry.extremeWide ? 44 : 34;

  for (let index = 0; index < layers; index += 1) {
    const ring = Math.floor(index / 6);
    const spoke = index % 6;
    const radius = 0.08 + ring * 0.115 + rng() * 0.035;
    const angle = (spoke / 6) * TWO_PI + ring * 0.31 + (rng() - 0.5) * 0.22;
    const center = contain(
      {
        x: tree.center.x + Math.cos(angle) * tree.radiusX * radius,
        y: tree.center.y + Math.sin(angle) * tree.radiusY * radius * 0.92,
      },
      tree
    );
    const scaleWave = 0.62 + 0.36 * Math.sin(ring * 1.15 + spoke * 0.8 + rng() * 0.45);
    const rx = Math.max(18, tree.radiusX * (0.075 + ring * 0.011) * scaleWave);
    const ry = Math.max(14, tree.radiusY * (0.09 + ring * 0.013) * (0.78 + rng() * 0.42));
    const rotation = angle * 0.42 + ring * 0.19 + (rng() - 0.5) * 0.35;
    const kind = kinds[Math.floor(rng() * kinds.length)] ?? 'rhombus';
    const shape = polygon(center, rx, ry, rotation, kind).map((point) => contain(point, tree));
    tree.paths.push({
      id: `nest-outline-${index}`,
      ownerId: '__ambient__',
      depth: 2 + (ring % 2),
      points: closed(shape),
      width: ring === 0 ? 1.08 : 0.72,
      alpha: clamp(0.34 - ring * 0.024, 0.16, 0.34),
      renderMode: 'stroke',
      glow: ring <= 1 ? 0.25 : 0.05,
    });
    addMatteHatching(tree, center, rx * 0.82, ry * 0.72, rotation, `${index}`, clamp(0.115 - ring * 0.008, 0.052, 0.115));
  }

  for (let index = 0; index < Math.min(14, layers - 1); index += 1) {
    const angle = (index / 14) * TWO_PI + 0.18;
    const a = contain(
      {
        x: tree.center.x + Math.cos(angle) * tree.radiusX * 0.18,
        y: tree.center.y + Math.sin(angle) * tree.radiusY * 0.16,
      },
      tree
    );
    const b = contain(
      {
        x: tree.center.x + Math.cos(angle + 0.38) * tree.radiusX * (0.42 + (index % 3) * 0.08),
        y: tree.center.y + Math.sin(angle + 0.38) * tree.radiusY * (0.38 + (index % 4) * 0.055),
      },
      tree
    );
    tree.paths.push({
      id: `nest-lattice-${index}`,
      ownerId: '__ambient__',
      depth: 4,
      points: [a, b],
      width: 0.5,
      alpha: 0.11,
      renderMode: 'stroke',
    });
  }

  destinationIds.forEach((ownerId, index) => {
    const endpoint = perimeterDestination(index, destinationIds.length, tree);
    tree.endpoints.set(ownerId, endpoint);
    const innerAngle = -Math.PI / 2 + (index / destinationIds.length) * TWO_PI + (rng() - 0.5) * 0.08;
    const inner = contain(
      {
        x: tree.center.x + Math.cos(innerAngle) * tree.radiusX * 0.28,
        y: tree.center.y + Math.sin(innerAngle) * tree.radiusY * 0.28,
      },
      tree
    );
    const mid = contain(
      {
        x: inner.x * 0.54 + endpoint.x * 0.46 + (rng() - 0.5) * tree.radiusX * 0.022,
        y: inner.y * 0.54 + endpoint.y * 0.46 + (rng() - 0.5) * tree.radiusY * 0.038,
      },
      tree
    );
    tree.paths.push({
      id: `primary-${ownerId}`,
      ownerId,
      depth: 0,
      points: [inner, mid, endpoint],
      width: 1.55,
      alpha: 0.58,
      renderMode: 'stroke',
      glow: 0.26,
    });
  });

  return tree;
}

export function buildAdaptiveFractalTree(dimensions: Dimensions, seed: string, destinationIds: string[]): FractalTree {
  const { entropy } = parseForced(seed);
  const morphology = chooseCuratedMorphology(dimensions, seed);
  if (morphology === 'tectonic') return buildTectonicV4(dimensions, entropy, destinationIds);
  if (morphology === 'echo-nest') return buildEchoNestV4(dimensions, entropy, destinationIds);

  const tree = base.buildAdaptiveFractalTree(dimensions, `force:${morphology}:${entropy}`, destinationIds);
  return applyAsymmetry(tree, entropy);
}
