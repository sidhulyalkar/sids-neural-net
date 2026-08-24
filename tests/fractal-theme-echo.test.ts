import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  CURATED_FRACTAL_THEME_IDS,
  createFractalTheme,
  isCuratedFractalThemeId,
  parseFractalTheme,
  serializeFractalTheme,
  stripForcedMorphology,
} from '../lib/home/fractalTheme';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('theme echo only accepts the active homepage morphologies', () => {
  // Tectonic remains in the renderer compatibility union but is retired by the runtime guard.
  assert.equal(CURATED_FRACTAL_THEME_IDS.length, 10);
  assert.equal(isCuratedFractalThemeId('tectonic'), false);
  assert.equal(isCuratedFractalThemeId('echo-nest'), true);
  assert.equal(isCuratedFractalThemeId('aurora'), false);
  assert.equal(isCuratedFractalThemeId('mycelial'), false);
});

test('persisted themes strip force prefixes and reject removed morphologies', () => {
  assert.equal(stripForcedMorphology('force:tectonic:review-17'), 'review-17');
  const theme = createFractalTheme('coral', 'force:coral:organic-session', 1234);
  assert.deepEqual(parseFractalTheme(serializeFractalTheme(theme)), {
    version: 1,
    morphology: 'coral',
    seed: 'organic-session',
    savedAt: 1234,
  });
  for (const morphology of ['mycelial', 'aurora', 'tectonic']) {
    assert.equal(
      parseFractalTheme(JSON.stringify({ version: 1, morphology, seed: 'x', savedAt: 1234 })),
      null
    );
  }
});

test('homepage records its theme and subpages consume the echo consistently', () => {
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const header = readRepoFile('components/layout/Header.tsx');
  const comic = readRepoFile('components/neural-atlas/ComicSectionLayout.tsx');
  const pageShell = readRepoFile('components/portfolio/PageShell.tsx');
  const echo = readRepoFile('components/neural-atlas/FractalThemeEcho.tsx');

  assert.match(stage, /FractalThemeRecorder/);
  assert.match(header, /FractalThemeEcho variant="glyph"/);
  assert.match(comic, /ThemedNeuralBackground/);
  assert.match(pageShell, /ThemedNeuralBackground/);
  assert.match(echo, /data-fractal-theme-echo="background"/);
  assert.match(echo, /force:\$\{theme\.morphology\}/);
});

test('homepage relocates CORE into a quiet pocket and expands Echo Nest', () => {
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const experience = readRepoFile('components/neural-atlas-canvas/FractalExperienceV3.tsx');
  assert.match(stage, /FractalExperienceV3/);
  assert.match(experience, /placeCoreInQuietPocket/);
  assert.match(experience, /candidateDensity/);
  assert.match(experience, /dataset\.corePlacement = 'quiet-pocket-v1'/);
  assert.match(experience, /drawExpandedEchoNest/);
  assert.match(experience, /morphology === 'tectonic'/);
  assert.match(experience, /url\.searchParams\.set\('morph', 'echo-nest'\)/);
});

test('Echo Nest uses an oriented Fermat spiral instead of random polygon clouds', () => {
  const experience = readRepoFile('components/neural-atlas-canvas/FractalExperienceV3.tsx');

  assert.match(experience, /FERMAT_SPIRAL_STEP/);
  assert.match(experience, /FERMAT_SPIRAL_ARMS/);
  assert.match(experience, /fermatTangentAngle/);
  assert.match(experience, /buildFermatSpiralBand/);
  assert.match(experience, /drawFermatSpiralBand/);
  assert.match(experience, /rotation: tangent \+ shapeBias \+ rotationJitter/);
  assert.match(experience, /drawMatteHatch/);
  assert.match(experience, /shapeIntersectsProtected/);
  assert.match(experience, /dataset\.echoNestLayout = 'fermat-spiral-v1'/);
  assert.doesNotMatch(experience, /drawCellCloud/);
});

test('homepage v4 routes major connectors as angular protected signal paths', () => {
  const home = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalHome.tsx');

  assert.match(home, /buildProtectedPrimaryRoute/);
  assert.match(home, /connector-v4:/);
  assert.match(home, /routeCollisionScore/);
  assert.match(home, /data-primary-routing="angular-obstacle-v1"/);
  assert.match(home, /data-navigation-clearance="protected"/);
  assert.match(home, /RETIRED_MORPHOLOGIES/);
  assert.match(home, /'tectonic', 'aurora', 'mycelial'/);
  assert.match(home, /connectorTerminal/);
  assert.match(home, /segmentIntersectsRect/);
});

test('contact suppresses the redundant frontier shortcut while other comic pages retain it', () => {
  const comic = readRepoFile('components/neural-atlas/ComicSectionLayout.tsx');
  assert.match(comic, /pathname !== '\/contact'/);
  assert.match(comic, /showFrontierShortcut \? \(/);
  assert.match(comic, /href="\/frontier"/);
});