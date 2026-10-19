import test from "node:test";
import assert from "node:assert/strict";
import {
  GROVE_LOG,GROVE_TUNNEL,SKATE_LOOP,SKATE_PARK_RAILS,REDWOOD_BOWL,
  insideMeadowConnector,skateParkZone,skateParkSurface,
} from "../lib/world/skatepark";
import {groundHeight,stepTravel,type Travel} from "../lib/world/activities";
import {
  beginSkateLoop,skateLoopEntryCrossing,skateLoopSample,advanceSkateLoop,
} from "../lib/world/skateLoop";
import {idleSkateTrick,scoreSkateLoop} from "../lib/world/skateTricks";

const C=SKATE_LOOP.center;
const entry=(x:number,z:number=C.z)=>({x:C.x+x,z});
const left={x:-1,z:0},right={x:1,z:0};

test("sequoia bore follows the existing open, fully traversable log trough",()=>{
  assert.deepEqual(GROVE_TUNNEL.center,GROVE_LOG.center);
  assert.equal(GROVE_TUNNEL.halfLength,GROVE_LOG.halfLength);
  assert.ok(GROVE_TUNNEL.innerHalfWidth-GROVE_LOG.halfWidth>.4,
    "the wood skin must not cut across the polished riding channel");
  assert.ok(GROVE_TUNNEL.innerRadius+GROVE_TUNNEL.archCenterLift>4.2,
    "the human silhouette and camera need generous headroom");
  assert.ok(GROVE_LOG.halfLength>5&&GROVE_TUNNEL.outerHalfWidth>3,
    "the sequoia must have an old-growth scale, not a narrow pipe");
  for(let x=GROVE_LOG.center.x-GROVE_LOG.halfLength;
      x<=GROVE_LOG.center.x+GROVE_LOG.halfLength+.0001;x+=.12){
    const point={x,z:GROVE_LOG.center.z};
    assert.ok(insideMeadowConnector(point));
    assert.equal(skateParkSurface(point)!<=groundHeight(point)+1e-6,true);
    assert.ok(Number.isFinite(groundHeight(point)));
    const ahead={x:x+.08,z:point.z};
    assert.ok(Math.abs(groundHeight(ahead)-groundHeight(point))<.6,
      "the riding floor must not have an invisible vertical step");
  }
  assert.equal(skateParkZone(GROVE_LOG.center),"sequoia-tunnel");
});

test("loop is separate from rails, bowl, and boundary while staying within the park",()=>{
  const {center,radius,width}=SKATE_LOOP;
  assert.ok(radius>=3.65&&width>=3.2,"loop must be enlarged to landmark scale");
  for(const x of [center.x-radius,center.x,center.x+radius])
    for(const z of [center.z-width*.5,center.z,center.z+width*.5])
      assert.ok(insideMeadowConnector({x,z}),"all wheel track points must be on the dry meadow");
  assert.equal(skateParkZone(center),"timber-loop");
  assert.ok(Math.hypot(center.x-REDWOOD_BOWL.center.x,center.z-REDWOOD_BOWL.center.z)>
    radius+1.5,"the new loop cannot overwrite the old redwood bowl");
  for(const rail of SKATE_PARK_RAILS){
    const dx=rail.b.x-rail.a.x,dz=rail.b.z-rail.a.z;
    const t=Math.max(0,Math.min(1,
      ((center.x-rail.a.x)*dx+(center.z-rail.a.z)*dz)/(dx*dx+dz*dz)));
    const distance=Math.hypot(center.x-rail.a.x-dx*t,center.z-rail.a.z-dz*t);
    assert.ok(distance>radius+.35,"loop must avoid all existing grind rails: "+rail.id);
  }
});

test("entry is swept, one-way, fast enough, and centered on planked lane",()=>{
  assert.equal(skateLoopEntryCrossing(entry(.25),entry(-.25),left,9.4),true);
  assert.equal(skateLoopEntryCrossing(entry(.25),entry(-.25),left,.79),false);
  assert.equal(skateLoopEntryCrossing(entry(.25),entry(-.25),right,9.4),false);
  assert.equal(skateLoopEntryCrossing(entry(-.25),entry(.25),right,9.4),false);
  assert.equal(skateLoopEntryCrossing(entry(.25,C.z+1.45),entry(-.25,C.z+1.45),left,9.4),false);
  assert.equal(skateLoopEntryCrossing(entry(2.3),entry(1.9),left,9.4),false);
  assert.equal(skateLoopEntryCrossing(entry(.25),entry(-.25),{x:-.2,z:1},9.4),false);
  assert.equal(skateLoopEntryCrossing(entry(.25),entry(-.25),left,Number.NaN),false);
});

test("ordinary WASD skating can line up and enter the giant loop from park spawn",()=>{
 // This is the same two-stage input sequence used by the real browser,
 // but independent of slow software-GPU wall clock and screenshot delays.
 let travel:Travel={point:{x:C.x+SKATE_LOOP.leadLength,z:C.z},speed:0,heading:{x:-1,z:0}};
 let crossing=false,arrival=travel;
 for(let i=0;i<200;i++){
  const before=travel;
  travel=stepTravel(travel,{x:-1,z:0},.05,"skate",[]);
  if(skateLoopEntryCrossing(before.point,travel.point,travel.heading,travel.speed)){
   crossing=true;arrival=travel;break;
  }
  if(travel.point.x<SKATE_LOOP.center.x-1)break;
 }
 assert.ok(crossing,
  "A then W must cross the actual center seam with enough speed and lane alignment");
 assert.ok(Math.abs(arrival.point.z-SKATE_LOOP.center.z)<SKATE_LOOP.entryHalfWidth);
});

test("elliptic loop has true inner contact, full inversion and different entry/exit",()=>{
 const start=beginSkateLoop(9.2,groundHeight(C),C.z,
  groundHeight({x:C.x-SKATE_LOOP.exitOffset,z:C.z+SKATE_LOOP.laneOffset}));
 const entry=skateLoopSample(start),top=skateLoopSample({...start,angle:Math.PI});
 const finish=skateLoopSample({...start,angle:2*Math.PI});
 assert.ok(SKATE_LOOP.radiusY>SKATE_LOOP.radius,
  "the timber loop must be taller and more asymmetric than a perfect circle");
 assert.ok(Math.abs(entry.point.x-C.x)<1e-8);
 assert.ok(Math.abs(top.point.x-(C.x-SKATE_LOOP.exitOffset*.5))<1e-8);
 assert.ok(Math.abs(top.y-(start.baseY+SKATE_LOOP.radiusY*2+
   (start.exitY-start.baseY)*.5))<1e-6);
 assert.ok(Math.abs(top.pitch+Math.PI)<.06,
  "the skater must actually face backward while inverted");
 assert.ok(Math.abs(finish.pitch+2*Math.PI)<.06);
 assert.ok(Math.abs(finish.point.x-(C.x-SKATE_LOOP.exitOffset))<1e-8);
 assert.ok(Math.abs(finish.y-start.exitY)<1e-6);
 assert.ok(Math.abs(finish.y-groundHeight(finish.point)-.035)<.13,
  "land exactly on the western exit grade");
 assert.ok(Math.abs(finish.point.x-entry.point.x)>2,
  "the exit cannot put the skater back onto the entry seam");
});

test("full elliptical loop completes at 10, 20, 40 and 60 FPS",()=>{
 for(const fps of [10,20,40,60]){
  let ride=beginSkateLoop(8.9,groundHeight(C),C.z,
   groundHeight({x:C.x-SKATE_LOOP.exitOffset,z:C.z+SKATE_LOOP.laneOffset}));
  let completed=false,steps=0,maxY=-Infinity;
  while(steps<9*fps&&!completed){
   const next=advanceSkateLoop(ride,1/fps);
   assert.ok(next.ride.angle>=ride.angle);
   assert.ok(next.ride.angle<=2*Math.PI);
   assert.ok(Number.isFinite(next.ride.speed));
   const sample=skateLoopSample(next.ride);
   assert.ok(Number.isFinite(sample.y));
   maxY=Math.max(maxY,sample.y);
   ride=next.ride;completed=next.completed;steps++;
  }
  assert.equal(completed,true,"must release to ordinary skating: "+fps+" fps");
  assert.ok(steps/fps<8,"track traversal must complete at "+fps+" fps");
  assert.ok(maxY>(ride.baseY+ride.exitY)*.5+2*SKATE_LOOP.radiusY-.18);
  assert.ok(Math.abs(skateLoopSample(ride).point.x-
   (C.x-SKATE_LOOP.exitOffset))<1e-6);
 }
});

test("loop success is scored as an ordinary skate trick, not a new minigame",()=>{
  const baseline=idleSkateTrick();
  const landed=scoreSkateLoop(baseline,3.1,8.9);
  assert.equal(landed.phase,"ground");
  assert.match(landed.lastLabel,/Loop 360°/);
  assert.ok(landed.points>=420);
  assert.equal(landed.lastLandedAt,3.1);
  assert.equal(scoreSkateLoop(baseline,Number.NaN,8.9),baseline);
});

test('reverse entrance and full loop work across frame rates',()=>{
 const start=beginSkateLoop(10,2,C.z,2,-1),p=skateLoopSample(start);
 const before={x:p.point.x-p.heading.x*.2,z:p.point.z-p.heading.z*.2};
 const after={x:p.point.x+p.heading.x*.2,z:p.point.z+p.heading.z*.2};
 assert.ok(skateLoopEntryCrossing(before,after,p.heading,10));
 assert.equal(skateLoopEntryCrossing(after,before,p.heading,10),false);
 for(const fps of [10,30,60]){
  let ride=start,done=false;
  for(let i=0;i<15*fps&&!done;i++){const n=advanceSkateLoop(ride,1/fps);ride=n.ride;done=n.completed;}
  assert.ok(done);assert.equal(ride.angle,0);assert.ok(skateLoopSample(ride).heading.x>.95);
 }
});
test('slow reverse entry rolls back to its own mouth',()=>{
 let ride=beginSkateLoop(1,2,C.z,2,-1),returned=false;
 for(let i=0;i<600&&!returned;i++){const n=advanceSkateLoop(ride,1/60);ride=n.ride;returned=n.returned;assert.ok(!n.completed);}
 assert.ok(returned);assert.equal(ride.angle,2*Math.PI);
});
