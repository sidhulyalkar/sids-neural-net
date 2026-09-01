import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDirectPreferenceEvidenceIndex,
  directPreferenceEvidenceFor,
  directPreferenceSignalsForItem,
} from '../lib/frontier/directPreferenceEvidence';
import type { FrontierHistoryEntry, FrontierItem, FrontierProfile } from '../lib/frontier/types';

const now = new Date('2026-08-31T12:00:00.000Z');

function item(tags: string[]): FrontierItem {
  return {
    id: 'canonical-topic-test',
    title: 'BCI signal',
    summary: 'Canonical topic identity regression fixture.',
    url: 'https://github.com/example/bci-signal',
    source: 'github.com',
    sourceLabel: 'GitHub',
    sourceKind: 'github',
    publishedAt: '2026-08-31T10:00:00.000Z',
    lane: 'neuro_frontier',
    tags,
    baseScore: 0.6,
    importance: 0.7,
    novelty: 0.6,
    quality: 0.8,
    momentum: 0.5,
  };
}

function historyEntry(signal: FrontierItem): FrontierHistoryEntry {
  return {
    item: signal,
    firstSeenAt: '2026-08-31T10:30:00.000Z',
    lastSeenAt: '2026-08-31T11:00:00.000Z',
    impressions: 1,
    reaction: 'up',
    reactedAt: '2026-08-31T11:00:00.000Z',
    resurfacedCount: 0,
    rewarded: true,
  };
}

const profile: FrontierProfile = {
  laneAffinity: {
    must_know: 0, ml_data: 0, ai_frontier: 0, neuro_frontier: 0, methods: 0,
    builder_signal: 0, competitions: 0, broad_science: 0, creative_tech: 0,
    world_pulse: 0, premier_league: 0, world_soccer: 0, team_pulse: 0, sports: 0,
    gaming: 0, screen: 0, music: 0, internet_culture: 0, life: 0, wildcards: 0,
  },
  topicAffinity: { bci: 0.6, 'neural interfaces': 0.2 },
  sourceAffinity: {},
  interestPairs: {},
  knownTopics: {},
  curiosity: 0.5,
  meaningfulInteractions: 0,
};

test('normalized duplicate tags contribute exactly one direct evidence event per item', () => {
  const duplicate = item(['BCI', 'bci', ' BCI ', 'neural interfaces']);
  const canonical = item(['bci', 'neural interfaces']);
  const duplicateIndex = buildDirectPreferenceEvidenceIndex({ duplicate: historyEntry(duplicate) }, now);
  const canonicalIndex = buildDirectPreferenceEvidenceIndex({ canonical: historyEntry(canonical) }, now);

  assert.deepEqual(
    directPreferenceEvidenceFor(duplicateIndex, 'topic', 'bci'),
    directPreferenceEvidenceFor(canonicalIndex, 'topic', 'bci'),
  );
  assert.deepEqual(
    directPreferenceEvidenceFor(duplicateIndex, 'topic', 'neural interfaces'),
    directPreferenceEvidenceFor(canonicalIndex, 'topic', 'neural interfaces'),
  );
});

test('duplicate item tags cannot overweight a profile topic during item scoring', () => {
  const duplicate = directPreferenceSignalsForItem(item(['BCI', 'bci', ' BCI ', 'neural interfaces']), profile);
  const canonical = directPreferenceSignalsForItem(item(['bci', 'neural interfaces']), profile);
  assert.equal(duplicate.topicSignal, canonical.topicSignal);
});
