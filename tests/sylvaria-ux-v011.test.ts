import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
const root=process.cwd(),read=(path:string)=>readFileSync(join(root,path),'utf8'),runtimeRoot='public/game-runtimes/mosslight-v2';

test('Sylvaria keeps competitive UI restrained and hidden while v0.15 ranking is intentionally unavailable',()=>{
  const html=read(`${runtimeRoot}/index.html`),competitive=read(`${runtimeRoot}/v011/competitive-v011.js`),entry15=read(`${runtimeRoot}/v015-entry.js`),styles=read(`${runtimeRoot}/sylvaria-minimal-v011.css`);
  assert.match(html,/id="targetWrap" hidden/);assert.match(html,/id="rankPanel" class="rankPanel" hidden/);assert.match(entry15,/SylvariaRankedDisabledReason='v0\.15 Cutstep prototype · verifier migration required'/);assert.match(competitive,/if\(!current\|\|current\.practice\|\|current\.unrankedReason\|\|state\.mode!=='playing'\)/);assert.match(styles,/#targetWrap\[hidden\],#bossWrap\[hidden\]\{display:none!important\}/);
});

test('legacy verified leaderboard behavior remains available without surfacing on unverified v0.15 runs',()=>{
  const competitive=read(`${runtimeRoot}/v011/competitive-v011.js`),styles=read(`${runtimeRoot}/sylvaria-minimal-v011.css`);assert.match(competitive,/function rankForm/);assert.match(competitive,/if\(run\.unrankedReason\)\{/);assert.match(competitive,/development build/);assert.match(styles,/\.rankForm\[hidden\],\.rankForm \[hidden\]\{display:none!important\}/);
});

test('v0.15 shell teaches the new independent-aim Cutstep contract',()=>{
  const html=read(`${runtimeRoot}/index.html`);assert.match(html,/CUTSTEP CLEARING/);assert.match(html,/WASD controls body movement only/);assert.match(html,/Arrow-key chords give crisp 8-way aim/);assert.match(html,/mouse gives free-angle aim/i);assert.match(html,/SPACE or left click fires immediately/);assert.match(html,/There is no charge delay/);assert.match(html,/THRUST/);assert.match(html,/CROSSCUT/);assert.match(html,/REVERSAL/);assert.match(html,/Dense ferns and grass obscure threats/);assert.match(html,/forest regrows behind you/);assert.doesNotMatch(html,/Hold Space while steering|156° tongue sweep|first five active simulation ticks|1160 px\/s|Reactive Blade/i);
});

test('the dark forest shell uses temporary visibility and ecological refill as player-facing rules',()=>{
  const html=read(`${runtimeRoot}/index.html`),entry15=read(`${runtimeRoot}/v015-entry.js`),forest=read(`${runtimeRoot}/v015/forest-world-v015.js`);assert.match(html,/Carve visibility/i);assert.match(entry15,/carve brush for micro-refill/i);assert.match(entry15,/forest closes around the fight/i);assert.match(forest,/v015RegrowAt>0&&state\.roomTime>=f\.v015RegrowAt/);assert.match(forest,/drawBrushFog/);
});

test('preserved v0.14 mastery overlays remain available underneath the new player verb',()=>{
  const flow=read(`${runtimeRoot}/v014/flow-presentation-v014.js`),boss=read(`${runtimeRoot}/v014/boss-flow-v014.js`),enemy=read(`${runtimeRoot}/v014/enemy-flow-v014.js`);assert.match(flow,/function drawPunishWindows/);assert.match(flow,/function drawBossFlow/);assert.match(boss,/guardByPhase/);assert.match(enemy,/v014PunishTimer/);
});

test('pause and mute continue to reject operating-system key repeat',()=>{
  const guard=read(`${runtimeRoot}/v011/input-guard-v011.js`);assert.match(guard,/event\.repeat/);assert.match(guard,/key==='p'/);assert.match(guard,/key==='m'/);assert.match(guard,/stopImmediatePropagation/);
});
