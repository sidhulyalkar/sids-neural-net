import assert from "node:assert/strict";
import test from "node:test";
import {advanceShastaStride,shastaGaitForSpeed,shastaGaitPose,
 shastaLegIK,SHASTA_LEG_LENGTHS} from "../lib/world/shastaGait";
import {idleShastaSnowPlay,queueShastaSnowPlay,stepShastaSnowPlay,
 shastaSnowPose} from "../lib/world/shastaPersonality";

test("Shasta changes between grounded walk, diagonal trot, and canter",()=>{
 assert.equal(shastaGaitForSpeed(0),"stand");
 assert.equal(shastaGaitForSpeed(2.5),"walk");
 assert.equal(shastaGaitForSpeed(6),"trot");
 assert.equal(shastaGaitForSpeed(12),"canter");
 for(const speed of [0,1,3,5,8,11,17]){
  const gait=shastaGaitPose(speed,2.3,speed?1:0);
  assert.ok(Math.abs(gait.bodyBob)<.021,
   "Body must not hop up and down even at full fetch sprint");
  assert.equal(gait.feet.length,4);
  for(const foot of gait.feet){
   assert.ok(foot.y>=.055&&foot.y<=.21);
   assert.ok(Math.abs(foot.z)<1);
  }
 }
});

test("stride timing depends on actual ground distance not FPS or elapsed time",()=>{
 const start=2.1;
 assert.equal(advanceShastaStride(start,0,11),start);
 const once=advanceShastaStride(start,.1,6);
 const split=advanceShastaStride(
  advanceShastaStride(start,.05,6),.05,6);
 assert.ok(Math.abs(once-split)<1e-10);
 assert.equal(advanceShastaStride(start,0,0),start);
 assert.ok(Number.isFinite(advanceShastaStride(start,.25,13)));
});

test("Shasta's diagonal trot is phase-synchronized and paw swing is local",()=>{
 for(let i=0;i<90;i++){
  const s=shastaGaitPose(6,Math.PI*2*i/90,1);
  assert.equal(s.feet[0].stance,s.feet[3].stance);
  assert.equal(s.feet[1].stance,s.feet[2].stance);
  assert.ok(s.feet.some(p=>p.stance));
 }
 assert.deepEqual(shastaGaitPose(0,0,0).feet,
  shastaGaitPose(0,Math.PI*2,0).feet,
  "Standing dogs must have stable paws");
});

test("Shasta fore elbows and hind stifles always fold the canine direction",()=>{
 for(const fore of [false,true]){
  for(const speed of [0,1,3,6,9,13]){
   for(let frame=0;frame<80;frame++){
    const gait=shastaGaitPose(speed,Math.PI*2*frame/80,speed?1:0);
    for(const i of fore?[1,3]:[0,2]){
     const foot=gait.feet[i];
     const hipZ=fore?.44:-.44;
     const ik=shastaLegIK(hipZ,foot.z,foot.y,fore);
     assert.ok(Number.isFinite(ik.knee.z)&&Number.isFinite(ik.knee.y));
     assert.ok(fore?ik.knee.z<ik.hip.z:ik.knee.z>ik.hip.z,
       "Front elbows must point back, hind stifles must point forward");
     if(fore)assert.equal(ik.hock,null);
     else{
      assert.ok(ik.hock);
      assert.ok(ik.hock.z<ik.paw.z,"Hind hock sits behind planted toes");
      assert.ok(ik.hock.y>ik.paw.y,"Hock must rise above rear toes");
     }
    }
   }
  }
 }
});

test("three-link hind / two-link fore IK stays connected throughout gait",()=>{
 for(const fore of [false,true]){
  for(const height of [.055,.10,.17]){
   for(const dz of [-.22,-.14,0,.14,.22]){
    const hipZ=fore?.44:-.44;
    const pose=shastaLegIK(hipZ,hipZ+dz,height,fore);
    const endpoint=pose.hock??pose.paw;
    const upper=Math.hypot(pose.hip.y-pose.knee.y,
      pose.hip.z-pose.knee.z);
    const lower=Math.hypot(pose.knee.y-endpoint.y,
      pose.knee.z-endpoint.z);
    const lengths=fore?SHASTA_LEG_LENGTHS.fore:SHASTA_LEG_LENGTHS.hind;
    assert.ok(Math.abs(upper-lengths.upper)<.0001);
    assert.ok(Math.abs(lower-lengths.lower)<.0001);
    if(!fore&&pose.hock){
     assert.ok(Math.hypot(pose.hock.y-pose.paw.y,
      pose.hock.z-pose.paw.z)>.2);
    }
   }
  }
 }
});

test("ski selection queues an alpine-only, finite, interruptible celebration",()=>{
 let state=queueShastaSnowPlay(idleShastaSnowPlay());
 assert.equal(state.queued,true);
 state=stepShastaSnowPlay(state,1,false,true);
 assert.equal(state.stage,"idle","do not roll on the tropical beach");
 state=stepShastaSnowPlay(state,3,true,true);
 assert.equal(state.stage,"perk");
 assert.equal(state.queued,false);
 const timeline:[[number,string]]|[number,string][]=[
  [3.3,"perk"],[4.2,"zoom"],[7.1,"roll"],[9.8,"shake"],
  [11.1,"rejoin"],[12,"idle"],
 ];
 for(const [now,stage] of timeline){
  state=stepShastaSnowPlay(state,now,true,true);
  assert.equal(state.stage,stage);
  const pose=shastaSnowPose(state,now);
  assert.ok(Number.isFinite(pose.roll)&&Number.isFinite(pose.wag));
 }
 assert.equal(stepShastaSnowPlay(state,30,true,true).stage,"idle",
  "Ski animation must not restart endlessly");
 assert.equal(stepShastaSnowPlay(
  queueShastaSnowPlay(idleShastaSnowPlay()),2,true,false).queued,false,
  "Other modes/cinematics cancel pending celebrations");
});

test("rolling in snow starts/ends grounded and does not cartwheel the dog",()=>{
 let state=stepShastaSnowPlay(
  queueShastaSnowPlay(idleShastaSnowPlay()),5,true,true);
 const start=shastaSnowPose(stepShastaSnowPlay(state,8.61,true,true),8.61);
 const middle=shastaSnowPose(stepShastaSnowPlay(state,9.85,true,true),9.85);
 const end=shastaSnowPose(stepShastaSnowPlay(state,11.24,true,true),11.24);
 assert.equal(start.stage,"roll");
 assert.ok(Math.abs(start.roll)<.01,"roll begins smoothly at zero");
 assert.ok(middle.roll>1,"roll must be visibly more than a head nod");
 assert.ok(Math.abs(end.roll)<.02,"roll returns upright before shake");
});
