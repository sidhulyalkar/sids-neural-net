import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessFrontierCandidateEvidence,
  candidateEvidenceShadowAdjustment,
} from '../lib/frontier/candidateEvidence';
import type { FrontierItem } from '../lib/frontier/types';

function ambiguousHighScorePaper(): FrontierItem {
  return {
    id: 'high-score-contextless-paper',
    title: 'Machine-Checked Proofs on Computation, Consciousness, and Self-Contained Reality',
    summary: 'A formal scholarly treatment of computation and consciousness.',
    url: 'https://example.org/paper',
    source: 'openalex.org',
    sourceLabel: 'OpenAlex',
    sourceKind: 'openalex',
    publishedAt: '2026-09-10T12:00:00.000Z',
    lane: 'builder_signal',
    tags: ['framework', 'paper', 'research'],
    baseScore: 0.76,
    importance: 0.7,
    novelty: 0.7,
    quality: 0.9,
    momentum: 0.3,
    metrics: [{ label: 'citations', value: '0' }],
  };
}

test('contextless OpenAlex shadow preserves strongly qualified scholarship when lane evidence is only generic', () => {
  const paper = ambiguousHighScorePaper();
  const evidence = assessFrontierCandidateEvidence(paper);

  assert.equal(evidence.disposition, 'retain');
  assert.deepEqual(evidence.distinctLaneHits, ['framework']);
  assert.equal(candidateEvidenceShadowAdjustment(paper), 0);
  assert.match(evidence.reasons.join(' '), /strong upstream scholarly score is preserved/i);
});

test('known acquisition mismatch can still suppress high-score scholarship', () => {
  const paper = ambiguousHighScorePaper();
  const context = { discoveryQuery: 'robotics reinforcement learning locomotion' };
  const evidence = assessFrontierCandidateEvidence(paper, context);

  assert.equal(evidence.disposition, 'suppress');
  assert.deepEqual(evidence.discoveryQueryHits, []);
  assert.equal(candidateEvidenceShadowAdjustment(paper, context), -1);
});
