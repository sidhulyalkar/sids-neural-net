import * as v6 from './fractalDendriteV6';

export type Vec2 = v6.Vec2;
export type Dimensions = v6.Dimensions;
export type FractalPath = v6.FractalPath;
export type FractalTree = v6.FractalTree;
export type FractalProfile = v6.FractalProfile;
export type FractalMorphologyId = v6.FractalMorphologyId;
export type FractalViewportGeometry = v6.FractalViewportGeometry;

export const clamp = v6.clamp;
export const seededRng = v6.seededRng;
export const theoreticalSelfSimilarDimension = v6.theoreticalSelfSimilarDimension;
export const getFractalViewportGeometry = v6.getFractalViewportGeometry;
export const unitVectorFromCenter = v6.unitVectorFromCenter;
export const FRACTAL_PROFILES = v6.FRACTAL_PROFILES;

const TWO_PI = Math.PI * 2;
const RETIRED_MORPHOLOGIES = new Set(['tectonic', 'aurora', 'mycelial']);

function contain(point: Vec2, tree: FractalTree): Vec2 {
  return {
    x: clamp(point.x, tree.edgeMargin, tree.center.x * 2 - tree.edgeMargin),
    y: clamp(point.y, tree.edgeMargin, tree.usableBottom - tree.edgeMargin * 0.35),
  };
}

function polygon(center: Vec2, rx: number, ry: number, rotation: number, sides: number): Vec2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation - Math.PI / 2 + (index / sides) * TWO_PI;
    return {
      x: center.x + Math.cos(angle) * rx,
      y: center.y + Math.sin(angle) * ry,
    };
  });
}

function addPolygonEdges(
  paths: FractalPath[],
  tree: FractalTree,
  center: Vec2,
  rx: number,
  ry: number,
  rotation: number,
  sides: number,
  key: string,
  depth: number,
  alpha: number,
  width: number,
  glow = 0
): void {
  const vertices = polygon(center, rx, ry, rotation, sides).map((point) => contain(point, tree));
  for (let index = 0; index < vertices.length; index += 1) {
    paths.push({
      id: `${key}-edge-${index}`,
      ownerId: '__ambient__',
      depth,
      points: [vertices[index], vertices[(index + 1) % vertices.length]],
      width,
      alpha,
      renderMode: 'stroke',
      glow: index % 2 === 0 ? glow : glow * 0.45,
    });
  }
}

function addBraidedBand(
  paths: FractalPath[],
  tree: FractalTree,
  rng: () => number,
  radius: number,
  count: number,
  phase: number,
  key: string,
  scale: number,
  yScale = 0.86
): void {
  let previous: Vec2 | null = null;
  for (let index = 0; index < count; index += 1) {
    const angle = phase + (index / count) * TWO_PI;
    const wobble = 1 + Math.sin(angle * 3 + phase) * 0.07 + (rng() - 0.5) * 0.035;
    const center = contain(
      {
        x: tree.center.x + Math.cos(angle) * tree.radiusX * radius * wobble,
        y: tree.center.y + Math.sin(angle) * tree.radiusY * radius * yScale * wobble,
      },
      tree
    );
    const sides = index % 5 === 0 ? 6 : index % 3 === 0 ? 3 : 4;
    const cellScale = scale * (0.78 + rng() * 0.42);
    addPolygonEdges(
      paths,
      tree,
      center,
      tree.radiusX * cellScale,
      tree.radiusY * cellScale * (0.72 + rng() * 0.28),
      angle * 0.52 + phase + (rng() - 0.5) * 0.4,
      sides,
      `${key}-${index}`,
      2 + (index % 3),
      0.16 + rng() * 0.16,
      0.34 + rng() * 0.38,
      index % 4 === 0 ? 0.1 : 0
    );

    if (previous) {
      const bridgeMid = contain(
        {
          x: (previous.x + center.x) * 0.5 + (rng() - 0.5) * tree.radiusX * 0.018,
          y: (previous.y + center.y) * 0.5 + (rng() - 0.5) * tree.radiusY * 0.025,
        },
        tree
      );
      paths.push({
        id: `${key}-bridge-${index}`,
        ownerId: '__ambient__',
        depth: 4,
        points: [previous, bridgeMid, center],
        width: 0.32,
        alpha: 0.105,
        renderMode: 'stroke',
      });
    }
    previous = center;
  }
}

function addSatelliteCluster(paths: FractalPath[], tree: FractalTree, rng: () => number): void {
  if (tree.compact) return;
  const anchor = contain(
    {
      x: tree.center.x + tree.radiusX * 0.78,
      y: tree.center.y - tree.radiusY * 0.72,
    },
    tree
  );
  const radius = Math.min(tree.radiusX, tree.radiusY) * 0.17;
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * TWO_PI + 0.32;
    const radial = radius * (0.52 + (index % 3) * 0.19 + rng() * 0.08);
    const center = contain(
      {
        x: anchor.x + Math.cos(angle) * radial,
        y: anchor.y + Math.sin(angle) * radial * 0.9,
      },
      tree
    );
    addPolygonEdges(
      paths,
      tree,
      center,
      radius * (0.17 + rng() * 0.12),
      radius * (0.15 + rng() * 0.12),
      angle + rng() * 0.5,
      index % 4 === 0 ? 6 : 4,
      `satellite-${index}`,
      3,
      0.16 + rng() * 0.13,
      0.32 + rng() * 0.26
    );
  }

  const neck = contain({ x: tree.center.x + tree.radiusX * 0.55, y: tree.center.y - tree.radiusY * 0.42 }, tree);
  paths.push({
    id: 'satellite-neck-a',
    ownerId: '__ambient__',
    depth: 3,
    points: [neck, anchor],
    width: 0.45,
    alpha: 0.14,
    renderMode: 'stroke',
  });
  paths.push({
    id: 'satellite-neck-b',
    ownerId: '__ambient__',
    depth: 4,
    points: [contain({ x: neck.x - tree.radiusX * 0.05, y: neck.y + tree.radiusY * 0.04 }, tree), anchor],
    width: 0.28,
    alpha: 0.09,
    renderMode: 'stroke',
  });
}

function expandEchoNest(tree: FractalTree, seed: string): FractalTree {
  if (tree.morphology.id !== 'echo-nest') return tree;

  const rng = seededRng(`echo-nest-v7:${seed}`);
  const additions: FractalPath[] = [];

  // Dense asymmetric polygonal braids inspired by a folded neural mantle rather than concentric decoration.
  addBraidedBand(additions, tree, rng, tree.compact ? 0.5 : 0.57, tree.compact ? 13 : 24, 0.1, 'mantle-inner', tree.compact ? 0.055 : 0.044);
  addBraidedBand(additions, tree, rng, tree.compact ? 0.71 : 0.78, tree.compact ? 16 : tree.extremeWide ? 34 : 29, 0.29, 'mantle-outer', tree.compact ? 0.047 : 0.037, 0.9);

  // A compact central rosette gives the composition a readable nucleus without filling every quiet pocket.
  for (let index = 0; index < (tree.compact ? 8 : 14); index += 1) {
    const angle = (index / (tree.compact ? 8 : 14)) * TWO_PI + 0.18;
    const radial = (index % 3) * 0.045 + 0.035;
    const center = contain({
      x: tree.center.x + Math.cos(angle) * tree.radiusX * radial,
      y: tree.center.y + Math.sin(angle) * tree.radiusY * radial,
    }, tree);
    addPolygonEdges(
      additions,
      tree,
      center,
      tree.radiusX * (0.035 + rng() * 0.018),
      tree.radiusY * (0.04 + rng() * 0.018),
      angle * 0.8 + rng() * 0.35,
      index % 4 === 0 ? 6 : 4,
      `nucleus-${index}`,
      2,
      0.22 + rng() * 0.14,
      0.42 + rng() * 0.3,
      0.1
    );
  }

  addSatelliteCluster(additions, tree, rng);

  const morphology: FractalProfile = {
    ...tree.morphology,
    label: 'echo nest · braided neural lattice',
    pathBudget: tree.compact ? 980 : 1280,
    dimensionHint: 1.67,
  };

  return {
    ...tree,
    morphology,
    theoreticalTerminalDimension: 1.67,
    paths: [...tree.paths, ...additions].slice(0, morphology.pathBudget),
  };
}

function sanitizeRequestedMorphology(seed: string): string {
  const forced = /^force:([a-z-]+):(.*)$/.exec(seed);
  if (!forced || !RETIRED_MORPHOLOGIES.has(forced[1])) return seed;
  return `force:echo-nest:${forced[2] || 'retired-morphology'}`;
}

export function buildAdaptiveFractalTree(dimensions: Dimensions, seed: string, destinationIds: string[]): FractalTree {
  const safeSeed = sanitizeRequestedMorphology(seed);
  let tree = v6.buildAdaptiveFractalTree(dimensions, safeSeed, destinationIds);

  // V4/V5 selection can still produce tectonic from random entropy. Retire it at the public runtime boundary.
  if (RETIRED_MORPHOLOGIES.has(tree.morphology.id)) {
    tree = v6.buildAdaptiveFractalTree(dimensions, `force:echo-nest:${seed}:retired-fallback`, destinationIds);
  }

  const entropy = /^force:[a-z-]+:(.*)$/.exec(safeSeed)?.[1] ?? safeSeed;
  return expandEchoNest(tree, entropy);
}
