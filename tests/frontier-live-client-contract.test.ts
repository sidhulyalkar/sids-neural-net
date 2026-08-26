import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const experience = readFileSync(new URL('../components/frontier/FrontierExperience.tsx', import.meta.url), 'utf8');

test('manual refresh always returns to the live server rather than consuming the pending queue as a substitute', () => {
  const block = experience.match(/const manualRefresh = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[[^\]]+\]\);/)?.[1] ?? '';
  assert.match(block, /clearPending\(\)/);
  assert.match(block, /await loadFeed\(true\)/);
  assert.match(block, /requestPoll\('manual-refresh'\)/);
  assert.doesNotMatch(block, /flushPending/);
  assert.doesNotMatch(block, /pendingCount/);
});

test('manual live pulls carry an explicit cache-busting request identity', () => {
  assert.match(experience, /params\.set\('fresh', '1'\)/);
  assert.match(experience, /params\.set\('request', `\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/);
  assert.match(experience, /cache: 'no-store'/);
});

test('passive navigation is snapshot-first while explicit search and refresh retain live focus', () => {
  const block = experience.match(/const loadFeed = useCallback\(async \(forceFresh = false\) => \{([\s\S]*?)\n  \}, \[[^\]]+\]\);/)?.[1] ?? '';
  assert.match(block, /const primaryFocus = forceFresh \|\| activeSearch \? focusSignature : '';/);
  assert.match(block, /const payload = await fetchPayload\(primaryFocus\);/);
  assert.doesNotMatch(block, /const payload = await fetchPayload\(focusSignature\);/);
  assert.doesNotMatch(block, /const wide = await fetchPayload\(''\);/);
});

test('opportunistic local feed cache is bounded to hours rather than a day-plus stale window', () => {
  assert.match(experience, /FEED_CACHE_MAX_AGE_MS = 4 \* 60 \* 60_000/);
});
