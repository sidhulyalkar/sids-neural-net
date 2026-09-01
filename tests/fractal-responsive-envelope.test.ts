import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdaptiveFractalTree,
  type Dimensions,
  type FractalMorphologyId,
  type FractalTree,
  type Vec2,
} from '../lib/home/fractalDendrite';
import {
  getResponsiveFractalEnvelope,
  hasViewportBoundaryFlattening,
  mapPathToResponsiveEnvelope,
  mapPointToResponsiveEnvelope,
  physicalViewportEdgeDistance,
} from '../lib/home/fractalResponsiveEnvelope';

const DESTINATION_IDS = [
  'frontier',
  'games',
  'builds',
  'systems',
  'contact',
  'visuals',
  'research',
  'papers',
];

const ACTIVE_MORPHOLOGIES: FractalMorphologyId[] = [
  'radial',
  'coral',
  'fan',
  'apical',
  'spiraloid',
  'echo-nest',
];

const VIEWPORTS: Dimensions[] = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 812, height: 375 },
  { width: 896, height: 414 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
  { width: 3440, height: 1440 },
];

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polylineLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function normalizedRadius(point: Vec2, tree: FractalTree): number {
  const nx = (point.x - tree.center.x) / Math.max(1, tree.radiusX);
  const ny = (point.y - tree.center.y) / Math.max(1, tree.radiusY);
  return Math.hypot(nx, ny);
}

test('responsive envelope scales smoothly and reserves more space on small or short displays', () => {
  const tiny = getResponsiveFractalEnvelope({ width: 320, height: 568 });
  const desktop = getResponsiveFractalEnvelope({ width: 1440, height: 900 });
  const ultrawide = getResponsiveFractalEnvelope({ width: 2560, height: 1080 });
  const short = getResponsiveFractalEnvelope({ width: 896, height: 414 });

  assert.ok(tiny.fieldScaleX < desktop.fieldScaleX);
  assert.ok(tiny.fieldScaleY < desktop.fieldScaleY);
  assert.ok(desktop.fieldScaleX <= ultrawide.fieldScaleX + 0.02);
  assert.ok(short.fieldScaleY < desktop.fieldScaleY);
  assert.equal(tiny.compactNavigation, true);
  assert.equal(short.compactNavigation, true);
  assert.equal(desktop.compactNavigation, false);

  for (const envelope of [tiny, desktop, ultrawide, short]) {
    assert.ok(envelope.fieldScaleX >= 0.8 && envelope.fieldScaleX <= 0.92);
    assert.ok(envelope.fieldScaleY >= 0.79 && envelope.fieldScaleY <= 0.91);
    assert.ok(envelope.radialExponent > 1 && envelope.radialExponent <= 1.12);
    assert.ok(envelope.normalizedRadiusCap < 1);
  }
});

test('all six public morphologies remain interior and never flatten against any viewport boundary', () => {
  for (const morphology of ACTIVE_MORPHOLOGIES) {
    for (const dimensions of VIEWPORTS) {
      const tree = buildAdaptiveFractalTree(
        dimensions,
        `force:${morphology}:responsive-matrix`,
        DESTINATION_IDS
      );
      const minimumExpectedEdgeDistance = Math.max(5, Math.min(18, tree.edgeMargin * 0.34));

      for (const path of tree.paths) {
        const mapped = mapPathToResponsiveEnvelope(path.points, tree, dimensions);
        assert.equal(
          hasViewportBoundaryFlattening(mapped, tree, dimensions, 2),
          false,
          `${morphology} ${dimensions.width}x${dimensions.height} retained a viewport-flat segment in ${path.id}`
        );

        for (const point of mapped) {
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `${path.id} mapped to non-finite geometry`);
          const edgeDistance = physicalViewportEdgeDistance(point, tree, dimensions);
          assert.ok(
            edgeDistance >= minimumExpectedEdgeDistance,
            `${morphology} ${dimensions.width}x${dimensions.height} ${path.id} approached the physical edge (${edgeDistance.toFixed(2)}px)`
          );
        }

        const originalLength = polylineLength(path.points);
        const mappedLength = polylineLength(mapped);
        if (originalLength > 8 && path.points.every((point) => normalizedRadius(point, tree) <= 0.9)) {
          assert.ok(
            mappedLength > originalLength * 0.5,
            `${morphology} ${dimensions.width}x${dimensions.height} collapsed interior branch ${path.id}`
          );
        }
        // Edge-reaching twigs are allowed to collapse below the renderer's branch-length
        // threshold. Their authored length can be an artifact of the old rectangular
        // clamp, and the final crisp topology pass intentionally prunes those orphans.
      }
    }
  }
});

test('navigation endpoints move modestly toward CORE while preserving all eight directions', () => {
  for (const morphology of ACTIVE_MORPHOLOGIES) {
    for (const dimensions of VIEWPORTS) {
      const tree = buildAdaptiveFractalTree(
        dimensions,
        `force:${morphology}:responsive-endpoints`,
        DESTINATION_IDS
      );
      const mappedAngles: number[] = [];

      for (const destinationId of DESTINATION_IDS) {
        const endpoint = tree.endpoints.get(destinationId);
        assert.ok(endpoint, `${morphology} missing ${destinationId}`);
        const mapped = mapPointToResponsiveEnvelope(endpoint, tree, dimensions);
        const originalRadius = distance(endpoint, tree.center);
        const mappedRadius = distance(mapped, tree.center);
        const ratio = mappedRadius / Math.max(1, originalRadius);

        assert.ok(
          ratio >= 0.72 && ratio <= 0.94,
          `${morphology} ${dimensions.width}x${dimensions.height} endpoint ratio ${ratio.toFixed(3)} is not a modest inward rescale`
        );
        mappedAngles.push(Math.atan2(mapped.y - tree.center.y, mapped.x - tree.center.x));
      }

      const uniqueDirections = new Set(mappedAngles.map((angle) => Math.round(angle * 1000)));
      assert.equal(uniqueDirections.size, 8, `${morphology} ${dimensions.width}x${dimensions.height} collapsed navigation directions`);
    }
  }
});

test('secondary branch roots are pulled closer to CORE than their authored locations', () => {
  for (const morphology of ['radial', 'coral', 'fan', 'apical', 'spiraloid'] as const) {
    const dimensions = { width: 1440, height: 900 };
    const tree = buildAdaptiveFractalTree(
      dimensions,
      `force:${morphology}:responsive-inner-compression`,
      DESTINATION_IDS
    );
    const branchRoots = tree.paths.filter((path) => path.depth > 0 && path.ownerId !== '__ambient__');
    assert.ok(branchRoots.length > 8, `${morphology} generated too few branch roots for the audit`);

    let compressed = 0;
    for (const path of branchRoots) {
      const root = path.points[0];
      const originalRadius = distance(root, tree.center);
      if (originalRadius < 24) continue;
      const mapped = mapPointToResponsiveEnvelope(root, tree, dimensions);
      if (distance(mapped, tree.center) < originalRadius * 0.94) compressed += 1;
    }

    assert.ok(
      compressed >= Math.floor(branchRoots.length * 0.7),
      `${morphology} did not move enough protrusion roots toward CORE (${compressed}/${branchRoots.length})`
    );
  }
});
