import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  ARCADE_CAVE,MEMORY_POINTS,REGIONS,terrainHeight,
  terrainHeightBeforeHalfpipe,isWater,
} from "../lib/world/model";
import {SNOWMELT_PATH,DOWNSTREAM_PATH,drainagePoints,
  downstreamPoints,waterfallCrownRings,waterfallProfile} from "../lib/world/hydrology";
import {groundHeight,rampImpulseAt,RIDE_RAMPS,sportClearance,stepTravel,type Travel} from "../lib/world/activities";
import {BIG_AIR,shouldLaunchAuthoredSkiJump} from "../lib/world/bigAir";
import {
 MOUNTAIN_HALFPIPE,MOUNTAIN_SUMMIT,MOUNTAIN_PROTECTED_ANCHORS,
 mountainHalfpipeInfluence,mountainHalfpipeBank,mountainSummitBoost,
 withinMountainHalfpipe,
 halfpipeManualPopEligible,suppressedFaceKicker,
} from "../lib/world/mountainHalfpipe";
import {createWorldMountainHalfpipe} from "../components/world/worldMountainHalfpipe";

const h=MOUNTAIN_HALFPIPE;
const centerZ=(h.startZ+h.endZ)*.5;
const original=(x:number,z:number)=>terrainHeightBeforeHalfpipe(x,z);

test("new halfpipe starts from the verified pre-alpine world, without any glacier/park systems",()=>{
 assert.deepEqual(Object.keys(MOUNTAIN_HALFPIPE).sort(),
   ["bankRise","centerCut","centerX","endBlend","endZ",
    "featherWidth","floorHalfWidth","lipHalfWidth","startZ"].sort());
 assert.ok(h.endZ>h.startZ+18);
 assert.ok(h.lipHalfWidth-h.floorHalfWidth>=2.25,
   "each bank needs >=2.25m horizontal shaping width for ski carving");
 assert.ok(h.bankRise>=3&&h.bankRise<4.5);
 assert.ok(MOUNTAIN_SUMMIT.rise>0&&MOUNTAIN_SUMMIT.rise<=5);
 for(const id of ["ski-kicker","bowl-small","bowl-medium"])
   assert.equal(suppressedFaceKicker(id),true);
 for(const id of ["bike-ramp","grove-home-kicker","tree-kicker",
   "bowl-large","sequoia-return-kicker"])
   assert.equal(suppressedFaceKicker(id),false);
 assert.ok(REGIONS.some(r=>r.id==="waterfall"));
 assert.ok(REGIONS.some(r=>r.id==="canyon"));
});

test("the entire original snowmelt, waterfall, plunge, and coast remain bit-identical",()=>{
 const hydrology=[...SNOWMELT_PATH,...DOWNSTREAM_PATH,
   ...drainagePoints(),...downstreamPoints(),...waterfallCrownRings().flat(),
   waterfallProfile().lip,waterfallProfile().pool];
 for(const p of hydrology){
   assert.equal(terrainHeight(p.x,p.z),original(p.x,p.z),
     "sculpting must never alter flowing water at "+JSON.stringify(p));
   assert.equal(mountainHalfpipeInfluence(p),0);
   assert.equal(mountainSummitBoost(p),0);
 }
 for(const [name,p] of Object.entries(MOUNTAIN_PROTECTED_ANCHORS)){
   assert.equal(terrainHeight(p.x,p.z),original(p.x,p.z),name);
   assert.equal(mountainHalfpipeInfluence(p),0,name);
   assert.equal(mountainSummitBoost(p),0,name);
 }
 for(const p of [ARCADE_CAVE.entrance,ARCADE_CAVE.approach,
   ...MEMORY_POINTS.map(p=>p.point)]){
   assert.equal(terrainHeight(p.x,p.z),original(p.x,p.z),
     "protected artwork/cave/memory should not shift: "+JSON.stringify(p));
 }
});

test("edits are mathematically zero outside the one front ski face",()=>{
 let edited=0,identical=0;
 const limit=h.lipHalfWidth+h.featherWidth;
 for(let x=-39;x<=47;x+=.8)for(let z=-90;z<=5;z+=.8){
   const p={x,z},delta=terrainHeight(x,z)-original(x,z);
   const insidePipe=x>h.centerX-limit&&x<h.centerX+limit&&
     z>h.startZ&&z<h.endZ;
   const summit=mountainSummitBoost(p);
   if(!insidePipe&&summit===0){
     assert.equal(delta,0,"outside protected face: "+JSON.stringify(p));
     identical++;
   }else if(Math.abs(delta)>.00001)edited++;
   assert.ok(Number.isFinite(delta));
   if(isWater(p))assert.equal(delta,0);
 }
 assert.ok(identical>4000&&edited>200,
   "edits must be both local and materially sculpted");
});

test("summit is taller but no new shoreline or waterfall slopes are introduced",()=>{
 const s=MOUNTAIN_SUMMIT;
 // Preserve the entire original arcade chamber roof, not merely its two
 // anchor points. Otherwise summit lifts can deform a museum ceiling.
 for(let x=12.2;x<=19.8;x+=.4)for(let z=-81;z<=-63;z+=.4){
   const before=original(x,z);
   assert.equal(terrainHeight(x,z),before,
     "arcade roof must remain unchanged "+JSON.stringify({x,z}));
 }
 assert.ok(sportClearance({x:s.centerX,z:s.centerZ}),
   "the taller summit must reserve a clear snow in-run from procedural obstacles");
 assert.ok(terrainHeight(s.centerX,s.centerZ)-
   original(s.centerX,s.centerZ)>=s.rise-.01);
 for(const p of [MOUNTAIN_PROTECTED_ANCHORS.meltwaterSource,
  MOUNTAIN_PROTECTED_ANCHORS.fernWaterfall,
  MOUNTAIN_PROTECTED_ANCHORS.waterfallApproach,
  MOUNTAIN_PROTECTED_ANCHORS.arcadeEntrance]){
   assert.equal(terrainHeight(p.x,p.z)-original(p.x,p.z),0);
 }
 assert.ok(terrainHeight(h.centerX,h.startZ+4)>
   terrainHeight(h.centerX,h.endZ-4),
   "halfpipe must descend continuously toward the front of the mountain");
});

test("smooth banks, flat bottom, lips and feathered snow contact are real",()=>{
 const at=(x:number,z=centerZ)=>terrainHeight(x,z);
 const floor=at(h.centerX);
 assert.equal(mountainHalfpipeBank({x:h.centerX,z:centerZ}),0);
 for(const side of [-1,1]){
   const rimX=h.centerX+side*h.lipHalfWidth;
   assert.ok(at(rimX)>floor+2.3,
     "pipe must have genuine rideable vertical wall separation");
   const exterior=h.centerX+side*(h.lipHalfWidth+h.featherWidth);
   assert.equal(at(exterior),original(exterior,centerZ));
   assert.equal(mountainHalfpipeInfluence({x:exterior,z:centerZ}),0);
   assert.ok(mountainHalfpipeBank({x:rimX,z:centerZ})>=h.bankRise-.001);
   for(const radius of [h.floorHalfWidth,h.lipHalfWidth,
       h.lipHalfWidth+h.featherWidth]){
     const a=at(h.centerX+side*(radius-.055));
     const b=at(h.centerX+side*(radius+.055));
     assert.ok(Math.abs(a-b)<.42,
       "no seam or vertical collision step at x="+radius);
   }
 }
 for(const z of [h.startZ,h.endZ]){
   for(const x of [h.centerX,h.centerX-5,h.centerX+5])
     assert.equal(terrainHeight(x,z),
       original(x,z)+mountainSummitBoost({x,z}));
 }
 assert.equal(withinMountainHalfpipe({x:h.centerX,z:centerZ}),true);
});

test("default Ski and other world modes never arm Big Air at ordinary mountain ledges",()=>{
 for(const phase of ["idle","landed","missed","flying"] as const)
  for(const marked of [false,true])
   assert.equal(shouldLaunchAuthoredSkiJump("ski",phase,marked),false);
 for(const mode of ["run","skate","bike","boulder"])
  assert.equal(shouldLaunchAuthoredSkiJump(mode,"armed",true),false);
 assert.equal(shouldLaunchAuthoredSkiJump("ski","armed",false),false);
 assert.equal(shouldLaunchAuthoredSkiJump("ski","armed",true),true,
   "only explicitly selected Ski Jump crosses its authored lip");
 assert.ok(!withinMountainHalfpipe(BIG_AIR.lip));
 assert.equal(mountainHalfpipeInfluence(BIG_AIR.lip),0);
 assert.equal(mountainSummitBoost(BIG_AIR.start),0);
 assert.equal(mountainSummitBoost(BIG_AIR.lip),0);
 assert.ok(halfpipeManualPopEligible({x:h.centerX,z:centerZ},"ski",5,true));
 assert.equal(halfpipeManualPopEligible({x:h.centerX,z:centerZ},"ski",5,false),false);
 assert.equal(halfpipeManualPopEligible({x:h.centerX,z:centerZ},"bike",5,true),false);
 assert.equal(halfpipeManualPopEligible({x:h.centerX,z:centerZ},"ski",2,true),false);
});

test("old floating ski kickers on the face are gone physically but external activity ramps persist",()=>{
 for(const id of ["ski-kicker","bowl-small","bowl-medium"]){
  const ramp=RIDE_RAMPS.find(r=>r.id===id)!;
  const delta=groundHeight(ramp.point)-terrainHeight(ramp.point.x,ramp.point.z);
  assert.ok(delta<.1,"an invisible timber ramp must not lift the skier: "+id);
  assert.equal(rampImpulseAt(ramp.point,ramp.heading,"ski",8),null);
  assert.equal(rampImpulseAt(ramp.point,ramp.heading,"bike",8),null);
 }
 for(const id of ["grove-home-kicker","bike-ramp","sequoia-return-kicker"]){
  const ramp=RIDE_RAMPS.find(r=>r.id===id)!;
  assert.ok(rampImpulseAt(ramp.point,ramp.heading,ramp.modes[0],8),
    "skate/bike systems outside the face must still work: "+id);
 }
});

test("skiing physically traverses a downhill halfpipe and the existing ski launch stays manually authorized",()=>{
 const start:Travel={point:{x:h.centerX,z:h.startZ+1.2},
   heading:{x:0,z:1},speed:0};
 let step:Travel=start,inside=0,progress=0;
 for(let i=0;i<200;i++){
   step=stepTravel(step,{x:0,z:1},.05,"ski",[]);
   if(withinMountainHalfpipe(step.point))inside++;
   progress=Math.max(progress,step.point.z-start.point.z);
 }
 assert.ok(progress>10);
 assert.ok(inside>25);
 assert.ok(step.point.z>h.startZ+8);
 assert.ok(Number.isFinite(groundHeight(step.point)));
});

test("one snow mesh and one subtle coping follow exact collision geometry",()=>{
 const scene=new THREE.Scene();
 const world=createWorldMountainHalfpipe(scene);
 try{
   assert.equal(scene.children.length,2);
   assert.equal(world.snow.name,"granite-ridge-single-carved-halfpipe");
   assert.equal(world.coping.name,"granite-ridge-halfpipe-snow-coping");
   assert.ok(world.triangles>3000&&world.triangles<22000);
   for(const mesh of [world.snow,world.coping]){
     const a=mesh.geometry.getAttribute("position");
     assert.ok(a.count>200);
     for(let i=0;i<a.count;i+=13){
       const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
       assert.ok([x,y,z].every(Number.isFinite));
       assert.ok(Math.abs(y-terrainHeight(x,z))<.18,
         "snow skin must match physical surface, not a floating plane");
       assert.ok(z>=h.startZ-1e-4&&z<=h.endZ+1e-4);
     }
   }
 }finally{world.dispose()}
 assert.equal(scene.children.length,0);
});
