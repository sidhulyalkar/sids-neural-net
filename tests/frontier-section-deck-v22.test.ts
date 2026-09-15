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
const fastCss = readFileSync(new URL('../app/frontier/frontier-render-fast.css', import.meta.url), 'utf8');
const experienceSource = readFileSync(new URL('../components/frontier/FrontierSectionExperience.tsx', import.meta.url), 'utf8');
const deckSource = readFileSync(new URL('../components/frontier/FrontierSectionDeck.tsx', import.meta.url), 'utf8');
const deckCss = readFileSync(new URL('../components/frontier/frontier-section-deck.module.css', import.meta.url), 'utf8');
const signalCardSource = readFileSync(new URL('../components/frontier/SignalCard.tsx', import.meta.url), 'utf8');
const mediaSource = readFileSync(new URL('../components/frontier/media/FrontierMediaSurface.tsx', import.meta.url), 'utf8');
const mediaCss = readFileSync(new URL('../components/frontier/media/frontier-media.module.css', import.meta.url), 'utf8');
const richMediaSource = readFileSync(new URL('../components/frontier/media/RichFrontierMediaSurface.tsx', import.meta.url), 'utf8');
const focalSource = readFileSync(new URL('../components/frontier/FrontierFocalPlane.tsx', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../components/layout/Header.tsx', import.meta.url), 'utf8');
const cursorSource = readFileSync(new URL('../components/effects/SiteNeuronCursor.tsx', import.meta.url), 'utf8');
const sensingSource = readFileSync(new URL('../components/sensing/InteractionCapabilityProvider.tsx', import.meta.url), 'utf8');

function item(index: number): FrontierItem {
  return {
    id: `section-v24-${index}`,
    title: `Section v24 ${index}`,
    summary: 'Render-fast section test fixture.',
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

test('v24 maximizes bounded page density without mounting a second page', () => {
  const items = Array.from({ length: 48 }, (_, index) => item(index + 1));
  const desktop = buildFrontierSectionPages(items, FRONTIER_SECTION_PAGE_SIZE);
  const mobile = buildFrontierSectionPages(items, FRONTIER_SECTION_FEED_PAGE_SIZE);
  assert.equal(FRONTIER_SECTION_PAGE_SIZE, 10);
  assert.equal(FRONTIER_SECTION_FEED_PAGE_SIZE, 4);
  assert(desktop.every((page) => page.items.length <= 10));
  assert(mobile.every((page) => page.items.length <= 4));
  assert.deepEqual(desktop.flatMap((page) => page.items.map((entry) => entry.id)), items.map((entry) => entry.id));
  assert.deepEqual(mobile.flatMap((page) => page.items.map((entry) => entry.id)), items.map((entry) => entry.id));
});

test('FRONTIER first paint ships a smaller server snapshot and no holographic transition stylesheet', () => {
  assert.match(pageSource, /getFrontierColdSnapshotFeed/);
  assert.match(pageSource, /snapshot\.items\.slice\(0, 48\)/);
  assert.match(pageSource, /<FrontierSectionExperience/);
  assert.match(pageSource, /data-frontier-performance-route="true"/);
  assert.match(pageSource, /frontier-render-fast\.css/);
  assert.doesNotMatch(pageSource, /frontier-holographic-panels\.css/);
  assert.doesNotMatch(pageSource, /BackgroundCanvas|DeferredFrontierAmbient|SignalTelemetryBridge|MeshStateBridge|FrontierRuntimeControls|FrontierAutonomyProvider/);
});

test('bounded section experience keeps explicit refresh authority but no passive discovery daemon', () => {
  assert.doesNotMatch(experienceSource, /useLiveDiscoveryDaemon/);
  assert.doesNotMatch(experienceSource, /FrontierStreamPulse/);
  assert.doesNotMatch(experienceSource, /onNearEnd|revealPending/);
  assert.match(experienceSource, /const MAX_CLIENT_ITEMS = 72/);
  assert.match(experienceSource, /params\.set\('fresh', '1'\)/);
  assert.match(experienceSource, /<FrontierSectionDeck/);
});

test('page navigation stays local and media warming is bounded by a two-job scheduler', () => {
  assert.doesNotMatch(deckSource, /fetch\s*\(/);
  assert.match(deckSource, /const MAX_DECODED_MEDIA = 18/);
  assert.match(deckSource, /const MAX_CONCURRENT_MEDIA_WARMS = 2/);
  assert.match(deckSource, /pendingWarmUrls = new Set/);
  assert.match(deckSource, /mediaWarmQueue: WarmRequest\[\] = \[\]/);
  assert.match(deckSource, /activeMediaWarms < MAX_CONCURRENT_MEDIA_WARMS/);
  assert.match(deckSource, /scheduleMediaWarm\(url, priority\)/);
  assert.match(deckSource, /image\.decode\(\)\.then/);
  assert.match(deckSource, /requestIdleCallback/);
  assert.match(deckSource, /warmIndex\(activePageIndex, 'immediate', Math\.min\(2, warmBudget\('immediate'\)\)\)/);
  assert.match(deckSource, /warmIndex\(activePageIndex \+ 1, 'idle', Math\.min\(2, budget\)\)/);
  assert.match(deckSource, /warmIndex\(activePageIndex - 1, 'idle', Math\.min\(1, budget\)\)/);
  assert.match(deckSource, /warmIndex\(clamped, 'immediate', 3\)/);
  assert.match(deckSource, /page\.items\.slice\(0, mediaBearingItemLimit\(layoutMode\)\)/);
  assert.doesNotMatch(deckSource, /activePageIndex \+ 2/);
  assert.match(deckSource, /data-frontier-media-concurrency=\{MAX_CONCURRENT_MEDIA_WARMS\}/);
  assert.match(deckSource, /data-frontier-fast-swap="true"/);
  assert.match(deckSource, /data-frontier-transition="single-plane"/);
  assert.doesNotMatch(deckSource, /TurnPhase|incomingPage|onAnimationEnd/);
});

test('ten-card pages use feature, standard, and compact render tiers', () => {
  assert.match(deckSource, /function cardVariant/);
  assert.match(deckSource, /if \(index === 0\) return 'feature'/);
  assert.match(deckSource, /if \(index === 1\) return 'wide'/);
  assert.match(deckSource, /return 'compact'/);
  assert.match(deckSource, /cloneElement\(renderedCard, \{ variant \}\)/);
  assert.match(deckSource, /data-frontier-card-tier=\{variant\}/);
  assert.match(signalCardSource, /const compact = variant === 'compact'/);
  assert.match(signalCardSource, /const renderMedia = hasMedia && !compact/);
  assert.match(signalCardSource, /const quickActions = compact \? compactActions : fullActions/);
  assert.match(signalCardSource, /PUBLISHED_DATE_FORMATTER/);
});

test('high-resolution wheel gestures are coalesced into one bounded page movement', () => {
  assert.match(deckSource, /const WHEEL_NAV_THRESHOLD = 72/);
  assert.match(deckSource, /const WHEEL_GESTURE_RESET_MS = 170/);
  assert.match(deckSource, /const WHEEL_NAV_LOCK_MS = 420/);
  assert.match(deckSource, /wheelDelta\.current \+= event\.deltaX/);
  assert.match(deckSource, /wheelLockedUntil\.current = now \+ WHEEL_NAV_LOCK_MS/);
  assert.match(deckSource, /data-frontier-wheel-coalescing="true"/);
});

test('v24 daily deck fits a hierarchical ten-tile desk or four-tile feed with one compositor reveal', () => {
  assert.match(fastCss, /height: 100dvh/);
  assert.match(fastCss, /body:has\([\s\S]*overflow: hidden/);
  assert.match(fastCss, /> main \{[\s\S]*min-height: 0;[\s\S]*overflow: hidden/);
  assert.match(deckCss, /touch-action: pan-y pinch-zoom/);
  assert.match(deckCss, /overscroll-behavior: contain/);
  assert.match(deckCss, /scroll-snap-type: x proximity/);
  assert.match(deckCss, /\.card \{[\s\S]*contain: layout paint style/);
  assert.match(deckCss, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(deckCss, /grid-template-rows: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(deckCss, /grid > \.card:nth-child\(1\)/);
  assert.match(deckCss, /grid-column: span 2/);
  assert.match(deckCss, /data-frontier-card-tier='compact'/);
  assert.match(deckCss, /@keyframes frontier-page-reveal/);
  assert.match(deckCss, /transform: translate3d\(var\(--frontier-enter-x\), 0, 0\) scale\(0\.996\)/);
  assert.match(deckCss, /\.card > \* \{[\s\S]*height: 100%/);
  assert.doesNotMatch(deckCss, /perspective:|clip-path:|will-change:|content-visibility:/);
});

test('feed media reserves geometry and applies explicit primary versus secondary priority', () => {
  assert.match(mediaSource, /export function FrontierMediaSurface/);
  assert.match(mediaSource, /loading=\{priority === 'primary' \? 'eager' : 'lazy'\}/);
  assert.match(mediaSource, /fetchPriority=\{priority === 'primary' \? 'high' : 'low'\}/);
  assert.match(mediaSource, /decoding="async"/);
  assert.match(mediaSource, /image\.decode\(\)/);
  assert.match(mediaSource, /data-media-priority=\{priority\}/);
  assert.match(mediaSource, /data-media-state=\{failed \? 'fallback' : ready \? 'ready' : 'loading'\}/);
  assert.match(mediaCss, /\.nativeImageSurface \{[\s\S]*contain: layout paint style/);
  assert.match(mediaCss, /\.nativeImage \{[\s\S]*opacity: 0/);
  assert.match(mediaCss, /\.nativeImageReady \{[\s\S]*opacity: 1/);
  assert.match(mediaCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(mediaSource, /GpuImageSurface|AdaptiveVideoSurface|useMediaVisibility|<iframe/);
  assert.match(richMediaSource, /GpuImageSurface/);
  assert.match(richMediaSource, /AdaptiveVideoSurface/);
  assert.match(richMediaSource, /useMediaVisibility/);
  assert.match(focalSource, /RichFrontierMediaSurface/);
  assert.doesNotMatch(focalSource, /FrontierMediaSurface item=\{item\}/);
});

test('FRONTIER route excludes decorative cursor, sensing, and fractal back-button rendering', () => {
  assert.match(cursorSource, /pathname\?\.startsWith\('\/frontier'\)/);
  assert.match(sensingSource, /pathname\?\.startsWith\('\/frontier'\)/);
  assert.match(headerSource, /const frontierFastPath = pathname\?\.startsWith\('\/frontier'\)/);
  assert.match(headerSource, /data-frontier-static-back=\{frontierFastPath \? 'true' : undefined\}/);
  assert.match(headerSource, /!frontierFastPath \? \([\s\S]*<FractalThemeEcho variant="glyph"/);
});
