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
  const styles = read(`${runtimeRoot}/sylvaria-minimal-v011.css`);
  assert.match(html, /id="targetWrap" hidden/);
  assert.match(html, /id="targetState"/);
  assert.match(competitive, /function nextTarget/);
  assert.match(competitive, /function updatePace/);
  assert.match(competitive, /to go/);
  assert.match(competitive, /function provisionalPlacement/);
  assert.match(competitive, /current board/);
  assert.match(styles, /#targetWrap\[hidden\],#bossWrap\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(competitive, /\b(?:streak|xp|currency)\b|daily quest/i);
});

test('verified leaderboard state collapses the input form after it has served its purpose', () => {
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  const styles = read(`${runtimeRoot}/sylvaria-minimal-v011.css`);
  assert.match(competitive, /function rankForm/);
  assert.match(competitive, /if\(form\)form\.hidden=true/);
  assert.match(competitive, /if\(form\)form\.hidden=false/);
  assert.match(styles, /\.rankForm\[hidden\],\.rankForm \[hidden\]\{display:none!important\}/);
});

test('v0.13 Learn Controls is non-ranked and forgiving only until the first successful reflect', () => {
  const coach = read(`${runtimeRoot}/v013/coach-v013.js`);
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  assert.match(coach, /practice&&enabled&&stage<4/);
  assert.match(coach, /p\.hp=p\.maxHp/);
  assert.match(coach, /tree\.alive=true/);
  assert.match(coach, /tree\.hp=tree\.maxHp/);
  assert.match(coach, /time one clean reflect/);
  assert.match(coach, /forgiving:practice&&enabled&&stage<4/);
  assert.match(competitive, /if\(!practice\)run\.ticketPromise=issueTicket\(run\)/);
});

test('v0.13 player-facing shell teaches continuous motion and the opening parry hierarchy', () => {
  const html = read(`${runtimeRoot}/index.html`);
  assert.match(html, /Glide\. Charge\. Sweep\. Return fire\./);
  assert.match(html, /Hold Space to store burst energy/);
  assert.match(html, /wind-up, an active moving arc, and recovery/);
  assert.match(html, /first five active simulation ticks/i);
  assert.match(html, /1160 px\/s return/);
  assert.match(html, /later sweep still cuts enemies/i);
  assert.match(html, /Skimmers orbit, Striders evade/);
  assert.doesNotMatch(html, /mid-swing|middle of the active sweep is the sweet spot|short cardinal burst|One extra direction can stay queued/i);
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
