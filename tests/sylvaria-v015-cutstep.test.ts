import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
const read=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');
const cut=read('public/game-runtimes/mosslight-v2/v015/cutstep-v015.js');
const entry=read('public/game-runtimes/mosslight-v2/v015-entry.js');
const html=read('public/game-runtimes/mosslight-v2/index.html');
const presentation=read('public/game-runtimes/mosslight-v2/v015/cutstep-presentation-v015.js');
const space=read('public/game-runtimes/mosslight-v2/v014/presentation-space-v014.js');

test('v0.15 boots as a Cutstep layer over the qualified v0.14 substrate',()=>{
  assert.match(entry,/await import\('\.\/v014-entry\.js'\)/);
  assert.match(entry,/v015\/cutstep-v015\.js/);
  assert.match(entry,/v015\/forest-world-v015\.js/);
  assert.match(entry,/v015\/cutstep-presentation-v015\.js/);
  assert.match(html,/src="\.\/v015-entry\.js"/);
  assert.match(html,/Sylvaria · Cutstep Forest/);
});

test('movement and aim are independent by construction',()=>{
  assert.match(cut,/const ARROWS=new Set\(\['arrowup','arrowdown','arrowleft','arrowright'\]\)/);
  assert.match(cut,/function arrowVector\(\)/);
  assert.match(cut,/v015MouseAim/);
  assert.match(cut,/source:'arrows'/);
  assert.match(cut,/source:'mouse'/);
  assert.match(html,/WASD never changes your aim/);
  assert.match(html,/Arrow-key chords give crisp 8-way aim/);
});

test('Cutstep launches on press with no charge or release dependency',()=>{
  assert.match(cut,/Space'\)&&!event\.repeat&&state\.mode==='playing'\)\{event\.preventDefault\(\);event\.stopPropagation\(\);launchCutstep\(currentAim\(\)\)/);
  assert.match(cut,/F\.beginDashCharge=\(\)=>false;F\.releaseDashCharge=\(\)=>false/);
  assert.match(cut,/if\(k===' '\|\|event\.code==='Space'\)\{event\.preventDefault\(\);event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(cut,/dashChargeTime/);
  assert.match(html,/There is no charge delay/);
});

test('three short segments and geometry techniques define the player verb',()=>{
  assert.match(cut,/maxSegments:3/);
  assert.match(cut,/distance:86/);
  assert.match(cut,/thrustDistance:104/);
  assert.match(cut,/ticks:9/);
  assert.match(cut,/kind:'thrust'/);
  assert.match(cut,/kind:'crosscut'/);
  assert.match(cut,/kind:'reversal'/);
  assert.match(presentation,/THRUST|thrust/);
  assert.match(presentation,/CROSSCUT|crosscut/);
  assert.match(presentation,/REVERSAL|reversal/);
});

test('an aimed Cutstep owns a fixed line instead of inheriting WASD dash steering',()=>{
  assert.match(cut,/const active=p\.dash\?\.v015Cutstep\?p\.dash:null/);
  assert.match(cut,/if\(active\)state\.heldMoves=new Set\(\)/);
  assert.match(cut,/finally\{if\(active\)state\.heldMoves=held\}/);
  assert.doesNotMatch(cut,/p\.invuln=0/);
});

test('the line is simultaneously movement attack counter and environmental carve',()=>{
  assert.match(cut,/function processLine/);
  assert.match(cut,/reflectShot\(s,dash\.dir,p\)/);
  assert.match(cut,/F\.damageEnemy\?\./);
  assert.match(cut,/F\.damageBoss\?\./);
  assert.match(cut,/f\.cut=true;f\.v015RegrowAt=/);
  assert.match(cut,/F\.breakDeadwood\?\./);
  assert.match(cut,/F\.breakBrittle\?\./);
});

test('one Cutstep can independently return multiple projectiles',()=>{
  assert.match(cut,/dash\.v015HitIds\.has\(s\)/);
  assert.match(cut,/dash\.v015HitIds\.add\(s\)/);
  assert.doesNotMatch(cut,/`shot:\$\{s\}`/);
});

test('segment economy rewards ecology and skilled counters rather than waiting only',()=>{
  assert.match(cut,/passiveRefillPerSecond:\.55/);
  assert.match(cut,/brushRefillPerBlade:\.018/);
  assert.match(cut,/brushRefillCap:\.30/);
  assert.match(cut,/counterRefill:\.42/);
  assert.match(cut,/killRefill:\.48/);
  assert.match(cut,/refill\(p,CUTSTEP_CONFIG\.counterRefill\)/);
  assert.match(cut,/refill\(p,CUTSTEP_CONFIG\.killRefill\)/);
});

test('Cutstep presentation shares the same logical screen space as forest and combat overlays',()=>{
  assert.match(space,/\['forestCanvas','kineticCanvas','flowCanvas','cutstepCanvas'\]/);
  assert.match(presentation,/overlay\.id='cutstepCanvas'/);
  assert.match(presentation,/drawAim/);
  assert.match(presentation,/drawSegments/);
  assert.match(presentation,/drawHistory/);
});

test('authoritative Cutstep rules remain fixed-step deterministic',()=>{
  assert.match(cut,/FIXED_DT/);
  assert.doesNotMatch(cut,/Math\.random|Date\.now|performance\.now|setTimeout|setInterval/);
});
