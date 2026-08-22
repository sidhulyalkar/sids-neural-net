import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v014/threat-manager-v014.js'),
  'utf8',
);
const roomsSource = readFileSync(
  join(process.cwd(), 'public/game-runtimes/mosslight-v2/v011/rooms-v011.js'),
  'utf8',
);

function profileArgs() {
  const block = source.match(/ROOM_THREAT_PROFILES=Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  return [...block.matchAll(/P\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+),'([^']+)'\)/g)].map(match => ({
    gapMin: Number(match[1]), gapMax: Number(match[2]), budget: Number(match[3]), maxAttacks: Number(match[4]),
    restTicks: Number(match[5]), punishGraceTicks: Number(match[6]), accent: match[7],
  }));
}
function threatTitles() {
  const block = source.match(/ROOM_PROFILE_TITLES=Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)'/g)].map(match => match[1]);
}
function authoredRoomTitles() {
  return [...roomsSource.matchAll(/R\('([^']+)'/g)].map(match => match[1]).slice(0, 30);
}

const profiles = profileArgs();
const profileTitles = threatTitles();
const roomTitles = authoredRoomTitles();

test('every fixed Sylvaria room has an explicit rhythmic threat profile in the authored roster order', () => {
  assert.equal(profiles.length, 30);
  assert.equal(profileTitles.length, 30);
  assert.equal(roomTitles.length, 30);
  assert.deepEqual(profileTitles, roomTitles);
  assert.ok(profiles.every(profile => profile.accent.length > 0));
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

test('call-and-response selection is recomputed on every legal beat from the live pending queue', () => {
  assert.match(source, /coverage:Object\.freeze\(\['engage','precision','support','heavy','coverage'\]\)/);
  assert.match(source, /engage:Object\.freeze\(\['precision','coverage','support','heavy','engage'\]\)/);
  assert.match(source, /precision:Object\.freeze\(\['engage','coverage','heavy','support','precision'\]\)/);
  assert.match(source, /eligible\.sort\(candidateSort\);const item=eligible\[0\]/);
  assert.match(source, /tick<Math\.max\(gateTick,punishGraceUntil\)/);
  assert.match(source, /holdWaitingThreats/);
});

test('threat cost and phrase budget distinguish coverage engage precision heavy and support pressure', () => {
  assert.match(source, /coverage:2/);
  assert.match(source, /engage:1/);
  assert.match(source, /precision:2/);
  assert.match(source, /heavy:3/);
  assert.match(source, /support:1/);
  assert.match(source, /const remaining=profile\.budget-phraseCost/);
  assert.match(source, /waiting\.filter\(item=>item\.cost<=remaining\)/);
  assert.match(source, /phraseAttacks>=profile\.maxAttacks/);
  assert.match(source, /tick\+profile\.restTicks/);
});

test('stale phrase budget and role memory reset after one deterministic idle rest', () => {
  assert.match(source, /function resetIdlePhrase\(profile\)/);
  assert.match(source, /phraseAttacks>0&&tick>gateTick\+profile\.restTicks/);
  assert.match(source, /phraseIndex\+\+;lastRole='light'/);
});

test('an armed beat diverted into defensive AI is consumed and cannot become a ghost reservation', () => {
  assert.match(source, /function actorDiverted\(actor\)/);
  assert.match(source, /if\(item\.armed\)/);
  assert.match(source, /!item\.released&&!isTelegraphing\(actor\)&&actorDiverted\(actor\)/);
  assert.match(source, /reason:actor\?\.kineticEvade\|\|actor\?\.evade\?'defense':'interrupted'/);
  assert.match(source, /clearActorReservation\(actor\);item\.cancelled=true;item\.yielded=true/);
});

test('melee feller commitments and bosses share the same threat queue as projectile roles', () => {
  assert.match(source, /feller:'engage'/);
  assert.match(source, /if\(state\.boss&&!state\.boss\.dead\)actors\.push\(state\.boss\)/);
  assert.match(source, /if\(actor&&actor===state\.boss\)return'heavy'/);
  assert.match(source, /const inheritedBoss=F\.updateBoss/);
  assert.match(source, /F\.updateBoss=\(dt\)=>\{const result=inheritedBoss\(dt\);recordReleasedTelegraphs\(\);return result\}/);
});

test('post-evade vulnerability opens one fixed scheduler grace edge without deleting existing projectiles', () => {
  assert.match(source, /if\(open&&!punishWindowActive\)/);
  assert.match(source, /punishGraceUntil=Math\.max\(punishGraceUntil,tick\+profile\.punishGraceTicks\)/);
  assert.match(source, /gateTick=Math\.max\(gateTick,punishGraceUntil\)/);
  assert.doesNotMatch(source, /state\.shots\s*=|pendingShots\s*=\[\]/);
});

test('threat orchestration is fixed-step deterministic and contains no wall-clock or random scheduling APIs', () => {
  assert.match(source, /tick\+\+/);
  assert.match(source, /hash\(`v014-threat:/);
  assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval/);
});
