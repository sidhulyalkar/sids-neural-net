import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const routePath = path.resolve('app/api/frontier/feed/route.ts');
const snapshotPath = path.resolve('lib/frontier/snapshotFeed.ts');

function source(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

test('passive FRONTIER feed does not statically import the live discovery graph', () => {
  const route = source(routePath);
  const staticImports = route
    .split('\n')
    .filter((line) => /^import\s/.test(line) && !/^import\s+type\s/.test(line))
    .join('\n');

  for (const forbidden of [
    '@/lib/frontier/aggregate',
    '@/lib/frontier/sportsStateCdnRequest',
    '@/lib/frontier/interests',
    '@/lib/frontier/personalTaste',
  ]) {
    assert.ok(
      !staticImports.includes(forbidden),
      `cold feed statically imports live-only module ${forbidden}`,
    );
  }

  assert.match(route, /getFrontierColdSnapshotFeed/, 'passive route lost its lightweight snapshot authority');
  assert.match(route, /import\(['"]@\/lib\/frontier\/aggregate['"]\)/, 'focused/live path must still lazy-load integrated discovery');
  assert.match(route, /if \(!requestedFocus\.length && !forceFresh\)/, 'snapshot branch must remain before live dependency loading');

  const snapshotBranch = route.indexOf('if (!requestedFocus.length && !forceFresh)');
  const liveLoad = route.indexOf('const dependencies = await loadLiveDependencies()');
  assert.ok(snapshotBranch >= 0 && liveLoad > snapshotBranch, 'live graph can initialize before the passive snapshot branch returns');
});

test('cold snapshot module contains no live adapters or network discovery imports', () => {
  const snapshot = source(snapshotPath);
  for (const forbidden of [
    'aggregate',
    'activeSportsSources',
    'expandedSourcesShared',
    'liveDiscovery',
    'personalSources',
    'personalTasteSources',
    'screenSources',
    'sourceIngestorShared',
    'sportsAnalyticsSources',
    'sportsClipSources',
    'sportsStateDeepSources',
    'sportsStateSources',
    'toolingRadarSources',
    'vimeoSource',
    'watchableSources',
  ]) {
    assert.ok(!snapshot.includes(`from './${forbidden}'`), `cold snapshot imports ${forbidden}`);
  }
  assert.match(snapshot, /vetFrontierItems/, 'cold archive must still re-run current provenance policy');
  assert.match(snapshot, /needsEnglishTranslation/, 'cold archive must still enforce English readability');
  assert.match(snapshot, /ageDays > 10/, 'cold archive must remain time-bounded');
});
