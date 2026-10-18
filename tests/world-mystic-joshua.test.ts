import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {MYSTIC_GROVE,MYSTIC_TREES,mysticGroveDistance,
 mysticCircuitPhase,mysticCircuitIntensity,MYSTIC_CIRCUIT}
 from "../lib/world/mysticGrove";
import {joshuaTreeSites} from "../lib/world/joshuaTrees";
import {REGIONS,isWater,terrainHeight,waterZone} from "../lib/world/model";
import {skimBeachClearance,northShoreZ} from "../lib/world/skimboarding";
import {desertTrackClearance,desertBypassClearance,DESERT_JUMPS}
 from "../lib/world/desertTrack";
import {sportClearance} from "../lib/world/activities";
import {createMysticElectricity} from "../components/world/worldMysticElectricity";
import {createWorldMysticGroveGeometry} from "../components/world/worldMysticGroveGeometry";

test("Mystic Grove discovery and its six trees moved together onto the north shelf",()=>{
 const region=REGIONS.find(r=>r.id==="neural");
 assert.ok(region);
 assert.equal(region!.name,"Mystic grove");
 assert.deepEqual(region!.point,MYSTIC_GROVE.center);
 assert.ok(mysticGroveDistance(region!.point)<.01);
 assert.equal(MYSTIC_TREES.length,6);
 const old={x:30,z:-5};
 assert.ok(mysticGroveDistance(old)>50,"old inland position cannot remain active");
 for(const p of [region!.point,...MYSTIC_TREES]){
  assert.equal(isWater(p),false,"all roots must remain dry");
  assert.equal(waterZone(p),null);
  assert.ok(p.z<northShoreZ(p.x)-2.3,"leave foreshore approach visible");
  assert.equal(skimBeachClearance(p),false,"skim beach must stay uncluttered");
  assert.equal(sportClearance(p),false,"skate and race lines stay open");
  assert.ok(Number.isFinite(terrainHeight(p.x,p.z)));
 }
 for(let i=0;i<MYSTIC_TREES.length;i++)
  assert.ok(mysticGroveDistance(MYSTIC_TREES[i])>3,
   "leave a walking path through the mystic discovery marker");
});

test("electrical arcs remain tip-connected, bounded and dispose correctly",()=>{
 const scene=new THREE.Scene();
 const links:[
  [THREE.Vector3,THREE.Vector3],[THREE.Vector3,THREE.Vector3]
 ]=[
  [new THREE.Vector3(1,7,2),new THREE.Vector3(7,8,4)],
  [new THREE.Vector3(7,8,4),new THREE.Vector3(9,9,7)],
 ];
 const effect=createMysticElectricity(scene,links);
 assert.equal(effect.count,2);
 assert.equal(scene.children.length,1);
 const mesh=scene.children[0] as THREE.LineSegments;
 const geo=mesh.geometry,attribute=geo.getAttribute("position");
 assert.equal(attribute.count,2*12*2);
 const attributeColors=geo.getAttribute("color");
 assert.equal(attributeColors.count,attribute.count);
 const before=Array.from(attribute.array);
 effect.update(.5,true,false);
 const after=Array.from(attribute.array);
 assert.notDeepEqual(after,before,"lightning should move over time");
 assert.equal(effect.activeLink,0,"pulse begins at the first actual branch link");
 // Verify that pulse brightness moves from the first link to the second.
 const brightness=(vertex:number)=>
  attributeColors.getX(vertex)+attributeColors.getY(vertex)+
  attributeColors.getZ(vertex);
 const firstBright=brightness(6);
 const secondDim=brightness(24+6);
 assert.ok(firstBright>secondDim*1.1,
  "the traveling packet must brighten one link, not flash all six");
 effect.update(MYSTIC_CIRCUIT.secondsPerLink+.5,true,false);
 assert.equal(effect.activeLink,1);
 assert.ok(brightness(24+6)>brightness(6)*1.1,
  "pulse must travel to next tree with deterministic ordering");
 for(let i=0;i<attribute.count;i++)
  for(const n of [attribute.getX(i),attribute.getY(i),attribute.getZ(i)])
   assert.ok(Number.isFinite(n));
 for(let i=0;i<links.length;i++){
  const base=i*12*2;
  assert.ok(new THREE.Vector3().fromBufferAttribute(attribute,base)
   .distanceTo(links[i][0])<1e-6);
  assert.ok(new THREE.Vector3().fromBufferAttribute(attribute,base+23)
   .distanceTo(links[i][1])<1e-6);
 }
 effect.update(4,false,false);
 assert.equal(mesh.visible,false,"do not run offscreen lightning");
 assert.equal(effect.activeLink,-1);
 effect.update(3,true,true);
 assert.equal(effect.activeLink,-2,"reduced motion shows a steady low glow");
 const reduced=Array.from(attribute.array);
 const staticColors=Array.from(attributeColors.array);
 effect.update(4,true,true);
 assert.deepEqual(Array.from(attribute.array),reduced,
  "reduced motion must not animate vertices");
 assert.deepEqual(Array.from(attributeColors.array),staticColors,
  "reduced motion must not change pulse color");
 effect.dispose();
 assert.equal(scene.children.length,0);
});

test("living Joshua trees line both sides of race course without blocking any lane",()=>{
 const sites=joshuaTreeSites();
 assert.ok(sites.length>=15,"race track must feel inhabited: "+sites.length);
 assert.ok(sites.length<=100,"no dense forest near active bike track");
 for(const p of sites){
  assert.equal(isWater(p),false);
  assert.equal(desertTrackClearance(p),false);
  assert.equal(desertBypassClearance(p),false);
  assert.equal(sportClearance(p),false);
  assert.ok(DESERT_JUMPS.every(j=>
   Math.hypot(p.x-j.point.x,p.z-j.point.z)>=9));
  assert.ok(p.height>2.5&&p.height<5.5);
  assert.ok(p.arms>=2&&p.arms<=4);
  assert.ok(Number.isFinite(terrainHeight(p.x,p.z)));
 }
 for(let i=0;i<sites.length;i++)for(let j=0;j<i;j++)
  assert.ok(Math.hypot(sites[i].x-sites[j].x,sites[i].z-sites[j].z)>=3.29);
 assert.deepEqual(joshuaTreeSites(),sites,"forest placement is deterministic");
});

test("Mystic Grove forest detailing is terrain-rooted, colored, small and disposable",()=>{
 const scene=new THREE.Scene();
 const tips=MYSTIC_TREES.map((site,i)=>Array.from({length:8},(_,j)=>{
  const a=i*1.6+j*.88;
  return new THREE.Vector3(site.x+Math.cos(a)*1.2,
   terrainHeight(site.x,site.z)+5.8+(j%3)*.22,
   site.z+Math.sin(a)*1.2);
 }));
 const grove=createWorldMysticGroveGeometry(scene,p=>terrainHeight(p.x,p.z),tips);
 assert.equal(scene.children.length,1);
 assert.equal(grove.root.children.length,3);
 assert.equal(grove.diagnostics.trees,6);
 assert.equal(grove.diagnostics.drawCalls,3);
 assert.ok(grove.diagnostics.fronds>=35,"ferns make the forest floor feel alive");
 assert.ok(grove.diagnostics.canopy>=40,"tree crowns have leaf detail");
 assert.ok(grove.diagnostics.stones>=12,"granite forms a quiet broken circle");
 assert.ok(grove.diagnostics.spores>=8,"subtle quartz and mushrooms");
 assert.ok(grove.diagnostics.triangles<22000,
  "geometry budget must remain small enough for browser SwiftShader");
 assert.deepEqual(grove.root.children.map(x=>x.name),[
  "mystic-rooted-bark","mystic-fern-moss-and-granite",
  "mystic-quartz-and-biological-glow",
 ]);
 for(const child of grove.root.children){
  assert.ok(child instanceof THREE.Mesh);
  const positions=(child as THREE.Mesh).geometry.getAttribute("position");
  const colors=(child as THREE.Mesh).geometry.getAttribute("color");
  assert.ok(positions.count>60&&colors.count===positions.count);
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
   assert.ok([x,y,z,colors.getX(i)].every(Number.isFinite));
   assert.ok(Math.hypot(x-MYSTIC_GROVE.center.x,z-MYSTIC_GROVE.center.z)<14,
    "grove detail may not spill onto the beach, race or meadow");
  }
  const material=(child as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(material.transparent,false);
  assert.equal(material.vertexColors,true);
 }
 const emissive=(grove.root.children[2] as THREE.Mesh)
  .material as THREE.MeshStandardMaterial;
 assert.ok(emissive.emissiveIntensity<=.3,"quartz must be subtle, not bloom");
 grove.dispose();
 assert.equal(scene.children.length,0);
});

test("Mystic pulse sweeps a closed six-tree circuit without frame-dependent state",()=>{
 const total=MYSTIC_TREES.length,step=MYSTIC_CIRCUIT.secondsPerLink;
 assert.equal(mysticCircuitPhase(0,total).link,0);
 assert.equal(mysticCircuitPhase(.6*step,total).link,0);
 for(let i=0;i<total;i++){
  const when=(i+.43)*step;
  const phase=mysticCircuitPhase(when,total);
  assert.equal(phase.link,i);
  assert.ok(Math.abs(phase.progress-.43)<1e-6);
  const active=mysticCircuitIntensity(when,i,.43,total);
  const neighboring=mysticCircuitIntensity(when,(i+1)%total,.43,total);
  assert.ok(active>.86&&neighboring<.2,
   "only the traveling link should flare brightly");
  assert.ok(mysticCircuitIntensity(when,i,0,total)>=0);
 }
 assert.equal(mysticCircuitPhase(total*step+.31*step,total).link,0);
 assert.equal(mysticCircuitPhase(-.2*step,total).link,total-1);
 assert.equal(mysticCircuitPhase(NaN,total).link,-1);
 assert.equal(mysticCircuitPhase(2,0).link,-1);
 assert.equal(mysticCircuitIntensity(3,2,.5,total,true),.32);
});
