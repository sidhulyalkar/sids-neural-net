import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const html=read('public/game-runtimes/sylvaria-v2/index.html');
const css=read('public/game-runtimes/sylvaria-v2/sylvaria-v2.css');
const game=read('public/game-runtimes/sylvaria-v2/game-v2.js');
const arcade=read('src/data/arcadeGames.ts');

test('Sylvaria v2 boots a clean horizontal runtime rather than another top-down inheritance layer',()=>{
  assert.match(html,/<title>Sylvaria<\/title>/);
  assert.match(html,/src="\.\/game-v2\.js"/);
  assert.match(html,/SIDE-VIEW COMBAT PROTOTYPE/);
  assert.match(html,/Simple attacks\. Complicated terrain\./);
  assert.match(arcade,/launchUrl: '\/game-runtimes\/sylvaria-v2\/index\.html'/);
  assert.match(arcade,/title: 'Sylvaria'/);
  assert.doesNotMatch(game,/mosslight|v014-entry|v015-entry|Sylvaria091|Cutstep/);
});

test('movement foundation is deterministic and tuned for a precision platformer',()=>{
  for(const token of ['FIXED_DT = 1 / 120','runSpeed: 285','gravity: 1850','jumpSpeed: 590','coyote: 0.105','jumpBuffer: 0.12','wallLaunchX: 430','wallLaunchY: 545'])assert.ok(game.includes(token),`missing ${token}`);
  assert.match(game,/if \(!keys\.has\('Space'\) && player\.vy < -180\)/);
  assert.doesNotMatch(game,/Math\.random/);
});

test('the guardian starts planted on the first root with no settling drop',()=>{
  assert.match(game,/x: 150, y: 839/);
  assert.match(game,/onGround: true, groundId: 'g0'/);
  assert.match(game,/coyote: MOVE\.coyote/);
});

test('living branches are stateful moving platforms that carry their supported rider',()=>{
  for(const token of ['const branches = [','spring: 1.16','const branchTop = (branch) => branch.baseY + branch.flex * 17','const supported = player.onGround && player.groundId === branch.id','const oldTop = branchTop(branch)','const platformMotion = branchTop(branch) - oldTop','if (supported && platformMotion !== 0) player.y += platformMotion'])assert.ok(game.includes(token),`missing ${token}`);
});

test('Bark Grip and wall launch use tree trunks as traversal technology',()=>{
  assert.match(game,/function detectWall\(player\)/);
  assert.match(game,/const gripping = player\.wallDir/);
  assert.match(game,/player\.vx = -player\.wallDir \* MOVE\.wallLaunchX/);
  assert.match(game,/player\.vy = -MOVE\.wallLaunchY/);
  assert.match(game,/state\.stats\.wallLaunches\+\+/);
});

test('vines preserve pendulum momentum and release into traversal',()=>{
  assert.match(game,/const vines = \[/);
  assert.match(game,/const torque = -Math\.sin\(vine\.angle\) \* 2\.15/);
  assert.match(game,/const tangent = vine\.angVel \* vine\.len/);
  assert.match(game,/player\.vx = Math\.cos\(vine\.angle\) \* tangent/);
  assert.match(game,/state\.stats\.vineSwings\+\+/);
});

test('combat uses directional machete attacks while projectile defense starts earlier than melee damage',()=>{
  for(const token of ["let type = 'side'","type = 'up'","type = 'down'",'meleeStartup: 0.035','deflectWindow: 0.12','function attackBox(player)','function deflectBox(player)','player.attack.deflected.add(nail)','reflectNail(nail, player, player.attack)'])assert.ok(game.includes(token),`missing ${token}`);
  assert.match(game,/player\.attack\.time < COMBAT\.meleeStartup/);
  assert.match(game,/player\.attack\.time > COMBAT\.deflectWindow/);
});

test('downslash rebounds from enemies and living branches',()=>{
  assert.match(game,/player\.vy = -520/);
  assert.match(game,/branch\.flex = 1/);
  assert.match(game,/player\.vy = -560/);
  assert.match(game,/player\.airStep = true/);
});

test('one aerial Canopy Step connects routes without replacing platforming',()=>{
  for(const token of ['canopySpeed: 720','canopyTime: 0.115','function startCanopyStep()','player.airStep = false','state.stats.canopySteps++'])assert.ok(game.includes(token),`missing ${token}`);
  assert.match(html,/SHIFT<\/b> canopy step/);
});

test('the first room teaches standard combat with exactly one Logger and one Nailgun Ranger',()=>{
  const enemies=game.match(/kind: 'logger'|kind: 'nailgun'/g)||[];
  assert.equal(enemies.length,2);
  for(const token of ["enemy.state = 'windup'; enemy.windup = 0.34","enemy.state = 'strike'; enemy.clock = 0.12","enemy.recover = 0.42","enemy.state = 'aim'; enemy.windup = 0.48","nailSpeed: 565","enemy.recover = 1.05"])assert.ok(game.includes(token),`missing ${token}`);
});

test('the Old Growth Trial is multi-screen and has an obvious heartwood completion gate',()=>{
  assert.match(game,/WORLD_W = 3600/);
  assert.match(game,/WORLD_H = 1000/);
  assert.match(game,/const checkpoints = \[/);
  assert.match(game,/state\.player\.x > 3380/);
  assert.match(game,/HEARTWOOD OPEN/);
  assert.match(css,/width:100vw;height:100vh/);
});
