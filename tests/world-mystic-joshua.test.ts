import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {MYSTIC_GROVE,MYSTIC_TREES,mysticGroveDistance}
 from "../lib/world/mysticGrove";
import {joshuaTreeSites} from "../lib/world/joshuaTrees";
import {REGIONS,isWater,terrainHeight,waterZone} from "../lib/world/model";
import {skimBeachClearance,northShoreZ} from "../lib/world/skimboarding";
import {desertTrackClearance,desertBypassClearance,DESERT_JUMPS}
 from "../lib/world/desertTrack";
import {sportClearance} from "../lib/world/activities";
import {createMysticElectricity} from "../components/world/worldMysticElectricity";

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
 assert.equal(attribute.count,2*9*2);
 const before=Array.from(attribute.array);
 effect.update(1,true,false);
 const after=Array.from(attribute.array);
 assert.notDeepEqual(after,before,"lightning should move over time");
 for(let i=0;i<attribute.count;i++)
  for(const n of [attribute.getX(i),attribute.getY(i),attribute.getZ(i)])
   assert.ok(Number.isFinite(n));
 for(let i=0;i<links.length;i++){
  const base=i*9*2;
  assert.ok(new THREE.Vector3().fromBufferAttribute(attribute,base)
   .distanceTo(links[i][0])<1e-6);
  assert.ok(new THREE.Vector3().fromBufferAttribute(attribute,base+17)
   .distanceTo(links[i][1])<1e-6);
 }
 effect.update(2,false,false);
 assert.equal(mesh.visible,false,"do not run offscreen lightning");
 effect.update(3,true,true);
 const reduced=Array.from(attribute.array);
 effect.update(4,true,true);
 assert.deepEqual(Array.from(attribute.array),reduced,
  "reduced motion must not animate");
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
