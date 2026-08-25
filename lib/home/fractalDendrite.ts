export type Vec2 = { x: number; y: number };
export type Dimensions = { width: number; height: number };

export type FractalMorphologyId =
  | 'radial'
  | 'coral'
  | 'fan'
  | 'apical'
  | 'tectonic'
  | 'spiraloid'
  | 'mycelial'
  | 'halo'
  | 'pixel-ghost'
  | 'aurora'
  | 'echidna'
  | 'echo-nest';

export type FractalRenderMode = 'stroke' | 'pixel' | 'stencil';

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
  dimensionHint?: number;
};

export type FractalViewportGeometry = {
  compact: boolean;
  short: boolean;
  portrait: boolean;
  ultrawide: boolean;
  extremeWide: boolean;
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
  renderMode: FractalRenderMode;
  closed?: boolean;
  glow?: number;
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
  tectonic: {
    id: 'tectonic',
    label: 'tectonic rift',
    recursionDepth: 4,
    branchPoints: 4,
    terminalShrink: 0.58,
    splitAngle: 1.08,
    angularNoise: 0.3,
    sideLengthScale: 0.2,
    dropout: 0.14,
    centerBias: 0.04,
    pathBudget: 780,
    dimensionHint: 1.52,
  },
  spiraloid: {
    id: 'spiraloid',
    label: 'helical spiraloid',
    recursionDepth: 5,
    branchPoints: 3,
    terminalShrink: 0.63,
    splitAngle: 0.44,
    angularNoise: 0.08,
    sideLengthScale: 0.2,
    dropout: 0.1,
    centerBias: 0.18,
    pathBudget: 760,
    dimensionHint: 1.56,
  },
  mycelial: {
    id: 'mycelial',
    label: 'mycelial web',
    recursionDepth: 3,
    branchPoints: 3,
    terminalShrink: 0.62,
    splitAngle: 0.3,
    angularNoise: 0.18,
    sideLengthScale: 0.18,
    dropout: 0.08,
    centerBias: 0,
    pathBudget: 900,
    dimensionHint: 1.82,
  },
  halo: {
    id: 'halo',
    label: 'pendulum halo',
    recursionDepth: 4,
    branchPoints: 3,
    terminalShrink: 0.61,
    splitAngle: 0.34,
    angularNoise: 0.08,
    sideLengthScale: 0.19,
    dropout: 0.09,
    centerBias: 0.38,
    pathBudget: 660,
    dimensionHint: 1.47,
  },
  'pixel-ghost': {
    id: 'pixel-ghost',
    label: 'pixel ghost',
    recursionDepth: 6,
    branchPoints: 3,
    terminalShrink: 0.78,
    splitAngle: 0,
    angularNoise: 0,
    sideLengthScale: 0.16,
    dropout: 0.18,
    centerBias: 0,
    pathBudget: 980,
    dimensionHint: 1.74,
  },
  aurora: {
    id: 'aurora',
    label: 'aurora veil',
    recursionDepth: 4,
    branchPoints: 4,
    terminalShrink: 0.67,
    splitAngle: 0.26,
    angularNoise: 0.12,
    sideLengthScale: 0.25,
    dropout: 0.08,
    centerBias: 0.08,
    pathBudget: 820,
    dimensionHint: 1.62,
  },
  echidna: {
    id: 'echidna',
    label: 'echidna quill',
    recursionDepth: 5,
    branchPoints: 4,
    terminalShrink: 0.61,
    splitAngle: 0.46,
    angularNoise: 0.1,
    sideLengthScale: 0.21,
    dropout: 0.08,
    centerBias: 0.12,
    pathBudget: 820,
    dimensionHint: 1.53,
  },
  'echo-nest': {
    id: 'echo-nest',
    label: 'echo nest',
    recursionDepth: 4,
    branchPoints: 3,
    terminalShrink: 0.6,
    splitAngle: Math.PI / 6,
    angularNoise: 0,
    sideLengthScale: 0.2,
    dropout: 0,
    centerBias: 0,
    pathBudget: 540,
    dimensionHint: 1.46,
  },
};

const TWO_PI = Math.PI * 2;
const PRIMARY_ANGLE_OFFSET = -Math.PI / 2;
const PIPE_EXPONENT = 2.35;
const AMBIENT_OWNER = '__ambient__';

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
  const extremeWide = aspect > 2.35;
  const edgeMargin = clamp(Math.min(width, height) * 0.038, compact ? 18 : 28, 64);
  const titleBand = clamp(height * (short ? 0.12 : compact ? 0.15 : 0.14), 84, 138);
  const usableBottom = Math.max(edgeMargin + 220, height - titleBand);
  const usableHeight = Math.max(240, usableBottom - edgeMargin);
  const center: Vec2 = {
    x: width * 0.5,
    y: edgeMargin + usableHeight * (portrait ? 0.48 : short ? 0.46 : 0.47),
  };

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
    extremeWide,
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

function pickWeightedFromSeed(
  items: ReadonlyArray<readonly [FractalProfile, number]>,
  seed: string
): FractalProfile {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  const rng = seededRng(seed);
  let cursor = rng() * total;
  for (const [profile, weight] of items) {
    cursor -= weight;
    if (cursor <= 0) return profile;
  }
  return items[items.length - 1]?.[0] ?? FRACTAL_PROFILES.radial;
}

function forcedMorphology(seed: string): FractalProfile | undefined {
  const match = /^force:([a-z-]+):/.exec(seed);
  if (!match) return undefined;
  const id = match[1] as FractalMorphologyId;
  return FRACTAL_PROFILES[id];
}

export function chooseFractalMorphology(dimensions: Dimensions, seed: string): FractalProfile {
  const forced = forcedMorphology(seed);
  if (forced) return forced;

  const aspect = dimensions.width / Math.max(dimensions.height, 1);
  const balanced = aspect >= 0.88 && aspect <= 1.16;

  if (dimensions.width < 480) {
    return pickWeightedFromSeed(
      [
        [FRACTAL_PROFILES.halo, 0.3],
        [FRACTAL_PROFILES.apical, 0.22],
        [FRACTAL_PROFILES.echidna, 0.2],
        [FRACTAL_PROFILES.spiraloid, 0.18],
        [FRACTAL_PROFILES['pixel-ghost'], 0.1],
      ],
      `${seed}:compact`
    );
  }
  if (aspect > 2.35) {
    return pickWeightedFromSeed(
      [
        [FRACTAL_PROFILES.aurora, 0.31],
        [FRACTAL_PROFILES.tectonic, 0.27],
        [FRACTAL_PROFILES.mycelial, 0.2],
        [FRACTAL_PROFILES.fan, 0.12],
        [FRACTAL_PROFILES['echo-nest'], 0.1],
      ],
      `${seed}:extreme-wide`
    );
  }
  if (aspect > 1.7) {
    return pickWeightedFromSeed(
      [
        [FRACTAL_PROFILES.aurora, 0.22],
        [FRACTAL_PROFILES.tectonic, 0.18],
        [FRACTAL_PROFILES.mycelial, 0.16],
        [FRACTAL_PROFILES.fan, 0.14],
        [FRACTAL_PROFILES.coral, 0.12],
        [FRACTAL_PROFILES.radial, 0.1],
        [FRACTAL_PROFILES['echo-nest'], 0.08],
      ],
      `${seed}:ultrawide`
    );
  }
  if (aspect < 0.82) {
    return pickWeightedFromSeed(
      [
        [FRACTAL_PROFILES.halo, 0.26],
        [FRACTAL_PROFILES.echidna, 0.23],
        [FRACTAL_PROFILES.spiraloid, 0.2],
        [FRACTAL_PROFILES.apical, 0.18],
        [FRACTAL_PROFILES.coral, 0.08],
        [FRACTAL_PROFILES['echo-nest'], 0.05],
      ],
      `${seed}:portrait`
    );
  }
  if (balanced) {
    return pickWeightedFromSeed(
      [
        [FRACTAL_PROFILES.spiraloid, 0.16],
        [FRACTAL_PROFILES.mycelial, 0.16],
        [FRACTAL_PROFILES.radial, 0.16],
        [FRACTAL_PROFILES['echo-nest'], 0.14],
        [FRACTAL_PROFILES.coral, 0.12],
        [FRACTAL_PROFILES['pixel-ghost'], dimensions.width <= 960 ? 0.12 : 0.06],
        [FRACTAL_PROFILES.echidna, 0.08],
        [FRACTAL_PROFILES.halo, 0.06],
      ],
      `${seed}:balanced`
    );
  }
  return pickWeightedFromSeed(
    [
      [FRACTAL_PROFILES.radial, 0.18],
      [FRACTAL_PROFILES.coral, 0.17],
      [FRACTAL_PROFILES.fan, 0.14],
      [FRACTAL_PROFILES.aurora, 0.13],
      [FRACTAL_PROFILES.mycelial, 0.12],
      [FRACTAL_PROFILES.tectonic, 0.1],
      [FRACTAL_PROFILES.spiraloid, 0.08],
      [FRACTAL_PROFILES['echo-nest'], 0.08],
    ],
    `${seed}:landscape`
  );
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

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
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

function jaggedPath(start: Vec2, end: Vec2, rng: () => number, segments: number, intensity: number): Vec2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length, y: dx / length };
  const points = [start];
  let walk = 0;
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    walk = walk * 0.46 + (rng() - 0.5) * length * intensity;
    points.push({
      x: start.x + dx * t + normal.x * walk,
      y: start.y + dy * t + normal.y * walk,
    });
  }
  points.push(end);
  return points;
}

function flowPathToTarget(
  start: Vec2,
  end: Vec2,
  depth: number,
  phase: number,
  geometry: FractalViewportGeometry
): Vec2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length, y: dx / length };
  const points = [start];
  const segments = geometry.extremeWide ? 22 : 16;
  const amplitude = Math.min(geometry.radiusY * 0.2, length * (0.07 + depth * 0.008));
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    const envelope = Math.sin(Math.PI * t);
    const wind = Math.sin(phase + t * TWO_PI * 1.35 + depth * 0.7) * amplitude * envelope;
    const drift = Math.sin(phase * 0.7 + t * Math.PI) * geometry.radiusY * 0.025 * envelope;
    points.push({
      x: start.x + dx * t + normal.x * wind + drift,
      y: start.y + dy * t + normal.y * wind * 0.62,
    });
  }
  points.push(end);
  return points;
}

function spiralPath(start: Vec2, end: Vec2, chirality: number, phase: number): Vec2[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length, y: dx / length };
  const points = [start];
  const segments = 18;
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    const envelope = Math.sin(Math.PI * t);
    const twist = Math.sin(phase + t * TWO_PI * 1.25) * length * 0.055 * envelope * chirality;
    points.push({
      x: start.x + dx * t + normal.x * twist,
      y: start.y + dy * t + normal.y * twist,
    });
  }
  points.push(end);
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

type PushOptions = {
  id: string;
  ownerId: string;
  depth: number;
  points: Vec2[];
  primary?: boolean;
  width?: number;
  alpha?: number;
  renderMode?: FractalRenderMode;
  closed?: boolean;
  glow?: number;
  enforceOwnerBudget?: boolean;
};

type BuildContext = {
  geometry: FractalViewportGeometry;
  morphology: FractalProfile;
  rng: () => number;
  paths: FractalPath[];
  endpoints: Map<string, Vec2>;
  ownerBudget: number;
  pushPath: (options: PushOptions) => boolean;
  hasOwnerBudget: (ownerId: string) => boolean;
};

function createBuildContext(
  geometry: FractalViewportGeometry,
  morphology: FractalProfile,
  rng: () => number,
  destinationIds: string[]
): BuildContext {
  const paths: FractalPath[] = [];
  const endpoints = new Map<string, Vec2>();
  const ownerCounts = new Map<string, number>();
  const ownerBudget = Math.max(
    14,
    Math.floor((morphology.pathBudget - destinationIds.length) / Math.max(1, destinationIds.length))
  );

  const pushPath = (options: PushOptions): boolean => {
    if (paths.length >= morphology.pathBudget || options.points.length === 0) return false;
    const enforce = options.enforceOwnerBudget ?? options.ownerId !== AMBIENT_OWNER;
    const ownerCount = ownerCounts.get(options.ownerId) ?? 0;
    if (enforce && !options.primary && ownerCount >= ownerBudget) return false;

    ownerCounts.set(options.ownerId, ownerCount + 1);
    paths.push({
      id: options.id,
      ownerId: options.ownerId,
      depth: options.depth,
      points: containPath(options.points, geometry),
      width: options.width ?? branchWidth(morphology.recursionDepth, options.depth, options.primary),
      alpha: options.alpha ?? branchAlpha(options.depth, options.primary),
      renderMode: options.renderMode ?? 'stroke',
      closed: options.closed,
      glow: options.glow,
    });
    return true;
  };

  return {
    geometry,
    morphology,
    rng,
    paths,
    endpoints,
    ownerBudget,
    pushPath,
    hasOwnerBudget: (ownerId: string) => (ownerCounts.get(ownerId) ?? 0) < ownerBudget + 1,
  };
}

function standardEndpoint(
  ownerIndex: number,
  count: number,
  geometry: FractalViewportGeometry,
  scale = 0.96
): { angle: number; point: Vec2 } {
  const angle = armAngle(ownerIndex, count, geometry);
  return {
    angle,
    point: ellipsePoint(geometry.center, angle, geometry.radiusX, geometry.radiusY, scale),
  };
}

function nearestOwner(point: Vec2, endpoints: Map<string, Vec2>): string {
  let owner = AMBIENT_OWNER;
  let best = Number.POSITIVE_INFINITY;
  for (const [id, endpoint] of endpoints) {
    const distance = distanceSquared(point, endpoint);
    if (distance < best) {
      best = distance;
      owner = id;
    }
  }
  return owner;
}

function buildRootedMorphology(context: BuildContext, destinationIds: string[]): void {
  const { geometry, morphology, rng, pushPath, endpoints } = context;
  const chirality = rng() < 0.5 ? -1 : 1;
  const phase = rng() * TWO_PI;

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
      context.paths.length >= morphology.pathBudget ||
      !context.hasOwnerBudget(ownerId)
    ) {
      return;
    }

    let biasedAngle = angle + (rng() - 0.5) * morphology.angularNoise;
    let adjustedLength = length;

    if (morphology.id === 'spiraloid') {
      biasedAngle += chirality * depth * (Math.PI / 15);
      adjustedLength *= 1 + 0.16 * Math.sin(phase + depth * 1.27);
    } else if (morphology.id === 'echidna' && depth >= 3) {
      const horizontal = Math.cos(biasedAngle) >= 0 ? 0 : Math.PI;
      biasedAngle = horizontal + (rng() - 0.5) * 0.14;
      const parentHeight = Math.abs(start.y - geometry.center.y) / Math.max(1, geometry.radiusY);
      adjustedLength *= 0.72 + parentHeight * 0.52;
    }

    const end = containPoint(
      {
        x: start.x + Math.cos(biasedAngle) * adjustedLength,
        y: start.y + Math.sin(biasedAngle) * adjustedLength,
      },
      geometry
    );
    const travelled = Math.hypot(end.x - start.x, end.y - start.y);
    if (travelled < Math.max(4, adjustedLength * 0.34)) return;

    const points =
      morphology.id === 'aurora'
        ? flowPathToTarget(start, end, depth, phase + depth * 0.61, geometry)
        : morphology.id === 'spiraloid'
          ? spiralPath(start, end, chirality, phase + depth * 0.72)
          : organicPath(start, end, rng, depth <= 2 ? 4 : 3, 0.035 + depth * 0.01);

    if (
      !pushPath({
        id: `${ownerId}-${branchKey}-${depth}-${context.paths.length}`,
        ownerId,
        depth,
        points,
        glow: morphology.id === 'aurora' ? 1.2 : morphology.id === 'spiraloid' ? 0.55 : 0,
      })
    ) {
      return;
    }
    if (depth >= morphology.recursionDepth) return;

    const nextLength = adjustedLength * morphology.terminalShrink * (0.88 + rng() * 0.18);
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
    const { angle, point: endpoint } = standardEndpoint(
      index,
      destinationIds.length,
      geometry,
      geometry.compact ? 0.92 : 0.96
    );
    const primary =
      morphology.id === 'aurora'
        ? flowPathToTarget(geometry.center, endpoint, 0, phase + index * 0.48, geometry)
        : morphology.id === 'spiraloid'
          ? spiralPath(geometry.center, endpoint, chirality, phase + index * 0.58)
          : organicPath(
              geometry.center,
              endpoint,
              rng,
              geometry.compact ? 11 : geometry.ultrawide ? 16 : 14,
              morphology.id === 'coral' ? 0.032 : 0.022
            );

    pushPath({
      id: `primary-${ownerId}`,
      ownerId,
      depth: 0,
      points: primary,
      primary: true,
      glow: morphology.id === 'aurora' ? 1.7 : morphology.id === 'spiraloid' ? 0.7 : 0.25,
    });
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

    const terminalCount = geometry.compact ? 3 : morphology.id === 'fan' || morphology.id === 'aurora' ? 5 : 4;
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
}

function buildTectonic(context: BuildContext, destinationIds: string[]): void {
  const { geometry, rng, pushPath, endpoints, morphology } = context;
  const baseline: Vec2[] = [];
  const steps = geometry.extremeWide ? 34 : 26;
  let walk = 0;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    walk = walk * 0.72 + (rng() - 0.5) * geometry.radiusY * 0.11;
    const y = geometry.center.y + Math.sin(t * Math.PI * 3.1 + 0.4) * geometry.radiusY * 0.09 + walk;
    baseline.push(
      containPoint(
        {
          x: geometry.edgeMargin + t * (geometry.center.x * 2 - geometry.edgeMargin * 2),
          y,
        },
        geometry
      )
    );
  }

  for (let index = 0; index < baseline.length - 1; index += 1) {
    const ownerId = destinationIds[Math.min(destinationIds.length - 1, Math.floor((index / steps) * destinationIds.length))];
    pushPath({
      id: `rift-baseline-${index}`,
      ownerId,
      depth: 0,
      points: [baseline[index], baseline[index + 1]],
      width: 1.8,
      alpha: 0.62,
      glow: 0.3,
      enforceOwnerBudget: false,
    });
  }

  const growFracture = (
    ownerId: string,
    start: Vec2,
    angle: number,
    length: number,
    depth: number,
    key: string
  ): void => {
    if (depth > morphology.recursionDepth || length < 6 || !context.hasOwnerBudget(ownerId)) return;
    const end = containPoint(
      {
        x: start.x + Math.cos(angle) * length,
        y: start.y + Math.sin(angle) * length,
      },
      geometry
    );
    if (
      !pushPath({
        id: `rift-${ownerId}-${key}-${depth}-${context.paths.length}`,
        ownerId,
        depth,
        points: jaggedPath(start, end, rng, depth <= 2 ? 5 : 3, 0.065 + depth * 0.018),
        width: clamp(1.25 - depth * 0.2, 0.38, 1.25),
        alpha: clamp(0.56 - depth * 0.08, 0.2, 0.56),
      })
    ) {
      return;
    }
    if (depth >= morphology.recursionDepth) return;

    const next = length * morphology.terminalShrink * (0.88 + rng() * 0.16);
    const perpendicular = Math.PI / 2 + (rng() - 0.5) * 0.48;
    if (rng() > morphology.dropout) growFracture(ownerId, end, angle + perpendicular, next, depth + 1, `${key}a`);
    if (rng() > morphology.dropout + 0.08) growFracture(ownerId, end, angle - perpendicular, next * 0.88, depth + 1, `${key}b`);
  };

  destinationIds.forEach((ownerId, index) => {
    const { point: endpoint } = standardEndpoint(index, destinationIds.length, geometry, geometry.compact ? 0.9 : 0.96);
    endpoints.set(ownerId, endpoint);
    const start = pointOnPath(baseline, (index + 0.5) / destinationIds.length);
    const primary = jaggedPath(start, endpoint, rng, geometry.extremeWide ? 9 : 7, 0.055);
    pushPath({ id: `primary-${ownerId}`, ownerId, depth: 0, points: primary, primary: true, glow: 0.35 });

    const length = Math.min(geometry.radiusX, geometry.radiusY) * 0.18;
    for (const t of [0.28, 0.48, 0.68, 0.82]) {
      const fractureStart = pointOnPath(primary, t);
      const tangent = pathDirection(primary, t);
      const side = rng() < 0.5 ? -1 : 1;
      growFracture(ownerId, fractureStart, tangent + side * (Math.PI / 2), length * (1.04 - t * 0.3), 1, `s${t}`);
    }
  });
}

function buildMycelial(context: BuildContext, destinationIds: string[]): void {
  const { geometry, rng, pushPath, endpoints } = context;
  destinationIds.forEach((ownerId, index) => {
    const { point } = standardEndpoint(index, destinationIds.length, geometry, geometry.compact ? 0.88 : 0.94);
    endpoints.set(ownerId, point);
  });

  const seeds: Vec2[] = [];
  const seedCount = geometry.extremeWide ? 34 : geometry.compact ? 16 : 26;
  for (let index = 0; index < seedCount; index += 1) {
    const angle = rng() * TWO_PI;
    const radial = Math.sqrt(rng()) * 0.92;
    seeds.push(
      containPoint(
        ellipsePoint(geometry.center, angle, geometry.radiusX * radial, geometry.radiusY * radial, 1),
        geometry
      )
    );
  }

  const forks: Vec2[] = [];
  const usedEdges = new Set<string>();
  for (let index = 0; index < seeds.length; index += 1) {
    const distances = seeds
      .map((point, other) => ({ other, distance: other === index ? Number.POSITIVE_INFINITY : distanceSquared(seeds[index], point) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    const targets = distances.slice(0, 2);
    if (targets.length < 2) continue;

    const midpoint = {
      x: seeds[index].x * 0.36 + seeds[targets[0].other].x * 0.32 + seeds[targets[1].other].x * 0.32,
      y: seeds[index].y * 0.36 + seeds[targets[0].other].y * 0.32 + seeds[targets[1].other].y * 0.32,
    };
    const fork = containPoint(
      {
        x: midpoint.x + (rng() - 0.5) * geometry.radiusX * 0.025,
        y: midpoint.y + (rng() - 0.5) * geometry.radiusY * 0.04,
      },
      geometry
    );
    forks.push(fork);
    const ownerId = nearestOwner(seeds[index], endpoints);
    pushPath({
      id: `web-stem-${index}`,
      ownerId,
      depth: 1,
      points: organicPath(seeds[index], fork, rng, 4, 0.028),
      width: 0.82,
      alpha: 0.43,
      enforceOwnerBudget: false,
    });

    for (const target of targets) {
      const edge = [index, target.other].sort((a, b) => a - b).join(':');
      if (usedEdges.has(edge)) continue;
      usedEdges.add(edge);
      pushPath({
        id: `web-edge-${edge}`,
        ownerId,
        depth: 2,
        points: organicPath(fork, seeds[target.other], rng, 4, 0.034),
        width: 0.56,
        alpha: 0.34,
        enforceOwnerBudget: false,
      });
    }
  }

  for (let index = 0; index < forks.length; index += 1) {
    const nearest = seeds
      .map((point, seedIndex) => ({ seedIndex, distance: distanceSquared(forks[index], point) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(1, 3);
    const ownerId = nearestOwner(forks[index], endpoints);
    for (const target of nearest) {
      if (rng() < 0.2) continue;
      pushPath({
        id: `web-recursive-${index}-${target.seedIndex}`,
        ownerId,
        depth: 3,
        points: organicPath(forks[index], seeds[target.seedIndex], rng, 3, 0.05),
        width: 0.4,
        alpha: 0.25,
        enforceOwnerBudget: false,
      });
    }
  }

  for (const [ownerId, endpoint] of endpoints) {
    const nearest = seeds.reduce((best, point) =>
      distanceSquared(point, endpoint) < distanceSquared(best, endpoint) ? point : best
    );
    pushPath({
      id: `primary-${ownerId}`,
      ownerId,
      depth: 0,
      points: organicPath(endpoint, nearest, rng, 5, 0.025),
      primary: true,
      glow: 0.25,
    });
  }
}

function haloArc(
  geometry: FractalViewportGeometry,
  angle: number,
  radialStart: number,
  radialEnd: number,
  curl: number,
  phase: number
): Vec2[] {
  const points: Vec2[] = [];
  const segments = 14;
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const eased = t * t * (3 - 2 * t);
    const radial = radialStart + (radialEnd - radialStart) * eased;
    const bend = curl * Math.sin(t * Math.PI * 0.9) * (0.45 + 0.55 * t);
    const theta = angle + bend + Math.sin(phase + t * Math.PI) * 0.025;
    points.push(ellipsePoint(geometry.center, theta, geometry.radiusX, geometry.radiusY, radial));
  }
  return containPath(points, geometry);
}

function buildHalo(context: BuildContext, destinationIds: string[]): void {
  const { geometry, rng, pushPath, endpoints } = context;
  const chirality = rng() < 0.5 ? -1 : 1;

  const ringSegments = geometry.compact ? 28 : 40;
  for (let index = 0; index < ringSegments; index += 1) {
    const a0 = (index / ringSegments) * TWO_PI;
    const a1 = ((index + 1) / ringSegments) * TWO_PI;
    pushPath({
      id: `halo-ring-${index}`,
      ownerId: AMBIENT_OWNER,
      depth: 4,
      points: [
        ellipsePoint(geometry.center, a0, geometry.radiusX, geometry.radiusY, geometry.compact ? 0.91 : 0.95),
        ellipsePoint(geometry.center, a1, geometry.radiusX, geometry.radiusY, geometry.compact ? 0.91 : 0.95),
      ],
      width: 0.42,
      alpha: 0.14,
      enforceOwnerBudget: false,
    });
  }

  destinationIds.forEach((ownerId, index) => {
    const { angle, point: endpoint } = standardEndpoint(index, destinationIds.length, geometry, geometry.compact ? 0.91 : 0.95);
    endpoints.set(ownerId, endpoint);
    const primary = haloArc(geometry, angle, geometry.compact ? 0.91 : 0.95, 0.28, chirality * 0.64, index * 0.57);
    pushPath({ id: `primary-${ownerId}`, ownerId, depth: 0, points: primary, primary: true, glow: 0.55 });

    for (const side of [-1, 1] as const) {
      const start = pointOnPath(primary, 0.34 + (side > 0 ? 0.08 : 0));
      const startAngle = Math.atan2(
        (start.y - geometry.center.y) / Math.max(1, geometry.radiusY),
        (start.x - geometry.center.x) / Math.max(1, geometry.radiusX)
      );
      const branch = haloArc(
        geometry,
        startAngle + side * 0.06,
        0.7,
        0.31,
        chirality * (0.5 + side * 0.08),
        index + side
      );
      branch[0] = start;
      pushPath({
        id: `halo-${ownerId}-${side}`,
        ownerId,
        depth: 2,
        points: branch,
        width: 0.72,
        alpha: 0.36,
        glow: 0.35,
      });
    }
  });
}

function buildPixelGhost(context: BuildContext, destinationIds: string[]): void {
  const { geometry, rng, pushPath, endpoints, morphology } = context;
  destinationIds.forEach((ownerId, index) => {
    const { point } = standardEndpoint(index, destinationIds.length, geometry, geometry.compact ? 0.86 : 0.9);
    endpoints.set(ownerId, point);
  });

  const baseCell = clamp(Math.min(geometry.center.x * 2, geometry.usableBottom) / 32, 6, geometry.compact ? 11 : 17);
  const encode = (x: number, y: number) => `${x},${y}`;
  const decode = (key: string): [number, number] => {
    const [x, y] = key.split(',').map(Number);
    return [x, y];
  };
  let cells = new Set<string>([
    encode(0, 0),
    encode(1, 0),
    encode(-1, 0),
    encode(0, 1),
    encode(0, -1),
    encode(2, 1),
    encode(-2, -1),
  ]);

  const neighbors = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ] as const;

  for (let generation = 0; generation <= morphology.recursionDepth && cells.size > 0; generation += 1) {
    const cellSize = baseCell * Math.pow(morphology.terminalShrink, generation * 0.48);
    let rendered = 0;
    for (const key of cells) {
      if (rendered >= 150 || context.paths.length >= morphology.pathBudget - destinationIds.length * 2) break;
      const [gx, gy] = decode(key);
      const point = containPoint(
        {
          x: geometry.center.x + gx * baseCell * 1.12,
          y: geometry.center.y + gy * baseCell * 1.12,
        },
        geometry
      );
      const ownerId = nearestOwner(point, endpoints);
      pushPath({
        id: `pixel-${generation}-${key}`,
        ownerId,
        depth: generation,
        points: [point],
        width: cellSize,
        alpha: clamp(0.58 - generation * 0.045, 0.26, 0.58),
        renderMode: 'pixel',
        enforceOwnerBudget: false,
      });
      rendered += 1;
    }

    const candidates = new Set<string>();
    for (const key of cells) {
      const [gx, gy] = decode(key);
      for (const [dx, dy] of neighbors) candidates.add(encode(gx + dx, gy + dy));
    }

    const next = new Set<string>();
    for (const candidate of candidates) {
      const [gx, gy] = decode(candidate);
      let count = 0;
      for (const [dx, dy] of neighbors) {
        if (cells.has(encode(gx + dx, gy + dy))) count += 1;
      }
      if (cells.has(candidate) && count >= 2 && count <= 4) next.add(candidate);
      if (!cells.has(candidate) && count === 3 && rng() > 0.24) next.add(candidate);
      if (next.size > 180) break;
    }

    if (next.size < 4) {
      for (const key of cells) {
        const [gx, gy] = decode(key);
        if (rng() > 0.5) next.add(encode(gx + (rng() > 0.5 ? 1 : -1), gy + (rng() > 0.5 ? 1 : -1)));
      }
    }
    cells = next;
  }

  for (const [ownerId, endpoint] of endpoints) {
    const elbow = {
      x: Math.abs(endpoint.x - geometry.center.x) > Math.abs(endpoint.y - geometry.center.y)
        ? geometry.center.x + Math.sign(endpoint.x - geometry.center.x) * geometry.radiusX * 0.42
        : endpoint.x,
      y: Math.abs(endpoint.y - geometry.center.y) >= Math.abs(endpoint.x - geometry.center.x)
        ? geometry.center.y + Math.sign(endpoint.y - geometry.center.y) * geometry.radiusY * 0.42
        : geometry.center.y,
    };
    pushPath({
      id: `primary-${ownerId}`,
      ownerId,
      depth: 0,
      points: [geometry.center, containPoint(elbow, geometry), endpoint],
      primary: true,
      width: 1.1,
      alpha: 0.48,
      enforceOwnerBudget: false,
    });
  }
}

function trianglePoints(center: Vec2, radiusX: number, radiusY: number, rotation: number): Vec2[] {
  return [0, 1, 2].map((index) => {
    const angle = rotation - Math.PI / 2 + (index / 3) * TWO_PI;
    return { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY };
  });
}

function buildEchoNest(context: BuildContext, destinationIds: string[]): void {
  const { geometry, pushPath, endpoints } = context;
  const maxDepth = context.morphology.recursionDepth;
  const baseRadiusX = geometry.radiusX * (geometry.extremeWide ? 0.64 : 0.72);
  const baseRadiusY = geometry.radiusY * 0.72;

  const recurse = (center: Vec2, scale: number, rotation: number, depth: number, key: string): void => {
    if (depth > maxDepth || context.paths.length >= context.morphology.pathBudget - destinationIds.length) return;
    const polygon = trianglePoints(center, baseRadiusX * scale, baseRadiusY * scale, rotation);
    pushPath({
      id: `nest-${key}-${depth}`,
      ownerId: AMBIENT_OWNER,
      depth,
      points: polygon,
      width: clamp(1.3 - depth * 0.16, 0.42, 1.3),
      alpha: clamp(0.42 - depth * 0.055, 0.14, 0.42),
      renderMode: 'stencil',
      closed: true,
      glow: depth === 0 ? 0.8 : 0.3,
      enforceOwnerBudget: false,
    });
    if (depth >= maxDepth) return;

    polygon.forEach((vertex, index) => {
      const childCenter = {
        x: center.x + (vertex.x - center.x) * 0.64,
        y: center.y + (vertex.y - center.y) * 0.64,
      };
      recurse(containPoint(childCenter, geometry), scale * 0.6, rotation + Math.PI / 6, depth + 1, `${key}${index}`);
    });
  };

  recurse(geometry.center, 1, 0, 0, 'r');

  destinationIds.forEach((ownerId, index) => {
    const { angle, point: endpoint } = standardEndpoint(index, destinationIds.length, geometry, geometry.compact ? 0.88 : 0.94);
    endpoints.set(ownerId, endpoint);
    const inner = ellipsePoint(geometry.center, angle, geometry.radiusX, geometry.radiusY, geometry.compact ? 0.34 : 0.4);
    pushPath({
      id: `primary-${ownerId}`,
      ownerId,
      depth: 0,
      points: organicPath(inner, endpoint, seededRng(`nest-link:${ownerId}:${context.paths.length}`), 6, 0.02),
      primary: true,
      width: 1.2,
      alpha: 0.46,
      glow: 0.3,
      enforceOwnerBudget: false,
    });
  });
}

export function buildAdaptiveFractalTree(
  dimensions: Dimensions,
  seed: string,
  destinationIds: string[]
): FractalTree {
  const geometry = getFractalViewportGeometry(dimensions);
  const morphology = chooseFractalMorphology(dimensions, seed);
  const rng = seededRng(`adaptive-fractal-v3:${seed}:${dimensions.width}x${dimensions.height}:${morphology.id}`);
  const context = createBuildContext(geometry, morphology, rng, destinationIds);

  switch (morphology.id) {
    case 'tectonic':
      buildTectonic(context, destinationIds);
      break;
    case 'mycelial':
      buildMycelial(context, destinationIds);
      break;
    case 'halo':
      buildHalo(context, destinationIds);
      break;
    case 'pixel-ghost':
      buildPixelGhost(context, destinationIds);
      break;
    case 'echo-nest':
      buildEchoNest(context, destinationIds);
      break;
    case 'radial':
    case 'coral':
    case 'fan':
    case 'apical':
    case 'spiraloid':
    case 'aurora':
    case 'echidna':
      buildRootedMorphology(context, destinationIds);
      break;
  }

  return {
    ...geometry,
    morphology,
    theoreticalTerminalDimension:
      morphology.dimensionHint ?? theoreticalSelfSimilarDimension(2, morphology.terminalShrink),
    paths: context.paths,
    endpoints: context.endpoints,
  };
}

export function unitVectorFromCenter(point: Vec2, center: Vec2): Vec2 {
  return normalize({ x: point.x - center.x, y: point.y - center.y });
}
