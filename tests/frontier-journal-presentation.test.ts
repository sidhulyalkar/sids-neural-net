import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { journalFormat, journalPresentation, journalRealm, journalRelatedItems, journalSharedTopics } from '../lib/frontier/journalPresentation';
import type { FrontierItem } from '../lib/frontier/types';

const fixture: FrontierItem = {
  id: 'research-one',
  title: 'A published finding',
  summary: 'The paper reports a narrow observation.',
  url: 'https://example.org/paper',
  source: 'example.org',
  sourceLabel: 'Research publisher',
  sourceKind: 'arxiv',
  publishedAt: '2026-11-10T00:00:00.000Z',
  lane: 'ml_data',
  tags: ['machine learning', 'unlabeled data'],
  baseScore: 0.8, importance: 0.8, novelty: 0.8, quality: 0.9, momentum: 0.5,
};

test('the journal changes realm using published source categories, not a generated theme guess', () => {
  assert.equal(journalRealm(fixture), 'research');
  assert.equal(journalRealm({ lane: 'neuro_frontier' }), 'neural');
  assert.equal(journalRealm({ lane: 'builder_signal' }), 'systems');
  assert.equal(journalRealm({ lane: 'sports' }), 'motion');
  assert.equal(journalRealm({ lane: 'life' }), 'nature');
  assert.equal(journalRealm({ lane: 'music' }), 'culture');
});

test('the evidence layout respects real source material with deterministic priority', () => {
  assert.equal(journalFormat(fixture, false), 'brief');
  assert.equal(journalFormat({ ...fixture, artifacts: [{ kind: 'repository', label: 'Code' }] }, false), 'technical');
  assert.equal(journalFormat(fixture, true), 'visual');
  assert.equal(journalFormat({ ...fixture, metrics: [{ label: 'Runs', value: '19' }] }, true), 'measured');
  assert.equal(journalFormat({
    ...fixture,
    sportsState: { kind: 'scoreboard', league: 'test', leagueLabel: 'Test league', games: [] },
    metrics: [{ label: 'Runs', value: '19' }],
  }, true), 'live');
  assert.equal(journalPresentation(fixture, false).hasEvidence, false);
  assert.equal(journalPresentation({ ...fixture, convergence: { confidence: 0.5, windowHours: 24, sourceKinds: [], members: [{
    id: 'source-2', title: 'Second source', url: 'https://example.net/story',
    sourceLabel: 'Other publisher', sourceKind: 'rss', publishedAt: '2026-11-11T00:00:00.000Z',
  }] } }, false).hasEvidence, true);
});

test('research threads require actual shared source tags rather than arbitrary visual proximity', () => {
  const shared = { ...fixture, id: 'shared', tags: ['Unlabeled Data', 'new method'] };
  const distant = { ...fixture, id: 'distant', tags: ['winter sports'] };
  const other = { ...fixture, id: 'other', tags: ['machine learning', 'unlabeled data'] };
  assert.deepEqual(journalSharedTopics(fixture, shared), ['unlabeled data']);
  assert.deepEqual(journalSharedTopics(fixture, distant), []);
  const related = journalRelatedItems(fixture, [fixture, shared, distant, other], 2);
  assert.deepEqual(related.map((entry) => entry.item.id), ['other', 'shared']);
  assert.equal(related[0].sharedTopics.length, 2);
});

test('default reader uses source-evidence composition, never a duplicate text poster', () => {
  const reader = fs.readFileSync('components/frontier/FrontierFocusReader.tsx', 'utf8');
  const css = fs.readFileSync('components/frontier/frontier-journal.module.css', 'utf8');
  const evidence = fs.readFileSync('components/frontier/FrontierJournalEvidence.tsx', 'utf8');
  assert.match(reader, /data-realm=\{presentation\?\.realm/);
  assert.match(reader, /data-format=\{presentation\?\.format/);
  assert.match(reader, /<FrontierJournalEvidence item=\{item\}/);
  assert.doesNotMatch(reader, /Editorial article cover/);
  assert.match(css, /font-size: clamp\(30px, 2\.9vw, 42px\)/);
  for (const realm of ['research', 'neural', 'systems', 'nature', 'motion', 'culture']) {
    if (realm !== 'research') assert(css.includes("[data-realm='" + realm + "']"));
  }
  assert.match(evidence, /Reported, not inferred/);
  assert.doesNotMatch(evidence, /Math\.random|<canvas/);
});
