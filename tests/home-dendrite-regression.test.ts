import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('homepage keeps the original six-primary dendrite morphology', () => {
  const dendrite = readRepoFile('components/neural-atlas-canvas/MinimalDendriteHome.tsx');

  assert.match(dendrite, /const treeRadius = Math\.min\(viewportWidth, viewportHeight\) \* 0\.38/);
  assert.match(dendrite, /const primaryCount = 6/);
  assert.match(dendrite, /const secondaryCount = 2 \+ Math\.floor\(rng\(\) \* 3\)/);
  assert.match(dendrite, /const terminalCount = 1 \+ Math\.floor\(rng\(\) \* 3\)/);
  assert.match(dendrite, /data-home-dendrite="original-six"/);
  assert.match(dendrite, /data-home-dendrite-canvas/);
  assert.match(dendrite, /data-home-soma/);

  assert.doesNotMatch(dendrite, /EDGE_MARGIN_MIN/);
  assert.doesNotMatch(dendrite, /PRIMARY_ENDPOINT_LABELS/);
  assert.doesNotMatch(dendrite, /getOpenLabelPlacement/);
  assert.doesNotMatch(dendrite, /containPath/);
});

test('FRONTIER and Game Network stay peripheral instead of distorting the specimen', () => {
  const home = readRepoFile('app/page.tsx');
  const dendrite = readRepoFile('components/neural-atlas-canvas/MinimalDendriteHome.tsx');

  assert.match(home, /href: '\/frontier'/);
  assert.match(home, /href: '\/arcade'/);
  assert.match(home, /Homepage peripheral destinations/);
  assert.match(home, /data-home-peripheral-portals/);
  assert.match(home, /radar · drift/);
  assert.match(home, /Rabbit Holes and waterfall search/);

  assert.doesNotMatch(dendrite, /FRONTIER/i);
  assert.doesNotMatch(dendrite, /Game Network/i);
});

test('peripheral access points use one minimal dendritic visual grammar', () => {
  const portal = readRepoFile('components/home/DendriticPortalLink.tsx');

  assert.match(portal, /data-gesture-target/);
  assert.match(portal, /data-home-portal=\{tone\}/);
  assert.match(portal, /viewBox="0 0 176 52"/);
  assert.match(portal, /<polygon/);
  assert.match(portal, /strokeLinecap="round"/);
  assert.match(portal, /vectorEffect="non-scaling-stroke"/);
  assert.match(portal, /stroke-cyan\/25/);
  assert.match(portal, /stroke-violet\/25/);
  assert.match(portal, /motion-reduce:transition-none/);

  assert.doesNotMatch(portal, /animate-ping/);
  assert.doesNotMatch(portal, /backdrop-blur/);
});

test('the new FRONTIER discovery affordances remain present behind the dendritic entry point', () => {
  const experience = readRepoFile('components/frontier/FrontierExperience.tsx');
  const utility = readRepoFile('components/frontier/FrontierUtilityDock.tsx');
  const card = readRepoFile('components/frontier/SignalCard.tsx');
  const constellation = readRepoFile('components/frontier/InterestConstellation.tsx');
  const waterfall = readRepoFile('components/frontier/useWaterfallText.ts');

  assert.match(utility, /Signal Drift/);
  assert.match(card, /Rabbit Hole/);
  assert.match(constellation, /Taste constellation/i);
  assert.match(experience, /launchWaterfall/);
  assert.match(waterfall, /stepWaterfallParticle/);
});
