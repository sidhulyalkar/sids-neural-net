import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readRepoFile = (path: string) => readFileSync(join(root, path), 'utf8');

test('FRONTIER page turns yield fixed GPU media to native sheet geometry', () => {
  const guard = readRepoFile('components/frontier/FrontierPageTurnMediaGuard.tsx');
  const route = readRepoFile('app/frontier/page.tsx');

  assert.match(route, /<FrontierPageTurnMediaGuard\s*\/>/);
  assert.match(guard, /data-frontier-page-turn-media-guard="native-sheet"/);
  assert.match(guard, /data-frontier-turning="prepare"/);
  assert.match(guard, /data-frontier-turning="turn"/);
  assert.match(guard, /canvas\[aria-hidden="true"\]\[style\*="z-index: 42"\]/);
  assert.match(guard, /opacity:\s*0\s*!important/);
  assert.match(guard, /visibility:\s*hidden\s*!important/);
  assert.doesNotMatch(guard, /data-frontier-turning="idle"[\s\S]*opacity:\s*0/);
});
