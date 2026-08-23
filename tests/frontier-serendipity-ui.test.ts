import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const experience = read('components/frontier/FrontierExperience.tsx');
const waterfall = read('components/frontier/useWaterfallText.ts');
const bridge = read('components/frontier/frontierSearchBridge.ts');
const dock = read('components/frontier/FrontierUtilityDock.tsx');
const card = read('components/frontier/SignalCard.tsx');
const constellation = read('components/frontier/InterestConstellation.tsx');
const packageJson = read('package.json');

test('waterfall search transition remains canonical and reduced-motion safe', () => {
  assert.match(experience, /launchWaterfall\(searchDraft\);/);
  assert.match(experience, /setActiveSearch\(next\);/);
  assert.match(waterfall, /stepWaterfallParticle/);
  assert.match(waterfall, /prefers-reduced-motion: reduce/);
  assert.match(waterfall, /collisionRef/);
  assert.match(packageJson, /"frontier:waterfall"/);
});

test('serendipity affordances submit through the canonical search form', () => {
  assert.match(bridge, /Search FRONTIER topics/);
  assert.match(bridge, /HTMLInputElement\.prototype/);
  assert.match(bridge, /dispatchEvent\(new Event\('input'/);
  assert.match(bridge, /form\.requestSubmit\(\)/);
  assert.doesNotMatch(bridge, /fetch\(/);

  assert.match(dock, /data-frontier-signal-drift/);
  assert.match(dock, /FRONTIER_PINNED_TOPICS/);
  assert.match(dock, /launchFrontierTopicSearch\(candidate\.label\)/);

  assert.match(card, /data-frontier-rabbit-hole/);
  assert.match(card, /frontierRabbitHoleQuery/);
  assert.match(card, /launchFrontierTopicSearch\(rabbitHoleQuery\)/);
});

test('taste constellation uses learned affinity while retaining the local latent map', () => {
  assert.match(constellation, /profile\.topicAffinity/);
  assert.match(constellation, /FrontierLatentCanvas/);
  assert.match(constellation, /data-frontier-interest-constellation/);
  assert.match(constellation, /launchFrontierTopicSearch\(node\.label\)/);
  assert.match(constellation, /FRONTIER_PINNED_TOPICS/);
});
