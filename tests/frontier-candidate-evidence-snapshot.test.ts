import assert from 'node:assert/strict';
import test from 'node:test';
import frontierSnapshot from '../content/frontier/latest.json';
import { assessFrontierCandidateEvidence } from '../lib/frontier/candidateEvidence';
import type { FrontierFeedResponse } from '../lib/frontier/types';

const snapshot = frontierSnapshot as FrontierFeedResponse;
const evaluated = (snapshot.items ?? [])
  .filter((item) => item.sourceKind === 'github' || item.sourceKind === 'openalex')
  .map((item) => ({ item, evidence: assessFrontierCandidateEvidence(item) }));

const shadowCensus = evaluated.reduce<Record<string, Record<string, number>>>((sources, { item, evidence }) => {
  const bucket = sources[item.sourceKind] ?? { retain: 0, demote: 0, suppress: 0 };
  bucket[evidence.disposition] = (bucket[evidence.disposition] ?? 0) + 1;
  sources[item.sourceKind] = bucket;
  return sources;
}, {});

const changedOpenAlex = evaluated
  .filter(({ item, evidence }) => item.sourceKind === 'openalex' && evidence.disposition !== 'retain')
  .map(({ item, evidence }) => ({
    id: item.id,
    title: item.title,
    lane: item.lane,
    baseScore: Number(item.baseScore.toFixed(4)),
    disposition: evidence.disposition,
    laneHits: evidence.distinctLaneHits,
    specificHits: evidence.specificLaneHits,
    titleHits: evidence.titleHits,
    summaryHits: evidence.summaryHits,
    tagHits: evidence.tagHits,
  }));

console.info(`FRONTIER candidate-evidence shadow census ${JSON.stringify(shadowCensus)}`);
console.info(`FRONTIER candidate-evidence changed OpenAlex ${JSON.stringify(changedOpenAlex)}`);

test('candidate-evidence shadow never suppresses GitHub and never touches unrelated source kinds', () => {
  for (const entry of evaluated.filter(({ item }) => item.sourceKind === 'github')) {
    assert.notEqual(entry.evidence.disposition, 'suppress', `${entry.item.id} must remain demotion-only in shadow v1`);
  }

  for (const item of (snapshot.items ?? []).filter((candidate) => !['github', 'openalex'].includes(candidate.sourceKind))) {
    assert.equal(assessFrontierCandidateEvidence(item).disposition, 'retain', `${item.id} unexpectedly changed source authority`);
  }
});

test('cold-snapshot OpenAlex cannot be suppressed without persisted acquisition intent', () => {
  const suppressed = evaluated.filter(({ item, evidence }) => item.sourceKind === 'openalex' && evidence.disposition === 'suppress');
  assert.deepEqual(
    suppressed.map(({ item }) => item.id),
    [],
    'contextless scholarly lane mismatch must not acquire deletion authority',
  );
});

test('OpenAlex shadow demotion remains bounded on the qualified corpus', () => {
  const openAlex = evaluated.filter(({ item }) => item.sourceKind === 'openalex');
  if (!openAlex.length) return;

  const demoted = openAlex.filter(({ evidence }) => evidence.disposition === 'demote');
  const fraction = demoted.length / openAlex.length;

  assert.ok(
    fraction <= 0.75,
    `candidate-evidence shadow would demote ${(fraction * 100).toFixed(1)}% of OpenAlex; policy is too broad`,
  );
});

test('high-scoring scholarly candidates remain retained in the first contextless shadow policy', () => {
  const highScore = evaluated.filter(({ item }) => item.sourceKind === 'openalex' && item.baseScore >= 0.75);
  const changed = highScore.filter(({ evidence }) => evidence.disposition !== 'retain');

  assert.deepEqual(
    changed.map(({ item }) => item.id),
    [],
    `high-score OpenAlex candidates must remain untouched in the first contextless shadow: ${changed.map(({ item }) => item.title).join(' | ')}`,
  );
});
