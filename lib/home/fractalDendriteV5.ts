import * as v4 from './fractalDendriteV4';

export type Vec2 = v4.Vec2;
export type Dimensions = v4.Dimensions;
export type FractalPath = v4.FractalPath;
export type FractalTree = v4.FractalTree;
export type FractalProfile = v4.FractalProfile;
export type FractalMorphologyId = v4.FractalMorphologyId;
export type FractalViewportGeometry = v4.FractalViewportGeometry;

export const clamp = v4.clamp;
export const seededRng = v4.seededRng;
export const theoreticalSelfSimilarDimension = v4.theoreticalSelfSimilarDimension;
export const getFractalViewportGeometry = v4.getFractalViewportGeometry;
export const unitVectorFromCenter = v4.unitVectorFromCenter;
export const FRACTAL_PROFILES = v4.FRACTAL_PROFILES;

function sharpenEchoNest(tree: FractalTree, seed: string): FractalTree {
  if (tree.morphology.id !== 'echo-nest') return tree;

  const sharpened: FractalPath[] = [];
  const rng = seededRng(`echo-nest-v5:${seed}`);
  for (const path of tree.paths) {
    if (!path.id.startsWith('nest-outline-') || path.points.length < 4) {
      sharpened.push(path);
      continue;
    }

    const vertices = path.points.slice(0, -1);
    const centroid = vertices.reduce(
      (sum, point) => ({ x: sum.x + point.x / vertices.length, y: sum.y + point.y / vertices.length }),
      { x: 0, y: 0 }
    );

    vertices.forEach((point, index) => {
      const next = vertices[(index + 1) % vertices.length];
      sharpened.push({
        ...path,
        id: `${path.id}-edge-${index}`,
        points: [point, next],
        width: Math.max(0.72, path.width * 1.08),
        alpha: Math.min(0.5, path.alpha * 1.34),
        glow: index % 2 === 0 ? Math.max(path.glow ?? 0, 0.12) : path.glow,
      });
    });

    const innerScale = 0.7 + rng() * 0.08;
    const inner = vertices.map((point) => ({
      x: centroid.x + (point.x - centroid.x) * innerScale,
      y: centroid.y + (point.y - centroid.y) * innerScale,
    }));
    inner.forEach((point, index) => {
      sharpened.push({
        ...path,
        id: `${path.id}-inner-${index}`,
        points: [point, inner[(index + 1) % inner.length]],
        width: 0.38,
        alpha: 0.12 + rng() * 0.045,
        glow: 0,
      });
    });
  }

  return { ...tree, paths: sharpened.slice(0, tree.morphology.pathBudget) };
}

function rotatePoint(point: Vec2, center: Vec2, angle: number): Vec2 {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
}

function contain(point: Vec2, tree: FractalTree): Vec2 {
  return {
    x: clamp(point.x, tree.edgeMargin, tree.center.x * 2 - tree.edgeMargin),
    y: clamp(point.y, tree.edgeMargin, tree.usableBottom - tree.edgeMargin * 0.35),
  };
}

function deepenTectonic(tree: FractalTree, seed: string): FractalTree {
  if (tree.morphology.id !== 'tectonic') return tree;
  const rng = seededRng(`tectonic-v5:${seed}`);
  const paths = tree.paths.map((path) => {
    if (path.id === 'fault-0') {
      return { ...path, points: path.points.map((point) => contain(rotatePoint(point, tree.center, -0.045), tree)) };
    }
    if (path.id === 'fault-2') {
      return { ...path, points: path.points.map((point) => contain(rotatePoint(point, tree.center, 0.052), tree)) };
    }
    return path;
  });

  const mainFault = paths.find((path) => path.id === 'fault-1');
  if (!mainFault) return { ...tree, paths };

  const tributaries: FractalPath[] = [];
  for (let index = 3; index < mainFault.points.length - 3; index += 4) {
    const start = mainFault.points[index];
    const prev = mainFault.points[index - 1];
    const next = mainFault.points[index + 1];
    const tangent = Math.atan2(next.y - prev.y, next.x - prev.x);
    const side = index % 8 === 3 ? -1 : 1;
    const length = tree.radiusY * (0.2 + rng() * 0.15);
    const angle = tangent + side * (0.82 + rng() * 0.42);
    const elbow = contain(
      {
        x: start.x + Math.cos(angle) * length * 0.55,
        y: start.y + Math.sin(angle) * length * 0.55,
      },
      tree
    );
    const tip = contain(
      {
        x: elbow.x + Math.cos(angle + side * (0.28 + rng() * 0.34)) * length * 0.5,
        y: elbow.y + Math.sin(angle + side * (0.28 + rng() * 0.34)) * length * 0.5,
      },
      tree
    );
    tributaries.push({
      id: `rift-vein-${index}`,
      ownerId: '__ambient__',
      depth: 2,
      points: [start, elbow, tip],
      width: 0.66,
      alpha: 0.31,
      renderMode: 'stroke',
      glow: 0.08,
    });

    if (rng() > 0.28) {
      const twigAngle = angle - side * (0.72 + rng() * 0.48);
      const twig = contain(
        {
          x: elbow.x + Math.cos(twigAngle) * length * 0.34,
          y: elbow.y + Math.sin(twigAngle) * length * 0.34,
        },
        tree
      );
      tributaries.push({
        id: `rift-twig-${index}`,
        ownerId: '__ambient__',
        depth: 3,
        points: [elbow, twig],
        width: 0.36,
        alpha: 0.2,
        renderMode: 'stroke',
      });
    }
  }

  return { ...tree, paths: [...paths, ...tributaries].slice(0, tree.morphology.pathBudget) };
}

export function buildAdaptiveFractalTree(dimensions: Dimensions, seed: string, destinationIds: string[]): FractalTree {
  const tree = v4.buildAdaptiveFractalTree(dimensions, seed, destinationIds);
  const entropy = /^force:[a-z-]+:(.*)$/.exec(seed)?.[1] ?? seed;
  return deepenTectonic(sharpenEchoNest(tree, entropy), entropy);
}
