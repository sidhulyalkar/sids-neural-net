import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FrontierBloomFilter,
  canonicalizeFrontierUrl,
  frontierSeenSignatures,
} from '../lib/frontier/live/seenLedger';
import {
  runFrontierDaemonLeadership,
  type FrontierLockManagerLike,
} from '../lib/frontier/live/leaderElection';
import {
  frontierRepetitionPenalty,
  frontierSemanticDistance64,
  scoreFrontierAntiStaleness,
} from '../lib/frontier/vector/antiStalenessReranker';
import { normalizeVector } from '../lib/frontier/vector/math';
import { projectEmbeddingToSequence } from '../lib/frontier/vector/sequenceModel';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `A sufficiently descriptive frontier item ${id}`,
    summary: 'A concise summary for deterministic ranking coverage.',
    url: `https://example.com/${id}`,
    source: 'test',
    sourceLabel: 'Test',
    sourceKind: 'local',
    publishedAt: new Date('2026-08-22T12:00:00Z').toISOString(),
    lane: 'wildcards',
    tags: ['frontier', 'systems'],
    authors: ['Ada Example'],
    baseScore: 0.5,
    importance: 0.7,
    novelty: 0.7,
    quality: 0.9,
    momentum: 0.5,
    ...overrides,
  };
}

function basis(index: number, dimensions = 384): Float32Array {
  const vector = new Float32Array(dimensions);
  vector[index] = 1;
  return vector;
}

test('Bloom filter has no false negatives and a bounded deterministic collision rate', () => {
  const bloom = new FrontierBloomFilter();
  const inserted = Array.from({ length: 4_000 }, (_, index) => `seen:${index}:alpha`);
  inserted.forEach((value) => bloom.add(value));
  for (const value of inserted) assert.equal(bloom.mightContain(value), true);

  let falsePositives = 0;
  const heldOut = Array.from({ length: 4_000 }, (_, index) => `unseen:${index}:omega`);
  for (const value of heldOut) if (bloom.mightContain(value)) falsePositives += 1;
  assert.ok(falsePositives / heldOut.length < 0.01, `false-positive rate was ${falsePositives / heldOut.length}`);
});

test('canonical URL signatures collapse common tracking variants', () => {
  const left = item('tracking-a', { url: 'https://www.example.com/story/?utm_source=x&b=2&a=1#comments' });
  const right = item('tracking-b', { url: 'https://example.com/story?a=1&b=2' });
  assert.equal(canonicalizeFrontierUrl(left.url), canonicalizeFrontierUrl(right.url));
  assert.equal(frontierSeenSignatures(left)[0], frontierSeenSignatures(right)[0]);
});

class SerialFakeLockManager implements FrontierLockManagerLike {
  private tail = Promise.resolve();

  request(
    _name: string,
    _options: { mode: 'exclusive'; signal?: AbortSignal },
    callback: (lock: unknown) => Promise<void> | void
  ): Promise<void> {
    const run = this.tail.then(() => callback({ name: 'frontier_live_daemon' }));
    this.tail = run.catch(() => undefined);
    return run;
  }
}

test('exclusive daemon leadership hands off after the current leader releases', async () => {
  const manager = new SerialFakeLockManager();
  const firstController = new AbortController();
  const secondController = new AbortController();
  const events: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = runFrontierDaemonLeadership(manager, firstController.signal, async () => {
    events.push('first-enter');
    await firstGate;
    events.push('first-exit');
  });
  const second = runFrontierDaemonLeadership(manager, secondController.signal, async () => {
    events.push('second-enter');
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['first-enter']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first-enter', 'first-exit', 'second-enter']);
});

test('repetition penalty grows logarithmically for visible domains, authors, and topic clusters', () => {
  const candidate = item('candidate', {
    url: 'https://repeat.example/research',
    authors: ['Same Author'],
    tags: ['transformers', 'interpretability'],
  });
  const repeated = Array.from({ length: 4 }, (_, index) => item(`visible-${index}`, {
    url: `https://repeat.example/${index}`,
    authors: ['Same Author'],
    tags: ['transformers', 'interpretability'],
  }));
  const novel = item('novel', {
    url: 'https://novel.example/research',
    authors: ['Different Author'],
    tags: ['oceanography', 'robotics'],
  });
  assert.ok(frontierRepetitionPenalty(candidate, repeated) > frontierRepetitionPenalty(novel, repeated));
});

test('high exploration temperature can promote credible semantic distance over a stale context', () => {
  const nearVector = normalizeVector(basis(0));
  const farVector = normalizeVector(basis(41));
  const context = projectEmbeddingToSequence(nearVector);
  assert.ok(frontierSemanticDistance64(farVector, context) > frontierSemanticDistance64(nearVector, context));

  const near = item('near', { url: 'https://repeat.example/near', quality: 0.95, baseScore: 0.8 });
  const far = item('far', {
    url: 'https://novel.example/far',
    authors: ['New Author'],
    tags: ['unfamiliar', 'concept'],
    quality: 0.95,
    baseScore: 0.4,
  });
  const vectors = new Map<string, Float32Array>([
    [near.id, nearVector],
    [far.id, farVector],
  ]);
  const visible = Array.from({ length: 4 }, (_, index) => item(`stale-${index}`, {
    url: `https://repeat.example/${index}`,
  }));
  const scored = scoreFrontierAntiStaleness(
    [near, far],
    vectors,
    nearVector,
    context,
    '',
    visible,
    0.9,
    new Date('2026-08-22T12:30:00Z').getTime()
  ).sort((left, right) => right.finalScore - left.finalScore);
  assert.equal(scored[0]?.item.id, 'far');
  assert.ok((scored.find((entry) => entry.item.id === 'near')?.repetitionPenalty ?? 0) > 0);
});
