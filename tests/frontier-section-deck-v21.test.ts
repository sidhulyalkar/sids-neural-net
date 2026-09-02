import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildFrontierSectionPages,
  FRONTIER_SECTION_FEED_PAGE_SIZE,
  FRONTIER_SECTION_PAGE_SIZE,
} from '../lib/frontier/sectionDeck';
import type { FrontierItem } from '../lib/frontier/types';

const pageSource = readFileSync(new URL('../app/frontier/page.tsx', import.meta.url), 'utf8');
const experienceSource = readFileSync(new URL('../components/frontier/FrontierSectionExperience.tsx', import.meta.url), 'utf8');
const deckSource = readFileSync(new URL('../components/frontier/FrontierSectionDeck.tsx', import.meta.url), 'utf8');

function item(index: number): FrontierItem {
  return {
    id: `section-test-${index}`,
    title: `Section test ${index}`,
    summary: 'Bounded newspaper section test fixture.',
    url: `https://example.invalid/${index}`,
    source: 'example.invalid',
    sourceLabel: 'Fixture',
    sourceKind: 'local',
    publishedAt: '2026-09-02T12:00:00.000Z',
    lane: index % 2 ? 'ai_frontier' : 'gaming',
    tags: ['fixture'],
    baseScore: 0.8,
    importance: 0.7,
    novelty: 0.7,
    quality: 0.9,
    momentum: 0.4,
  };
}

test('desktop newspaper pages preserve order and never exceed ten mounted candidates', () => {
  const items = Array.from({ length: 48 }, (_, index) => item(index + 1));
  const pages = buildFrontierSectionPages(items, FRONTIER_SECTION_PAGE_SIZE);
  assert.equal(FRONTIER_SECTION_PAGE_SIZE, 10);
  assert.equal(pages.length, 5);
  assert.equal(pages[0].title, 'Front Page');
  assert(pages.every((page) => page.items.length <= 10));
  assert.deepEqual(pages.flatMap((page) => page.items.map((entry) => entry.id)), items.map((entry) => entry.id));
  assert.equal(new Set(pages.flatMap((page) => page.items.map((entry) => entry.id))).size, items.length);
});

test('feed/mobile newspaper pages use the stricter eight-card budget', () => {
  const items = Array.from({ length: 25 }, (_, index) => item(index + 1));
  const pages = buildFrontierSectionPages(items, FRONTIER_SECTION_FEED_PAGE_SIZE);
  assert.equal(FRONTIER_SECTION_FEED_PAGE_SIZE, 8);
  assert(pages.every((page) => page.items.length <= 8));
});

test('FRONTIER route sends a bounded qualified snapshot in server HTML', () => {
  assert.match(pageSource, /getFrontierColdSnapshotFeed/);
  assert.match(pageSource, /snapshot\.items\.slice\(0, 72\)/);
  assert.match(pageSource, /<FrontierSectionExperience/);
  assert.doesNotMatch(pageSource, /<FrontierExperience/);
});

test('newspaper experience has no background live discovery daemon or infinite append authority', () => {
  assert.doesNotMatch(experienceSource, /useLiveDiscoveryDaemon/);
  assert.doesNotMatch(experienceSource, /FrontierStreamPulse/);
  assert.doesNotMatch(experienceSource, /onNearEnd/);
  assert.doesNotMatch(experienceSource, /revealPending/);
  assert.match(experienceSource, /const MAX_CLIENT_ITEMS = 72/);
  assert.match(experienceSource, /<FrontierSectionDeck/);
  assert.match(experienceSource, /<SignalCard/);
  assert.match(experienceSource, /params\.set\('fresh', '1'\)/);
});

test('section deck mounts only the active page and warms at most two next-page media assets', () => {
  assert.match(deckSource, /currentPage\.items\.map/);
  assert.doesNotMatch(deckSource, /nextPage\.items\.map/);
  assert.match(deckSource, /nextPage\.items\.slice\(0, 2\)/);
  assert.match(deckSource, /data-frontier-mounted-cards=\{currentPage\.items\.length\}/);
  assert.match(deckSource, /data-frontier-total-items=\{items\.length\}/);
  assert.match(deckSource, /data-frontier-fluid-card=\{item\.id\}/);
  assert.match(deckSource, /window\.setTimeout\(\(\) => \{\s*setPageIndex\(clamped\)/);
});
