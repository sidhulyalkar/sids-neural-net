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
const holoCss = readFileSync(new URL('../app/frontier/frontier-holographic-panels.css', import.meta.url), 'utf8');
const cursorSource = readFileSync(new URL('../components/effects/SiteNeuronCursor.tsx', import.meta.url), 'utf8');
const sensingSource = readFileSync(new URL('../components/sensing/InteractionCapabilityProvider.tsx', import.meta.url), 'utf8');

function item(index: number): FrontierItem {
  return {
    id: `section-v23-${index}`,
    title: `Section v23 ${index}`,
    summary: 'Predictive holographic section test fixture.',
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

test('v23 keeps edition data bounded while sectioning desktop and mobile pages', () => {
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
  assert.match(pageSource, /frontier-holographic-panels\.css/);
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

test('v23 geometric turn uses stronger depth while the final material stays compositor-first', () => {
  assert.match(deckSource, /type TurnPhase = 'prepare' \| 'turn'/);
  assert.match(deckSource, /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame/);
  assert.match(deckSource, /data-frontier-page-role="incoming"/);
  assert.match(deckSource, /data-frontier-page-role="current"/);
  assert.match(deckSource, /data-frontier-turning=\{turn\?\.phase \?\? 'idle'\}/);
  assert.match(deckCss, /perspective: clamp\(900px, 70vw, 1220px\)/);
  assert.match(deckCss, /translate3d\(-12\.8%, -5\.3%, -535px\).*rotateY\(-96deg\)/);
  assert.match(deckCss, /translate3d\(12\.8%, -5\.3%, -535px\).*rotateY\(96deg\)/);
  assert.match(holoCss, /clip-path: none !important/);
  assert.match(holoCss, /will-change: transform, opacity !important/);
  assert.match(holoCss, /content-visibility: visible/);
});

test('holographic material is bounded, readable, and avoids expensive idle effects', () => {
  assert.match(holoCss, /repeating-linear-gradient/);
  assert.match(holoCss, /data-frontier-virtual-card/);
  assert.match(holoCss, /@media \(max-width: 720px\)/);
  assert.match(holoCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(holoCss, /backdrop-filter/);
  assert.doesNotMatch(holoCss, /filter:\s*blur/);
  assert.doesNotMatch(holoCss, /animation:\s*[^;]*infinite/);
  assert.doesNotMatch(holoCss, /<canvas|three|WebGL/i);
});

test('FRONTIER route excludes decorative cursor and sensing/camera shells', () => {
  assert.match(cursorSource, /pathname\?\.startsWith\('\/frontier'\)/);
  assert.match(sensingSource, /pathname\?\.startsWith\('\/frontier'\)/);
});
