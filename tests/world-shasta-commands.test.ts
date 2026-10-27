import test from 'node:test';
import assert from 'node:assert/strict';
import {commandShasta,initialShastaOuting,stepShastaOuting} from '../lib/world/shastaCommands';
import {steerShastaVelocity} from '../lib/world/shastaMotion';
const origin={x:0,z:0},clear=()=>true;
test('default follows; Go pursues only eligible squirrel indices; Come stays latched',()=>{
 const prey=[null,{x:9,z:0},{x:5,z:0}];
 assert.equal(stepShastaOuting(initialShastaOuting(),0,origin,origin,prey,true,clear).mode,'follow');
 const chase=stepShastaOuting(commandShasta('go'),0,origin,origin,prey,true,clear);
 assert.equal(chase.mode,'chase');assert.equal(chase.target,2);
 let recall=commandShasta('come');
 for(let t=0;t<50;t++)recall=stepShastaOuting(recall,t,origin,origin,prey,true,clear);
 assert.equal(recall.mode,'follow');assert.equal(recall.target,null);assert.equal(recall.command,'come');
});
test('Go roams without prey; unsafe terrain never becomes an outing goal',()=>{
 const roam=stepShastaOuting(commandShasta('go'),0,origin,origin,[],true,clear);
 assert.equal(roam.mode,'roam');assert.ok(roam.goal);
 assert.equal(stepShastaOuting(commandShasta('go'),0,origin,origin,[{x:5,z:0}],true,()=>false).goal,null);
});
test('chase timeout, removed prey and leash commit a return before retargeting',()=>{
 const chase=stepShastaOuting(commandShasta('go'),0,origin,origin,[{x:9,z:0}],true,clear);
 for(const [now,prey] of [[9,[{x:10,z:0}]],[1,[]]] as const){
  const back=stepShastaOuting(chase,now,{x:12,z:0},origin,prey,true,clear);
  assert.equal(back.mode,'return');assert.equal(back.target,null);
  assert.equal(stepShastaOuting(back,now+1,{x:9,z:0},origin,[{x:10,z:0}],true,clear).mode,'return');
 }
 assert.equal(stepShastaOuting(chase,1,{x:25,z:0},origin,[{x:26,z:0}],true,clear).mode,'return');
});
test('water, cave and game interruption cancel an outing without a delayed restart',()=>{
 const stopped=stepShastaOuting(commandShasta('go'),1,origin,origin,[],false,clear);
 assert.deepEqual(stopped,initialShastaOuting());
 assert.equal(stepShastaOuting(stopped,2,origin,origin,[{x:3,z:0}],true,clear).mode,'follow');
});
test('recall converges from a moving chase at multiple frame rates without teleporting',()=>{
 for(const hz of [10,30,60]){
  let dog={x:18,z:9},v={x:8,z:0},state=commandShasta('come');
  for(let i=0;i<hz*12;i++){
   state=stepShastaOuting(state,i/hz,dog,origin,[{x:19,z:8}],true,clear);
   v=steerShastaVelocity(v,dog,origin,6,1/hz);
   const next={x:dog.x+v.x/hz,z:dog.z+v.z/hz};
   assert.ok(Math.hypot(next.x-dog.x,next.z-dog.z)<1);
   dog=next;
  }
  assert.equal(state.mode,'follow');assert.ok(Math.hypot(dog.x,dog.z)<1.5);
 }
});

test('a close squirrel becomes carried prey, returns for a delivery, then fades out',()=>{
 let chase=stepShastaOuting(commandShasta('go'),0,origin,origin,[{x:6,z:0}],true,clear);
 assert.equal(chase.mode,'chase');
 chase=stepShastaOuting(chase,.6,{x:5.25,z:0},origin,[{x:6,z:0}],true,clear);
 assert.equal(chase.mode,'return');assert.equal(chase.carrying,true);
 assert.equal(chase.target,null);
 let delivering=stepShastaOuting(chase,2,{x:1.4,z:0},origin,[],true,clear);
 assert.equal(delivering.mode,'deliver');assert.equal(delivering.carrying,true);
 assert.equal(stepShastaOuting(delivering,2.4,{x:1,z:0},origin,[],true,clear).mode,'deliver');
 delivering=stepShastaOuting(delivering,3.4,{x:1,z:0},origin,[],true,clear);
 assert.equal(delivering.mode,'follow');assert.equal(delivering.carrying,false);
 assert.ok(delivering.cooldown>3.4);
});
test('Come immediately interrupts and clears carried prey',()=>{
 const caught=stepShastaOuting(
  stepShastaOuting(commandShasta('go'),0,origin,origin,[{x:1,z:0}],true,clear),
  .1,origin,origin,[{x:1,z:0}],true,clear);
 assert.equal(caught.carrying,true);
 assert.equal(commandShasta('come').carrying,false);
 assert.deepEqual(stepShastaOuting(caught,1,origin,origin,[],false,clear),initialShastaOuting());
});
