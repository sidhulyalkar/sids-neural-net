import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
 WORLD_BOUNDS, SOUTH_CHANNEL_MIN_Z,SOUTH_CHANNEL_SHORE_Z,SEA_SURFACE,
 waterZone,constrainMove,constrainSwimMove,regionLanding,REGIONS,
 seaFloorHeight,southernChannelFloorHeight,worldFloorHeight,
 terrainHeight,maxDiveDepth,
} from "../lib/world/model";
import {stepSwim} from "../lib/world/activities";
import {southCoastDryShore,southCoastEntry,southCoastLanding,
 SOUTH_ENTRY_SURFACE_Y} from "../lib/world/southCoastAccess";
import {RAY_PASSAGE,rayPassageDepth} from "../lib/world/rayPassage";
import {EAGLE_FEVER_COUNT,EAGLE_FEVER_MOBILE_COUNT} from "../lib/world/rayFever";
import {SOUTH_HABITATS,southHabitatPoint} from "../lib/world/southCoastHabitats";
import {createRayPassage} from "../components/world/worldRayPassage";
import {createSouthChannelLife} from "../components/world/worldSouthChannelLife";
import {createSouthCoastalEcology} from "../components/world/worldSouthCoastalEcology";

test("South Shore menu arrives in actual water, with land boundaries unchanged",()=>{
 const region=REGIONS.find(r=>r.id==="south-shore");
 assert.ok(region);
 assert.match(region!.name,/South shore/);
 assert.equal(WORLD_BOUNDS.minZ,-96);
 assert.equal(SOUTH_CHANNEL_SHORE_Z,WORLD_BOUNDS.minZ);
 assert.equal(SOUTH_CHANNEL_MIN_Z,-166);
 const arrival=regionLanding("south-shore");
 assert.deepEqual(arrival,{x:17,z:-110});
 assert.equal(waterZone(arrival),"south-channel");
 assert.ok(maxDiveDepth(arrival)>.8,"menu must reach diveable water");
 const land=constrainMove({x:17,z:-95},{x:17,z:-130},[]);
 assert.equal(land.z,WORLD_BOUNDS.minZ,"land and skiing must remain clamped");
 const swim=constrainSwimMove(arrival,{x:17,z:-130});
 assert.equal(swim.z,-130,"only actual swimming crosses original land bounds");
 assert.deepEqual(constrainSwimMove(swim,{x:17,z:-190}),{x:17,z:-166});
 for(const p of [{x:-60,z:13},{x:65,z:13},{x:0,z:90}]){
  assert.notEqual(waterZone(p),"south-channel");
 }
});

test("Dry South Shore allows grounded outward entry and safe return across the beach",()=>{
 const samples=[];
 for(let x=-30;x<=55;x+=2){
  if(!southCoastDryShore(x))continue;
  samples.push(x);
  const shore={x,z:-95.95};
  assert.equal(waterZone(shore),null,"entry must begin on the beach");
  const entry=southCoastEntry(shore,{x:0,z:-1},true,true);
  assert.ok(entry,"blocked beach entry x="+x);
  assert.equal(entry!.z,-96.9);
  assert.equal(waterZone(entry!),"south-channel");
  assert.ok(seaFloorHeight(x,entry!.z)<SOUTH_ENTRY_SURFACE_Y-.2,
   "swimmer cannot enter if floor rises above body at x="+x);
  assert.equal(southCoastEntry(shore,{x:0,z:1},true,true),null);
  assert.equal(southCoastEntry(shore,{x:0,z:-1},true,false),null);
  assert.equal(southCoastEntry(shore,{x:0,z:-1},false,true),null);
  const exit=southCoastLanding({x,z:-95.5});
  assert.ok(exit);
  assert.equal(waterZone(exit!),null);
 }
 assert.ok(samples.length>25,"most of the dry southern beach must have entry");
 assert.equal(SOUTH_ENTRY_SURFACE_Y,SEA_SURFACE-.42);
});

test("South bathymetry has matching land edge and physical dive clearance",()=>{
 for(const x of [-80,-55,-20,0,17,34,62,82]){
  const shore=worldFloorHeight(x,-96);
  assert.ok(Number.isFinite(shore));
  assert.ok(Math.abs(shore-southernChannelFloorHeight(x,-96))<1e-8);
  assert.ok(Math.abs(shore-southernChannelFloorHeight(x,-96.001))<.025,
   "visible terrain seam at x="+x);
  for(const z of [-96.9,-102,-116,-127,-151,-166]){
   const sea=seaFloorHeight(x,z);
   assert.ok(Number.isFinite(sea));
   assert.ok(Math.abs(sea-southernChannelFloorHeight(x,z))<1e-8);
  }
 }
 assert.ok(rayPassageDepth(17,-127)>10);
 assert.equal(rayPassageDepth(17,-95),0);
 assert.ok(maxDiveDepth({x:17,z:-127})>10);
 assert.equal(terrainHeight(16,-82),worldFloorHeight(16,-82),
  "Arcade cavern approach must stay dry land");
});

test("Swimming crosses old boundary, reaches Eagle Ray Passage, and returns",()=>{
 let swim={point:{x:17,z:-110},speed:0,heading:{x:0,z:-1}};
 for(let i=0;i<100;i++)swim=stepSwim(swim,{x:0,z:-1},.12);
 assert.ok(swim.point.z<-122,"stuck before southern passage: "+swim.point.z);
 assert.equal(waterZone(swim.point),"south-channel");
 for(let i=0;i<100;i++)swim=stepSwim(swim,{x:0,z:1},.12);
 assert.ok(swim.point.z>-135,"failed return swim: "+swim.point.z);
 // The swimmer can reach the shallows again; the in-game aquatic state
 // changes to land only once the shore has been physically crossed.
 assert.ok(swim.point.z> -155);
});

test("Southern ray school and neighboring reef art are bounded and disposable",()=>{
 assert.equal(RAY_PASSAGE.centerZ,-127);
 assert.equal(EAGLE_FEVER_COUNT,96);
 assert.equal(EAGLE_FEVER_MOBILE_COUNT,72);
 assert.equal(SOUTH_HABITATS.filter(p=>p.side==="southwest-reef").length,7);
 assert.equal(SOUTH_HABITATS.filter(p=>p.side==="southeast-kelp").length,5);
 for(const patch of SOUTH_HABITATS){
  const key=Object.keys(patch.population)[0] as keyof typeof patch.population;
  const point=southHabitatPoint(patch,key,0);
  assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
  assert.equal(waterZone(point),"south-channel");
 }
 const parent=new THREE.Group();
 const rays=createRayPassage(parent);
 const fish=createSouthChannelLife(parent);
 const habitats=createSouthCoastalEcology(parent);
 assert.ok(rays.count>=EAGLE_FEVER_COUNT);
 assert.equal(rays.feverCount,96);
 assert.equal(fish.counts.fish,72);
 assert.ok(habitats.draws>0);
 rays.update(1,true,{x:17,y:-5,z:-127});
 fish.update(1,true);
 habitats.update(1,{x:17,z:-127},true);
 rays.dispose();fish.dispose();habitats.dispose();
 assert.equal(parent.children.length,0,"remove and dispose generated art on exit");
});
