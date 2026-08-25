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

test('theme echo only accepts the six active homepage morphologies', () => {
  const active = CURATED_FRACTAL_THEME_IDS.filter((morphology) => isCuratedFractalThemeId(morphology));
  assert.deepEqual(active, ['radial', 'coral', 'fan', 'apical', 'spiraloid', 'echo-nest']);
  for (const morphology of ['tectonic', 'aurora', 'mycelial', 'halo', 'pixel-ghost', 'echidna']) {
    assert.equal(isCuratedFractalThemeId(morphology), false);
  }
  assert.equal(isCuratedFractalThemeId('echo-nest'), true);
});

test('persisted themes strip force prefixes and reject every retired morphology', () => {
  assert.equal(stripForcedMorphology('force:tectonic:review-17'), 'review-17');
  const theme = createFractalTheme('coral', 'force:coral:organic-session', 1234);
  assert.deepEqual(parseFractalTheme(serializeFractalTheme(theme)), {
    version: 1,
    morphology: 'coral',
    seed: 'organic-session',
    savedAt: 1234,
  });
  for (const morphology of ['mycelial', 'aurora', 'tectonic', 'halo', 'pixel-ghost', 'echidna']) {
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

test('public curation v14 removes weak variants, keeps destination interiors opaque, and uses minimal chrome', () => {
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const curation = readRepoFile('components/neural-atlas-canvas/FractalPublicCurationV14.tsx');

  assert.match(stage, /FractalPublicCurationV14/);
  assert.match(curation, /ACTIVE_PUBLIC_MORPHOLOGIES = \['radial', 'coral', 'fan', 'apical', 'spiraloid', 'echo-nest'\]/);
  assert.match(curation, /'halo'/);
  assert.match(curation, /'pixel-ghost'/);
  assert.match(curation, /'echidna'/);
  assert.match(curation, /curateLocationBeforeGeneration/);
  assert.match(curation, /window\.history\.replaceState/);
  assert.match(curation, /window\.location\.replace/);
  assert.match(curation, /background-color: #010406 !important/);
  assert.match(curation, /isolation: isolate/);
  assert.match(curation, /destinationClearance = 'opaque-card-v14'/);
  assert.match(curation, /destinationEdgeClearance = 'v14'/);
  assert.match(curation, /homeChrome = 'minimal-v15'/);
  assert.match(curation, /data-home-chrome="minimal-v15"/);
  assert.match(curation, /div\[aria-hidden="true"\]\.top-5/);
  assert.match(curation, /display: none !important/);
  assert.doesNotMatch(curation, /data-destination-clearance-mask/);
});

test('Echo Nest theme echoes reuse the Fermat orientation grammar', () => {
  const echo = readRepoFile('components/neural-atlas/FractalThemeEcho.tsx');
  assert.match(echo, /FERMAT_ECHO_STEP/);
  assert.match(echo, /fermatEchoTangent/);
  assert.match(echo, /renderEchoNestFermatEcho/);
  assert.match(echo, /theme\.morphology === 'echo-nest'/);
});

test('CORE is one fixed circular center control for every homepage morphology', () => {
  const home = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalHome.tsx');
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const experience = readRepoFile('components/neural-atlas-canvas/FractalExperienceV3.tsx');

  assert.match(home, /data-core-placement="fixed-center-circle-v1"/);
  assert.match(home, /data-core-shape="circle"/);
  assert.match(home, /data-core-anchor="tree-center"/);
  assert.match(home, /rounded-full/);
  assert.match(home, /coreDiameter = tree\?\.compact \? 46 : 54/);
  assert.match(home, /data-core-routing="fixed-center-circle-v1"/);
  assert.match(experience, /lockCoreToTreeCenter/);
  assert.match(experience, /getFractalViewportGeometry/);
  assert.doesNotMatch(experience, /candidateDensity/);
  assert.doesNotMatch(experience, /placeCoreInQuietPocket/);
  assert.doesNotMatch(stage, /FractalCoreNucleusV10/);
});

test('primary navigation preserves generated branch topology instead of rerouting trunks away from their children', () => {
  const home = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalHome.tsx');

  assert.match(home, /orientPrimaryFromCore/);
  assert.match(home, /buildTopologyPreservingPrimaryRoute/);
  assert.match(home, /data-primary-routing="topology-preserving-v2"/);
  assert.match(home, /buildProtectedTerminalTail/);
  assert.match(home, /return \[\.\.\.ordered, \.\.\.tail\.slice\(1\)\]/);
  assert.doesNotMatch(home, /connector-v4:/);
});

test('Echo Nest is centered on CORE and keeps tangent-oriented Fermat geometry', () => {
  const experience = readRepoFile('components/neural-atlas-canvas/FractalExperienceV3.tsx');

  assert.match(experience, /FERMAT_SPIRAL_STEP/);
  assert.match(experience, /FERMAT_SPIRAL_ARMS/);
  assert.match(experience, /fermatTangentAngle/);
  assert.match(experience, /buildFermatSpiralBand/);
  assert.match(experience, /drawFermatSpiralBand/);
  assert.match(experience, /rotation: tangent \+ shapeBias \+ rotationJitter/);
  assert.match(experience, /drawMatteHatch/);
  assert.match(experience, /shapeIntersectsProtected/);
  assert.match(experience, /const center = geometry\.center/);
  assert.match(experience, /dataset\.echoNestLayout = 'fermat-core-centered-v2'/);
});

test('contact suppresses the redundant frontier shortcut while other comic pages retain it', () => {
  const comic = readRepoFile('components/neural-atlas/ComicSectionLayout.tsx');
  assert.match(comic, /pathname !== '\/contact'/);
  assert.match(comic, /showFrontierShortcut \? \(/);
  assert.match(comic, /href="\/frontier"/);
});
