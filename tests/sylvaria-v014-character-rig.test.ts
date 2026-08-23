import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const rig = readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/character-rig-v014.js'), 'utf8');
const pond = readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v012/webgl-pond-v012.js'), 'utf8');
const tongue = readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v013/kinetic-presentation-v013.js'), 'utf8');

test('frog atlas forward basis is corrected exactly once by the shared rig', () => {
  assert.match(rig, /SPRITE_FORWARD_OFFSET=Math\.PI\/2/);
  assert.match(rig, /spriteRotation=facingAngle\+SPRITE_FORWARD_OFFSET/);
  assert.match(rig, /localToWorld\(bodyX,bodyY,spriteRotation,0,-bodyH\*\.075\)/);
  assert.doesNotMatch(rig, /requestAnimationFrame|performance\.now|Date\.now|Math\.random/);
});

test('body, mouth, and combat root derive from the same authoritative player state', () => {
  assert.match(rig, /root:Object\.freeze\(\{x:q\(p\.x\),y:q\(p\.y\)\}\)/);
  assert.match(rig, /mouth:Object\.freeze\(mouth\)/);
  assert.match(rig, /function mouthForAttack/);
  assert.match(rig, /function attachmentError/);
  assert.match(rig, /Math\.hypot\(\(s\.x\?\?p\.x\)-pose\.root\.x,\(s\.y\?\?p\.y\)-pose\.root\.y\)/);
});

test('frog renderer consumes the shared body pose instead of inventing a second transform', () => {
  assert.match(pond, /window\.SylvariaCharacterRig\?\.pose\?\.\(p\)/);
  assert.match(pond, /emit\('frog',body\.x,body\.y,body\.w,body\.h,\{rot:body\.rotation/);
  assert.match(pond, /foot:body\.foot/);
});

test('Reactive Blade originates from the rig mouth socket and keeps authoritative reach centered on the attack root', () => {
  assert.match(tongue, /rig\?\.mouthForAttack/);
  assert.match(tongue, /const root=\{x:s\?\.x\?\?p\.x,y:s\?\.y\?\?p\.y\}/);
  assert.match(tongue, /tip=anglePoint\(root,a,length\)/);
  assert.match(tongue, /curveTongue\(s,p,s\.angle,s\.reach,1\)/);
  assert.match(tongue, /tongueAttachmentError:lastTongueAttachmentError/);
});

test('v0.14 attack pose faces the commanded direction while the tongue sweeps independently around the fixed mouth socket', () => {
  assert.match(rig, /if\(slash\)\{const d=DIRS\[slash\.direction\]/);
  assert.doesNotMatch(rig, /slash\.angle.*spriteRotation|spriteRotation.*slash\.angle/);
});
