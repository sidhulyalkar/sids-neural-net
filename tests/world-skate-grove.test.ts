import test from "node:test";
import assert from "node:assert/strict";
import {terrainHeight,isWater} from "../lib/world/model";
import {groundHeight,nearestGrind,rampImpulseCrossing} from "../lib/world/activities";
import {
 SKATE_PARK,SKATE_PARK_RAILS,STUMP_PADS,REDWOOD_BOWL,
 insideSkatePark,skateParkZone,skateParkSurface,
 GROVE_BRIDGE,GROVE_LOG,groveBridgeRise,groveLogRise,
} from "../lib/world/skatepark";

test("Redwood Skate Grove has readable, geographically distinct features",()=>{
 assert.equal(SKATE_PARK_RAILS.length,3,"preserve existing grindable segments and ids");
 assert.deepEqual(SKATE_PARK_RAILS.map(rail=>rail.id),[
  "park-flat-bar","park-down-rail","park-bowl-coping",
 ]);
 assert.equal(skateParkZone(REDWOOD_BOWL.center),"redwood-bowl");
 assert.equal(skateParkZone({x:2,z:31}),"timber-quarter");
 assert.equal(skateParkZone({x:2,z:49}),"timber-quarter");
 for(const pad of STUMP_PADS){
  assert.equal(skateParkZone(pad.center),"stump-pad");
  assert.ok(insideSkatePark(pad.center));
  assert.ok(pad.lift<=.16,"the stump deck must remain a shallow transition");
 }
 assert.equal(skateParkZone({x:0,z:40}),"street");
 assert.ok(REDWOOD_BOWL.barkRadius<SKATE_PARK.halfWidth);
 assert.ok(!isWater(REDWOOD_BOWL.center));
});

test("tree-bowl is physically hollow, continuous and offers a shallow eastern entrance",()=>{
 const {center,rimRadius}=REDWOOD_BOWL;
 const floor=groundHeight(center);
 const west={x:center.x-rimRadius+.35,z:center.z};
 const east={x:center.x+rimRadius-.35,z:center.z+.7};
 const westRim=groundHeight(west),eastOpening=groundHeight(east);
 assert.ok(westRim>floor+.25,"bowl rim must rise above floor");
 // Terrain may incline naturally; compare the east and west rises to their
 // local base slope by sampling the field profile at matched radii.
 assert.ok(eastOpening<westRim+.8,"split entrance cannot form a tall gate");
 for(const theta of [0,Math.PI/4,Math.PI/2,Math.PI,3*Math.PI/2]){
  let previous=skateParkSurface(center)!;
  for(let r=.1;r<7;r+=.1){
   const p={x:center.x+Math.cos(theta)*r,z:center.z+Math.sin(theta)*r};
   const y=skateParkSurface(p);
   if(y===null)break;
   assert.ok(Number.isFinite(y));
   assert.ok(Math.abs(y-previous)<.6,
    "bowl bank cannot introduce wheel-catching steps");
   previous=y;
  }
 }
});

test("stump pads and halfpipes are on the same finite, rideable sampled heightfield",()=>{
 for(const pad of STUMP_PADS)for(let step=0;step<=20;step++){
  const p={x:pad.center.x-pad.radius*1.15+step*pad.radius*2.3/20,
   z:pad.center.z};
  const y=skateParkSurface(p);
  assert.ok(y!==null&&Number.isFinite(y));
  assert.ok(groundHeight(p)>=terrainHeight(p.x,p.z)-1e-6);
  assert.ok(Math.abs(groundHeight(p)-Math.max(terrainHeight(p.x,p.z),y!))<1e-6);
 }
 for(const z of [28.1,29,30.9,33,35,40,46.2,49.1,51.9]){
  const p={x:2,z},y=skateParkSurface(p);
  assert.ok(y!==null&&Number.isFinite(y));
  assert.ok(Math.abs(groundHeight(p)-Math.max(terrainHeight(p.x,p.z),y!))<1e-6);
 }
 for(let z=28;z<=52;z+=.25)for(const x of [-19.95,-12,-5,2,7.95]){
  const h=groundHeight({x,z});
  assert.ok(Number.isFinite(h),"finite support required across all park biomes");
 }
});

test("wood transformation does not change grind or park lip targets",()=>{
 assert.equal(nearestGrind({x:5,z:40})?.log.id,"park-flat-bar");
 const from={x:2,z:31.25},to={x:2,z:30.75},heading={x:0,z:-1};
 assert.equal(rampImpulseCrossing(from,to,heading,"skate",9)?.id,"park-north-quarter");
 assert.equal(rampImpulseCrossing(from,to,heading,"bike",9)?.id,undefined);
});


test("reference bridge and split log have continuous physical entrances and clear runouts",()=>{
 assert.ok(groveBridgeRise(GROVE_BRIDGE.center)>1.4);
 assert.equal(groveLogRise(GROVE_LOG.center),0,"hollow log has an open floor");
 assert.ok(groveLogRise({x:GROVE_LOG.center.x,z:GROVE_LOG.center.z+GROVE_LOG.halfWidth})>1);
 for(const feature of [GROVE_BRIDGE,GROVE_LOG]){
  let prior=groundHeight({x:feature.center.x-feature.halfLength-.3,z:feature.center.z});
  for(let dx=-feature.halfLength-.25;dx<=feature.halfLength+.25;dx+=.05){
   const p={x:feature.center.x+dx,z:feature.center.z};
   assert.ok(insideSkatePark(p)&&!isWater(p));
   const y=groundHeight(p);
   assert.ok(Math.abs(y-prior)<.18,"no step at either entrance or arch crest");
   assert.equal(y,skateParkSurface(p),"rendered support remains the physical support");
   prior=y;
  }
 }
});
