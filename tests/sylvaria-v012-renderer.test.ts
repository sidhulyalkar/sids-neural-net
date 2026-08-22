import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root=process.cwd();
const runtime='public/game-runtimes/mosslight-v2';
const read=(path:string)=>readFileSync(join(root,path),'utf8');

test('v0.12 is a presentation release over the qualified v0.11.1 engine season',()=>{
  const entry=read(`${runtime}/v012-entry.js`);
  const replay=read(`${runtime}/v011/replay-v011.js`);
  const server=read('src/lib/sylvaria/replay.ts');
  assert.match(entry,/PRESENTATION='0\.12\.0',ENGINE='0\.11\.1'/);
  assert.match(entry,/import'\.\/v011-entry\.js'/);
  assert.match(replay,/VERSION='0\.11\.1'/);
  assert.match(server,/SYLVARIA_ENGINE_VERSION = '0\.11\.1'/);
  assert.doesNotMatch(entry,/F\.(?:update|updateMovement|updateEnemies|updateShots|cut|dashStep|counterShot)\s*=/);
  assert.match(entry,/F\.render=/);
  assert.match(entry,/F\.updateHud=/);
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

test('WebGL2 renderer implements height-derived normals bounded lights batching and foot-Y sorting',()=>{
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
  for(const pair of ["feller:'fly'","foreman:'bee'","lobbyist:'mosquito'","skidder:'beetle'","drone:'dragonfly'","chair:'hornet'","surveyor:'crane'","mech:'divingBeetle'"])assert.ok(renderer.includes(pair),`missing insect mapping ${pair}`);
  assert.match(renderer,/for\(const s of state\.slashes\)/);
  assert.match(renderer,/emit\('tongue'/);
  assert.doesNotMatch(renderer,/F\.(?:update|cut|dashStep|counterShot)\s*=/);
});

test('pond shell teaches the frog fantasy without changing the eight-key control grammar',()=>{
  const html=read(`${runtime}/index.html`);
  const arcade=read('src/data/arcadeGames.ts');
  assert.match(html,/v0\.12 · frog pond presentation/);
  assert.match(html,/Lily Clearing/);
  assert.match(html,/Tongue-slap incoming attacks back/);
  assert.match(html,/tongue up/);
  assert.match(html,/tongue down/);
  assert.match(html,/tongue left/);
  assert.match(html,/tongue right/);
  assert.match(html,/\.\/v012-entry\.js/);
  assert.match(arcade,/version: 'v0\.12\.0'/);
  assert.match(arcade,/HOP · SLAP · REFLECT\./);
  assert.match(arcade,/frog-and-pond/);
  assert.match(arcade,/WebGL2/);
});

test('v0.12 graphics documentation protects simulation and replay boundaries',()=>{
  const doc=read('docs/SYLVARIA_V012_FROG_POND_GRAPHICS.md');
  assert.match(doc,/authoritative game remains the fully qualified v0\.11\.1 engine/);
  assert.match(doc,/120 Hz fixed simulation tick/);
  assert.match(doc,/840 \/ 1040 px\/s/);
  assert.match(doc,/ranked engine version therefore remains \*\*0\.11\.1\*\*/);
  assert.match(doc,/Only `F\.render` is replaced/);
  assert.match(doc,/≤ 6 dynamic lights/);
  assert.match(doc,/≤ 900 sprite quads hard render cap/);
});
