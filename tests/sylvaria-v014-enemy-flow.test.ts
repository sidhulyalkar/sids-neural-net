import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/enemy-flow-v014.js'),
  'utf8',
);
const DT = 1 / 120;

test('v0.14 removes hidden dodge odds from agile kinetic enemies', () => {
  assert.match(source, /spec\.dodge=100/);
  assert.match(source, /reactionTicks:12/);
  assert.match(source, /reactionTicks:9/);
  assert.match(source, /reactionTicks:14/);
  assert.doesNotMatch(source, /Math\.random|entityRand|rngFrom/);
});

test('enemy evade cadence is expressed in exact simulation ticks', () => {
  assert.match(source, /cooldownTicks:156/);
  assert.match(source, /cooldownTicks:108/);
  assert.match(source, /cooldownTicks:174/);
  assert.match(source, /e\.arcDodgeCooldown=q\(flow\.cooldownTicks\*DT\)/);

  assert.equal(9 * DT, 0.075);
  assert.equal(108 * DT, 0.9);
});

test('finishing an evade creates one deterministic blade punish window', () => {
  assert.match(source, /punishTicks:20/);
  assert.match(source, /punishTicks:30/);
  assert.match(source, /punishTicks:24/);
  assert.match(source, /e\.v014PunishTimer=q\(flow\.punishTicks\*DT\)/);
  assert.match(source, /source\.arc\|\|source\.melee/);
  assert.match(source, /amount\*=flow\.punishMultiplier/);
  assert.match(source, /e\.v014PunishTimer=0/);
  assert.match(source, /'OPEN'/);
});

test('Strider remains the fastest reactor but exposes a meaningful follow-up window', () => {
  const reaction = 9 * DT;
  const punish = 30 * DT;
  const cooldown = 108 * DT;
  assert.ok(reaction < 0.1);
  assert.ok(punish >= 0.25);
  assert.ok(cooldown >= 0.9);
});

test('enemy flow layer stays fixed-step deterministic', () => {
  assert.doesNotMatch(source, /requestAnimationFrame|performance\.now|Date\.now|setTimeout/);
});
