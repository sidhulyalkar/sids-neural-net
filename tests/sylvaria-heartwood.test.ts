import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { arcadeGames } from '../src/data/arcadeGames';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Sylvaria advertises a finite Heartwood objective beyond score', () => {
  const game = arcadeGames.find((entry) => entry.slug === 'sylvaria-sequoia');
  assert.ok(game);
  assert.match(game.subtitle, /HEARTSEEDS/);
  assert.match(game.subtitle, /WAKE THE CROWN/);
  assert.match(game.description, /five persistent Heartseeds/i);
  assert.match(game.description, /Living Crown at floor 250/i);
  assert.match(game.description, /BREAKAWAY/);
  assert.match(game.description, /PENDULUM/);
  assert.match(game.description, /CONEFALL/);
  assert.match(game.description, /THUNDERCROWN/);
  assert.ok(game.controls.some((control) => control.input === 'Heartseeds'));
  assert.ok(game.controls.some((control) => control.input === 'Living Crown · floor 250'));
});

test('Heartwood objective and canopy trials are wired into the v0.4 runtime', () => {
  const runtimeRoot = 'public/game-runtimes/sylvaria-sequoia';
  for (const file of ['02-heartwood-quest.js', '02-canopy-trials.js', '03-heartwood-trials-render.js']) {
    assert.ok(existsSync(join(root, runtimeRoot, file)), `missing ${file}`);
  }

  const index = read(`${runtimeRoot}/index.html`);
  const quest = read(`${runtimeRoot}/02-heartwood-quest.js`);
  const trials = read(`${runtimeRoot}/02-canopy-trials.js`);
  const render = read(`${runtimeRoot}/03-heartwood-trials-render.js`);
  const hud = read(`${runtimeRoot}/03-canopy-progress-hud.js`);

  assert.match(index, /02-canopy-progression\.js[\s\S]*02-heartwood-quest\.js[\s\S]*02-canopy-trials\.js/);
  assert.match(index, /03-sap-stick-control-hud\.js[\s\S]*03-heartwood-trials-render\.js[\s\S]*03-canopy-progress-hud\.js/);
  assert.match(index, /Crown marks every 25 floors/i);
  assert.match(index, /find 5 Heartseeds/i);
  assert.match(index, /Living Crown at 250/i);

  assert.match(quest, /FINAL_CROWN_FLOOR = 250/);
  assert.match(quest, /ROOTLIGHT[\s\S]*floor: 22/);
  assert.match(quest, /REDSTAR[\s\S]*floor: 58/);
  assert.match(quest, /SAPHEART[\s\S]*floor: 103/);
  assert.match(quest, /SKYSEED[\s\S]*floor: 153/);
  assert.match(quest, /CROWNCORE[\s\S]*floor: 218/);
  assert.match(quest, /sylvaria\.sequoia\.heartseedMask/);
  assert.match(quest, /sylvaria\.sequoia\.crownAwakened/);
  assert.doesNotMatch(quest, /state\.routeRng\.next\(/);

  for (const grammar of ['BREAKAWAY', 'PENDULUM', 'CONEFALL', 'THUNDERCROWN']) {
    assert.match(trials, new RegExp(`${grammar}:`));
  }
  assert.match(trials, /fragile-branch-break/);
  assert.match(trials, /_trialSway/);
  assert.match(trials, /function spawnCone\(/);
  assert.doesNotMatch(trials, /state\.routeRng\.next\(/);

  assert.match(render, /heartwood-trials-render-v1/);
  assert.match(render, /function drawHeartseed\(/);
  assert.match(render, /function drawLivingCrown\(/);
  assert.match(render, /function drawCones\(/);
  assert.doesNotMatch(render, /routeRng\.next\(/);

  assert.match(hud, /heartwood-objective-v2/);
  assert.match(hud, /primaryObjective: 'wake the crown with five persistent Heartseeds'/);
});

test('dedicated Heartwood static and four-browser gates remain present', () => {
  const staticGate = read('scripts/validate-sylvaria-heartwood.mjs');
  const browserGate = read('scripts/playtest-sylvaria-heartwood.mjs');
  const workflow = read('.github/workflows/sylvaria-sequoia-ci.yml');
  const pkg = read('package.json');

  assert.match(pkg, /check:sylvaria-heartwood/);
  assert.match(staticGate, /Heartwood quest \+ canopy trial gate passed/);
  assert.match(browserGate, /name: 'chrome-stable'/);
  assert.match(browserGate, /chromium/);
  assert.match(browserGate, /firefox/);
  assert.match(browserGate, /webkit/);
  assert.match(browserGate, /Heartseed pickup did not bank \+ refill correctly/);
  assert.match(browserGate, /Breakaway branch lifecycle failed/);
  assert.match(browserGate, /Living Crown completion did not persist/);
  assert.match(workflow, /Validate Heartwood quest and canopy trials across four engines/);
  assert.match(workflow, /artifacts\/sylvaria-sequoia-heartwood/);
});
