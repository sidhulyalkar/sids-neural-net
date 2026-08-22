import assert from 'node:assert/strict';
import test from 'node:test';
import { FrontierThroughputEstimator, chooseFrontierVideoVariant } from '../lib/frontier/media/abr';
import { FrontierMediaScheduler } from '../lib/frontier/media/scheduler';
import type { FrontierVideoVariant } from '../lib/frontier/types';

const variants: FrontierVideoVariant[] = [
  { id: '360', width: 640, height: 360, bitrate: 700_000, codec: 'avc1.4d401e', mimeType: 'video/mp4' },
  { id: '720', width: 1280, height: 720, bitrate: 2_400_000, codec: 'avc1.64001f', mimeType: 'video/mp4' },
  { id: '1080', width: 1920, height: 1080, bitrate: 5_200_000, codec: 'avc1.640028', mimeType: 'video/mp4' },
];

test('throughput estimator converges without trusting a single burst', () => {
  const estimator = new FrontierThroughputEstimator();
  estimator.sample(500_000, 1_000); // 4 Mbps
  assert.equal(Math.round(estimator.rawBandwidthBps()), 4_000_000);
  estimator.sample(1_000_000, 1_000); // 8 Mbps sample, EWMA should remain below it
  assert.ok(estimator.rawBandwidthBps() > 4_000_000);
  assert.ok(estimator.rawBandwidthBps() < 8_000_000);
  assert.ok(estimator.safeBandwidthBps() < estimator.rawBandwidthBps());
});

test('ABR drops aggressively when the forward buffer is shallow', () => {
  const chosen = chooseFrontierVideoVariant(variants, 4_000_000, 1440, '720', 1.5);
  assert.equal(chosen?.id, '360');
});

test('ABR requires headroom and healthy buffer before upgrading', () => {
  const shallow = chooseFrontierVideoVariant(variants, 8_000_000, 1920, '720', 5);
  assert.equal(shallow?.id, '720');
  const healthy = chooseFrontierVideoVariant(variants, 10_000_000, 1920, '720', 10);
  assert.equal(healthy?.id, '1080');
});

test('media scheduler bounds concurrency and prioritizes queued visible work', async () => {
  const scheduler = new FrontierMediaScheduler(1);
  const order: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

  scheduler.enqueue({ id: 'first', priority: 'near', run: async () => { order.push('first'); await firstGate; } });
  scheduler.enqueue({ id: 'background', priority: 'background', run: async () => { order.push('background'); } });
  scheduler.enqueue({ id: 'visible', priority: 'visible', run: async () => { order.push('visible'); } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order, ['first']);
  releaseFirst();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(order, ['first', 'visible', 'background']);
  assert.equal(scheduler.pendingCount(), 0);
});
