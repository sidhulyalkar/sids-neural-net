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
  mapPointToResponsiveEnvelope,
} from '../lib/home/fractalResponsiveEnvelope';
import {
  buildResponsiveDensityObstacle,
  buildResponsiveDensityPaths,
  getResponsiveDensityProfile,
  responsiveDensityPathViolatesObstacle,
  type ResponsiveDensityObstacle,
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

const DESTINATION_LABELS: Record<string, string> = {
  frontier: 'FRONTIER',
  games: 'GAME NETWORK',
  builds: 'BUILDS',
  systems: 'DEPLOYED SYSTEMS',
  contact: 'CONTACT',
  visuals: 'VISUAL CORTEX',
  research: 'RESEARCH',
  papers: 'PAPER ARCHIVE',
};

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

function syntheticDestinationObstacles(tree: FractalTree, dimensions: Dimensions): ResponsiveDensityObstacle[] {
  const envelope = getResponsiveFractalEnvelope(dimensions);
  const compact = dimensions.width < 720;
  const shortWide = dimensions.height < 700 && dimensions.width / Math.max(1, dimensions.height) > 1.35;

  return DESTINATION_IDS.flatMap((id) => {
    const endpoint = tree.endpoints.get(id);
    if (!endpoint) return [];
    const mapped = mapPointToResponsiveEnvelope(endpoint, tree, dimensions);
    const dx = mapped.x - tree.center.x;
    const dy = mapped.y - tree.center.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const direction = { x: dx / length, y: dy / length };
    const label = DESTINATION_LABELS[id] ?? id;
    const halfWidth = Math.max(compact ? 30 : 38, label.length * (compact ? 2.9 : 3.4) + (compact ? 13 : 18));
    const halfHeight = compact ? 14 : 17;
    const position = {
      x: mapped.x + direction.x * (envelope.labelGap + 12),
      y: mapped.y + direction.y * (envelope.labelGap + 12),
    };
    const priority = id === 'frontier' || id === 'research' || id === 'visuals';
    const corridorLength = priority ? (shortWide ? 76 : compact ? 82 : 108) : shortWide ? 64 : compact ? 72 : 90;

    return [
      buildResponsiveDensityObstacle(
        id,
        {
          left: position.x - halfWidth,
          top: position.y - halfHeight,
          right: position.x + halfWidth,
          bottom: position.y + halfHeight,
        },
        tree.center,
        {
          paddingX: priority ? (compact ? 20 : 28) : compact ? 16 : 22,
          paddingY: priority ? (shortWide ? 13 : 18) : shortWide ? 11 : 15,
          corridorLength,
          corridorHalfWidth: priority ? (compact ? 18 : 24) : compact ? 15 : 20,
          repelDistance: corridorLength + (priority ? 138 : 112),
        }
      ),
    ];
  });
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

test('destination obstacles reject straight, curved-control, and docking-corridor collisions', () => {
  const obstacle = buildResponsiveDensityObstacle(
    'frontier',
    { left: 130, top: 80, right: 190, bottom: 112 },
    { x: 0, y: 96 },
    { paddingX: 18, paddingY: 14, corridorLength: 82, corridorHalfWidth: 18 }
  );

  assert.equal(
    responsiveDensityPathViolatesObstacle(
      [
        { x: 80, y: 96 },
        { x: 220, y: 96 },
      ],
      obstacle
    ),
    true,
    'straight branch crossing a destination box was accepted'
  );
  assert.equal(
    responsiveDensityPathViolatesObstacle(
      [
        { x: 60, y: 40 },
        { x: 160, y: 96 },
        { x: 240, y: 40 },
      ],
      obstacle
    ),
    true,
    'curved branch with a protected control point was accepted'
  );
  assert.equal(
    responsiveDensityPathViolatesObstacle(
      [
        { x: 50, y: 96 },
        { x: 105, y: 96 },
      ],
      obstacle
    ),
    true,
    'branch occupying the quiet docking corridor was accepted'
  );
  assert.equal(
    responsiveDensityPathViolatesObstacle(
      [
        { x: 40, y: 20 },
        { x: 80, y: 20 },
      ],
      obstacle
    ),
    false,
    'safe branch away from the destination was rejected'
  );
});

test('generated V17 canopy never enters destination halos or quiet docking corridors', () => {
  const fixtures: Array<{ morphology: FractalMorphologyId; dimensions: Dimensions }> = [
    { morphology: 'radial', dimensions: { width: 1440, height: 900 } },
    { morphology: 'coral', dimensions: { width: 896, height: 414 } },
    { morphology: 'spiraloid', dimensions: { width: 1440, height: 900 } },
  ];

  for (const fixture of fixtures) {
    const tree = treeFor(fixture.morphology, fixture.dimensions, 'destination-clearance');
    const obstacles = syntheticDestinationObstacles(tree, fixture.dimensions);
    assert.equal(obstacles.length, 8, `${fixture.morphology} did not create all destination obstacles`);
    const paths = buildResponsiveDensityPaths(tree, fixture.dimensions, 'destination-clearance', obstacles);
    assert.ok(
      paths.length >= 24,
      `${fixture.morphology} retained only ${paths.length} paths under deliberately oversized synthetic obstacles`
    );

    for (const path of paths) {
      for (const obstacle of obstacles) {
        assert.equal(
          responsiveDensityPathViolatesObstacle(path.points, obstacle),
          false,
          `${fixture.morphology} ${path.id} entered ${obstacle.id} clearance geometry`
        );
      }
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
  const obstacles = syntheticDestinationObstacles(radialTree, dimensions);
  const first = buildResponsiveDensityPaths(radialTree, dimensions, 'same-seed', obstacles);
  const second = buildResponsiveDensityPaths(radialTree, dimensions, 'same-seed', obstacles);
  assert.deepEqual(second, first);

  const echoTree = treeFor('echo-nest', dimensions, 'density-echo-native');
  assert.deepEqual(buildResponsiveDensityPaths(echoTree, dimensions, 'density-echo-native', obstacles), []);
});
