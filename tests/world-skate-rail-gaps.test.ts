import test from "node:test";
import assert from "node:assert/strict";
import {SKATE_RAIL_GAPS,SKATE_PARK_RAILS,railLiftAt,insideSkatePark,
 insideCanyonFlow,insideMeadowConnector} from "../lib/world/skatepark";
import {groundHeight} from "../lib/world/activities";
import {isWater} from "../lib/world/model";
import {beginSkateRailGap,advanceSkateRailGap,skateRailGapSample} from
 "../lib/world/skateRailGaps";
import {idleSkateTrick,scoreSkateRailGap} from "../lib/world/skateTricks";

const distance=(a:{x:number;z:number},b:{x:number;z:number})=>
 Math.hypot(a.x-b.x,a.z-b.z);

test("four distinct real gaps connect dry, independent north-California lines",()=>{
 assert.equal(SKATE_RAIL_GAPS.length,4);
 for(const gap of SKATE_RAIL_GAPS){
  const source=SKATE_PARK_RAILS.find(r=>r.id===gap.from);
  const target=SKATE_PARK_RAILS.find(r=>r.id===gap.to);
  assert.ok(source&&target,gap.id);
  assert.notEqual(source!.chainId,target!.chainId);
  assert.ok(source!.chainId&&target!.chainId);
  for(const p of [source!.a,source!.b,target!.a,target!.b]){
   assert.ok(insideSkatePark(p)||insideCanyonFlow(p)||insideMeadowConnector(p),gap.id);
   assert.equal(isWater(p),false,gap.id);
  }
  assert.ok(distance(source!.b,target!.a)>2,
   "gap must have true open space, not a coincident rail seam");
  const ride=beginSkateRailGap(source!,1,8.8,groundHeight);
  assert.ok(ride,"eligible momentum must link "+gap.id);
  assert.equal(ride!.to,target!.id);
  assert.ok(ride!.duration>.35&&ride!.duration<1.0);
  assert.equal(beginSkateRailGap(source!,-1,9,groundHeight),null,
   "reverse riding is not eligible for a forward gap");
  assert.equal(beginSkateRailGap(source!,1,gap.minSpeed-.1,groundHeight),null,
   "slow riders must still exit normally");
 }
});

test("cubic flights physically connect rail tops without jumping or phantom surfaces",()=>{
 for(const gap of SKATE_RAIL_GAPS){
  const a=SKATE_PARK_RAILS.find(r=>r.id===gap.from)!;
  const b=SKATE_PARK_RAILS.find(r=>r.id===gap.to)!;
  const ride=beginSkateRailGap(a,1,8.8,groundHeight)!;
  const takeoff=skateRailGapSample(ride);
  const landed=skateRailGapSample({...ride,time:ride.duration});
  assert.ok(distance(takeoff.point,a.b)<1e-6);
  assert.ok(Math.abs(takeoff.y-groundHeight(a.b)-railLiftAt(a,1)-.16)<1e-6);
  const end={x:b.a.x+(b.b.x-b.a.x)*ride.toT,
   z:b.a.z+(b.b.z-b.a.z)*ride.toT};
  assert.ok(distance(landed.point,end)<1e-6,gap.id);
  assert.ok(Math.abs(landed.y-ride.endY)<1e-6);
  assert.ok(landed.done);
  const middle=skateRailGapSample({...ride,time:ride.duration*.5});
  assert.ok(middle.y>(ride.startY+ride.endY)*.5+.85,
   "rail-to-rail jumps must show a real airborne arc");
  assert.ok([middle.y,middle.point.x,middle.point.z,middle.heading.x,
   middle.heading.z].every(Number.isFinite));
  for(let i=0;i<=100;i++){
   const pose=skateRailGapSample({...ride,time:ride.duration*i/100});
   assert.ok(Number.isFinite(pose.y)&&
    Math.abs(Math.hypot(pose.heading.x,pose.heading.z)-1)<1e-6);
   assert.ok(!isWater(pose.point),gap.id+" must stay in the dry grove");
   assert.ok(pose.y>=groundHeight(pose.point)-.20,
    "board may not disappear below the true canyon terrain");
  }
 }
});

test("every transfer lands once at 10, 20, 40 and 60 FPS",()=>{
 for(const gap of SKATE_RAIL_GAPS){
  const rail=SKATE_PARK_RAILS.find(r=>r.id===gap.from)!;
  for(const fps of [10,20,40,60]){
   let ride=beginSkateRailGap(rail,1,8.8,groundHeight)!;
   let completed=false,frames=0,lastProgress=0;
   while(!completed&&frames<4*fps){
    const result=advanceSkateRailGap(ride,1/fps);
    ride=result.ride;completed=result.completed;frames++;
    const pose=skateRailGapSample(ride);
    assert.ok(pose.progress>=lastProgress);
    lastProgress=pose.progress;
   }
   assert.ok(completed,gap.id+" must land at "+fps+" FPS");
   assert.ok(frames/fps<1.2);
   assert.equal(skateRailGapSample(ride).progress,1);
   assert.equal(advanceSkateRailGap(ride,.1).completed,true,
    "completion must stay idempotent");
  }
 }
});

test("only a completed transfer awards its own combo, without modifying physics",()=>{
 const initial=idleSkateTrick();
 assert.equal(scoreSkateRailGap(initial,"",1,8),initial);
 assert.equal(scoreSkateRailGap(initial,"valid",1,NaN),initial);
 const landed=scoreSkateRailGap(initial,"granite-tongue-gap",2,8);
 assert.ok(landed.lastLabel.includes("Rail"));
 assert.ok(landed.points>=200&&landed.combo===1);
 assert.equal(landed.phase,"ground");
});
