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

test('roll lowers onto a shoulder before rotating and recovers upright',()=>{
 for(const trick of ['roll-left','roll-right'] as const){
  const s=beginShastaTrick(trick,0,player,player,heading);
  const start=shastaTrickPose(s,.18);
  assert.ok(start.down>.01,'must first lower onto the ground');
  assert.equal(start.roll,0,'must not barrel-roll while standing');
  assert.equal(Object.is(start.roll,-0),false,'zero roll must not preserve a negative sign');
  const side=shastaTrickPose(s,.9);
  assert.ok(Math.abs(side.roll)>.1&&Math.abs(side.roll)<Math.PI*2);
  const end=shastaTrickPose(s,2.34);
  assert.ok(Math.abs(Math.abs(end.roll)-Math.PI*2)<.001,
   'return upright before starting recovery');
  const recovering=stepShastaTrick(s,2.35,player,true);
  const recoveryPose=shastaTrickPose(recovering,2.7);
  assert.ok(recoveryPose.down<.8&&Number.isFinite(recoveryPose.roll));
 }
});
test('one paw lifts after a visible supporting weight shift and the other stays planted',()=>{
 for(const trick of ['shake-left','shake-right'] as const){
  const s=beginShastaTrick(trick,0,{x:0,z:1.55},player,heading);
  assert.equal(s.phase,'perform');
  const initial=shastaTrickPose(s,.1);
  assert.equal(initial.pawLeft+initial.pawRight,0);
  const lifted=shastaTrickPose(s,.7);
  assert.ok(Math.abs(lifted.weightShift)>.01);
  assert.ok(lifted.sit>0,'sit and transfer weight while paw is lifted');
  assert.ok((trick==='shake-left'?lifted.pawLeft:lifted.pawRight)>.15);
  assert.equal(trick==='shake-left'?lifted.pawRight:lifted.pawLeft,0);
 }
});
test('spin steps, jump compresses before takeoff and held poses do not drift',()=>{
 const spin=beginShastaTrick('spin-right',0,player,player,heading);
 assert.ok(Math.abs(shastaTrickPose(spin,.7).turnStep)>.001);
 const jump=beginShastaTrick('jump',0,player,player,heading);
 const loading=shastaTrickPose(jump,.13);
 const air=shastaTrickPose(jump,.75);
 assert.ok(loading.crouch>.05&&loading.jump===0);
 assert.ok(air.jump>.25&&air.tuck>.03);
 for(const trick of ['sit','down','park-it','stay'] as const){
  const s=beginShastaTrick(trick,0,player,player,heading);
  const state={...s,phase:'hold' as const,since:1};
  assert.deepEqual(shastaTrickPose(state,100),shastaTrickPose(state,1),
   'held postures cannot accumulate oscillator drift');
 }
});
test('trick pose samples are deterministic and finite across browser frame intervals',()=>{
 for(const trick of ['sit','down','stay','roll-left','roll-right',
  'spin-left','spin-right','shake-left','shake-right','jump','park-it'] as const){
  const s=beginShastaTrick(trick,0,player,player,heading);
  for(const hz of [15,30,60,120]){
   for(let i=0;i<Math.floor(hz*2.5);i++){
    const pose=shastaTrickPose(s,i/hz);
    for(const [k,v] of Object.entries(pose))
     if(typeof v==='number')assert.ok(Number.isFinite(v),k+' nonfinite');
    assert.ok(pose.jump>=0&&pose.jump<=.66);
    assert.ok(pose.crouch>=0&&pose.crouch<=.95);
   }
  }
 }
});

test('Park it chooses reachable ground when the exact heel position is blocked',()=>{
 const blocked=(p:{x:number;z:number})=>Math.hypot(p.x,p.z+.38)>.42;
 const state=beginShastaTrick('park-it',0,dog,player,heading,blocked);
 assert.equal(state.phase,'approach');
 assert.ok(state.finalGoal);
 assert.ok(blocked(state.finalGoal!));
 assert.notDeepEqual(state.finalGoal,{x:0,z:-.38});
 assert.ok(state.goal&&blocked(state.goal));
});
test('fully blocked Park it settles safely at the existing dog location',()=>{
 const state=beginShastaTrick('park-it',0,dog,player,heading,()=>false);
 assert.equal(state.phase,'perform');
 assert.equal(state.goal,null);
 assert.equal(state.finalGoal,null);
 const held=stepShastaTrick(state,2,dog,true);
 assert.equal(held.phase,'hold');
 assert.ok(shastaTrickPose(held,2).down>.8);
});
