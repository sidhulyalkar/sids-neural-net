import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierLightningFarTip, frontierLightningGeometry, LIGHTNING_REACH_X, LIGHTNING_REACH_Y } from '../lib/frontier/lightningGeometry';

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
    assert.deepEqual(result.start, from);
    assert.equal(result.forks.length,5);
    assert.equal(result.filaments.length,2);
    assert(result.filaments.every((line)=>line.startsWith('M ') && line.includes(' L ')));
    assert(result.forks.every((path)=>/^M -?\d+ -?\d+ L -?\d+ -?\d+ L -?\d+ -?\d+$/.test(path)));
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

test('the emitter stays at the cursor while the lethal tip is farther away',()=>{
  const view={width:1440,height:900};
  const cursor={x:700,y:480};
  const tip=frontierLightningFarTip(cursor,view);
  assert.deepEqual(tip,{x:cursor.x-LIGHTNING_REACH_X,y:cursor.y-LIGHTNING_REACH_Y});
  assert(Math.hypot(cursor.x-tip.x,cursor.y-tip.y)>140);
  const arc=frontierLightningGeometry(cursor,tip,81);
  assert.deepEqual(arc.start,cursor);
  assert.deepEqual(arc.end,tip);
  assert(arc.main.startsWith(`M ${cursor.x} ${cursor.y}`));
  assert(arc.main.endsWith(`L ${tip.x} ${tip.y}`));
});

test('the lightning projection reflects near boundaries and remains visible',()=>{
  const view={width:390,height:844};
  for(const cursor of [{x:6,y:7},{x:385,y:840},{x:118,y:380},{x:320,y:40}]){
    const tip=frontierLightningFarTip(cursor,view);
    assert(tip.x>=14 && tip.x<=376);
    assert(tip.y>=14 && tip.y<=830);
    assert(Math.hypot(tip.x-cursor.x,tip.y-cursor.y)>=100,
      'Even near an edge the effect must reach a visibly distant point');
  }
});

test('the main discharge visibly bows away from the straight chord',()=>{
  const origin={x:500,y:360},tip={x:384,y:268};
  const path=frontierLightningGeometry(origin,tip,57).main;
  const segments=[...path.matchAll(/[ML] (-?\d+) (-?\d+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
  const midpoint=segments[Math.floor(segments.length/2)];
  const dx=tip.x-origin.x,dy=tip.y-origin.y;
  const displacement=Math.abs((midpoint.x-origin.x)*dy - (midpoint.y-origin.y)*dx)/Math.hypot(dx,dy);
  assert(displacement>35,`Expected a substantially curved galvanic arc, got ${displacement}px`);
});
