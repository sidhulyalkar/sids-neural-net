import test from "node:test";
import assert from "node:assert/strict";
import {
  GROVE_LOG,GROVE_TUNNEL,SKATE_LOOP,SKATE_PARK_RAILS,REDWOOD_BOWL,
  insideSkatePark,skateParkZone,skateParkSurface,
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
    assert.ok(insideSkatePark(point));
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
      assert.ok(insideSkatePark({x,z}),"all wheel track points must be on the dry meadow");
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
  assert.equal(skateLoopEntryCrossing(entry(.25),entry(-.25),left,8.39),false);
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
 let travel:Travel={point:{x:3,z:40.8},speed:0,heading:{x:-1,z:0}};
 let southSteps=0;
 while(travel.point.z<43.20&&southSteps<220){
  travel=stepTravel(travel,{x:0,z:1},.05,"skate",[]);
  southSteps++;
 }
 assert.ok(southSteps<220,"south alignment must remain traversable");
 assert.ok(travel.point.x>SKATE_LOOP.center.x,"must be east of the loop");
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

test("3D wheel support forms a complete upright-to-inverted-to-upright circle",()=>{
  const start=beginSkateLoop(9.2,2.5,C.z+.25);
  const a=skateLoopSample(start);
  const q=skateLoopSample({...start,angle:Math.PI/2});
  const top=skateLoopSample({...start,angle:Math.PI});
  const down=skateLoopSample({...start,angle:3*Math.PI/2});
  const finish=skateLoopSample({...start,angle:2*Math.PI});
  const tolerance=1e-7;
  assert.ok(Math.abs(a.point.x-C.x)<tolerance);
  assert.ok(Math.abs(q.point.x-(C.x-SKATE_LOOP.radius))<tolerance);
  assert.ok(Math.abs(top.y-(a.y+2*SKATE_LOOP.radius))<tolerance);
  assert.ok(Math.abs(down.point.x-(C.x+SKATE_LOOP.radius))<tolerance);
  assert.ok(Math.abs(top.pitch+Math.PI)<tolerance);
  assert.ok(Math.abs(finish.pitch+2*Math.PI)<tolerance);
  assert.ok(Math.abs(finish.point.x-a.point.x)<tolerance);
  assert.ok(Math.abs(finish.y-a.y)<tolerance);
  assert.equal(top.point.z,C.z+.25);
  assert.ok(top.y>groundHeight(C)+3,
    "inverted wheel contact must remain above the ordinary ground field");
});

test("full completion remains stable at 10, 20, 40 and 60 FPS",()=>{
  for(const fps of [10,20,40,60]){
    let ride=beginSkateLoop(8.9,groundHeight(C),C.z);
    let completed=false,steps=0,maxY=-Infinity;
    while(steps<8*fps&&!completed){
      const next=advanceSkateLoop(ride,1/fps);
      assert.ok(next.ride.angle>=ride.angle);
      assert.ok(next.ride.angle<=2*Math.PI);
      assert.ok(Number.isFinite(next.ride.speed));
      assert.ok(Number.isFinite(skateLoopSample(next.ride).y));
      maxY=Math.max(maxY,skateLoopSample(next.ride).y);
      ride=next.ride;completed=next.completed;steps++;
    }
    assert.equal(completed,true,"must return to free skating: "+fps+" fps");
    assert.ok(steps/fps<4,"the controlled arc must complete promptly: "+fps+" fps");
    assert.ok(maxY>ride.baseY+2*SKATE_LOOP.radius-.08);
    assert.ok(Math.abs(skateLoopSample(ride).point.x-C.x)<1e-6);
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
