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

const suppressedOpenAlex = evaluated
  .filter(({ item, evidence }) => item.sourceKind === 'openalex' && evidence.disposition === 'suppress')
  .map(({ item, evidence }) => ({
    id: item.id,
    title: item.title,
    lane: item.lane,
    baseScore: Number(item.baseScore.toFixed(4)),
    laneHits: evidence.distinctLaneHits,
    specificHits: evidence.specificLaneHits,
    titleHits: evidence.titleHits,
    summaryHits: evidence.summaryHits,
    tagHits: evidence.tagHits,
  }));

console.info(`FRONTIER candidate-evidence shadow census ${JSON.stringify(shadowCensus)}`);
console.info(`FRONTIER candidate-evidence suppressed OpenAlex ${JSON.stringify(suppressedOpenAlex)}`);

test('candidate-evidence shadow never suppresses GitHub and never touches unrelated source kinds', () => {
  for (const entry of evaluated.filter(({ item }) => item.sourceKind === 'github')) {
    assert.notEqual(entry.evidence.disposition, 'suppress', `${entry.item.id} must remain demotion-only in shadow v1`);
  }

  for (const item of (snapshot.items ?? []).filter((candidate) => !['github', 'openalex'].includes(candidate.sourceKind))) {
    assert.equal(assessFrontierCandidateEvidence(item).disposition, 'retain', `${item.id} unexpectedly changed source authority`);
  }
});

test('OpenAlex shadow suppression remains a bounded minority of the qualified corpus', () => {
  const openAlex = evaluated.filter(({ item }) => item.sourceKind === 'openalex');
  if (!openAlex.length) return;

  const suppressed = openAlex.filter(({ evidence }) => evidence.disposition === 'suppress');
  const fraction = suppressed.length / openAlex.length;

  assert.ok(
    fraction <= 0.4,
    `candidate-evidence shadow would suppress ${(fraction * 100).toFixed(1)}% of OpenAlex; policy is too aggressive`,
  );
});

test('high-scoring scholarly candidates require exceptionally strong evidence before shadow suppression', () => {
  const highScore = evaluated.filter(({ item }) => item.sourceKind === 'openalex' && item.baseScore >= 0.75);
  const suppressed = highScore.filter(({ evidence }) => evidence.disposition === 'suppress');

  assert.deepEqual(
    suppressed.map(({ item }) => item.id),
    [],
    `high-score OpenAlex candidates must not be removed by the first shadow policy: ${suppressed.map(({ item }) => item.title).join(' | ')}`,
  );
});
