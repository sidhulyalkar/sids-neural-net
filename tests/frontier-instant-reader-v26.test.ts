import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('FRONTIER cold route is a server snapshot performance island', () => {
  const page = read('app/frontier/page.tsx');
  const experience = read('components/frontier/FrontierSectionExperience.tsx');
  const cursor = read('components/effects/SiteNeuronCursor.tsx');
  const sensing = read('components/sensing/InteractionCapabilityProvider.tsx');

  assert.match(page, /getFrontierColdSnapshotFeed/);
  assert.match(page, /slice\(0, 40\)/);
  assert.match(page, /data-frontier-data-authority="server-snapshot"/);
  assert.match(page, /data-frontier-passive-discovery="off"/);
  assert.doesNotMatch(page, /BackgroundCanvas|SignalTelemetryBridge|MeshStateBridge|FrontierRuntimeControls/);
  assert.doesNotMatch(experience, /useLiveDiscoveryDaemon|SignalBoard/);
  assert.match(cursor, /pathname\?\.startsWith\('\/frontier'\)/);
  assert.match(sensing, /pathname\?\.startsWith\('\/frontier'\)/);
});

test('FRONTIER mounts one bounded page and delegates motion to the compositor', () => {
  const deck = read('components/frontier/FrontierSectionDeck.tsx');
  const sections = read('lib/frontier/sectionDeck.ts');

  assert.match(sections, /FRONTIER_SECTION_PAGE_SIZE = 10/);
  assert.match(sections, /FRONTIER_SECTION_FEED_PAGE_SIZE = 4/);
  assert.match(deck, /startViewTransition/);
  assert.match(deck, /flushSync/);
  assert.match(deck, /viewTransitionName: 'frontier-page'/);
  assert.match(deck, /data-frontier-live-planes="1"/);
  assert.match(deck, /MAX_CONCURRENT_MEDIA_WARMS = 2/);
  assert.match(deck, /MAX_DECODED_MEDIA = 12/);
  assert.match(deck, /page\.items\.slice\(0, 2\)/);
  assert.doesNotMatch(deck, /incomingPage|incomingPrepared|data-frontier-page-role="incoming"/);
});

test('browse media remains native and rich media is explicit-only', () => {
  const browse = read('components/frontier/media/FrontierMediaSurface.tsx');
  const rich = read('components/frontier/media/RichFrontierMediaSurface.tsx');
  const focal = read('components/frontier/FrontierFocalPlane.tsx');
  const card = read('components/frontier/SignalCard.tsx');

  assert.doesNotMatch(browse, /GpuImageSurface|AdaptiveVideoSurface|useMediaVisibility|<iframe/);
  assert.match(browse, /fetchPriority=\{priority === 'primary' \? 'high' : 'low'\}/);
  assert.match(browse, /loading=\{priority === 'primary' \? 'eager' : 'lazy'\}/);
  assert.match(rich, /GpuImageSurface/);
  assert.match(rich, /AdaptiveVideoSurface/);
  assert.match(focal, /RichFrontierMediaSurface/);
  assert.match(card, /const compact = variant === 'compact'/);
  assert.match(card, /const renderMedia = hasMedia && !compact/);
});


test('cold reader keeps account, sensors, QC, and audio behind explicit interaction', () => {
  const experience = read('components/frontier/FrontierSectionExperience.tsx');
  const dock = read('components/frontier/FrontierUtilityDock.tsx');
  const lab = read('components/frontier/FrontierExperimentalControls.tsx');
  const qc = read('components/frontier/FrontierSensorQcControl.tsx');
  const header = read('components/layout/Header.tsx');
  const footer = read('components/layout/Footer.tsx');

  assert.match(experience, /dynamic\(\(\) => import\('\.\/FrontierAccount'\)/);
  assert.match(experience, /accountOpen \? <FrontierAccount \/> : null/);

  assert.match(dock, /dynamic\([\s\S]*FrontierExperimentalControls/);
  assert.match(dock, /labOpen \? <FrontierExperimentalControls feedActive=\{feedView\} \/> : null/);
  assert.doesNotMatch(dock, /from '\.\/FrontierReactionLoop'/);
  assert.doesNotMatch(dock, /from '\.\/FrontierSensorQcControl'/);
  assert.doesNotMatch(dock, /from '\.\/audio\/useUIFrequencies'/);
  assert.doesNotMatch(dock, /addEventListener\('scroll'|addEventListener\('pointermove'/);

  assert.match(lab, /FrontierReactionLoop/);
  assert.match(lab, /FrontierSensorQcControl/);
  assert.match(lab, /useUIFrequencies/);
  assert.match(qc, /setInterval\(refresh, 500\)/);

  assert.match(header, /dynamic\([\s\S]*FractalThemeEcho/);
  assert.match(header, /data-frontier-minimal-chrome="true"/);
  assert.match(footer, /pathname\?\.startsWith\('\/frontier'\)/);
});
