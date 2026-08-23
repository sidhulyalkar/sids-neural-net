import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'public/game-runtimes/crownrush');
const indexPath = join(runtimeRoot, 'index.html');
const gamePath = join(runtimeRoot, 'game.js');
const designPath = join(root, 'docs/CROWNRUSH_V01_DESIGN.md');

for (const path of [indexPath, gamePath, designPath]) {
  assert.ok(existsSync(path), `missing Crownrush artifact: ${path}`);
}

execFileSync(process.execPath, ['--check', gamePath], { stdio: 'pipe' });

const index = readFileSync(indexPath, 'utf8');
const game = readFileSync(gamePath, 'utf8');
const design = readFileSync(designPath, 'utf8');

assert.match(index, /<canvas id="c" width="960" height="640"/);
assert.match(index, /\.\.\/game-network-bridge\.js/);
assert.match(index, /\.\/game\.js/);
assert.match(game, /const FIXED_DT = 1 \/ 120/);
assert.match(game, /fixedHz: 120/);
assert.match(game, /window\.CROWNRUSH_DEBUG/);
assert.match(game, /player\.hyper = player\.combo >= 4/);
assert.match(game, /function attachSap\(/);
assert.match(game, /function releaseSap\(/);
assert.match(game, /function rescueFromThreat\(/);
assert.match(game, /function recycleWorld\(/);
assert.match(game, /pointerType !== 'touch'/);
assert.match(game, /const guaranteedKnot = generatedFloor % 4 === 0/);
assert.match(game, /const wasGrounded = Boolean\(player\.grounded\)/);
assert.match(game, /if \(wasGrounded\)[\s\S]*?player\.vy = 0/);
assert.match(game, /if \(!onGround \|\| player\.sap\) player\.vy \+= \(GRAVITY \+ sapForce\.ay\) \* dt/);
assert.match(game, /if \(player\.y < threatY - 95 && !rescueFromThreat\(\)\) endRun\(\)/);
assert.match(game, /Math\.sin\(now \* 0\.083\) \* shake/);
assert.doesNotMatch(
  game,
  /function render\([\s\S]*?\(random\(\) - 0\.5\) \* shake/,
  'render-only camera shake must not consume gameplay RNG'
);
assert.doesNotMatch(game, /\benemy\b|\bdamage\b|\battack\b/i, 'Crownrush runtime should not regress into combat');
assert.match(design, /simple horizontal movement/i);
assert.match(design, /Sapline is not a generic grapple/i);
assert.match(design, /four consecutive skips trigger `CROWNVELOCITY`/i);

console.log(JSON.stringify({
  ok: true,
  runtime: 'crownrush',
  version: '0.1.0',
  fixedHz: 120,
  canvas: [960, 640],
  invariants: ['grounded vertical reset', 'render RNG isolation', 'deep-fall Sap Catch threshold', 'guaranteed knot cadence'],
  mechanics: ['momentum jump', 'bark rebound', 'sapline pump', 'combo skip', 'sap catch'],
}, null, 2));
