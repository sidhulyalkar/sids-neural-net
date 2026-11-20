import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierLightningGeometry } from '../lib/frontier/lightningGeometry';

test('the jagged curved lightning terminates exactly on its target, at any offset', () => {
  for (const [from,to] of [
    [{x:20,y:15},{x:160,y:140}],
    [{x:780,y:22},{x:710,y:330}],
    [{x:40,y:100},{x:40,y:100}],
  ] as const) {
    const result=frontierLightningGeometry(from,to,47);
    assert.deepEqual(result.end,to);
    assert(result.main.startsWith(`M ${from.x} ${from.y}`));
    assert(result.main.endsWith(`L ${to.x} ${to.y}`));
    assert.equal(result.forks.length,3);
    assert(result.forks.every((path)=>/^M \d+ \d+ L \d+ \d+ L \d+ \d+$/.test(path)));
    assert(result.main.match(/ L /g)?.length && (result.main.match(/ L /g)?.length ?? 0) >= 9);
  }
});

test('each strike is deterministic but changes electric shape between shots', () => {
  const from={x:120,y:40},to={x:240,y:175};
  assert.deepEqual(frontierLightningGeometry(from,to,7),frontierLightningGeometry(from,to,7));
  assert.notEqual(frontierLightningGeometry(from,to,7).main,frontierLightningGeometry(from,to,8).main);
  assert.notEqual(frontierLightningGeometry(from,to,7).main,
    `M ${from.x} ${from.y} L ${to.x} ${to.y}`, 'Electrical arc must curve and fork');
});
