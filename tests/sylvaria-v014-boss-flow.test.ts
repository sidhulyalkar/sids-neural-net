import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const boss = readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/boss-flow-v014.js'), 'utf8');
const presentation = readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/flow-presentation-v014.js'), 'utf8');

test('boss guard escalates across phases without becoming a raw HP sponge', () => {
  assert.match(boss, /guardByPhase:Object\.freeze\(\{1:3,2:4,3:5\}\)/);
  assert.match(boss, /punishTicksByPhase:Object\.freeze\(\{1:36,2:30,3:24\}\)/);
  assert.match(boss, /bladePunishMultiplier:1\.35/);
  assert.match(boss, /guardedHpMultiplier:0/);
});

test('closed guard owns HP admission instead of acting as a decorative second meter', () => {
  assert.match(boss, /guarding=!open&&\(b\.v014Guard\?\?guardMax\(b\.phase\)\)>0/);
  assert.match(boss, /hpAmount=guarding\?amount\*BOSS_FLOW_CONFIG\.guardedHpMultiplier/);
  assert.match(boss, /function rejectGuardedDamage/);
  assert.match(boss, /GUARD · RETURN \/ ROUTE \/ DASH-CUT/);
});

test('high-skill interactions crack guard through counters environment and committed dash-cuts', () => {
  assert.match(boss, /counterQuality==='perfect'/);
  assert.match(boss, /perfectReturnGuardDamage:2/);
  assert.match(boss, /if\(source\.hazard\)/);
  assert.match(boss, /source\.attack\?\.dashCancelled&&b\.state==='telegraph'/);
  assert.match(boss, /telegraphDashCutGuardDamage:1/);
});

test('guard break creates a deterministic core opening but does not delete live projectiles', () => {
  assert.match(boss, /b\.v014PunishTimer=q\(punishDuration\(b\.phase\)\)/);
  assert.match(boss, /b\.telegraph=0;b\.intent=null;b\.state='recover'/);
  assert.doesNotMatch(boss, /state\.shots\s*=|\.shots\.splice|shot\.dead/);
  assert.match(boss, /'CORE OPEN'/);
});

test('phase transitions reset guard instead of carrying stale guard state between boss phases', () => {
  assert.match(boss, /if\(state\.boss\.phase!==phaseBefore\)\{initBossFlow\(state\.boss\);return result\}/);
  assert.match(boss, /if\(b\.phase!==b\.v014LastPhase\)\{initBossFlow\(b\)\}/);
});

test('boss mastery state has direct entity-space visual language', () => {
  assert.match(presentation, /function drawBossIntent/);
  assert.match(presentation, /function drawBossFlow/);
  assert.match(presentation, /b\.v014GuardMax/);
  assert.match(presentation, /b\.v014PunishTimer/);
  assert.match(presentation, /bossCues\+\+/);
});

test('boss flow remains fixed-step deterministic', () => {
  assert.doesNotMatch(boss, /requestAnimationFrame|performance\.now|Date\.now|setTimeout|Math\.random/);
});
