import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/flow-presentation-v014.js'),
  'utf8',
);

test('v0.14 presents Flow as in-world combat state rather than a hidden scalar', () => {
  assert.match(source, /function drawFlowRing/);
  assert.match(source, /p\.flow\|\|0/);
  assert.match(source, /Math\.PI\*2\*flow/);
});

test('buffered blade intent is acknowledged immediately in the requested direction', () => {
  assert.match(source, /function drawBufferedBlade/);
  assert.match(source, /p\.bladeQueuedDirection/);
  assert.match(source, /DIRS\[p\.bladeQueuedDirection\]/);
  assert.match(source, /bufferCues\+\+/);
});

test('post-evade punishability has a visible shrinking enemy-space cue', () => {
  assert.match(source, /function drawPunishWindows/);
  assert.match(source, /e\.v014PunishTimer/);
  assert.match(source, /spec\?\.punishTicks/);
  assert.match(source, /punishCues\+\+/);
  assert.match(source, /ctx\.setLineDash\(\[8,5\]\)/);
});

test('boss guard intent and core openings have direct entity-local presentation', () => {
  assert.match(source, /function drawBossIntent/);
  assert.match(source, /function drawBossFlow/);
  assert.match(source, /b\.v014GuardMax/);
  assert.match(source, /b\.v014PunishTimer>0/);
  assert.match(source, /bossCues\+\+/);
});

test('v0.14 hit-stop freezes the world but redraws every immediate tactical cue', () => {
  assert.match(source, /kind==='parry'\?3:kind==='armor'\?2:1/);
  assert.match(source, /if\(holding\)\{/);
  assert.match(source, /draw\(\);holdFrames--;return/);
  assert.match(source, /drawFlowRing\(state\.player\);drawBufferedBlade\(state\.player\);drawPunishWindows\(\);drawBossFlow\(\)/);
});

test('presentation does not own authoritative movement or combat simulation', () => {
  assert.doesNotMatch(source, /F\.(?:updateMovement|updateEnemies|updateSlashes|cut)\s*=/);
});
