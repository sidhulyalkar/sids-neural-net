import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const runtimeRoot = 'public/game-runtimes/mosslight-v2';

test('Sylvaria keeps competition visible as one restrained chase target', () => {
  const html = read(`${runtimeRoot}/index.html`);
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  assert.match(html, /id="targetWrap" hidden/);
  assert.match(html, /id="targetState"/);
  assert.match(competitive, /function nextTarget/);
  assert.match(competitive, /function updatePace/);
  assert.match(competitive, /to go/);
  assert.match(competitive, /function provisionalPlacement/);
  assert.match(competitive, /current board/);
  assert.doesNotMatch(competitive, /\b(?:streak|xp|currency)\b|daily quest/i);
});

test('Learn Controls is non-ranked and forgiving only until the first successful reflect', () => {
  const coach = read(`${runtimeRoot}/v011/coach-v011.js`);
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  assert.match(coach, /practice&&enabled&&stage<4/);
  assert.match(coach, /p\.hp=p\.maxHp/);
  assert.match(coach, /tree\.alive=true/);
  assert.match(coach, /tree\.hp=tree\.maxHp/);
  assert.match(coach, /land one reflect/);
  assert.match(coach, /forgiving:practice&&enabled&&stage<4/);
  assert.match(competitive, /if\(!practice\)run\.ticketPromise=issueTicket\(run\)/);
});

test('current player-facing presentation removes legacy names and reduces decorative lattice contrast', () => {
  const presentation = read(`${runtimeRoot}/v011/presentation-v011.js`);
  assert.match(presentation, /Sprid was overwhelmed\/gi,'run ended'/);
  assert.match(presentation, /PAC-a-Saw phase 2/);
  assert.match(presentation, /BOSS · phase 2/);
  assert.match(presentation, /PAC-a-Saw phase 3/);
  assert.match(presentation, /BOSS · phase 3/);
  assert.match(presentation, /PERFECT GROVE\/gi,'ALL TREES SAVED'/);
  assert.match(presentation, /CROSSCUT\/gi,'DOUBLE HIT'/);
  assert.match(presentation, /LONG RETURN\/gi,'LONG HIT'/);
  assert.match(presentation, /F\.rebuildTerrainCache=/);
  assert.match(presentation, /globalAlpha=\.05/);
  assert.match(presentation, /i<16/);
});

test('pause and mute continue to reject operating-system key repeat', () => {
  const guard = read(`${runtimeRoot}/v011/input-guard-v011.js`);
  assert.match(guard, /event\.repeat/);
  assert.match(guard, /key==='p'/);
  assert.match(guard, /key==='m'/);
  assert.match(guard, /stopImmediatePropagation/);
});
