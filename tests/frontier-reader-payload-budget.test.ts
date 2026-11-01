import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const file = (path: string) => readFileSync(path, 'utf8');

test('first reader navigation serializes 36 full items, not the 96-candidate inventory', () => {
  const page = file('app/frontier/page.tsx');
  const reader = file('components/frontier/FrontierFocusReader.tsx');
  assert.match(page, /initialItems=\{feed\.items\.slice\(0, 36\)\}/);
  assert.match(reader, /fetch\('\/api\/frontier\/feed\?candidates=1'/);
  assert.match(reader, /state\.profile\.meaningfulInteractions > 0/);
  assert.match(reader, /readerInteractedRef\.current/);
  assert.match(reader, /editionVersionRef\.current/);
});

test('public wider candidate endpoint never loads Internet adapters or private preference data', () => {
  const route = file('app/api/frontier/feed/route.ts');
  const early = route.slice(route.indexOf('if (!requestedFocus.length && !forceFresh && !wantsLatest) {'),
    route.indexOf('// Public, query-independent discovery'));
  assert.match(early, /wantsCandidates/);
  assert.match(early, /snapshot\.items\.slice\(0, 96\)/);
  assert.match(early, /getFrontierColdSnapshotFeed/);
  assert.doesNotMatch(early, /await loadLiveDependencies|aggregate|\.profile|history/);
});
