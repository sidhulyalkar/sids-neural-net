import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichFrontierSemantics,
  frontierCandidatePriority,
  prepareFrontierCandidatePool,
} from '../lib/frontier/aggregate';
import { auditBootstrapTasteCandidateCap } from '../lib/frontier/preferenceAuthorityAudit';
import type { FrontierItem } from '../lib/frontier/types';

function item(id: string, overrides: Partial<FrontierItem> = {}): FrontierItem {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    url: `https://github.com/frontier-authority/${id}`,
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-30T18:00:00.000Z',
    lane: 'ai_frontier',
    tags: ['language model', 'release'],
    baseScore: 0.83,
    importance: 0.6,
    novelty: 0.6,
    quality: 0.7,
    momentum: 0.5,
    ...overrides,
  };
}

test('non-binding candidate caps report zero bootstrap taste membership leverage', () => {
  const eligible = [item('one'), item('two'), item('three')];
  const retained = [...eligible].sort((a, b) => frontierCandidatePriority(b) - frontierCandidatePriority(a));
  const audit = auditBootstrapTasteCandidateCap(eligible, retained, 320);
  assert.deepEqual(audit, {
    eligible: 3,
    cap: 320,
    retained: 3,
    sharedWithBaseScore: 3,
    tasteProtected: 0,
    tasteDisplaced: 0,
    overlapRate: 1,
  });
});

test('binding cap measures membership protected by bootstrap taste without exposing identities', () => {
  const generic = Array.from({ length: 320 }, (_, index) => item(`generic-${index}`));
  const nfl = enrichFrontierSemantics(item('nfl-sports-analytics', {
    title: 'NFL player tracking model combines EPA and CPOE',
    summary: 'Open sports analytics project for player movement and route efficiency.',
    lane: 'sports',
    tags: ['nfl', 'player tracking', 'sports analytics'],
    baseScore: 0.77,
  }));
  const eligible = [...generic, nfl];
  const retained = [...eligible]
    .sort((a, b) => frontierCandidatePriority(b) - frontierCandidatePriority(a))
    .slice(0, 320);
  const audit = auditBootstrapTasteCandidateCap(eligible, retained, 320);

  assert.equal(frontierCandidatePriority(nfl) > frontierCandidatePriority(generic[0]), true);
  assert.equal(audit.eligible, 321);
  assert.equal(audit.retained, 320);
  assert.equal(audit.tasteProtected, 1);
  assert.equal(audit.tasteDisplaced, 1);
  assert.equal(audit.sharedWithBaseScore, 319);
  assert.equal(audit.overlapRate, 319 / 320);
  assert.deepEqual(Object.keys(audit).sort(), [
    'cap',
    'eligible',
    'overlapRate',
    'retained',
    'sharedWithBaseScore',
    'tasteDisplaced',
    'tasteProtected',
  ]);
});

test('candidate-pool preparation preserves the existing retained ordering before audit wiring', () => {
  const candidates = Array.from({ length: 327 }, (_, index) => item(`candidate-${index}`, {
    baseScore: 0.72 + (index % 17) / 100,
  }));
  const prepared = prepareFrontierCandidatePool(candidates);
  const expected = candidates
    .map(enrichFrontierSemantics)
    .sort((a, b) => frontierCandidatePriority(b) - frontierCandidatePriority(a))
    .slice(0, 320)
    .map((entry) => entry.id);
  assert.deepEqual(prepared.items.map((entry) => entry.id), expected);
});
