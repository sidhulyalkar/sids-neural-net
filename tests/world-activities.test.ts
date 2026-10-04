import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, activityLanding, BOULDER_HOLDS, effectiveActivity, groundHeight, nextHold, onSnow, stepTravel, type Activity, type Travel } from '../lib/world/activities';
import { distance, WORLD_BOUNDS } from '../lib/world/model';

function simulate(mode: Activity, seconds = 2, sprint = false) {
  let state: Travel = { point: { x: 0, z: 20 }, speed: 0, heading: { x: 1, z: 0 } };
  for (let i = 0; i < seconds * 60; i++) state = stepTravel(state, { x: 1, z: 0 }, 1 / 60, mode, [], sprint);
  return state;
}
test('wheels accelerate beyond running and sprint increases running pace', () => {
  const run = simulate('run');
  assert.ok(simulate('skate').point.x > run.point.x);
  assert.ok(simulate('bike').point.x > simulate('skate').point.x);
  assert.ok(simulate('run', 2, true).point.x > run.point.x);
});
test('all activities brake to rest and never tunnel through a trunk', () => {
  for (const { id } of ACTIVITIES) {
    let state = simulate(id, 0.5);
    for (let i = 0; i < 600; i++) state = stepTravel(state, { x: 0, z: 0 }, 1 / 60, id, []);
    assert.equal(state.speed, 0);
    state = { point: { x: -10, z: 0 }, speed: 20, heading: { x: 1, z: 0 } };
    const obstacle = { x: 0, z: 0, radius: 2 };
    for (let i = 0; i < 120; i++) state = stepTravel(state, { x: 1, z: 0 }, 1 / 30, id, [obstacle]);
    assert.ok(state.point.x <= -2.45 + 1e-5, id);
  }
});
test('ski landing has snow, skis come off below the snowline', () => {
  assert.ok(onSnow(activityLanding('ski')!));
  assert.equal(effectiveActivity('ski', activityLanding('ski')!), 'ski');
  assert.equal(effectiveActivity('ski', { x: 0, z: 16 }), 'run');
});
test('every authored climbing hold is reachable and advances upward', () => {
  let point = activityLanding('boulder')!;
  for (const hold of BOULDER_HOLDS) {
    assert.deepEqual(nextHold(point), hold);
    assert.ok(groundHeight(hold) > groundHeight(point));
    point = hold;
  }
  assert.equal(nextHold(point), undefined);
});
test('movement clamps long frames, cannot overshoot a click target or leave map', () => {
  const from: Travel = { point: { x: 0, z: 20 }, speed: 13, heading: { x: 1, z: 0 } };
  const destination = { x: 0.1, z: 20 };
  const next = stepTravel(from, { x: 1, z: 0 }, 10, 'bike', [], false, destination);
  assert.ok(distance(next.point, destination) < 1e-8);
  const step = stepTravel(from, { x: 1, z: 0 }, 10, 'bike', []);
  assert.ok(distance(step.point, from.point) <= 13 * 0.05);
  const edge = stepTravel({ ...from, point: { x: WORLD_BOUNDS.maxX, z: 20 } }, { x: 1, z: 0 }, 0.05, 'bike', []);
  assert.equal(edge.point.x, WORLD_BOUNDS.maxX);
});
