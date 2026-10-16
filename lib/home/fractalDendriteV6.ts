import * as v5 from './fractalDendriteV5';

export type Vec2 = v5.Vec2;
export type Dimensions = v5.Dimensions;
export type FractalPath = v5.FractalPath;
export type FractalTree = v5.FractalTree;
export type FractalProfile = v5.FractalProfile;
export type FractalMorphologyId = v5.FractalMorphologyId;
export type FractalViewportGeometry = v5.FractalViewportGeometry;

export const clamp = v5.clamp;
export const seededRng = v5.seededRng;
export const theoreticalSelfSimilarDimension = v5.theoreticalSelfSimilarDimension;
export const getFractalViewportGeometry = v5.getFractalViewportGeometry;
export const unitVectorFromCenter = v5.unitVectorFromCenter;
export const FRACTAL_PROFILES = v5.FRACTAL_PROFILES;

function contain(point: Vec2, tree: FractalTree): Vec2 {
  return {
    x: clamp(point.x, tree.edgeMargin, tree.center.x * 2 - tree.edgeMargin),
    y: clamp(point.y, tree.edgeMargin, tree.usableBottom - tree.edgeMargin * 0.35),
  };
}

function rotatePoint(point: Vec2, center: Vec2, angle: number): Vec2 {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
}

function reshapeFault(path: FractalPath, tree: FractalTree, angle: number, phase: number, amplitude: number): FractalPath {
  const count = Math.max(1, path.points.length - 1);
  return {
    ...path,
    points: path.points.map((point, index) => {
      const rotated = rotatePoint(point, tree.center, angle);
      const t = index / count;
      return contain(
        {
          x: rotated.x,
          y: rotated.y + Math.sin(t * Math.PI * 3.1 + phase) * tree.radiusY * amplitude,
        },
        tree
      );
    }),
  };
}

function pointAtIndex(path: FractalPath, index: number): Vec2 | undefined {
  if (!path.points.length) return undefined;
  return path.points[Math.min(path.points.length - 1, Math.max(0, index))];
}

function makeCrackleTectonic(tree: FractalTree, seed: string): FractalTree {
  if (tree.morphology.id !== 'tectonic') return tree;

  const rng = seededRng(`tectonic-v6:${seed}`);
  const rebuilt = tree.paths.map((path) => {
    if (path.id === 'fault-0') return reshapeFault(path, tree, -0.12, 0.45, 0.065);
    if (path.id === 'fault-1') return reshapeFault(path, tree, 0.012, 1.6, 0.095);
    if (path.id === 'fault-2') return reshapeFault(path, tree, 0.135, 2.8, 0.07);
    return path;
  });

  const fault0 = rebuilt.find((path) => path.id === 'fault-0');
  const fault1 = rebuilt.find((path) => path.id === 'fault-1');
  const fault2 = rebuilt.find((path) => path.id === 'fault-2');
  if (!fault0 || !fault1 || !fault2) {
    return { ...tree, theoreticalTerminalDimension: 1.58, paths: rebuilt };
  }

  const extra: FractalPath[] = [];
  const span = Math.min(fault0.points.length, fault1.points.length, fault2.points.length);
  for (let index = 3; index < span - 3; index += 3) {
    const upper = pointAtIndex(fault0, index + (index % 2));
    const middle = pointAtIndex(fault1, index);
    const lower = pointAtIndex(fault2, index - (index % 2));
    if (!upper || !middle || !lower) continue;

    const bridgeTarget = rng() > 0.5 ? upper : lower;
    const midpoint = contain(
      {
        x: middle.x * 0.54 + bridgeTarget.x * 0.46 + (rng() - 0.5) * tree.radiusX * 0.025,
        y: middle.y * 0.54 + bridgeTarget.y * 0.46 + (rng() - 0.5) * tree.radiusY * 0.045,
      },
      tree
    );
    extra.push({
      id: `plate-seam-${index}`,
      ownerId: '__ambient__',
      depth: 2,
      points: [middle, midpoint, bridgeTarget],
      width: 0.55,
      alpha: 0.27,
      renderMode: 'stroke',
      glow: 0.05,
    });

    if (rng() > 0.22) {
      const dx = bridgeTarget.x - middle.x;
      const dy = bridgeTarget.y - middle.y;
      const heading = Math.atan2(dy, dx);
      const branchAngle = heading + (rng() > 0.5 ? 1 : -1) * (0.72 + rng() * 0.5);
      const branchLength = tree.radiusY * (0.12 + rng() * 0.12);
      const branchTip = contain(
        {
          x: midpoint.x + Math.cos(branchAngle) * branchLength,
          y: midpoint.y + Math.sin(branchAngle) * branchLength,
        },
        tree
      );
      extra.push({
        id: `plate-chip-${index}`,
        ownerId: '__ambient__',
        depth: 3,
        points: [midpoint, branchTip],
        width: 0.34,
        alpha: 0.19,
        renderMode: 'stroke',
      });
    }
  }

  for (let index = 2; index < span - 2; index += 5) {
    const a = pointAtIndex(fault0, index);
    const b = pointAtIndex(fault2, Math.min(span - 1, index + 2));
    if (!a || !b || rng() < 0.22) continue;
    const center = contain(
      {
        x: a.x * 0.44 + b.x * 0.56 + (rng() - 0.5) * tree.radiusX * 0.04,
        y: a.y * 0.44 + b.y * 0.56 + (rng() - 0.5) * tree.radiusY * 0.08,
      },
      tree
    );
    extra.push({
      id: `delta-suture-${index}`,
      ownerId: '__ambient__',
      depth: 3,
      points: [a, center, b],
      width: 0.31,
      alpha: 0.15,
      renderMode: 'stroke',
    });
  }

  return {
    ...tree,
    theoreticalTerminalDimension: 1.58,
    paths: [...rebuilt, ...extra].slice(0, tree.morphology.pathBudget),
  };
}

function correctMetadata(tree: FractalTree): FractalTree {
  if (tree.morphology.id === 'echo-nest') {
    return { ...tree, theoreticalTerminalDimension: 1.51 };
  }
  if (tree.morphology.id === 'tectonic') {
    return { ...tree, theoreticalTerminalDimension: 1.58 };
  }
  return tree;
}

export function buildAdaptiveFractalTree(dimensions: Dimensions, seed: string, destinationIds: string[]): FractalTree {
  const tree = v5.buildAdaptiveFractalTree(dimensions, seed, destinationIds);
  const entropy = /^force:[a-z-]+:(.*)$/.exec(seed)?.[1] ?? seed;
  return correctMetadata(makeCrackleTectonic(tree, entropy));
}
