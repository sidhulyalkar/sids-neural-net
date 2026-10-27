import test from 'node:test';
import assert from 'node:assert/strict';
import {beginShastaTrick,stepShastaTrick,shastaTrickPose,idleShastaTrick,isShastaTrick} from '../lib/world/shastaTricks';
const dog={x:8,z:6},player={x:0,z:0},heading={x:0,z:1};
test('trick commands are distinct and never include chase/recall',()=>{
 for(const action of ['roll-left','roll-right','shake-left','shake-right','spin-left','spin-right','park-it','sit','down','stay','jump'] as const)
  assert.equal(isShastaTrick(action),true);
 assert.equal(isShastaTrick('go'),false);
 assert.equal(isShastaTrick('come'),false);
});
test('Park it approaches behind the player and lays down without teleporting',()=>{
 for(const hz of [10,30,60]){
  let state=beginShastaTrick('park-it',0,dog,player,heading);
  assert.deepEqual(state.goal,{x:1.3,z:-1.9});
  assert.deepEqual(state.finalGoal,{x:0,z:-.38});
  assert.equal(state.phase,'approach');
  // Stage one circles behind the legs without cutting through the player.
  state=stepShastaTrick(state,1,{x:1.3,z:-1.9},true);
  assert.equal(state.phase,'approach');
  assert.deepEqual(state.goal,{x:0,z:-.38});
  // Stage two settles into the center, then the down animation completes.
  state=stepShastaTrick(state,1.3,{x:0,z:-.42},true);
  assert.equal(state.phase,'perform');
  for(let i=0;i<hz*3;i++)
   state=stepShastaTrick(state,1.3+i/hz,{x:0,z:-.42},true);
  assert.equal(state.phase,'hold');
  const pose=shastaTrickPose(state,4.3);
  assert.ok(pose.crouch>.7);
  assert.equal(pose.jump,0);
  assert.ok(pose.still);
 }
});
test('Stay, sit and down remain in a stationary hold until interrupted',()=>{
 for(const t of ['sit','down','stay'] as const){
  let s=beginShastaTrick(t,0,{x:0,z:0},player,heading);
  s=stepShastaTrick(s,3,{x:0,z:0},true);
  assert.equal(s.phase,'hold');
  assert.equal(stepShastaTrick(s,60,{x:0,z:0},true).phase,'hold');
  assert.equal(stepShastaTrick(s,60,{x:0,z:0},false).phase,'idle');
 }
});
test('left and right paws, rolls and spins have mirror-opposite poses',()=>{
 const pose=(t:'shake-left'|'shake-right'|'roll-left'|'roll-right'|'spin-left'|'spin-right')=>
  shastaTrickPose(beginShastaTrick(t,0,t.startsWith('shake')?{x:0,z:1.5}:player,player,heading),.6);
 const left=pose('shake-left'),right=pose('shake-right');
 assert.ok(left.pawLeft>.05&&left.pawRight===0);
 assert.ok(right.pawRight>.05&&right.pawLeft===0);
 assert.ok(pose('roll-left').roll<0&&pose('roll-right').roll>0);
 assert.ok(pose('spin-left').spin<0&&pose('spin-right').spin>0);
});
test('new commands interrupt the prior trick without leaving queued animations',()=>{
 let s=beginShastaTrick('roll-left',0,player,player,heading);
 s=stepShastaTrick(s,.6,player,true);
 assert.ok(shastaTrickPose(s,.6).roll<0);
 s=beginShastaTrick('jump',.65,player,player,heading);
 assert.equal(s.trick,'jump');
 assert.equal(shastaTrickPose(s,.65).roll,0);
 s=stepShastaTrick(s,2.2,player,true);
 assert.equal(s.phase,'recover');
 s=stepShastaTrick(s,2.9,player,true);
 assert.deepEqual(s,idleShastaTrick());
});

test('park-it abandons blocked approach instead of teleporting through obstacles',()=>{
 let s=beginShastaTrick('park-it',0,dog,player,heading);
 s=stepShastaTrick(s,13,dog,true);
 assert.equal(s.phase,'idle');
});
