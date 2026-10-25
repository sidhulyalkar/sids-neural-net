import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const constellationSource = readFileSync(new URL('../components/frontier/InterestConstellation.tsx', import.meta.url), 'utf8');
const mediaSource = readFileSync(new URL('../components/frontier/media/FrontierMediaSurface.tsx', import.meta.url), 'utf8');
const richMediaSource = readFileSync(new URL('../components/frontier/media/RichFrontierMediaSurface.tsx', import.meta.url), 'utf8');

test('secondary map graphics are separate client chunks', () => {
  assert.match(constellationSource, /dynamic\(/);
  assert.match(constellationSource, /import\('\.\/FrontierLatentCanvas'\)/);
  assert.match(constellationSource, /import\('\.\/FrontierMeasurementHealth'\)/);
  assert.match(constellationSource, /ssr: false/);
  assert.doesNotMatch(constellationSource, /import \{ FrontierLatentCanvas \}/);
  assert.doesNotMatch(constellationSource, /import \{ FrontierMeasurementHealth \}/);
});

test('feed graphics stay native while lead media can opt into eager high priority', () => {
  assert.match(mediaSource, /loading=\{priority === 'primary' \? 'eager' : 'lazy'\}/);
  assert.match(mediaSource, /fetchPriority=\{priority === 'primary' \? 'high' : 'low'\}/);
  assert.match(mediaSource, /decoding="async"/);
  assert.doesNotMatch(mediaSource, /GpuImageSurface|AdaptiveVideoSurface|useMediaVisibility|<iframe/);
  assert.match(richMediaSource, /GpuImageSurface/);
  assert.match(richMediaSource, /AdaptiveVideoSurface/);
});
