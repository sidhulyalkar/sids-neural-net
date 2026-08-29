import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const workflow = readFileSync(
  join(process.cwd(), '.github/workflows/sylvaria-sequoia-ci.yml'),
  'utf8',
);

test('Sylvaria browser caching cannot weaken the four-engine qualification matrix', () => {
  assert.match(workflow, /uses: actions\/cache@v4/);
  assert.match(workflow, /path: ~\/\.cache\/ms-playwright/);
  assert.match(
    workflow,
    /key: sylvaria-playwright-\$\{\{ runner\.os \}\}-1\.55\.0-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/,
  );
  assert.match(workflow, /playwright@1\.55\.0/);
  assert.match(workflow, /install-deps chromium firefox webkit/);
  assert.match(workflow, /install chromium firefox webkit/);
  assert.match(workflow, /command -v google-chrome/);
  assert.match(workflow, /install chrome/);

  for (const script of [
    'playtest-sylvaria-shift-hold.mjs',
    'playtest-sylvaria-heartwood.mjs',
    'playtest-sylvaria-living-canopy-v2.mjs',
    'playtest-sylvaria-economy.mjs',
    'playtest-sylvaria-sap-authority.mjs',
    'playtest-sylvaria-mastery.mjs',
  ]) {
    assert.match(workflow, new RegExp(script.replaceAll('.', '\\.') ));
  }
});
