import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/sylvaria-sequoia');
const readRuntime = (name: string) => readFileSync(join(runtimeRoot, name), 'utf8');
const readScript = (name: string) => readFileSync(join(root, 'scripts', name), 'utf8');

test('Cone Token HUD uses the canonical camera projection without hidden renderer globals', () => {
  const hud = readRuntime('03-canopy-economy-hud.js');
  assert.match(hud, /function worldToScreenY\(worldY\)/);
  assert.match(hud, /return H - \(worldY - state\.cameraBottom\);/);
  assert.match(hud, /y: worldToScreenY\(token\.y\)/);
  assert.doesNotMatch(hud, /S\.sy\(/, 'economy HUD must not depend on a renderer-private helper');
});

test('Shift browser qualification advances authoritative fixed-step physics after synthetic resets', () => {
  const harness = readScript('playtest-sylvaria-shift-hold.mjs');
  assert.match(harness, /async function advanceSimulation/);
  assert.match(harness, /S\.update\(S\.state\.FIXED_DT\)/);
  assert.match(harness, /async function advanceUntil/);
  assert.match(harness, /advanceUntil\([\s\S]*'plain Sap release\/vault'/);
  assert.match(harness, /advanceUntil\([\s\S]*'held Shift release\/vault'/);
  assert.doesNotMatch(
    harness,
    /keyboard\.up\('Shift'\);\s*await page\.waitForTimeout\((?:80|110|125)\)/,
    'Sap release completion must not be inferred from a browser wall-clock sleep',
  );
});

test('Sap anti-inflation gate distinguishes Sap-awarded Flow from legitimate traversal combos', () => {
  const harness = readScript('playtest-sylvaria-shift-hold.mjs');
  assert.match(harness, /plainSapComboLinks/);
  assert.match(harness, /event\.type === 'combo-link' && event\.link === 'SAP'/);
  assert.match(harness, /sapStickCleanVaults/);
  assert.doesNotMatch(
    harness,
    /plainVault\.state\.combo !== 0/,
    'a normal floor-skip or route combo must not be misclassified as Sap-created Flow',
  );
});

test('Living Canopy browser qualification preserves authored progression across reloads', () => {
  const harness = readScript('playtest-sylvaria-living-canopy-v2.mjs');
  assert.match(harness, /async function runtimeFrame/);
  assert.match(harness, /async function reloadWithStorage/);
  assert.match(harness, /await page\.reload\(\{ waitUntil: 'networkidle' \}\)/);
  assert.match(harness, /'sylvaria\.sequoia\.wonderMask': '63'/);
  assert.match(harness, /'sylvaria\.sequoia\.heartseedMask': '31'/);
  assert.doesNotMatch(
    harness,
    /page\.addInitScript\([\s\S]*sylvaria\.sequoia\.wonderMask/,
    'a permanent init script must not erase the persisted Wonder state being tested on reload',
  );
  assert.doesNotMatch(
    harness,
    /keyboard\.press\('Space'\);\s*await page\.waitForTimeout\(120\)/,
    'Living Canopy start authority must be behavior-based rather than a fixed browser delay',
  );
});
