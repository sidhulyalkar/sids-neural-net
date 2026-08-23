import assert from 'node:assert/strict';
import test from 'node:test';
import { stepWaterfallParticle, waterfallOpacity } from '../lib/frontier/waterfallPhysics';

test('waterfall particles gain downward momentum under gravity', () => {
  const next = stepWaterfallParticle({
    x: 100,
    y: 100,
    vx: 20,
    vy: -80,
    rotation: 0,
    angularVelocity: 100,
    width: 10,
    height: 16,
  }, 1 / 60, { minX: 0, maxX: 800, floorY: 700 });

  assert.ok(next.vy > -80);
  assert.ok(next.x > 100);
  assert.ok(next.rotation > 0);
});

test('waterfall particles bounce without crossing the dock floor', () => {
  const floorY = 640;
  const next = stepWaterfallParticle({
    x: 120,
    y: 630,
    vx: 45,
    vy: 420,
    rotation: 12,
    angularVelocity: 80,
    width: 12,
    height: 18,
  }, 1 / 30, { minX: 0, maxX: 800, floorY });

  assert.equal(next.y, floorY - 18);
  assert.ok(next.vy <= 0);
  assert.ok(next.x >= 0 && next.x <= 788);
});

test('waterfall fade is full early and reaches zero at 1.5 seconds', () => {
  assert.equal(waterfallOpacity(0), 1);
  assert.equal(waterfallOpacity(500), 1);
  assert.ok(waterfallOpacity(1_200) > 0 && waterfallOpacity(1_200) < 1);
  assert.equal(waterfallOpacity(1_500), 0);
  assert.equal(waterfallOpacity(2_000), 0);
});
