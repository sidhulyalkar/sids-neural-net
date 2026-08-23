import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const html=read('public/game-runtimes/sylvaria-v2/index.html');
const css=read('public/game-runtimes/sylvaria-v2/sylvaria-v2.css');
const game=read('public/game-runtimes/sylvaria-v2/sylvaria-v2.js');
const arcade=read('src/data/arcadeGames.ts');

test('Sylvaria v2 is a clean horizontal runtime rather than another top-down inheritance layer',()=>{
  assert.match(html,/<title>Sylvaria<\/title>/);
  assert.match(html,/SIDE-VIEW COMBAT PROTOTYPE/);
  assert.match(html,/Simple attacks\. Complicated terrain\./);
  assert.match(arcade,/launchUrl: '\/game-runtimes\/sylvaria-v2\/index\.html'/);
  assert.match(arcade,/title: 'Sylvaria'/);
  assert.doesNotMatch(game,/mosslight|v014-entry|v015-entry|Sylvaria091|Cutstep/);
});

test('movement foundation is deterministic and tuned for a precision platformer',()=>{
  assert.match(game,/DT=1\/120/);
  assert.match(game,/p\.coyote=\.105/);
  assert.match(game,/p\.jumpBuffer=\.12/);
  assert.match(game,/target=move\*285/);
  assert.match(game,/p\.vy=-590-extra/);
  assert.match(game,/if\(!keys\.has\('Space'\)&&p\.vy< -180\)/);
  assert.doesNotMatch(game,/Math\.random/);
});

test('tree geometry is traversal technology',()=>{
  assert.match(game,/const trunks=\[/);
  assert.match(game,/const branches=\[/);
  assert.match(game,/spring:1\.16/);
  assert.match(game,/branchTop=b=>b\.baseY\+b\.flex\*17/);
  assert.match(game,/b\.flex=clamp\(b\.flex\+dt/);
  assert.match(game,/const gripping=p\.wallDir/);
  assert.match(game,/p\.vx=-p\.wallDir\*430;p\.vy=-545/);
  assert.match(game,/state\.stats\.wallLaunches\+\+/);
});

test('vines preserve pendulum momentum and release into traversal',()=>{
  assert.match(game,/const vines=\[/);
  assert.match(game,/const torque=Math\.sin\(v\.angle\)\*-2\.15/);
  assert.match(game,/v\.angVel\+=/);
  assert.match(game,/const tang=v\.angVel\*v\.len/);
  assert.match(game,/p\.vx=Math\.cos\(v\.angle\)\*tang/);
  assert.match(game,/state\.stats\.vineSwings\+\+/);
});

test('combat uses a compact directional machete language with environmental rebound',()=>{
  assert.match(game,/type='side'/);
  assert.match(game,/type='up'/);
  assert.match(game,/type='down'/);
  assert.match(game,/p\.combo%3/);
  assert.match(game,/p\.vy=-520;p\.airStep=true/);
  assert.match(game,/b\.flex=1;p\.vy=-560/);
  assert.match(game,/reflectNail/);
  assert.match(game,/n\.friendly=true/);
});

test('one aerial mobility charge connects routes without replacing platforming',()=>{
  assert.match(game,/airStep:true/);
  assert.match(game,/p\.dashTime=\.115/);
  assert.match(game,/p\.vx=p\.dashDir\.x\*720/);
  assert.match(game,/p\.airStep=false/);
  assert.match(game,/p\.airStep=true/);
  assert.match(html,/SHIFT<\/b> canopy step/);
});

test('first room teaches combat with one logger and one nailgunner',()=>{
  const enemies=(game.match(/kind:'logger'|kind:'nailgun'/g)||[]);
  assert.equal(enemies.length,2);
  assert.match(game,/e\.state='windup';e\.windup=\.34/);
  assert.match(game,/e\.state='strike';e\.clock=\.12/);
  assert.match(game,/e\.recover=\.42/);
  assert.match(game,/e\.state='aim';e\.windup=\.48/);
  assert.match(game,/s=565/);
  assert.match(game,/e\.recover=1\.05/);
});

test('the Old Growth Trial is genuinely multi-screen and has a clear completion condition',()=>{
  assert.match(game,/WORLD_W=3600,WORLD_H=1000/);
  assert.match(game,/const checkpoints=\[/);
  assert.match(game,/state\.player\.x>3380/);
  assert.match(game,/HEARTWOOD OPEN/);
  assert.match(css,/width:100vw;height:100vh/);
});
