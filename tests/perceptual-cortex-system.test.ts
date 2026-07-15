import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretArtwork } from '../components/perceptual-cortex/artwork';
import { createInputSnapshot, advanceWorld } from '../components/perceptual-cortex/fusionEngine';
import { adaptQuality, initialQuality } from '../components/perceptual-cortex/quality';
import { ReplayRecorder } from '../components/perceptual-cortex/replay';
import { createWorldState } from '../components/perceptual-cortex/signalTypes';
import { applySyntheticPreset } from '../components/perceptual-cortex/syntheticPresets';
import { deriveFaceFeatures, deriveHandFeatures, type Landmark } from '../components/perceptual-cortex/visionFeatures';

const hand = (offset: number): Landmark[] => Array.from({ length: 21 }, (_, index) => ({ x: offset + index * .004, y: .5 - index * .006, z: 0 }));

test('artwork title and interpretation are deterministic for a seed and world state', () => {
  const world = createWorldState(); world.bilateralStrength = .8; world.activeModalities = ['hand', 'pointer'];
  assert.deepEqual(interpretArtwork(1842, world), interpretArtwork(1842, world));
  assert.equal(interpretArtwork(1842, world).dominantInfluence, 'bilateral hand motion');
});

test('replay records normalized world features at no more than about 13 Hz', () => {
  const recorder = new ReplayRecorder(); const world = createWorldState();
  for (let time = 0; time < 1000; time += 10) recorder.capture(time, world);
  const frames = recorder.snapshot(); assert.ok(frames.length >= 12 && frames.length <= 13); assert.equal('pointerX' in frames[0].world, false);
});

test('quality starts low on mobile and degrades one tier at a time', () => {
  assert.equal(initialQuality(390, 8), 'low'); assert.equal(adaptQuality('high', 31), 'balanced'); assert.equal(adaptQuality('balanced', 31), 'low');
});

test('two hands produce separation, symmetry, and bilateral fusion', () => {
  const first = hand(.22); const second = hand(.68); const features = deriveHandFeatures([first, second], [hand(.2)[0], hand(.7)[0]], .1);
  assert.equal(features.count, 2); assert.ok(features.separation > .5); assert.ok(features.symmetry >= 0 && features.symmetry <= 1);
  const input = createInputSnapshot(); input.hands = { ...features, speed: .8, symmetry: .9 }; const world = createWorldState(); advanceWorld(world, input, 500, .2); assert.ok(world.bilateralStrength > 0);
});

test('face features expose continuous activity and bounded stillness without labels', () => {
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, .1, -.1, 1, 0, 0, 0, 0, 1]; const result = deriveFaceFeatures(matrix, [.2, .4, .1], .15);
  assert.equal(result.active, true); assert.ok(result.activity > 0); assert.ok(result.stillness >= 0 && result.stillness <= 1); assert.equal('emotion' in result, false);
});

test('synthetic bilateral preset drives stable visual-regression controls', () => {
  const a = createInputSnapshot(); const b = createInputSnapshot(); applySyntheticPreset(a, 'bilateral-bloom', 1200); applySyntheticPreset(b, 'bilateral-bloom', 1200); assert.deepEqual(a.hands, b.hands);
});
