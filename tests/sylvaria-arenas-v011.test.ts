import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

type Arena = {
  title: string;
  area: string;
  subtitle: string;
  trees: number;
  deadwood: number;
  enemies: string[];
  dash: number;
  terrain: Array<{ type: string; count: number; r: [number, number] }>;
  mushrooms: string[];
  brittle: number;
  secrets: number;
  hint: string;
  boss?: boolean;
  bossName?: string;
};

function loadArenas() {
  const legacyRoomBlueprint = (depth: number) => ({
    title: `legacy ${depth}`,
    subtitle: 'legacy',
    palette: ['#000', '#000'],
    trees: 9,
    deadwood: 9,
    enemies: [],
    dash: 84,
    terrain: [],
    mushrooms: [],
    brittle: 0,
    secrets: 1,
    hint: 'legacy',
    boss: depth % 10 === 0,
  });
  const sandbox: any = { window: { Sylvaria091: { roomBlueprint: legacyRoomBlueprint } }, Object };
  vm.runInNewContext(
    readFileSync(join(process.cwd(), 'public/game-runtimes/mosslight-v2/v011/rooms-v011.js'), 'utf8'),
    sandbox,
    { filename: 'rooms-v011.js' },
  );
  return sandbox.window.Sylvaria091 as { ROOMS_V011: Arena[]; roomBlueprint(depth: number): Arena };
}

const averageEnemies = (rooms: Arena[]) => rooms.reduce((sum, room) => sum + room.enemies.length, 0) / rooms.length;

test('v0.11.1 replaces the procedural cliff with thirty fixed learnable arenas', () => {
  const G = loadArenas();
  assert.equal(G.ROOMS_V011.length, 30);
  assert.deepEqual(Array.from(G.ROOMS_V011.slice(0, 10), (room) => room.area), Array(10).fill('forest'));
  assert.deepEqual(Array.from(G.ROOMS_V011.slice(10, 20), (room) => room.area), Array(10).fill('deep'));
  assert.deepEqual(Array.from(G.ROOMS_V011.slice(20, 30), (room) => room.area), Array(10).fill('cut'));
  assert.equal(G.roomBlueprint(1).title, 'Clearing');
  assert.equal(G.roomBlueprint(30).title, 'Mulcher');
  assert.equal(G.roomBlueprint(31).title, 'Depth 31');
});

test('difficulty grows mainly through enemy-role composition and hostile terrain, not runaway counts', () => {
  const rooms = loadArenas().ROOMS_V011;
  const first = rooms.slice(0, 10);
  const middle = rooms.slice(10, 20);
  const last = rooms.slice(20, 30);
  assert.ok(averageEnemies(first) < averageEnemies(middle));
  assert.ok(averageEnemies(middle) < averageEnemies(last));
  assert.ok(Math.max(...rooms.map((room) => room.enemies.length)) <= 9, 'authored arenas should not become spawn soup');
  assert.ok(Math.max(...rooms.map((room) => room.trees)) <= 12, 'tree defense load stays readable');
  assert.ok(Math.max(...rooms.map((room) => room.deadwood)) <= 12, 'static clutter stays bounded');
  assert.ok(last.some((room) => room.terrain.some((patch) => patch.type === 'shards')), 'late arenas should include pre-damaged hazardous ground');
  assert.ok(last.some((room) => new Set(room.enemies).size >= 7), 'late arenas should test role-order decisions');
});

test('every fixed arena contains optional exploration and milestone rooms are deliberate', () => {
  const rooms = loadArenas().ROOMS_V011;
  for (const [index, room] of rooms.entries()) {
    assert.ok(room.deadwood > 0, `room ${index + 1} should contain destructible exploration space`);
    assert.ok(room.mushrooms.length > 0, `room ${index + 1} should contain a deliberate field choice`);
    assert.ok(room.secrets >= 1 && room.secrets <= 5, `room ${index + 1} should keep discovery rewards bounded`);
    assert.ok(room.hint.length <= 100, `room ${index + 1} guidance should remain concise`);
  }
  for (const depth of [5, 15, 25]) assert.match(rooms[depth - 1].subtitle, /trial/);
  assert.deepEqual([10, 20, 30].map((depth) => rooms[depth - 1].bossName), ['Surveyor', 'Harvester', 'Mulcher']);
  const bossDepths = Array.from(rooms, (room, index) => room.boss ? index + 1 : null).filter((depth): depth is number => depth !== null);
  assert.deepEqual(bossDepths, [10, 20, 30]);
});

test('player-facing arena names are physical and restrained rather than pun-driven', () => {
  const rooms = loadArenas().ROOMS_V011;
  const retired = /Trespass|Nursery|Red Tape|Switchback|Committee|Subsidy|Conveyor|Firebreak|Summit|Crown|Wild Sector|PAC-a-Saw/i;
  for (const room of rooms) {
    assert.doesNotMatch(room.title, retired);
    assert.doesNotMatch(room.subtitle, retired);
    assert.doesNotMatch(room.hint, retired);
  }
});
