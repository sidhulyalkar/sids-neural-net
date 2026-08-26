import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAdaptiveFractalTree,
  type Dimensions,
  type FractalMorphologyId,
  type FractalTree,
  type Vec2,
} from '../lib/home/fractalDendrite';
import { getResponsiveFractalEnvelope } from '../lib/home/fractalResponsiveEnvelope';
import {
  buildResponsiveDensityPaths,
  getResponsiveDensityProfile,
} from '../lib/home/fractalResponsiveDensity';

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

const ROOTED_MORPHOLOGIES: FractalMorphologyId[] = [
  'radial',
  'coral',
  'fan',
  'apical',
  'spiraloid',
];

function treeFor(morphology: FractalMorphologyId, dimensions: Dimensions, suffix: string): FractalTree {
  return buildAdaptiveFractalTree(dimensions, `force:${morphology}:${suffix}`, DESTINATION_IDS);
}

function normalizedDensityRadius(point: Vec2, tree: FractalTree, dimensions: Dimensions): number {
  const envelope = getResponsiveFractalEnvelope(dimensions);
  const radiusX = Math.max(1, tree.radiusX * envelope.fieldScaleX);
  const radiusY = Math.max(1, tree.radiusY * envelope.fieldScaleY);
  return Math.hypot((point.x - tree.center.x) / radiusX, (point.y - tree.center.y) / radiusY);
}

function angularSector(point: Vec2, center: Vec2): number {
  const angle = Math.atan2(point.y - center.y, point.x - center.x);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  return Math.floor((normalized / (Math.PI * 2)) * 8) % 8;
}

test('short landscape viewports trade stem length for more branch stations', () => {
  const desktop = getResponsiveDensityProfile({ width: 1440, height: 900 });
  const shortLandscape = getResponsiveDensityProfile({ width: 896, height: 414 });
  const phoneLandscape = getResponsiveDensityProfile({ width: 812, height: 375 });

  assert.ok(shortLandscape.stationCount > desktop.stationCount);
  assert.ok(phoneLandscape.stationCount >= shortLandscape.stationCount);
  assert.ok(shortLandscape.stationStart < desktop.stationStart);
  assert.ok(shortLandscape.maximumBranchLength < desktop.maximumBranchLength);
  assert.ok(phoneLandscape.maximumBranchLength <= shortLandscape.maximumBranchLength);
  assert.ok(shortLandscape.branchLengthFactor < desktop.branchLengthFactor);
  assert.ok(shortLandscape.pathBudget > desktop.pathBudget);
});

test('responsive canopy starts close to CORE and fills all angular regions without crowding the perimeter', () => {
  const viewports: Dimensions[] = [
    { width: 812, height: 375 },
    { width: 896, height: 414 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ];

  for (const morphology of ROOTED_MORPHOLOGIES) {
    for (const dimensions of viewports) {
      const tree = treeFor(morphology, dimensions, 'density-coverage');
      const profile = getResponsiveDensityProfile(dimensions);
      const paths = buildResponsiveDensityPaths(tree, dimensions, 'density-coverage');
      assert.ok(paths.length >= 80, `${morphology} ${dimensions.width}x${dimensions.height} produced too little interior canopy`);
      assert.ok(paths.length <= profile.pathBudget, `${morphology} exceeded the density path budget`);

      const depthOne = paths.filter((path) => path.depth === 1);
      const owners = new Set(depthOne.map((path) => path.ownerId));
      assert.equal(owners.size, 8, `${morphology} ${dimensions.width}x${dimensions.height} missed a navigation arm`);

      const nearCoreOwners = new Set(
        depthOne
          .filter((path) => normalizedDensityRadius(path.points[0], tree, dimensions) <= 0.24)
          .map((path) => path.ownerId)
      );
      assert.equal(
        nearCoreOwners.size,
        8,
        `${morphology} ${dimensions.width}x${dimensions.height} did not branch near CORE on every arm`
      );

      const sectors = new Set<number>();
      for (const path of paths) {
        for (const point of path.points) {
          const radius = normalizedDensityRadius(point, tree, dimensions);
          assert.ok(
            radius <= profile.safeNormalizedRadius + 1e-6,
            `${morphology} ${dimensions.width}x${dimensions.height} density escaped the interior envelope (${radius.toFixed(3)})`
          );
          if (radius >= 0.18 && radius <= profile.safeNormalizedRadius) {
            sectors.add(angularSector(point, tree.center));
          }
        }
      }
      assert.equal(sectors.size, 8, `${morphology} ${dimensions.width}x${dimensions.height} left an angular region empty`);
    }
  }
});

test('short landscapes create at least as much canopy with shorter segments than desktop', () => {
  for (const morphology of ROOTED_MORPHOLOGIES) {
    const desktopDimensions = { width: 1440, height: 900 };
    const shortDimensions = { width: 896, height: 414 };
    const desktopTree = treeFor(morphology, desktopDimensions, 'density-short-vs-desktop');
    const shortTree = treeFor(morphology, shortDimensions, 'density-short-vs-desktop');
    const desktop = buildResponsiveDensityPaths(desktopTree, desktopDimensions, 'density-short-vs-desktop');
    const short = buildResponsiveDensityPaths(shortTree, shortDimensions, 'density-short-vs-desktop');

    assert.ok(short.length >= desktop.length, `${morphology} lost canopy density in a short landscape`);

    const averageLength = (paths: ReturnType<typeof buildResponsiveDensityPaths>) =>
      paths.reduce((sum, path) => {
        const first = path.points[0];
        const last = path.points[path.points.length - 1];
        return sum + Math.hypot(last.x - first.x, last.y - first.y);
      }, 0) / Math.max(1, paths.length);

    assert.ok(
      averageLength(short) < averageLength(desktop),
      `${morphology} short-landscape stems were not actually shorter`
    );
  }
});

test('density canopy is deterministic and leaves Echo Nest morphology untouched', () => {
  const dimensions = { width: 1440, height: 900 };
  const radialTree = treeFor('radial', dimensions, 'density-determinism');
  const first = buildResponsiveDensityPaths(radialTree, dimensions, 'same-seed');
  const second = buildResponsiveDensityPaths(radialTree, dimensions, 'same-seed');
  assert.deepEqual(second, first);

  const echoTree = treeFor('echo-nest', dimensions, 'density-echo-native');
  assert.deepEqual(buildResponsiveDensityPaths(echoTree, dimensions, 'density-echo-native'), []);
});
