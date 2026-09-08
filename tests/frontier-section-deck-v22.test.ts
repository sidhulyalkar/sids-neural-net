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
const deckCss = readFileSync(new URL('../components/frontier/frontier-section-deck.module.css', import.meta.url), 'utf8');
const cursorSource = readFileSync(new URL('../components/effects/SiteNeuronCursor.tsx', import.meta.url), 'utf8');
const sensingSource = readFileSync(new URL('../components/sensing/InteractionCapabilityProvider.tsx', import.meta.url), 'utf8');

function item(index: number): FrontierItem {
  return {
    id: `section-v22-${index}`,
    title: `Section v22 ${index}`,
    summary: 'Predictive newspaper section test fixture.',
    url: `https://example.invalid/${index}`,
    source: 'example.invalid',
    sourceLabel: 'Fixture',
    sourceKind: 'local',
    publishedAt: '2026-09-08T12:00:00.000Z',
    lane: index % 2 ? 'ai_frontier' : 'gaming',
    tags: ['fixture'],
    baseScore: 0.8,
    importance: 0.7,
    novelty: 0.7,
    quality: 0.9,
    momentum: 0.4,
  };
}

test('v22 keeps edition data bounded while sectioning desktop and mobile pages', () => {
  const items = Array.from({ length: 48 }, (_, index) => item(index + 1));
  const desktop = buildFrontierSectionPages(items, FRONTIER_SECTION_PAGE_SIZE);
  const mobile = buildFrontierSectionPages(items, FRONTIER_SECTION_FEED_PAGE_SIZE);
  assert.equal(FRONTIER_SECTION_PAGE_SIZE, 10);
  assert.equal(FRONTIER_SECTION_FEED_PAGE_SIZE, 8);
  assert(desktop.every((page) => page.items.length <= 10));
  assert(mobile.every((page) => page.items.length <= 8));
  assert.deepEqual(desktop.flatMap((page) => page.items.map((entry) => entry.id)), items.map((entry) => entry.id));
});

test('FRONTIER first paint comes from the bounded server snapshot and omits ambient GPU extras', () => {
  assert.match(pageSource, /getFrontierColdSnapshotFeed/);
  assert.match(pageSource, /snapshot\.items\.slice\(0, 72\)/);
  assert.match(pageSource, /<FrontierSectionExperience/);
  assert.match(pageSource, /data-frontier-performance-route="true"/);
  assert.doesNotMatch(pageSource, /BackgroundCanvas|DeferredFrontierAmbient|SignalTelemetryBridge|MeshStateBridge|FrontierRuntimeControls|FrontierAutonomyProvider/);
});

test('bounded section experience has no passive discovery daemon or infinite append authority', () => {
  assert.doesNotMatch(experienceSource, /useLiveDiscoveryDaemon/);
  assert.doesNotMatch(experienceSource, /FrontierStreamPulse/);
  assert.doesNotMatch(experienceSource, /onNearEnd|revealPending/);
  assert.match(experienceSource, /const MAX_CLIENT_ITEMS = 72/);
  assert.match(experienceSource, /params\.set\('fresh', '1'\)/);
  assert.match(experienceSource, /<FrontierSectionDeck/);
});

test('page navigation is data-local and predictively decodes bounded adjacent media', () => {
  assert.doesNotMatch(deckSource, /fetch\(['"`]\/api\/frontier\/feed/);
  assert.match(deckSource, /const MAX_DECODED_MEDIA = 32/);
  assert.match(deckSource, /decodedMediaCache = new Map/);
  assert.match(deckSource, /image\.decode\(\)\.catch/);
  assert.match(deckSource, /requestIdleCallback/);
  assert.match(deckSource, /warmIndex\(pageIndex \+ 1, 'idle'/);
  assert.match(deckSource, /warmIndex\(pageIndex - 1, 'idle'/);
  assert.match(deckSource, /warmIndex\(pageIndex \+ 2, 'idle'/);
  assert.match(deckSource, /connection\?\.saveData/);
  assert.match(deckSource, /media\.posterProxyUrl \?\? media\.poster/);
});

test('3D turn prepares the target sheet before a GPU-only reveal', () => {
  assert.match(deckSource, /type TurnPhase = 'prepare' \| 'turn'/);
  assert.match(deckSource, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame/);
  assert.match(deckSource, /data-frontier-page-role="incoming"/);
  assert.match(deckSource, /data-frontier-page-role="current"/);
  assert.match(deckSource, /data-frontier-turning=\{turn\?\.phase \?\? 'idle'\}/);
  assert.match(deckCss, /perspective: 1850px/);
  assert.match(deckCss, /rotateY\(-86deg\)/);
  assert.match(deckCss, /rotateY\(86deg\)/);
  assert.match(deckCss, /will-change: transform/);
  assert.doesNotMatch(deckCss, /will-change: transform, opacity/);
});

test('FRONTIER route excludes decorative cursor and sensing/camera shells', () => {
  assert.match(cursorSource, /pathname\?\.startsWith\('\/frontier'\)/);
  assert.match(sensingSource, /pathname\?\.startsWith\('\/frontier'\)/);
});
