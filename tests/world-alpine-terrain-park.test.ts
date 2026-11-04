import assert from "node:assert/strict";
import test from "node:test";
import {
  ALPINE_HALFPIPE,GLACIER_PASSAGE,ALPINE_KICKERS,ALPINE_PARK_RAILS,
  ALPINE_RAIL_CHAINS,ALPINE_FEATURE_BOXES,
  alpineHalfpipeStrength,halfpipeBankRise,glacierPassageStrength,
  insideGlacierPassage,glacierCeilingHeight,glacierEntrance,
  alpineFeatureZone,alpineSportClearance,alpineBoxSupport,
} from "../lib/world/alpineTerrainPark";
import {
  terrainHeight,mountainSurfaceHeight,isWater,
  ARCADE_CAVE,PAPER_CAVE,WORLD_BOUNDS,
} from "../lib/world/model";
import {
  groundHeight,RIDE_RAMPS,rampImpulseAt,nearestGrind,stepTravel,
  sportClearance,type Travel,
} from "../lib/world/activities";
import {advanceRailChain,SKATE_PARK_RAILS,SKATE_LOOP} from "../lib/world/skatepark";

test("halfpipe uses one connected C1 snow profile with realistic two-sided banking",()=>{
  const h=ALPINE_HALFPIPE,p={x:h.centerX,z:(h.startZ+h.endZ)/2};
  assert.ok(h.bankHeight>=3&&h.rimHalfWidth>h.floorHalfWidth+3);
  assert.ok(!isWater(p));
  assert.equal(halfpipeBankRise(p),0);
  assert.ok(Math.abs(halfpipeBankRise({x:p.x+h.rimHalfWidth,z:p.z})-h.bankHeight)<1e-8);
  assert.equal(alpineHalfpipeStrength({x:p.x,z:h.startZ}),0);
  assert.equal(alpineHalfpipeStrength({x:p.x,z:h.endZ}),0);
  const centerY=terrainHeight(p.x,p.z);
  for(const sign of [-1,1]){
    const rim={x:p.x+sign*h.rimHalfWidth,z:p.z};
    assert.ok(terrainHeight(rim.x,rim.z)>centerY+2.8);
    for(const x of [h.floorHalfWidth,h.rimHalfWidth,h.rimHalfWidth+h.outerFeather]){
      const a=terrainHeight(p.x+sign*(x-.025),p.z);
      const b=terrainHeight(p.x+sign*(x+.025),p.z);
      assert.ok(Math.abs(a-b)<.24,"profile has no sudden skiing step at "+x);
    }
  }
  // The local snow volume continues the natural longitudinal mountain grade.
  const upstream=terrainHeight(p.x,h.startZ+4);
  const downstream=terrainHeight(p.x,h.endZ-4);
  assert.ok(upstream>downstream,"halfpipe is a genuine downhill run");
});

test("glacier cave has two real open portals, a carved floor, and headroom",()=>{
  const g=GLACIER_PASSAGE;
  assert.ok(g.westX>WORLD_BOUNDS.minX && g.eastX<WORLD_BOUNDS.maxX);
  assert.ok(g.centerZ>WORLD_BOUNDS.minZ+g.outerHalfWidth+2);
  assert.ok(g.innerHalfWidth>2&&g.clearanceHeight>=4.5);
  const center={x:(g.westX+g.eastX)/2,z:g.centerZ};
  assert.equal(glacierEntrance({x:g.westX,z:g.centerZ}),"west");
  assert.equal(glacierEntrance({x:g.eastX,z:g.centerZ}),"east");
  assert.ok(insideGlacierPassage(center));
  assert.equal(alpineFeatureZone(center),"glacier");
  assert.ok(glacierPassageStrength(center)>.9);
  const original=mountainSurfaceHeight(center.x,center.z);
  const floor=terrainHeight(center.x,center.z);
  assert.ok(floor<original-3.7,"the existing mountain must be excavated");
  const ceiling=glacierCeilingHeight(center,p=>terrainHeight(p.x,p.z));
  assert.ok(ceiling!==null&&ceiling-floor>=g.clearanceHeight-.01);
  for(let x=g.westX-4;x<=g.eastX+4;x+=.25){
    const y=terrainHeight(x,g.centerZ);
    assert.ok(Number.isFinite(y));
    assert.ok(!isWater({x,z:g.centerZ}));
    assert.ok(Math.abs(y-terrainHeight(x+.025,g.centerZ))<.25,
      "no impossible step while skiing through "+x);
  }
  assert.equal(insideGlacierPassage({x:ARCADE_CAVE.entrance.x,z:ARCADE_CAVE.entrance.z}),false);
  assert.equal(insideGlacierPassage({x:PAPER_CAVE.x,z:PAPER_CAVE.z}),false);
});

test("glacier passage is a continuous two-way skiable traverse",()=>{
  const g=GLACIER_PASSAGE;
  for(const direction of [1,-1]){
    let rider:Travel={
      point:{x:direction===1?g.westX-4:g.eastX+4,z:g.centerZ},
      heading:{x:direction,z:0},speed:0,
    };
    let crossed=false;
    for(let i=0;i<260;i++){
      rider=stepTravel(rider,{x:direction,z:0},.05,"ski",[]);
      assert.ok(Number.isFinite(groundHeight(rider.point)));
      if(direction===1?rider.point.x>g.eastX+1:rider.point.x<g.westX-1){
        crossed=true;break;
      }
    }
    assert.ok(crossed,"both portals must permit a full ski traversal");
  }
});

test("curved alpine grind chains are physically connected and use the real rail solver",()=>{
  assert.ok(ALPINE_RAIL_CHAINS.length>=3);
  assert.ok(ALPINE_PARK_RAILS.length>=12);
  for(const chain of ALPINE_RAIL_CHAINS){
    const rails=ALPINE_PARK_RAILS.filter(r=>r.chainId===chain.id);
    assert.equal(rails.length,chain.points.length-1);
    for(let i=0;i<rails.length;i++){
      assert.deepEqual(rails[i].b,chain.points[i+1]);
      assert.ok(SKATE_PARK_RAILS.some(r=>r.id===rails[i].id));
      if(i<rails.length-1)assert.deepEqual(rails[i].b,rails[i+1].a);
      assert.ok(rails[i].radius>.05&&rails[i].lift>0);
    }
    const start=rails[0],end=rails.at(-1)!;
    const travel=advanceRailChain(start,0,1,100);
    assert.equal(travel.rail.id,end.id);
    assert.equal(travel.finished,true);
    const testPoint={x:(start.a.x+start.b.x)/2,z:(start.a.z+start.b.z)/2};
    assert.equal(nearestGrind(testPoint)?.log.id,start.id);
  }
});

test("terrain box support and large kickers correspond to authored ski mechanics",()=>{
  const box=ALPINE_FEATURE_BOXES[0];
  const halfway={x:(box.from.x+box.to.x)/2,z:(box.from.z+box.to.z)/2};
  assert.ok(alpineBoxSupport(halfway,0)>.65);
  assert.ok(groundHeight(halfway)>terrainHeight(halfway.x,halfway.z)+.65);
  assert.ok(alpineSportClearance(halfway));
  for(const kicker of ALPINE_KICKERS){
    const found=RIDE_RAMPS.find(r=>r.id===kicker.id);
    assert.ok(found,"ski/ride ramp impulses must share their visible lip coordinates");
    assert.deepEqual(found.point,kicker.point);
    assert.equal(rampImpulseAt(kicker.point,kicker.heading,"ski",8)?.id,kicker.id);
    assert.ok(sportClearance(kicker.point));
    assert.ok(!isWater(kicker.point));
  }
  assert.ok(Math.hypot(SKATE_LOOP.center.x-ALPINE_HALFPIPE.centerX,
    SKATE_LOOP.center.z-(ALPINE_HALFPIPE.startZ+ALPINE_HALFPIPE.endZ)*.5)>90);
});
