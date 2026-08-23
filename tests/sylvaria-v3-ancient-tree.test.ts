import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const root='public/game-runtimes/sylvaria-v3';
const html=read(`${root}/index.html`);
const config=read(`${root}/config-v3.js`);
const input=read(`${root}/input-v3.js`);
const world=read(`${root}/world-v3.js`);
const engine=read(`${root}/engine-v3.js`);
const feel=read(`${root}/engine-feel-v3.js`);
const render=read(`${root}/render-v3.js`);
const boot=read(`${root}/game-v3.js`);

test('Sylvaria v3 is a clean modular ancient-tree ascent runtime',()=>{
  for(const moduleName of ['config-v3.js','input-v3.js','world-v3.js','engine-v3.js','engine-feel-v3.js','render-v3.js','game-v3.js'])assert.ok(read(`${root}/${moduleName}`).length>100,`missing ${moduleName}`);
  assert.match(html,/ANCIENT TREE ASCENT/);
  assert.match(html,/game-v3\.js/);
  assert.match(boot,/engine-feel-v3\.js/);
  assert.match(config,/VERSION='3\.0\.0-alpha\.1'/);
  for(const source of [config,input,world,engine,feel,render,boot])assert.doesNotMatch(source,/mosslight|v015-entry|sylvaria-v2\/|Cutstep/);
});

test('movement is fast, deterministic, buffered, and built for upward flow',()=>{
  assert.match(config,/FIXED_DT=1\/120/);
  assert.match(config,/runSpeed:355/);
  assert.match(config,/groundAccel:3300/);
  assert.match(config,/airAccel:2250/);
  assert.match(config,/jumpSpeed:690/);
  assert.match(config,/coyote:0\.11/);
  assert.match(config,/jumpBuffer:0\.13/);
  assert.match(config,/wallLaunchX:500/);
  assert.match(config,/wallLaunchY:660/);
  assert.match(config,/airDashSpeed:825/);
  assert.match(engine,/p\.airDash=true/);
  assert.match(engine,/this\.zone\(\)\.wind\*130\*dt/);
  for(const source of [config,world,engine,feel]){assert.doesNotMatch(source,/Math\.random/);assert.doesNotMatch(source,/Date\.now|performance\.now/)}
});

test('neutral air preserves earned momentum instead of auto-braking vine and rebound routes',()=>{
  assert.match(feel,/preserveMomentum=!p\.onGround&&!p\.vineId&&p\.dashTime<=0&&this\.input\.axisX\(\)===0/);
  assert.match(feel,/const retained=Math\.abs\(incomingVx\)\*0\.995/);
  assert.match(feel,/if\(Math\.abs\(p\.vx\)<retained\)p\.vx=Math\.sign\(incomingVx\)\*retained/);
});

test('default controls use arrows for movement and D for the machete and are actually rebindable',()=>{
  assert.match(config,/left:'ArrowLeft'/);
  assert.match(config,/right:'ArrowRight'/);
  assert.match(config,/up:'ArrowUp'/);
  assert.match(config,/down:'ArrowDown'/);
  assert.match(config,/attack:'KeyD'/);
  assert.match(config,/jump:'Space'/);
  assert.match(input,/localStorage\.setItem\(STORAGE_KEY/);
  assert.match(input,/beginCapture\(action\)/);
  assert.match(input,/this\.bindings\[action\]=code/);
  assert.match(input,/this\.bindings=\{\.\.\.DEFAULT_BINDINGS\}/);
  assert.match(html,/CUSTOMIZE CONTROLS/);
  assert.match(html,/Bindings are saved on this device/);
});

test('the ancient tree contains five escalating vertical regions and precision-scale branches',()=>{
  for(const name of ['ROOTWARD BASE','SAPWOOD SPLIT','HOLLOW SCAR','CANOPY GAUNTLET','HEARTWOOD CROWN'])assert.match(world,new RegExp(name));
  assert.match(config,/WORLD=\{w:1760,h:6400\}/);
  const widths=[...world.matchAll(/w:(\d+),h:(?:1[678]|20|22|24),type:/g)].map(match=>Number(match[1]));
  assert.ok(widths.length>=25,`expected authored narrow platforms, got ${widths.length}`);
  assert.ok(widths.filter(width=>width<=150).length>=20,'most traversal platforms must stay precision-scale');
  assert.match(world,/type:'spring'/);
  assert.match(world,/type:'dead'/);
  assert.match(world,/type:'sap'/);
  assert.match(world,/type:'industrial'/);
  assert.match(engine,/platform\.standTime>\.52/);
  assert.match(engine,/platform\.sapCharged=false/);
});

test('tree traversal multiplies mechanics instead of adding extra buttons',()=>{
  assert.match(engine,/detectWall\(\)/);
  assert.match(engine,/p\.vx=-p\.wallDir\*MOVE\.wallLaunchX/);
  assert.match(engine,/tryGrabVine\(\)/);
  assert.match(engine,/const tangent=v\.angVel\*v\.len/);
  assert.match(engine,/ground&&ground\.type==='spring'/);
  assert.match(engine,/this\.bounce\(COMBAT\.plungeBounce\)/);
  assert.match(engine,/p\.airDash=true/);
  assert.match(engine,/dropTimer=\.18/);
});

test('one D attack button supports grounded, aerial, wall, plunge and dash combat contexts',()=>{
  for(const profile of ['side','up','down','wall','dash','plunge'])assert.match(config,new RegExp(`${profile}:\\{startup:`));
  assert.match(engine,/if\(p\.dashTime>0\|\|p\.dashRecover>0\)type='dash'/);
  assert.match(engine,/else if\(p\.wallDir&&!p\.onGround\)type='wall'/);
  assert.match(feel,/type=p\.vy>480\?'plunge':'down'/);
  assert.match(feel,/else if\(this\.input\.is\('up'\)\)type='up'/);
  assert.match(engine,/projectileDeflectWindow/);
  assert.match(engine,/reflectProjectile/);
  assert.match(engine,/a\.type==='down'\|\|a\.type==='plunge'/);
  assert.match(engine,/a\.type==='side'&&p\.combo===3/);
});

test('pressing D creates defensive blade coverage immediately before projectile travel advances',()=>{
  assert.match(feel,/this\.deflectNearbyProjectiles\(\)/);
  assert.match(feel,/deflectNearbyProjectiles\(\)/);
  assert.match(feel,/const p=this\.state\.player,box=this\.attackBox\(true\)/);
  assert.match(feel,/this\.reflectProjectile\(shot\)/);
});

test('aerial combat turns downward hits into traversal rather than stopping the player',()=>{
  assert.match(config,/downBounce:610/);
  assert.match(config,/plungeBounce:735/);
  assert.match(engine,/this\.bounce\(a\.type==='plunge'\?COMBAT\.plungeBounce:COMBAT\.downBounce\)/);
  assert.match(engine,/p\.vy=-power;p\.airDash=true/);
  assert.match(engine,/this\.state\.stats\.sapBounces\+\+/);
  assert.match(engine,/platform\.type==='dead'/);
});

test('enemy pressure escalates from standard combat into spatial interference',()=>{
  for(const kind of ['logger','ranger','climber','drone','trapper'])assert.match(world,new RegExp(`kind:'${kind}'`));
  assert.match(engine,/updateLogger/);
  assert.match(engine,/updateRanger/);
  assert.match(engine,/updateClimber/);
  assert.match(engine,/updateDrone/);
  assert.match(engine,/updateTrapper/);
  assert.match(engine,/this\.state\.traps\.push/);
  assert.match(world,/kind:'saw'/);
  assert.ok((world.match(/kind:'saw'/g)||[]).length>=4);
});

test('the Crown Feller is a real three-phase mastery boss rather than a larger normal enemy',()=>{
  assert.match(world,/name:'CROWN FELLER'/);
  assert.match(world,/hp:24,maxHp:24/);
  assert.match(engine,/bossPhase\(hp\)\{return hp>16\?1:hp>8\?2:3\}/);
  assert.match(engine,/b\.maxGuard=2\+phase/);
  assert.match(engine,/\['down','plunge','dash'\]\.includes\(a\.type\)/);
  assert.match(engine,/axeWindup/);
  assert.match(engine,/volleyWindup/);
  assert.match(engine,/sawWindup/);
  assert.match(feel,/beforeGuard>0&&boss\.guard===0/);
  assert.match(html,/bossHud/);
});

test('presentation follows the approved dark realistic old-growth target while preserving gameplay contrast',()=>{
  assert.match(render,/approved-old-growth-art-direction/);
  assert.match(render,/distantTrees/);
  assert.match(render,/drawBarkWall/);
  assert.match(render,/drawPlatform/);
  assert.match(render,/drawGuardian/);
  assert.match(render,/drawBoss/);
  assert.match(render,/COLORS\.blade/);
  assert.match(render,/machete|blade/i);
  assert.match(html,/SYLVARIA/);
  assert.doesNotMatch(html,/Hollow Knight|Silksong/);
});
