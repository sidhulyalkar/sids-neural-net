import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/frontier/feed/route.ts', import.meta.url), 'utf8');

test('cold FRONTIER navigation remains snapshot-first for bounded useful paint', () => {
  assert.match(route, /!requestedFocus\.length && !forceFresh/);
  assert.match(route, /getFrontierSnapshotFeed\(\)/);
  assert.match(route, /X-Frontier-Live': 'personal-snapshot'/);
});

test('focused search and manual refresh cannot silently refill from the committed snapshot', () => {
  assert.match(route, /includeSnapshot:\s*false/);
  assert.match(route, /Cache-Control': 'no-store'/);
  assert.match(route, /forceFresh \? 'fresh-live' : 'focused-live'/);
  assert.match(route, /X-Frontier-Result-Count/);
});

test('manual refresh gets a larger bounded live-adapter budget than focused search', () => {
  const focused = Number(route.match(/FOCUSED_LIVE_BUDGET_MS = ([\d_]+)/)?.[1]?.replaceAll('_', ''));
  const refresh = Number(route.match(/MANUAL_REFRESH_BUDGET_MS = ([\d_]+)/)?.[1]?.replaceAll('_', ''));
  assert.ok(Number.isFinite(focused) && focused >= 3_000);
  assert.ok(Number.isFinite(refresh) && refresh > focused && refresh <= 8_000);
});
