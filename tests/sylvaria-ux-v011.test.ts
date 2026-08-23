import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const runtimeRoot = 'public/game-runtimes/mosslight-v2';

test('Sylvaria keeps competitive UI restrained and hides it when v0.14 ranking is intentionally unavailable', () => {
  const html = read(`${runtimeRoot}/index.html`);
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  const entry14 = read(`${runtimeRoot}/v014-entry.js`);
  const styles = read(`${runtimeRoot}/sylvaria-minimal-v011.css`);
  assert.match(html, /id="targetWrap" hidden/);
  assert.match(html, /id="targetState"/);
  assert.match(html, /id="rankPanel" class="rankPanel" hidden/);
  assert.match(entry14, /SylvariaRankedDisabledReason='v0\.14 replay verifier migration'/);
  assert.match(competitive, /function nextTarget/);
  assert.match(competitive, /function updatePace/);
  assert.match(competitive, /if\(!current\|\|current\.practice\|\|current\.unrankedReason\|\|state\.mode!=='playing'\)/);
  assert.match(styles, /#targetWrap\[hidden\],#bossWrap\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(competitive, /\b(?:streak|xp|currency)\b|daily quest/i);
});

test('verified leaderboard form behavior remains available to the legacy verified engine without surfacing on unverified v0.14 runs', () => {
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  const styles = read(`${runtimeRoot}/sylvaria-minimal-v011.css`);
  assert.match(competitive, /function rankForm/);
  assert.match(competitive, /if\(form\)form\.hidden=true/);
  assert.match(competitive, /if\(form\)form\.hidden=false/);
  assert.match(competitive, /if\(run\.unrankedReason\)\{/);
  assert.match(competitive, /development build/);
  assert.match(styles, /\.rankForm\[hidden\],\.rankForm \[hidden\]\{display:none!important\}/);
});

test('Learn Controls remains non-ranked and inherits the forgiving opening-parry coaching loop', () => {
  const coach = read(`${runtimeRoot}/v013/coach-v013.js`);
  const competitive = read(`${runtimeRoot}/v011/competitive-v011.js`);
  assert.match(coach, /practice&&enabled&&stage<4/);
  assert.match(coach, /p\.hp=p\.maxHp/);
  assert.match(coach, /tree\.alive=true/);
  assert.match(coach, /tree\.hp=tree\.maxHp/);
  assert.match(coach, /time one clean opening parry/);
  assert.match(coach, /forgiving:practice&&enabled&&stage<4/);
  assert.match(competitive, /if\(!practice&&!reason\)run\.ticketPromise=issueTicket\(run\)/);
});

test('v0.14 player-facing shell teaches attached movement counter terrain and boss mastery instead of obsolete v0.13 copy', () => {
  const html = read(`${runtimeRoot}/index.html`);
  assert.match(html, /CARVE · COUNTER · CREATE THE OPENING|unified kinetic combat/i);
  assert.match(html, /Hold Space while steering/i);
  assert.match(html, /156° tongue sweep/i);
  assert.match(html, /actual mouth|physically anchored to Sprid’s mouth/i);
  assert.match(html, /first five active simulation ticks/i);
  assert.match(html, /1160 px\/s/i);
  assert.match(html, /Bait and punish/i);
  assert.match(html, /Break bosses/i);
  assert.match(html, /Perfect returns, hazard routes, and dash-cuts/i);
  assert.match(html, /Read the rhythm/i);
  assert.doesNotMatch(html, /mid-swing|middle of the active sweep is the sweet spot|short cardinal burst|One extra direction can stay queued/i);
});

test('current player-facing presentation retains clean run-state language while v0.14 overlays own mastery cues', () => {
  const presentation = read(`${runtimeRoot}/v011/presentation-v011.js`);
  const flowPresentation = read(`${runtimeRoot}/v014/flow-presentation-v014.js`);
  assert.match(presentation, /Sprid was overwhelmed\/gi,'run ended'/);
  assert.match(presentation, /PERFECT GROVE\/gi,'ALL TREES SAVED'/);
  assert.match(presentation, /CROSSCUT\/gi,'DOUBLE HIT'/);
  assert.match(presentation, /LONG RETURN\/gi,'LONG HIT'/);
  assert.match(presentation, /F\.rebuildTerrainCache=/);
  assert.match(presentation, /globalAlpha=\.05/);
  assert.match(presentation, /i<16/);
  assert.match(flowPresentation, /function drawPunishWindows/);
  assert.match(flowPresentation, /function drawBossIntent/);
  assert.match(flowPresentation, /function drawBossFlow/);
  assert.match(flowPresentation, /bufferCues/);
  assert.match(flowPresentation, /bossCues/);
});

test('pause and mute continue to reject operating-system key repeat', () => {
  const guard = read(`${runtimeRoot}/v011/input-guard-v011.js`);
  assert.match(guard, /event\.repeat/);
  assert.match(guard, /key==='p'/);
  assert.match(guard, /key==='m'/);
  assert.match(guard, /stopImmediatePropagation/);
});
