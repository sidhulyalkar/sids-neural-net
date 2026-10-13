import assert from "node:assert/strict";
import test from "node:test";
import {advanceShastaStride,shastaGaitForSpeed,shastaGaitPose,
 shastaStraightLeg} from "../lib/world/shastaGait";
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

test("Shasta has one uninterrupted straight leg per paw in all gaits",()=>{
 for(const speed of [0,1,2.9,3.25,6,8.5,11,17]){
  for(let frame=0;frame<100;frame++){
   const gait=shastaGaitPose(speed,Math.PI*2*frame/100,speed?1:0);
   for(let i=0;i<4;i++){
    const foot=gait.feet[i];
    const hipZ=i%2===1?.44:-.44;
    const leg=shastaStraightLeg(hipZ,foot.z,foot.y,hipZ>0);
    assert.ok(leg.length>.45&&leg.length<1.05,
      "leg is a single, finite solid column between hip and paw");
    assert.ok(Number.isFinite(leg.hip.y)&&Number.isFinite(leg.paw.z));
    assert.ok(Math.abs(leg.paw.z-leg.hip.z)<=.28000001,
      "feet stay beneath the body even at fast canter");
    assert.equal(Object.keys(leg).sort().join(","),"hip,length,paw",
      "no invisible IK joints or hock state remain in the rig");
   }
  }
 }
});

test("each straight paw adapts to bounded terrain without moving its hip",()=>{
 const offsets=[-.2,-.08,-.055,0,.075,.15,.3];
 for(const fore of [false,true]){
  for(const offset of offsets){
   const hipZ=fore?.44:-.44;
   const leg=shastaStraightLeg(hipZ,hipZ+.19,.055+offset,fore);
   assert.equal(leg.hip.z,hipZ);
   assert.equal(leg.hip.y,fore?.77:.82);
   assert.ok(leg.paw.y>=-.04&&leg.paw.y<=.28,
     "terrain must not drag paw far above or below the body");
   assert.ok(leg.length>.4&&Number.isFinite(leg.length));
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
