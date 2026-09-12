import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('surface enhancer is gated by the same circular navigation authority as the responsive renderer', () => {
  const source = readRepoFile('components/neural-atlas-canvas/FractalSurfaceBoundaryV17.tsx');

  assert.match(source, /circular-navigation-clip-v17/);
  assert.match(source, /data-fractal-surface-enhancer=\\"v2\\"/);
  assert.match(source, /fractalDecorativeClipRadius/);
  assert.match(source, /fractalResponsiveViewport === expectedViewport/);
  assert.match(source, /coreAnchorX/);
  assert.match(source, /coreAnchorY/);
  assert.match(source, /canvas\.style\.clipPath = clip/);
  assert.match(source, /-webkit-clip-path/);
  assert.match(source, /opacity: 0 !important/);
  assert.match(source, /data-fractal-surface-boundary=\\"navigation-circle-v17\\"/);
});

test('surface boundary mounts after responsive geometry authority', () => {
  const stage = readRepoFile('components/neural-atlas-canvas/AdaptiveFractalStage.tsx');
  const responsiveIndex = stage.indexOf('<FractalResponsiveEnvelopeV16 />');
  const boundaryIndex = stage.indexOf('<FractalSurfaceBoundaryV17 />');

  assert.ok(responsiveIndex >= 0, 'responsive geometry authority is missing from stage');
  assert.ok(boundaryIndex >= 0, 'surface boundary is missing from stage');
  assert.ok(boundaryIndex > responsiveIndex, 'surface boundary must mount after responsive geometry authority');
});
