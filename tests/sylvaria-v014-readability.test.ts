import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const entry=read('public/game-runtimes/mosslight-v2/v014-entry.js');
const space=read('public/game-runtimes/mosslight-v2/v014/presentation-space-v014.js');
const readability=read('public/game-runtimes/mosslight-v2/v014/combat-readability-v014.js');
const mastery=read('public/game-runtimes/mosslight-v2/v014/enemy-mastery-v014.js');
const ai=read('public/game-runtimes/mosslight-v2/v013/enemy-ai-v013.js');

test('v0.14 projects every 2D tactical overlay through the same logical 960x640 space as WebGL',()=>{
  assert.match(entry,/presentation-space-v014\.js/);
  assert.match(space,/window\.SylvariaDisplayScale\?\.scale/);
  assert.match(space,/ctx\?\.setTransform\(scale,0,0,scale,0,0\)/);
  assert.match(space,/logicalToClient/);
  assert.match(space,/clientToLogical/);
  assert.match(space,/OVERLAY_IDS=Object\.freeze\(\['kineticCanvas','flowCanvas'\]\)/);
});

test('projectile readability grows the visible signal without mutating authoritative projectile radii',()=>{
  assert.match(entry,/combat-readability-v014\.js/);
  assert.match(readability,/saw:Object\.freeze\(\{radius:11\.5,halo:19/);
  assert.match(readability,/reflected:Object\.freeze\(\{radius:12\.5,halo:21/);
  assert.match(readability,/drawProjectiles/);
  assert.doesNotMatch(readability,/\.r\s*=|s\.r\s*=|shot\.r\s*=/);
  assert.match(ai,/r:kind==='saw'\?8:6/);
});

test('advanced kinetic enemies reward readable mastery instead of hidden randomness',()=>{
  assert.match(entry,/enemy-mastery-v014\.js/);
  assert.match(mastery,/striderWhiffPunishTicks:28/);
  assert.match(mastery,/sniperCounterPunishTicks:32/);
  assert.match(mastery,/shellbackRearMultiplier:1\.35/);
  assert.match(mastery,/restoreArmor=e\.armor;e\.armor=0/);
  assert.match(mastery,/finally\{if\(flank&&e&&!e\.dead\)e\.armor=restoreArmor\}/);
  assert.match(mastery,/WHIFF OPEN/);
  assert.match(mastery,/LINE BROKEN/);
  assert.match(mastery,/FLANK/);
  assert.doesNotMatch(mastery,/Math\.random|Date\.now|performance\.now|setTimeout/);
});

test('combat HUD cannot report clear while living enemies remain',()=>{
  assert.match(readability,/const alive=state\.enemies\.filter\(e=>!e\.dead\)/);
  assert.match(readability,/field\.textContent=kinetic\?`\$\{alive\.length\} threats · \$\{kinetic\} elite`/);
  assert.match(readability,/else field\.textContent='clear'/);
});
