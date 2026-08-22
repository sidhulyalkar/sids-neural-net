import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/threat-manager-v014.js'),
  'utf8',
);

function profileArgs() {
  const block = source.match(/ROOM_THREAT_PROFILES=Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  return [...block.matchAll(/P\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+),'([^']+)'\)/g)].map(match => ({
    gapMin: Number(match[1]), gapMax: Number(match[2]), budget: Number(match[3]), maxAttacks: Number(match[4]),
    restTicks: Number(match[5]), punishGraceTicks: Number(match[6]), accent: match[7],
  }));
}

const profiles = profileArgs();

test('every fixed Sylvaria room has an explicit rhythmic threat profile', () => {
  assert.equal(profiles.length, 30);
  assert.equal(new Set(profiles.map(profile => profile.accent)).size, 30);
});

test('heavy telegraph micro-phrases remain inside the authored six-to-twelve tick cadence', () => {
  for (const [index, profile] of profiles.entries()) {
    assert.ok(profile.gapMin >= 6, `room ${index + 1} gapMin ${profile.gapMin}`);
    assert.ok(profile.gapMax <= 12, `room ${index + 1} gapMax ${profile.gapMax}`);
    assert.ok(profile.gapMin <= profile.gapMax, `room ${index + 1} inverted gap`);
    assert.ok(profile.restTicks > profile.gapMax, `room ${index + 1} phrase rest should be distinct from an ordinary beat`);
  }
});

test('the three ten-room acts tighten cadence and raise simultaneous phrase capacity deliberately', () => {
  const acts = [profiles.slice(0, 10), profiles.slice(10, 20), profiles.slice(20, 30)];
  const average = (rows: typeof profiles, key: 'gapMin' | 'budget' | 'maxAttacks') => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  assert.ok(average(acts[0], 'gapMin') > average(acts[1], 'gapMin'));
  assert.ok(average(acts[1], 'gapMin') > average(acts[2], 'gapMin'));
  assert.ok(average(acts[0], 'budget') < average(acts[1], 'budget'));
  assert.ok(average(acts[1], 'budget') < average(acts[2], 'budget'));
  assert.ok(average(acts[0], 'maxAttacks') < average(acts[2], 'maxAttacks'));
});

test('call-and-response role ordering prevents repeated coverage from dominating a phrase', () => {
  assert.match(source, /coverage:Object\.freeze\(\['engage','precision','support','heavy','coverage'\]\)/);
  assert.match(source, /engage:Object\.freeze\(\['precision','coverage','support','heavy','engage'\]\)/);
  assert.match(source, /precision:Object\.freeze\(\['engage','coverage','heavy','support','precision'\]\)/);
  assert.match(source, /while\(unscheduled\.length\)\{\s*unscheduled\.sort\(candidateSort\)/);
});

test('threat cost and phrase budget distinguish coverage engage precision heavy and support pressure', () => {
  assert.match(source, /coverage:2/);
  assert.match(source, /engage:1/);
  assert.match(source, /precision:2/);
  assert.match(source, /heavy:3/);
  assert.match(source, /support:1/);
  assert.match(source, /phraseCost\+item\.cost>profile\.budget/);
  assert.match(source, /phraseAttacks>=profile\.maxAttacks/);
  assert.match(source, /nextSlotTick\+profile\.restTicks/);
});

test('post-evade vulnerability opens one fixed scheduler grace edge without deleting existing projectiles', () => {
  assert.match(source, /if\(open&&!punishWindowActive\)/);
  assert.match(source, /pushQueuePastGrace\(punishGraceUntil\)/);
  assert.doesNotMatch(source, /state\.shots\s*=|pendingShots\s*=\[\]/);
});

test('threat orchestration is fixed-step deterministic and contains no wall-clock or random scheduling APIs', () => {
  assert.match(source, /tick\+\+/);
  assert.match(source, /hash\(`v014-threat:/);
  assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval/);
});
