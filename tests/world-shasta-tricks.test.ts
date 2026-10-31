import test from 'node:test';
import assert from 'node:assert/strict';
import {beginShastaTrick,stepShastaTrick,shastaTrickPose,idleShastaTrick,isShastaTrick,advanceShastaTrickClock,shastaSpinPawLift,SHASTA_TRICK_DURATION} from '../lib/world/shastaTricks';
const player={x:0,z:0},heading={x:0,z:1};
test('trick commands are distinct and never include chase/recall',()=>{
 for(const action of ['roll-left','roll-right','shake-left','shake-right','spin-left','spin-right','sit','down','stay','jump'] as const)
  assert.equal(isShastaTrick(action),true);
 assert.equal(isShastaTrick('go'),false);
 assert.equal(isShastaTrick('come'),false);
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
 assert.ok(shastaTrickPose(spin,.7).spinStep>0);
 const jump=beginShastaTrick('jump',0,player,player,heading);
 const loading=shastaTrickPose(jump,.13);
 const air=shastaTrickPose(jump,.75);
 assert.ok(loading.crouch>.05&&loading.jump===0);
 assert.ok(air.jump>.25&&air.tuck>.03);
 for(const trick of ['sit','down','stay'] as const){
  const s=beginShastaTrick(trick,0,player,player,heading);
  const state={...s,phase:'hold' as const,since:1};
  assert.deepEqual(shastaTrickPose(state,100),shastaTrickPose(state,1),
   'held postures cannot accumulate oscillator drift');
 }
});
test('trick pose samples are deterministic and finite across browser frame intervals',()=>{
 for(const trick of ['sit','down','stay','roll-left','roll-right',
  'spin-left','spin-right','shake-left','shake-right','jump'] as const){
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

test('trick choreography finishes on wall-time instead of slowing at 10 FPS',()=>{
 const simulate=(hz:number)=>{
  const dt=1/hz;
  let now=0;
  let state=beginShastaTrick('roll-left',now,player,player,heading);
  for(let i=0;i<Math.ceil(3*hz);i++){
   now=advanceShastaTrickClock(now,dt);
   state=stepShastaTrick(state,now,player,true);
  }
  return {now,state};
 };
 for(const hz of [10,15,30,60,120]){
  const {now,state}=simulate(hz);
  assert.ok(Math.abs(now-3)<.00001);
  assert.equal(state.phase,'idle',
   'roll and recovery should finish equally at desktop and low mobile FPS');
 }
 assert.equal(advanceShastaTrickClock(4,0),4,'paused simulation time stays frozen');
 assert.equal(advanceShastaTrickClock(4,-1),4,'corrupt negative RAF delta is ignored');
 assert.equal(advanceShastaTrickClock(4,.9),4.5,
   'long tab stalls are capped rather than skipping multiple motions');
});

test('Park it is absent from the public command vocabulary',()=>{
 assert.equal(isShastaTrick('park-it' as never),false);
 assert.ok(!Object.prototype.hasOwnProperty.call(SHASTA_TRICK_DURATION,'park-it'));
});
test('spin rotates on four paws without ever jumping or rolling',()=>{
 for(const trick of ['spin-left','spin-right'] as const){
  const state=beginShastaTrick(trick,0,player,player,heading);
  const direction=trick==='spin-left'?-1:1;
  let previous=0;
  const lifted=new Set<number>();
  for(let i=0;i<=270;i++){
   const t=i/100;
   const pose=shastaTrickPose(state,t);
   assert.equal(pose.jump,0,'spin must never lift the dog root off ground');
   assert.equal(pose.roll,0,'spin must not turn into a barrel roll');
   assert.equal(pose.crouch,0,'spin must keep a neutral standing body height');
   assert.equal(pose.down,0);
   const yaw=direction*pose.spin;
   assert.ok(yaw>=previous-1e-9,'spin yaw must be monotonic');
   previous=yaw;
   const paws=[0,1,2,3].map(index=>shastaSpinPawLift(pose,index));
   assert.ok(paws.every(v=>v>=0&&v<=.083));
   assert.ok(paws.filter(v=>v>.00001).length<=1,
    'only one paw can swing, with a minimum tripod support');
   paws.forEach((v,index)=>{if(v>.02)lifted.add(index);});
  }
  assert.ok(Math.abs(previous-Math.PI*2)<1e-8,'complete one turn');
  assert.deepEqual([...lifted].sort(),[0,1,2,3],
   'all four feet must reposition during the turn');
 }
});
test('spin footfalls alternate, with mirrored left/right order and low arcs',()=>{
 const left=beginShastaTrick('spin-left',0,player,player,heading);
 const right=beginShastaTrick('spin-right',0,player,player,heading);
 // Each step occupies 0.29 sec; sample precisely at the footfall midpoint.
 const leftOrder=[3,0,1,2,3,0,1,2];
 const rightOrder=[1,2,3,0,1,2,3,0];
 for(let step=0;step<8;step++){
  const at=.18+(step+.5)*2.32/8;
  for(const [state,order] of [[left,leftOrder],[right,rightOrder]] as const){
   const pose=shastaTrickPose(state,at);
   const lifts=[0,1,2,3].map(i=>shastaSpinPawLift(pose,i));
   assert.ok(lifts[order[step]]>.075,'one specific foot should swing');
   for(let i=0;i<4;i++)if(i!==order[step])assert.equal(lifts[i],0);
   assert.equal(pose.jump,0);
  }
 }
});
test('spin ends upright at 10-120 FPS and can be interrupted by Sit',()=>{
 for(const hz of [10,15,30,60,120]){
  let state=beginShastaTrick('spin-left',0,player,player,heading);
  let clock=0;
  const dt=1/hz;
  for(let i=0;i<Math.ceil(3.3*hz);i++){
   clock=advanceShastaTrickClock(clock,dt);
   state=stepShastaTrick(state,clock,player,true);
  }
  assert.equal(state.phase,'idle');
 }
 const spinning=beginShastaTrick('spin-right',0,player,player,heading);
 assert.ok(shastaTrickPose(spinning,1).spin>0);
 const sit=beginShastaTrick('sit',1,player,player,heading);
 assert.equal(shastaTrickPose(sit,1).spin,0);
 assert.equal(shastaTrickPose(sit,1).jump,0);
});
