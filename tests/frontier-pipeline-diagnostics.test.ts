import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichFrontierSemantics,
  prepareFrontierCandidatePool,
} from '../lib/frontier/aggregate';
import {
  buildFrontierPipelineDiagnostics,
  frontierObservedDrop,
} from '../lib/frontier/pipelineDiagnostics';
import { getFrontierColdSnapshotFeed } from '../lib/frontier/snapshotFeed';
import { vetFrontierItems } from '../lib/frontier/sourceTrust';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    url: `https://github.com/frontier-test/${id}`,
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-30T18:00:00.000Z',
    lane: 'builder_signal',
    tags: ['open source'],
    baseScore: 0.7,
    importance: 0.6,
    novelty: 0.7,
    quality: 0.8,
    momentum: 0.5,
    ...overrides,
  };
}

test('unknown pipeline causality remains unknown instead of becoming zero', () => {
  const diagnostics = buildFrontierPipelineDiagnostics({
    mode: 'snapshot',
    sourceAcquisition: 'offline-unavailable',
    stages: {
      sourceAcquired: null,
      candidateInput: 100,
      plausible: 95,
      rightsSafe: 93,
      recent: 80,
      deduped: 75,
      sourceAdmitted: 70,
      candidateRetained: 70,
      englishReady: 68,
      responseReady: 68,
    },
  });

  assert.equal(diagnostics.stages.sourceAcquired, null);
  assert.equal(diagnostics.adapters.attempted, null);
  assert.equal(diagnostics.coverage.sourceAcquisition, 'offline-unavailable');
  assert.equal(diagnostics.coverage.learnedPersonalFitBeforeResponse, 'unobservable-local-profile');
  assert.equal(frontierObservedDrop(null, 12), null);
  assert.equal(diagnostics.drops.stale, null);
  assert.equal(diagnostics.drops.nonEnglish, null);
});

test('snapshot callers can record exact drops without claiming a universal stage order', () => {
  const diagnostics = buildFrontierPipelineDiagnostics({
    mode: 'snapshot',
    sourceAcquisition: 'offline-unavailable',
    stages: {
      sourceAcquired: null,
      candidateInput: 100,
      plausible: 95,
      rightsSafe: 93,
      recent: 80,
      englishReady: 78,
      deduped: 75,
      sourceAdmitted: 70,
      candidateRetained: 70,
      responseReady: 70,
    },
    drops: {
      implausible: 5,
      rightsFragile: 2,
      stale: 13,
      nonEnglish: 2,
      duplicate: 3,
      sourceRejected: 5,
      candidateCap: 0,
    },
  });
  assert.deepEqual(diagnostics.drops, {
    implausible: 5,
    rightsFragile: 2,
    stale: 13,
    duplicate: 3,
    sourceRejected: 5,
    candidateCap: 0,
    nonEnglish: 2,
  });
});

test('the real cold snapshot never invents original Internet acquisition coverage', () => {
  const now = new Date('2026-08-30T20:00:00.000Z').getTime();
  const feed = getFrontierColdSnapshotFeed(now);
  assert.ok(feed.pipeline);
  assert.equal(feed.pipeline.mode, 'snapshot');
  assert.equal(feed.pipeline.coverage.sourceAcquisition, 'offline-unavailable');
  assert.equal(feed.pipeline.stages.sourceAcquired, null);
  assert.equal(feed.pipeline.stages.responseReady, feed.items.length);
  assert.equal(feed.pipeline.stages.candidateRetained, feed.items.length);
});

test('pipeline diagnostics serialize only anonymous counts and coverage labels', () => {
  const diagnostics = buildFrontierPipelineDiagnostics({
    mode: 'focused-live',
    sourceAcquisition: 'observed',
    adapters: { attempted: 14, fulfilled: 12, failed: 2 },
    stages: {
      sourceAcquired: 240,
      candidateInput: 240,
      plausible: 230,
      rightsSafe: 225,
      recent: null,
      deduped: 205,
      sourceAdmitted: 170,
      candidateRetained: 160,
      englishReady: 154,
      responseReady: 154,
    },
  });
  const serialized = JSON.stringify(diagnostics).toLowerCase();
  for (const forbidden of ['title', 'summary', 'url', 'query', 'itemid', 'profile', 'reaction']) {
    assert.equal(serialized.includes(forbidden), false, `diagnostics leaked forbidden field ${forbidden}`);
  }
  assert.deepEqual(diagnostics.drops, {
    implausible: 10,
    rightsFragile: 5,
    stale: null,
    duplicate: 20,
    sourceRejected: 35,
    candidateCap: 10,
    nonEnglish: 6,
  });
});

test('candidate observation preserves source-vetting score recalibration', () => {
  const source = item('preserved', {
    baseScore: 0.61,
    quality: 0.66,
    tags: [],
  });
  const expected = vetFrontierItems([enrichFrontierSemantics(source)])[0];
  assert.ok(expected);

  const prepared = prepareFrontierCandidatePool([source]);
  assert.equal(prepared.items.length, 1);
  assert.deepEqual(prepared.items[0], expected);
  assert.deepEqual(prepared.stages, {
    candidateInput: 1,
    plausible: 1,
    rightsSafe: 1,
    deduped: 1,
    sourceAdmitted: 1,
    candidateRetained: 1,
  });
});

test('candidate observation accounts for every pre-ranking rejection boundary', () => {
  const valid = item('valid');
  const invalid = item('invalid', { title: '' });
  const rightsFragile = item('rights', {
    sourceKind: 'youtube',
    source: 'youtube.com',
    sourceLabel: 'YouTube',
    url: 'https://youtube.com/watch?v=frontier-rights',
    lane: 'sports',
    tags: ['nfl'],
  });
  const duplicate = item('duplicate', { url: valid.url, title: valid.title });
  const untrusted = item('untrusted', {
    sourceKind: 'rss',
    source: 'unknown-frontier.example',
    sourceLabel: 'Unknown',
    url: 'https://unknown-frontier.example/post',
    lane: 'ml_data',
  });

  const prepared = prepareFrontierCandidatePool([valid, invalid, rightsFragile, duplicate, untrusted]);
  assert.deepEqual(prepared.items.map((entry) => entry.id), ['valid']);
  assert.deepEqual(prepared.stages, {
    candidateInput: 5,
    plausible: 4,
    rightsSafe: 3,
    deduped: 2,
    sourceAdmitted: 1,
    candidateRetained: 1,
  });
});

test('candidate cap is observable without exposing discarded identities', () => {
  const candidates = Array.from({ length: 327 }, (_, index) => item(`repo-${index}`, {
    baseScore: 0.5 + (index % 20) / 100,
  }));
  const prepared = prepareFrontierCandidatePool(candidates);
  assert.equal(prepared.stages.sourceAdmitted, 327);
  assert.equal(prepared.stages.candidateRetained, 320);
  assert.equal(prepared.items.length, 320);
});
