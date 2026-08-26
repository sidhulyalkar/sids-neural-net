import {
  clamp,
  type Dimensions,
  type FractalTree,
  type Vec2,
} from './fractalDendrite';

export type ResponsiveFractalEnvelope = {
  fieldScaleX: number;
  fieldScaleY: number;
  radialExponent: number;
  normalizedRadiusCap: number;
  labelGap: number;
  compactNavigation: boolean;
  tinyViewport: boolean;
  shortViewport: boolean;
};

export type ResponsiveLabelPosition = {
  x: number;
  y: number;
};

const MIN_WIDTH = 280;
const MIN_HEIGHT = 360;

function normalizedProgress(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

/**
 * Responsive envelope for the public homepage field.
 *
 * The original morphology engines intentionally generate generously and may
 * touch their rectangular safety bounds.  The public renderer then maps that
 * geometry through this smaller elliptical envelope.  Two things happen at
 * once: the navigation ring moves modestly closer to CORE, and any points that
 * were hard-clamped against a viewport edge are re-projected by angle instead
 * of being allowed to form a flat line along the browser boundary.
 */
export function getResponsiveFractalEnvelope(dimensions: Dimensions): ResponsiveFractalEnvelope {
  const width = Math.max(MIN_WIDTH, dimensions.width);
  const height = Math.max(MIN_HEIGHT, dimensions.height);
  const aspect = width / Math.max(1, height);
  const tinyViewport = width <= 360 || height <= 500;
  const shortViewport = height < 620;

  const widthProgress = normalizedProgress(width, 320, 1920);
  const heightProgress = normalizedProgress(height, 568, 1080);

  let fieldScaleX = 0.82 + widthProgress * 0.09;
  let fieldScaleY = 0.83 + heightProgress * 0.07;

  if (aspect > 1.85) fieldScaleX += 0.008;
  if (aspect < 0.78) fieldScaleY += 0.006;
  if (shortViewport) fieldScaleY -= 0.025;
  if (tinyViewport) {
    fieldScaleX -= 0.008;
    fieldScaleY -= 0.008;
  }

  fieldScaleX = clamp(fieldScaleX, 0.80, 0.92);
  fieldScaleY = clamp(fieldScaleY, 0.79, 0.91);

  return {
    fieldScaleX,
    fieldScaleY,
    radialExponent: tinyViewport ? 1.12 : shortViewport ? 1.1 : width < 760 ? 1.09 : 1.07,
    normalizedRadiusCap: tinyViewport ? 0.965 : shortViewport ? 0.975 : 0.985,
    labelGap: tinyViewport ? 10 : shortViewport ? 12 : width < 720 ? 13 : width < 1100 ? 16 : 19,
    compactNavigation: width < 720 || shortViewport,
    tinyViewport,
    shortViewport,
  };
}

/**
 * Map one authored/generated point into the responsive public envelope.
 *
 * A radial power slightly above 1 compresses the inner third more than the
 * outer ring, which makes secondary protrusions begin closer to CORE without
 * changing their angular topology.  Points outside the nominal ellipse are
 * capped radially, so rectangular clamping from the underlying generator can
 * never become a flat viewport-edge segment in the final renderer.
 */
export function mapPointToResponsiveEnvelope(
  point: Vec2,
  tree: FractalTree,
  dimensions: Dimensions
): Vec2 {
  const envelope = getResponsiveFractalEnvelope(dimensions);
  const radiusX = Math.max(1, tree.radiusX);
  const radiusY = Math.max(1, tree.radiusY);
  const nx = (point.x - tree.center.x) / radiusX;
  const ny = (point.y - tree.center.y) / radiusY;
  const normalizedRadius = Math.hypot(nx, ny);

  if (normalizedRadius < 1e-7) return { ...tree.center };

  const cappedRadius = Math.min(normalizedRadius, envelope.normalizedRadiusCap);
  const mappedRadius = Math.pow(cappedRadius, envelope.radialExponent);
  const radialScale = mappedRadius / normalizedRadius;

  return {
    x: tree.center.x + nx * radiusX * radialScale * envelope.fieldScaleX,
    y: tree.center.y + ny * radiusY * radialScale * envelope.fieldScaleY,
  };
}

export function mapPathToResponsiveEnvelope(
  points: readonly Vec2[],
  tree: FractalTree,
  dimensions: Dimensions
): Vec2[] {
  return points.map((point) => mapPointToResponsiveEnvelope(point, tree, dimensions));
}

export function estimateResponsiveLabelHalfWidth(label: string, compact: boolean): number {
  const glyphWidth = compact ? 5.35 : 6.55;
  const padding = compact ? 13 : 18;
  return Math.max(compact ? 28 : 36, label.length * glyphWidth * 0.5 + padding);
}

export function responsiveNavigationPosition(
  endpoint: Vec2,
  tree: FractalTree,
  dimensions: Dimensions,
  halfWidth: number,
  halfHeight = 15
): ResponsiveLabelPosition {
  const envelope = getResponsiveFractalEnvelope(dimensions);
  const mappedEndpoint = mapPointToResponsiveEnvelope(endpoint, tree, dimensions);
  const dx = mappedEndpoint.x - tree.center.x;
  const dy = mappedEndpoint.y - tree.center.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length;
  const uy = dy / length;
  const verticalBias = Math.abs(uy) > 0.72 ? (uy < 0 ? -2 : 2) : 0;
  const sidePadding = envelope.tinyViewport ? 6 : 9;
  const topPadding = envelope.tinyViewport ? 7 : 10;
  const bottomLimit = Math.min(dimensions.height - halfHeight - topPadding, tree.usableBottom - halfHeight - 5);

  return {
    x: clamp(
      mappedEndpoint.x + ux * envelope.labelGap,
      halfWidth + sidePadding,
      dimensions.width - halfWidth - sidePadding
    ),
    y: clamp(
      mappedEndpoint.y + uy * envelope.labelGap + verticalBias,
      halfHeight + topPadding,
      Math.max(halfHeight + topPadding, bottomLimit)
    ),
  };
}

export function physicalViewportEdgeDistance(
  point: Vec2,
  tree: FractalTree,
  dimensions: Dimensions
): number {
  const bottom = Math.min(dimensions.height, tree.usableBottom);
  return Math.min(point.x, dimensions.width - point.x, point.y, bottom - point.y);
}

export function hasViewportBoundaryFlattening(
  points: readonly Vec2[],
  tree: FractalTree,
  dimensions: Dimensions,
  tolerance = 2
): boolean {
  if (points.length < 2) return false;
  const bottom = Math.min(dimensions.height, tree.usableBottom);
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const sameLeft = a.x <= tolerance && b.x <= tolerance && Math.abs(a.y - b.y) > tolerance;
    const sameRight =
      dimensions.width - a.x <= tolerance &&
      dimensions.width - b.x <= tolerance &&
      Math.abs(a.y - b.y) > tolerance;
    const sameTop = a.y <= tolerance && b.y <= tolerance && Math.abs(a.x - b.x) > tolerance;
    const sameBottom =
      bottom - a.y <= tolerance &&
      bottom - b.y <= tolerance &&
      Math.abs(a.x - b.x) > tolerance;
    if (sameLeft || sameRight || sameTop || sameBottom) return true;
  }
  return false;
}
