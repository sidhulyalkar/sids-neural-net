export type Vec2 = { x: number; y: number };
export type Dimensions = { width: number; height: number };

export type FractalMorphologyId = 'radial' | 'coral' | 'fan' | 'apical';

export type FractalProfile = {
  id: FractalMorphologyId;
  label: string;
  recursionDepth: number;
  branchPoints: number;
  terminalShrink: number;
  splitAngle: number;
  angularNoise: number;
  sideLengthScale: number;
  dropout: number;
  centerBias: number;
  pathBudget: number;
};

export type FractalViewportGeometry = {
  compact: boolean;
  short: boolean;
  portrait: boolean;
  ultrawide: boolean;
  edgeMargin: number;
  titleBand: number;
  center: Vec2;
  radiusX: number;
  radiusY: number;
  usableBottom: number;
};

export type FractalPath = {
  id: string;
  ownerId: string;
  depth: number;
  points: Vec2[];
  width: number;
  alpha: number;
};

export type FractalTree = FractalViewportGeometry & {
  morphology: FractalProfile;
  theoreticalTerminalDimension: number;
  paths: FractalPath[];
  endpoints: Map<string, Vec2>;
};

export const FRACTAL_PROFILES: Record<FractalMorphologyId, FractalProfile> = {
  radial: {
    id: 'radial',
    label: 'radial snowflake',
    recursionDepth: 4,
    branchPoints: 4,
    terminalShrink: 0.66,
    splitAngle: 0.52,
    angularNoise: 0.12,
    sideLengthScale: 0.24,
    dropout: 0.08,
    centerBias: 0.16,
    pathBudget: 760,
  },
  coral: {
    id: 'coral',
    label: 'diffusion coral',
    recursionDepth: 5,
    branchPoints: 3,
    terminalShrink: 0.64,
    splitAngle: 0.44,
    angularNoise: 0.24,
    sideLengthScale: 0.22,
    dropout: 0.18,
    centerBias: 0.08,
    pathBudget: 880,
  },
  fan: {
    id: 'fan',
    label: 'lateral fan',
    recursionDepth: 4,
    branchPoints: 5,
    terminalShrink: 0.67,
    splitAngle: 0.38,
    angularNoise: 0.1,
    sideLengthScale: 0.2,
    dropout: 0.1,
    centerBias: 0.22,
    pathBudget: 820,
  },
  apical: {
    id: 'apical',
    label: 'apical arbor',
    recursionDepth: 4,
    branchPoints: 3,
    terminalShrink: 0.63,
    splitAngle: 0.48,
    angularNoise: 0.14,
    sideLengthScale: 0.21,
    dropout: 0.12,
    centerBias: 0.28,
    pathBudget: 620,
  },
};

const TWO_PI = Math.PI * 2;
const PRIMARY_ANGLE_OFFSET = -Math.PI / 2;
const PIPE_EXPONENT = 2.35;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function seededRng(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function theoreticalSelfSimilarDimension(branches: number, shrink: number): number {
  if (branches <= 1 || shrink <= 0 || shrink >= 1) return 1;
  return Math.log(branches) / Math.log(1 / shrink);
}

export function getFractalViewportGeometry(dimensions: Dimensions): FractalViewportGeometry {
  const { width, height } = dimensions;
  const aspect = width / Math.max(height, 1);
  const compact = width < 620;
  const short = height < 650;
  const portrait = aspect < 0.86;
  const ultrawide = aspect > 1.85;
  const edgeMargin = clamp(Math.min(width, height) * 0.038, compact ? 18 : 28, 64);
  const titleBand = clamp(height * (short ? 0.12 : compact ? 0.15 : 0.14), 84, 138);
  const usableBottom = Math.max(edgeMargin + 220, height - titleBand);
  const usableHeight = Math.max(240, usableBottom - edgeMargin);
  const center: Vec2 = {
    x: width * 0.5,
    y: edgeMargin + usableHeight * (portrait ? 0.48 : short ? 0.46 : 0.47),
  };

  // Independent axes fix the previous min(width, height) bottleneck on 16:9 and ultrawide screens.
  const horizontalReach = Math.max(120, width * 0.5 - edgeMargin);
  const verticalReach = Math.max(
    120,
    Math.min(center.y - edgeMargin, usableBottom - center.y - edgeMargin * 0.35)
  );

  return {
    compact,
    short,
    portrait,
    ultrawide,
    edgeMargin,
    titleBand,
    center,
    radiusX: horizontalReach * (compact ? 0.82 : ultrawide ? 0.94 : 0.91),
    radiusY: verticalReach * (portrait ? 0.96 : short ? 0.88 : 0.93),
    usableBottom,
  };
}

function pickFromSeed<T>(items: readonly T[], seed: string): T {
  const rng = seededRng(seed);
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

export function chooseFractalMorphology(dimensions: Dimensions, seed: string): FractalProfile {
  const aspect = dimensions.width / Math.max(dimensions.height, 1);
  if (dimensions.width < 520) return FRACTAL_PROFILES.apical;
  if (aspect > 1.95) {
    return pickFromSeed([FRACTAL_PROFILES.fan, FRACTAL_PROFILES.coral] as const, `${seed}:ultrawide`);
  }
  if (aspect > 1.25) {
    return pickFromSeed(
      [FRACTAL_PROFILES.radial, FRACTAL_PROFILES.coral, FRACTAL_PROFILES.fan] as const,
      `${seed}:landscape`
    );
  }
  if (aspect < 0.82) {
    return pickFromSeed([FRACTAL_PROFILES.apical, FRACTAL_PROFILES.coral] as const, `${seed}:portrait`);
  }
  return pickFromSeed([FRACTAL_PROFILES.radial, FRACTAL_PROFILES.coral] as const, `${seed}:balanced`);
}

function ellipsePoint(center: Vec2, angle: number, radiusX: number, radiusY: number, scale = 1): Vec2 {
  return {
    x: center.x + Math.cos(angle) * radiusX * scale,
    y: center.y + Math.sin(angle) * radiusY * scale,
  };
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.max(0.0001, Math.hypot(vector.x, vector.y));
  return { x: vector.x / length, y: vector.y / length };
}

function pointOnPath(points: Vec2[], t: number): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  const scaled = clamp(t, 0, 1) * (points.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(points.length - 1, index + 1);
  const local = scaled - index;
  return {
    x: points[index].x + (points[nextIndex].x - points[index].x) * local,
    y: points[index].y + (points[nextIndex].y - points[index].y) * local,
  };
}

function pathDirection(points: Vec2[], t: number): number {
  const a = pointOnPath(points, clamp(t - 0.025, 0, 1));
  const b = pointOnPath(points, clamp(t + 0.025, 0, 1));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function organicPath(start: Vec2, end: Vec2, rng: () => number, segments: number, wobble: number): Vec2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length, y: dx / length };
  const points: Vec2[] = [start];

  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const envelope = Math.sin(Math.PI * t);
    const offset = (rng() - 0.5) * length * wobble * envelope;
    points.push({
      x: start.x + dx * t + normal.x * offset,
      y: start.y + dy * t + normal.y * offset,
    });
  }
  return points;
}

function containPoint(point: Vec2, geometry: FractalViewportGeometry): Vec2 {
  return {
    x: clamp(point.x, geometry.edgeMargin, geometry.center.x * 2 - geometry.edgeMargin),
    y: clamp(point.y, geometry.edgeMargin, geometry.usableBottom - geometry.edgeMargin * 0.35),
  };
}

function containPath(points: Vec2[], geometry: FractalViewportGeometry): Vec2[] {
  return points.map((point) => containPoint(point, geometry));
}

function branchWidth(recursionDepth: number, depth: number, primary = false): number {
  if (primary) return 2.35 + recursionDepth * 0.11;
  const downstreamTips = Math.pow(2, Math.max(0, recursionDepth - depth));
  const radius = Math.pow(downstreamTips, 1 / PIPE_EXPONENT);
  return clamp(0.28 + radius * 0.34, 0.34, 1.62);
}

function branchAlpha(depth: number, primary = false): number {
  if (primary) return 0.72;
  return clamp(0.56 - depth * 0.085, 0.18, 0.52);
}

function armAngle(index: number, count: number, geometry: FractalViewportGeometry): number {
  const base = PRIMARY_ANGLE_OFFSET + (index / count) * TWO_PI;
  if (geometry.ultrawide) return base - Math.sin(base * 2) * 0.08;
  if (geometry.portrait) return base + Math.sin(base * 2) * 0.055;
  return base;
}

export function buildAdaptiveFractalTree(
  dimensions: Dimensions,
  seed: string,
  destinationIds: string[]
): FractalTree {
  const geometry = getFractalViewportGeometry(dimensions);
  const morphology = chooseFractalMorphology(dimensions, seed);
  const rng = seededRng(`adaptive-fractal-v2:${seed}:${dimensions.width}x${dimensions.height}:${morphology.id}`);
  const paths: FractalPath[] = [];
  const endpoints = new Map<string, Vec2>();
  const ownerCounts = new Map<string, number>();
  const ownerBudget = Math.max(
    12,
    Math.floor((morphology.pathBudget - destinationIds.length) / Math.max(1, destinationIds.length))
  );
  let pathCount = 0;

  const pushPath = (
    id: string,
    ownerId: string,
    depth: number,
    points: Vec2[],
    primary = false
  ): boolean => {
    if (pathCount >= morphology.pathBudget) return false;
    const ownerCount = ownerCounts.get(ownerId) ?? 0;
    if (!primary && ownerCount >= ownerBudget) return false;

    pathCount += 1;
    ownerCounts.set(ownerId, ownerCount + 1);
    paths.push({
      id,
      ownerId,
      depth,
      points: containPath(points, geometry),
      width: branchWidth(morphology.recursionDepth, depth, primary),
      alpha: branchAlpha(depth, primary),
    });
    return true;
  };

  const hasOwnerBudget = (ownerId: string) => (ownerCounts.get(ownerId) ?? 0) < ownerBudget + 1;

  const growRecursive = (
    ownerId: string,
    start: Vec2,
    angle: number,
    length: number,
    depth: number,
    branchKey: string
  ): void => {
    if (
      depth > morphology.recursionDepth ||
      length < 5 ||
      pathCount >= morphology.pathBudget ||
      !hasOwnerBudget(ownerId)
    ) {
      return;
    }

    const biasedAngle = angle + (rng() - 0.5) * morphology.angularNoise;
    const end = containPoint(
      {
        x: start.x + Math.cos(biasedAngle) * length,
        y: start.y + Math.sin(biasedAngle) * length,
      },
      geometry
    );
    const travelled = Math.hypot(end.x - start.x, end.y - start.y);
    if (travelled < Math.max(4, length * 0.36)) return;

    const points = organicPath(start, end, rng, depth <= 2 ? 4 : 3, 0.035 + depth * 0.01);
    if (!pushPath(`${ownerId}-${branchKey}-${depth}-${pathCount}`, ownerId, depth, points)) return;
    if (depth >= morphology.recursionDepth) return;

    const nextLength = length * morphology.terminalShrink * (0.88 + rng() * 0.18);
    const split = morphology.splitAngle * (0.88 + rng() * 0.22);
    const straightBias = morphology.centerBias * (rng() - 0.5);

    if (rng() > morphology.dropout) {
      growRecursive(ownerId, end, biasedAngle - split + straightBias, nextLength, depth + 1, `${branchKey}l`);
    }
    if (rng() > morphology.dropout) {
      growRecursive(ownerId, end, biasedAngle + split + straightBias, nextLength, depth + 1, `${branchKey}r`);
    }
    if (morphology.id === 'coral' && depth < morphology.recursionDepth - 1 && rng() > 0.72) {
      growRecursive(
        ownerId,
        end,
        biasedAngle + (rng() - 0.5) * 0.18,
        nextLength * 0.78,
        depth + 1,
        `${branchKey}c`
      );
    }
  };

  destinationIds.forEach((ownerId, index) => {
    const angle = armAngle(index, destinationIds.length, geometry);
    const endpoint = ellipsePoint(
      geometry.center,
      angle,
      geometry.radiusX,
      geometry.radiusY,
      geometry.compact ? 0.92 : 0.96
    );
    const primary = organicPath(
      geometry.center,
      endpoint,
      rng,
      geometry.compact ? 11 : geometry.ultrawide ? 16 : 14,
      morphology.id === 'coral' ? 0.032 : 0.022
    );

    // Primary paths are inserted first for each owner and therefore cannot be starved by another subtree.
    pushPath(`primary-${ownerId}`, ownerId, 0, primary, true);
    endpoints.set(ownerId, endpoint);

    const branchBaseLength = Math.min(geometry.radiusX, geometry.radiusY) * morphology.sideLengthScale;
    const startT = geometry.compact ? 0.34 : 0.29;
    const endT = geometry.compact ? 0.76 : 0.82;

    for (let branchIndex = 0; branchIndex < morphology.branchPoints; branchIndex += 1) {
      const t =
        morphology.branchPoints === 1
          ? 0.58
          : startT + ((endT - startT) * branchIndex) / (morphology.branchPoints - 1);
      const start = pointOnPath(primary, t);
      const tangent = pathDirection(primary, t);
      const branchLength = branchBaseLength * (1.08 - t * 0.22) * (0.88 + rng() * 0.22);

      for (const side of [-1, 1] as const) {
        if (rng() < morphology.dropout * 0.35) continue;
        const initialAngle =
          tangent +
          side * (morphology.splitAngle * (0.68 + rng() * 0.2)) +
          (rng() - 0.5) * morphology.angularNoise;
        growRecursive(ownerId, start, initialAngle, branchLength, 1, `b${branchIndex}${side < 0 ? 'l' : 'r'}`);
      }
    }

    const terminalCount = geometry.compact ? 3 : morphology.id === 'fan' ? 5 : 4;
    const terminalLength = branchBaseLength * (geometry.compact ? 0.62 : 0.74);
    for (let terminalIndex = 0; terminalIndex < terminalCount; terminalIndex += 1) {
      const centered = terminalIndex - (terminalCount - 1) / 2;
      growRecursive(
        ownerId,
        endpoint,
        angle + centered * morphology.splitAngle * 0.42,
        terminalLength * (0.86 + rng() * 0.18),
        2,
        `tip${terminalIndex}`
      );
    }
  });

  return {
    ...geometry,
    morphology,
    theoreticalTerminalDimension: theoreticalSelfSimilarDimension(2, morphology.terminalShrink),
    paths,
    endpoints,
  };
}

export function unitVectorFromCenter(point: Vec2, center: Vec2): Vec2 {
  return normalize({ x: point.x - center.x, y: point.y - center.y });
}
