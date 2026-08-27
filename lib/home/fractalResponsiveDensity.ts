import {
  clamp,
  seededRng,
  type Dimensions,
  type FractalMorphologyId,
  type FractalTree,
  type Vec2,
} from './fractalDendrite';
import { getResponsiveFractalEnvelope, mapPathToResponsiveEnvelope } from './fractalResponsiveEnvelope';

export type ResponsiveDensityProfile = {
  stationCount: number;
  stationStart: number;
  stationEnd: number;
  branchLengthFactor: number;
  minimumBranchLength: number;
  maximumBranchLength: number;
  terminalDecay: number;
  recursionDepth: number;
  safeNormalizedRadius: number;
  pathBudget: number;
  compact: boolean;
  shortWide: boolean;
};

export type ResponsiveDensityPath = {
  id: string;
  ownerId: string;
  depth: number;
  points: Vec2[];
};

export type ResponsiveDensityRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ResponsiveDensityObstacle = {
  id: string;
  labelRect: ResponsiveDensityRect;
  exclusionRect: ResponsiveDensityRect;
  center: Vec2;
  corridorStart: Vec2;
  corridorEnd: Vec2;
  corridorHalfWidth: number;
  repelDistance: number;
};

export type ResponsiveDensityObstacleOptions = {
  paddingX?: number;
  paddingY?: number;
  corridorLength?: number;
  corridorHalfWidth?: number;
  repelDistance?: number;
};

const DENSITY_MORPHOLOGIES = new Set<FractalMorphologyId>([
  'radial',
  'coral',
  'fan',
  'apical',
  'spiraloid',
]);

const GEOMETRY_EPSILON = 1e-6;
const CURVE_COLLISION_STEPS = 14;

function pointOnPath(points: readonly Vec2[], t: number): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  const scaled = clamp(t, 0, 1) * (points.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(points.length - 1, index + 1);
  const local = scaled - index;
  return {
    x: points[index].x + (points[nextIndex].x - points[index].x) * local,
    y: points[index].y + (points[nextIndex].y - points[index].y) * local,
  };
}

function pathAngle(points: readonly Vec2[], t: number): number {
  const a = pointOnPath(points, Math.max(0, t - 0.025));
  const b = pointOnPath(points, Math.min(1, t + 0.025));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.max(GEOMETRY_EPSILON, Math.hypot(vector.x, vector.y));
  return { x: vector.x / length, y: vector.y / length };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function pointInsideResponsiveDensityRect(point: Vec2, rect: ResponsiveDensityRect): boolean {
  return (
    point.x >= rect.left - GEOMETRY_EPSILON &&
    point.x <= rect.right + GEOMETRY_EPSILON &&
    point.y >= rect.top - GEOMETRY_EPSILON &&
    point.y <= rect.bottom + GEOMETRY_EPSILON
  );
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(a: Vec2, b: Vec2, point: Vec2): boolean {
  return (
    Math.abs(orientation(a, b, point)) <= GEOMETRY_EPSILON &&
    point.x >= Math.min(a.x, b.x) - GEOMETRY_EPSILON &&
    point.x <= Math.max(a.x, b.x) + GEOMETRY_EPSILON &&
    point.y >= Math.min(a.y, b.y) - GEOMETRY_EPSILON &&
    point.y <= Math.max(a.y, b.y) + GEOMETRY_EPSILON
  );
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  const crosses =
    ((o1 > GEOMETRY_EPSILON && o2 < -GEOMETRY_EPSILON) ||
      (o1 < -GEOMETRY_EPSILON && o2 > GEOMETRY_EPSILON)) &&
    ((o3 > GEOMETRY_EPSILON && o4 < -GEOMETRY_EPSILON) ||
      (o3 < -GEOMETRY_EPSILON && o4 > GEOMETRY_EPSILON));
  if (crosses) return true;

  return (
    (Math.abs(o1) <= GEOMETRY_EPSILON && pointOnSegment(a, b, c)) ||
    (Math.abs(o2) <= GEOMETRY_EPSILON && pointOnSegment(a, b, d)) ||
    (Math.abs(o3) <= GEOMETRY_EPSILON && pointOnSegment(c, d, a)) ||
    (Math.abs(o4) <= GEOMETRY_EPSILON && pointOnSegment(c, d, b))
  );
}

export function segmentIntersectsResponsiveDensityRect(
  a: Vec2,
  b: Vec2,
  rect: ResponsiveDensityRect
): boolean {
  if (pointInsideResponsiveDensityRect(a, rect) || pointInsideResponsiveDensityRect(b, rect)) return true;
  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };
  return (
    segmentsIntersect(a, b, topLeft, topRight) ||
    segmentsIntersect(a, b, topRight, bottomRight) ||
    segmentsIntersect(a, b, bottomRight, bottomLeft) ||
    segmentsIntersect(a, b, bottomLeft, topLeft)
  );
}

function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const denominator = ab.x * ab.x + ab.y * ab.y;
  if (denominator <= GEOMETRY_EPSILON) return distance(point, a);
  const projection = clamp(((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / denominator, 0, 1);
  return distance(point, { x: a.x + ab.x * projection, y: a.y + ab.y * projection });
}

function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distancePointToSegment(a, c, d),
    distancePointToSegment(b, c, d),
    distancePointToSegment(c, a, b),
    distancePointToSegment(d, a, b)
  );
}

export function pointInsideResponsiveDensityCorridor(
  point: Vec2,
  obstacle: ResponsiveDensityObstacle
): boolean {
  return distancePointToSegment(point, obstacle.corridorStart, obstacle.corridorEnd) <= obstacle.corridorHalfWidth;
}

function segmentIntersectsResponsiveDensityCorridor(
  a: Vec2,
  b: Vec2,
  obstacle: ResponsiveDensityObstacle
): boolean {
  return segmentDistance(a, b, obstacle.corridorStart, obstacle.corridorEnd) <= obstacle.corridorHalfWidth;
}

function quadraticPoint(start: Vec2, control: Vec2, end: Vec2, t: number): Vec2 {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
  };
}

/**
 * Sample the exact path grammar used by FractalInteriorDensityV17.drawPath.
 * Curved morphologies draw each interior point as a quadratic control point to
 * the midpoint between that control point and the next authored point, then
 * finish with a straight segment to the terminal point.
 */
export function sampleResponsiveDensityRenderedPath(points: readonly Vec2[]): Vec2[] {
  if (points.length <= 1) return points.map((point) => ({ ...point }));
  if (points.length === 2) return [{ ...points[0] }, { ...points[1] }];

  const sampled: Vec2[] = [{ ...points[0] }];
  let cursor = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const midpoint = { x: (control.x + next.x) * 0.5, y: (control.y + next.y) * 0.5 };
    for (let step = 1; step <= CURVE_COLLISION_STEPS; step += 1) {
      sampled.push(quadraticPoint(cursor, control, midpoint, step / CURVE_COLLISION_STEPS));
    }
    cursor = midpoint;
  }
  const terminal = points[points.length - 1];
  if (distance(cursor, terminal) > GEOMETRY_EPSILON) sampled.push({ ...terminal });
  return sampled;
}

export function responsiveDensityPathViolatesObstacle(
  points: readonly Vec2[],
  obstacle: ResponsiveDensityObstacle
): boolean {
  if (points.length === 0) return false;

  // Control points are protected explicitly as well as the rendered curve.
  if (
    points.some(
      (point) =>
        pointInsideResponsiveDensityRect(point, obstacle.exclusionRect) ||
        pointInsideResponsiveDensityCorridor(point, obstacle)
    )
  ) {
    return true;
  }

  const sampled = sampleResponsiveDensityRenderedPath(points);
  for (let index = 0; index < sampled.length; index += 1) {
    const point = sampled[index];
    if (
      pointInsideResponsiveDensityRect(point, obstacle.exclusionRect) ||
      pointInsideResponsiveDensityCorridor(point, obstacle)
    ) {
      return true;
    }
    if (index === 0) continue;
    const previous = sampled[index - 1];
    if (
      segmentIntersectsResponsiveDensityRect(previous, point, obstacle.exclusionRect) ||
      segmentIntersectsResponsiveDensityCorridor(previous, point, obstacle)
    ) {
      return true;
    }
  }
  return false;
}

export function buildResponsiveDensityObstacle(
  id: string,
  labelRect: ResponsiveDensityRect,
  core: Vec2,
  options: ResponsiveDensityObstacleOptions = {}
): ResponsiveDensityObstacle {
  const paddingX = options.paddingX ?? 20;
  const paddingY = options.paddingY ?? 15;
  const corridorLength = options.corridorLength ?? 88;
  const corridorHalfWidth = options.corridorHalfWidth ?? 20;
  const center = {
    x: (labelRect.left + labelRect.right) * 0.5,
    y: (labelRect.top + labelRect.bottom) * 0.5,
  };
  const exclusionRect = {
    left: labelRect.left - paddingX,
    top: labelRect.top - paddingY,
    right: labelRect.right + paddingX,
    bottom: labelRect.bottom + paddingY,
  };
  const inward = normalize({ x: core.x - center.x, y: core.y - center.y });
  const halfWidth = Math.max(1, (exclusionRect.right - exclusionRect.left) * 0.5);
  const halfHeight = Math.max(1, (exclusionRect.bottom - exclusionRect.top) * 0.5);
  const tx = Math.abs(inward.x) > GEOMETRY_EPSILON ? halfWidth / Math.abs(inward.x) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(inward.y) > GEOMETRY_EPSILON ? halfHeight / Math.abs(inward.y) : Number.POSITIVE_INFINITY;
  const edgeDistance = Math.min(tx, ty);
  const corridorStart = {
    x: center.x + inward.x * (edgeDistance + 1),
    y: center.y + inward.y * (edgeDistance + 1),
  };
  const corridorEnd = {
    x: corridorStart.x + inward.x * corridorLength,
    y: corridorStart.y + inward.y * corridorLength,
  };

  return {
    id,
    labelRect: { ...labelRect },
    exclusionRect,
    center,
    corridorStart,
    corridorEnd,
    corridorHalfWidth,
    repelDistance: options.repelDistance ?? corridorLength + Math.max(halfWidth, halfHeight) + 72,
  };
}

function branchPointsTowardObstacle(
  start: Vec2,
  angle: number,
  obstacle: ResponsiveDensityObstacle
): boolean {
  const toObstacle = { x: obstacle.center.x - start.x, y: obstacle.center.y - start.y };
  const obstacleDistance = Math.hypot(toObstacle.x, toObstacle.y);
  if (obstacleDistance > obstacle.repelDistance || obstacleDistance <= GEOMETRY_EPSILON) return false;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  return dot(direction, normalize(toObstacle)) > 0.14;
}

function boundedPoint(
  point: Vec2,
  tree: FractalTree,
  dimensions: Dimensions,
  safeNormalizedRadius: number
): Vec2 {
  const envelope = getResponsiveFractalEnvelope(dimensions);
  const effectiveRadiusX = Math.max(1, tree.radiusX * envelope.fieldScaleX);
  const effectiveRadiusY = Math.max(1, tree.radiusY * envelope.fieldScaleY);
  const nx = (point.x - tree.center.x) / effectiveRadiusX;
  const ny = (point.y - tree.center.y) / effectiveRadiusY;
  const radius = Math.hypot(nx, ny);
  if (radius <= safeNormalizedRadius) return point;
  const scale = safeNormalizedRadius / Math.max(radius, 1e-6);
  return {
    x: tree.center.x + nx * effectiveRadiusX * scale,
    y: tree.center.y + ny * effectiveRadiusY * scale,
  };
}

function branchPolyline(
  start: Vec2,
  end: Vec2,
  morphology: FractalMorphologyId,
  depth: number,
  rng: () => number,
  chirality: number
): Vec2[] {
  if (morphology === 'radial' || morphology === 'fan') return [start, end];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length, y: dx / length };
  const curvature =
    morphology === 'spiraloid'
      ? chirality * length * (0.055 + depth * 0.012)
      : morphology === 'coral'
        ? (rng() - 0.5) * length * 0.11
        : (rng() - 0.5) * length * 0.055;
  return [
    start,
    {
      x: start.x + dx * 0.52 + normal.x * curvature,
      y: start.y + dy * 0.52 + normal.y * curvature,
    },
    end,
  ];
}

export function getResponsiveDensityProfile(dimensions: Dimensions): ResponsiveDensityProfile {
  const width = Math.max(280, dimensions.width);
  const height = Math.max(320, dimensions.height);
  const aspect = width / Math.max(1, height);
  const compact = width < 720;
  const shortWide = height < 700 && aspect > 1.35;
  const veryShortWide = height < 520 && aspect > 1.7;
  const ultrawide = aspect > 2;

  let stationCount = compact ? 5 : 4;
  if (shortWide) stationCount += 2;
  if (veryShortWide || ultrawide) stationCount += 1;

  return {
    stationCount: clamp(stationCount, 4, 8),
    stationStart: veryShortWide ? 0.1 : shortWide ? 0.115 : compact ? 0.13 : 0.145,
    stationEnd: shortWide ? 0.74 : compact ? 0.72 : 0.76,
    branchLengthFactor: veryShortWide ? 0.092 : shortWide ? 0.105 : compact ? 0.112 : 0.132,
    minimumBranchLength: veryShortWide ? 16 : compact ? 18 : 22,
    maximumBranchLength: veryShortWide ? 54 : shortWide ? 68 : compact ? 58 : 92,
    terminalDecay: shortWide ? 0.57 : 0.6,
    recursionDepth: 2,
    safeNormalizedRadius: shortWide ? 0.79 : compact ? 0.78 : 0.82,
    pathBudget: shortWide ? 360 : compact ? 300 : 280,
    compact,
    shortWide,
  };
}

/**
 * Build a deterministic, interior-only canopy over the public navigation trunks.
 *
 * V16 solved clipping by projecting the authored geometry into a safe ellipse,
 * but it could not change the authored topology. On short/wide displays the old
 * generator derives every side branch from the viewport's shortest axis, which
 * leaves long bare primary spokes and tiny clusters near the perimeter. V17
 * keeps the navigation trunks authoritative and adds short branch stations much
 * closer to CORE. Constrained displays receive more stations with shorter stems,
 * so density rises while individual segments get cheaper to render.
 *
 * Destination obstacles are optional and apply only to this secondary canopy.
 * Primary navigation trunks remain authoritative. Every V17 path is rejected if
 * its rendered curve, authored control points, or root enters a padded label
 * exclusion rectangle or the label's inward docking corridor. Directional
 * repulsion applies only to the branch owner's own destination so unrelated
 * labels cannot erase entire canopy arms. Hard geometry collision rejection
 * still applies against every destination obstacle.
 *
 * Stations are emitted breadth-first across all eight navigation arms. If a
 * future profile reaches the global path budget, outer detail is what gets
 * dropped rather than the final navigation directions losing their canopy.
 */
export function buildResponsiveDensityPaths(
  tree: FractalTree,
  dimensions: Dimensions,
  seed: string,
  obstacles: readonly ResponsiveDensityObstacle[] = []
): ResponsiveDensityPath[] {
  if (!DENSITY_MORPHOLOGIES.has(tree.morphology.id)) return [];

  const profile = getResponsiveDensityProfile(dimensions);
  const rng = seededRng(`responsive-density-v17:${seed}:${tree.morphology.id}:${dimensions.width}x${dimensions.height}`);
  const chirality = rng() < 0.5 ? -1 : 1;
  const effectiveScale = Math.sqrt(Math.max(1, tree.radiusX * tree.radiusY));
  const splitBase = clamp(tree.morphology.splitAngle, 0.34, 0.64);
  const primaries = tree.paths
    .filter((path) => path.depth === 0 && path.renderMode === 'stroke' && path.ownerId !== '__ambient__')
    .map((path) => ({
      path,
      mapped: mapPathToResponsiveEnvelope(path.points, tree, dimensions),
    }))
    .filter((entry) => entry.mapped.length >= 2);
  const paths: ResponsiveDensityPath[] = [];

  const grow = (
    ownerId: string,
    start: Vec2,
    angle: number,
    length: number,
    depth: number,
    key: string
  ) => {
    if (depth > profile.recursionDepth || paths.length >= profile.pathBudget || length < 8) return;
    if (
      obstacles.some(
        (obstacle) =>
          pointInsideResponsiveDensityRect(start, obstacle.exclusionRect) ||
          pointInsideResponsiveDensityCorridor(start, obstacle)
      )
    ) {
      return;
    }

    const angleNoise = (rng() - 0.5) * tree.morphology.angularNoise * 0.7;
    const adjustedAngle = angle + angleNoise + (tree.morphology.id === 'spiraloid' ? chirality * depth * 0.075 : 0);
    const ownerObstacle = obstacles.find((obstacle) => obstacle.id === ownerId);
    if (ownerObstacle && branchPointsTowardObstacle(start, adjustedAngle, ownerObstacle)) return;

    const candidate = {
      x: start.x + Math.cos(adjustedAngle) * length,
      y: start.y + Math.sin(adjustedAngle) * length,
    };
    const end = boundedPoint(candidate, tree, dimensions, profile.safeNormalizedRadius);
    const travelled = Math.hypot(end.x - start.x, end.y - start.y);
    if (travelled < Math.max(6, length * 0.42)) return;

    const polyline = branchPolyline(start, end, tree.morphology.id, depth, rng, chirality).map((point) =>
      boundedPoint(point, tree, dimensions, profile.safeNormalizedRadius)
    );
    if (obstacles.some((obstacle) => responsiveDensityPathViolatesObstacle(polyline, obstacle))) return;

    paths.push({
      id: `density-${ownerId}-${key}-${depth}-${paths.length}`,
      ownerId,
      depth,
      points: polyline,
    });

    if (depth >= profile.recursionDepth || paths.length >= profile.pathBudget) return;
    const nextLength = length * profile.terminalDecay * (0.9 + rng() * 0.14);
    const split = splitBase * (0.68 + rng() * 0.16);
    grow(ownerId, end, adjustedAngle - split, nextLength, depth + 1, `${key}l`);
    grow(ownerId, end, adjustedAngle + split, nextLength, depth + 1, `${key}r`);
  };

  for (let station = 0; station < profile.stationCount; station += 1) {
    const progress = profile.stationCount === 1 ? 0.5 : station / (profile.stationCount - 1);
    const t = profile.stationStart + (profile.stationEnd - profile.stationStart) * progress;

    for (const { path: primary, mapped } of primaries) {
      if (paths.length >= profile.pathBudget) break;
      const start = pointOnPath(mapped, t);
      const tangent = pathAngle(mapped, t);
      const stationLength = clamp(
        effectiveScale * profile.branchLengthFactor * (1.08 - t * 0.24) * (0.88 + rng() * 0.22),
        profile.minimumBranchLength,
        profile.maximumBranchLength
      );

      for (const side of [-1, 1] as const) {
        if (paths.length >= profile.pathBudget) break;
        const perpendicularBias = tree.morphology.id === 'apical' ? 0.76 : tree.morphology.id === 'fan' ? 0.66 : 0.72;
        const initialAngle = tangent + side * splitBase * perpendicularBias + (rng() - 0.5) * 0.1;
        grow(primary.ownerId, start, initialAngle, stationLength, 1, `s${station}${side < 0 ? 'l' : 'r'}`);
      }
    }

    if (paths.length >= profile.pathBudget) break;
  }

  return paths;
}
