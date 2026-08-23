import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root=process.cwd();
const runtime='public/game-runtimes/mosslight-v2';
const read=(path:string)=>readFileSync(join(root,path),'utf8');

test('v0.12 remains a presentation-only foundation beneath the verified v0.13 compatibility engine',()=>{
  const entry12=read(`${runtime}/v012-entry.js`);
  const entry13=read(`${runtime}/v013-entry.js`);
  const server=read('src/lib/sylvaria/replay.ts');
  assert.match(entry12,/PRESENTATION='0\.12\.0',ENGINE='0\.11\.1'/);
  assert.match(entry12,/import'\.\/v011-entry\.js'/);
  assert.doesNotMatch(entry12,/F\.(?:update|updateMovement|updateEnemies|updateShots|cut|dashStep|counterShot)\s*=/);
  assert.match(entry12,/F\.render=/);
  assert.match(entry12,/F\.updateHud=/);
  assert.match(entry13,/import'\.\/v012-entry\.js'/);
  assert.match(entry13,/v013\/kinetic-combat-v013\.js/);
  assert.match(server,/SYLVARIA_ENGINE_VERSION = '0\.13\.0'/);
});

test('frog pond art atlas contains readable player insect terrain and tongue assets without CPU pixel readback or filtered preprocessing',()=>{
  const atlasEntry=read(`${runtime}/v012/art-atlas-v012.js`);
  const art=read(`${runtime}/v012/art-atlas-pro-v012.js`);
  assert.match(atlasEntry,/art-atlas-pro-v012\.js/);
  for(const sprite of ['frog','fly','bee','mosquito','beetle','dragonfly','hornet','moth','crane','divingBeetle','wasp','lilyBed','reeds','driftwood','rock','shrub','mushroom','pickup','lilyPad','tongue','stinger','reflected','water','mud','bank','algae','tangle','shells']) assert.ok(art.includes(`'${sprite}'`),`missing ${sprite}`);
  assert.match(art,/function frog/);
  assert.match(art,/function fastHeight/);
  assert.match(art,/g\.drawImage\(diffuse,0,0\)/);
  assert.doesNotMatch(art,/getImageData|putImageData|willReadFrequently|\.filter\s*=|\.roundRect\(/);
  assert.doesNotMatch(art,/Math\.random/);
});

test('WebGL2 pond renderer still implements height-derived normals bounded lights batching foot-Y sorting and the v0.14 character rig seam',()=>{
  const renderer=read(`${runtime}/v012/webgl-pond-v012.js`);
  assert.match(renderer,/getContext\('webgl2'/);
  assert.match(renderer,/MAX_SPRITES=900,MAX_LIGHTS=6/);
  assert.match(renderer,/float hL=texture\(uHeight/);
  assert.match(renderer,/vec3 normal=normalize/);
  assert.match(renderer,/max\(dot\(normal,lightDir\),0\.0\)/);
  assert.match(renderer,/active\.sort\(\(a,b\)=>a\.layer-b\.layer\|\|a\.foot-b\.foot\)/);
  assert.match(renderer,/gl\.bufferSubData/);
  assert.match(renderer,/webglcontextlost/);
  assert.match(renderer,/canvas-fallback/);
  assert.match(renderer,/ENEMY_ART=Object\.freeze/);
  assert.match(renderer,/SylvariaCharacterRig/);
  for(const pair of ["feller:'fly'","foreman:'bee'","lobbyist:'mosquito'","skidder:'beetle'","drone:'dragonfly'","chair:'hornet'","surveyor:'crane'","mech:'divingBeetle'"])assert.ok(renderer.includes(pair),`missing insect mapping ${pair}`);
  assert.doesNotMatch(renderer,/F\.(?:update|cut|dashStep|counterShot)\s*=/);
});

test('v0.13 kinetic presentation remains the authoritative Reactive Blade renderer and consumes the v0.14 mouth socket when present',()=>{
  const presentation=read(`${runtime}/v013/kinetic-presentation-v013.js`);
  assert.match(presentation,/original\.filter\(s=>s\.kind!=='arc'\)/);
  assert.match(presentation,/state\.slashes=legacy/);
  assert.match(presentation,/state\.slashes=original/);
  assert.match(presentation,/function drawArcAttack/);
  assert.match(presentation,/function drawBladeTrails/);
  assert.match(presentation,/quadraticCurveTo/);
  assert.match(presentation,/s\.phase==='windup'/);
  assert.match(presentation,/s\.phase==='active'/);
  assert.match(presentation,/s\.phaseTime\/s\.recovery/);
  assert.match(presentation,/rig\?\.mouthForAttack/);
  assert.match(presentation,/function resetRoomPresentation/);
  assert.match(presentation,/holdFrames=0;lastHitStopSerial=state\.hitStopSerial\|\|0/);
  assert.match(presentation,/F\.setupRoom=\(\.\.\.args\)=>\{const result=inheritedSetup\(\.\.\.args\);resetRoomPresentation\(\);return result\}/);
  assert.match(presentation,/drawDash/);
  assert.match(presentation,/drawKineticEnemies/);
  assert.doesNotMatch(presentation,/F\.(?:updateMovement|updateEnemies|updateShots|cut)\s*=/);
});

test('production pond shell teaches the v0.14 attached counter movement terrain and boss grammar',()=>{
  const html=read(`${runtime}/index.html`);
  const arcade=read('src/data/arcadeGames.ts');
  assert.match(html,/v0\.14 · unified kinetic combat/);
  assert.match(html,/Lily Clearing/);
  assert.match(html,/156° tongue sweep/);
  assert.match(html,/physically anchored to Sprid’s mouth|actual mouth/i);
  assert.match(html,/first five active simulation ticks/);
  assert.match(html,/glide north/);
  assert.match(html,/blade up/);
  assert.match(html,/hold \/ release dash/);
  assert.match(html,/Break bosses/);
  assert.match(html,/Read the rhythm/);
  assert.match(html,/\.\/v014-entry\.js/);
  assert.match(arcade,/version: 'v0\.14\.0'/);
  assert.match(arcade,/CARVE · COUNTER · CREATE THE OPENING/);
  assert.match(arcade,/one character rig/i);
  assert.match(arcade,/boss guard breaks/i);
  assert.match(arcade,/call-and-response threat phrases/i);
  assert.match(arcade,/webgl2/);
});

test('v0.12 graphics documentation remains a historical presentation contract beneath later combat engines',()=>{
  const doc=read('docs/SYLVARIA_V012_FROG_POND_GRAPHICS.md');
  assert.match(doc,/authoritative game remains the fully qualified v0\.11\.1 engine/);
  assert.match(doc,/120 Hz fixed simulation tick/);
  assert.match(doc,/ranked engine version therefore remains \*\*0\.11\.1\*\*/);
  assert.match(doc,/Only `F\.render` is replaced/);
  assert.match(doc,/≤ 6 dynamic lights/);
  assert.match(doc,/≤ 900 sprite quads hard render cap/);
});
