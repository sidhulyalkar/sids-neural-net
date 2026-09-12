import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('every decorative canvas is gated by the same circular navigation authority', () => {
  const source = readRepoFile('components/neural-atlas-canvas/FractalSurfaceBoundaryV17.tsx');

  assert.ok(source.includes('circular-navigation-clip-v17'));
  assert.ok(source.includes('[data-fractal-surface-enhancer="v2"]'));
  assert.ok(source.includes('[data-fractal-experience="v3"]'));
  assert.ok(source.includes('fractalDecorativeClipRadius'));
  assert.ok(source.includes('fractalResponsiveViewport === expectedViewport'));
  assert.ok(source.includes('coreAnchorX'));
  assert.ok(source.includes('coreAnchorY'));
  assert.ok(source.includes('canvas.style.clipPath = clip'));
  assert.ok(source.includes("-webkit-clip-path"));
  assert.ok(source.includes('fractalDecorativeBoundary'));
  assert.ok(source.includes('opacity: 0 !important'));
  assert.ok(source.includes('[data-fractal-decorative-boundary="navigation-circle-v17"]'));
});

test('surface boundary mounts after responsive geometry authority', () => {
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const responsiveIndex = stage.indexOf('<FractalResponsiveEnvelopeV16 />');
  const boundaryIndex = stage.indexOf('<FractalSurfaceBoundaryV17 />');

  assert.ok(responsiveIndex >= 0, 'responsive geometry authority is missing from stage');
  assert.ok(boundaryIndex >= 0, 'decorative boundary is missing from stage');
  assert.ok(boundaryIndex > responsiveIndex, 'decorative boundary must mount after responsive geometry authority');
});

test('echo-nest experience remains decorative and cannot bypass the v17 boundary', () => {
  const experience = readRepoFile('components/neural-atlas-canvas/FractalExperienceV3.tsx');
  const boundary = readRepoFile('components/neural-atlas-canvas/FractalSurfaceBoundaryV17.tsx');

  assert.ok(experience.includes('data-fractal-experience="v3"'));
  assert.ok(experience.includes("morphology === 'echo-nest'"));
  assert.ok(experience.includes('drawExpandedEchoNest'));
  assert.ok(boundary.includes('[data-fractal-experience="v3"]'));
  assert.ok(boundary.includes('DECORATIVE_CANVAS_SELECTOR'));
});
