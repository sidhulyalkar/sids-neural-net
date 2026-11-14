import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { JOURNAL_SECTIONS, journalSectionInventory, journalSectionMatches } from '../lib/frontier/journalSections';
import type { FrontierItem } from '../lib/frontier/types';

const item = (overrides: Partial<FrontierItem>): FrontierItem => ({
  id: 'sample', title: 'Source paper', summary: 'Source-authentic report', url: 'https://arxiv.org/abs/2611.17323v1',
  source: 'arxiv.org', sourceLabel: 'arXiv', sourceKind: 'arxiv',
  publishedAt: '2026-11-14T00:00:00.000Z', lane: 'ml_data', tags: ['research'],
  baseScore: 0.7, importance: 0.7, novelty: 0.7, quality: 0.7, momentum: 0.7,
  ...overrides,
});

test('the six audience-facing sections have stable, unique identities', () => {
  assert.deepEqual(JOURNAL_SECTIONS.map((section) => section.id),
    ['for-you', 'research', 'engineering', 'sports', 'entertainment', 'nature']);
  assert.equal(new Set(JOURNAL_SECTIONS.map((section) => section.label)).size, 6);
  assert(JOURNAL_SECTIONS.every((section) => Boolean(section.subtitle && section.realm)));
});

test('source-driven subjects route research, code, sports, culture and ecology without fictional associations', () => {
  const paper = item({});
  const neuralCode = item({ sourceKind: 'github', url: 'https://github.com/allenai/neural-tools',
    lane: 'builder_signal', tags: ['neuropixels', 'spike sorting'] });
  const sports = item({ sourceKind: 'football_data', lane: 'premier_league', tags: ['soccer'],
    url: 'https://example.org/match' });
  const culture = item({ sourceKind: 'steam', lane: 'gaming', tags: ['metroidvania'],
    url: 'https://store.steampowered.com/app/100/game' });
  const nature = item({ sourceKind: 'nasa', lane: 'world_pulse', tags: ['space science'],
    url: 'https://science.nasa.gov/' });
  const wildcard = item({ sourceKind: 'rss', lane: 'wildcards', tags: ['unrelated update'],
    url: 'https://example.org/news' });
  assert(journalSectionMatches(paper, 'research'));
  assert(journalSectionMatches(neuralCode, 'research'), 'Neuroscience code can cross into research');
  assert(journalSectionMatches(neuralCode, 'engineering'), 'Open-source release is also engineering');
  assert(journalSectionMatches(sports, 'sports'));
  assert(journalSectionMatches(culture, 'entertainment'));
  assert(journalSectionMatches(nature, 'nature'));
  for (const section of JOURNAL_SECTIONS.filter((section) => section.id !== 'for-you')) {
    assert(!journalSectionMatches(wildcard, section.id), 'Unknown sources should not fake an affinity');
  }
  assert(journalSectionMatches(wildcard, 'for-you'), 'Discovery retains unclassified stories');
});

test('section counts are data-driven and permit overlapping authentic domains', () => {
  const research = item({ id: 'research' });
  const code = item({ id: 'code', sourceKind: 'github', lane: 'builder_signal',
    url: 'https://github.com/allenai/olmo', tags: ['neural decoding'] });
  const match = item({ id: 'sports', sourceKind: 'sports_state', lane: 'sports',
    url: 'https://example.org/sports' });
  const inventory = journalSectionInventory([research, code, match]);
  assert.equal(inventory['for-you'], 3);
  assert.equal(inventory.research, 2);
  assert.equal(inventory.engineering, 1);
  assert.equal(inventory.sports, 1);
  assert.equal(inventory.entertainment, 0);
  assert.equal(inventory.nature, 0);
});

test('the reader navigates actual local subject collections without an additional feed request', () => {
  const reader = fs.readFileSync('components/frontier/FrontierFocusReader.tsx', 'utf8');
  const css = fs.readFileSync('components/frontier/frontier-journal.module.css', 'utf8');
  assert.match(reader, /role="tablist" aria-label="Content areas"/);
  assert.match(reader, /data-journal-section=\{section\.id\}/);
  assert.match(reader, /aria-selected=\{activeSection === section\.id\}/);
  assert.match(reader, /selectDailyRun\(poolItems\.filter/);
  assert.match(reader, /setActiveSection\('for-you'\)/);
  assert.match(css, /\.sectionTab\[aria-selected='true'\]/);
  assert.doesNotMatch(reader, /fetch\(.+section/);
});
