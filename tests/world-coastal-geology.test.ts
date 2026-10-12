import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {createSeaArchGeometry,createSeaStackGeometry} from "../components/world/worldCoastalRockGeometry";
import {createJetSkiCoastGeometry} from "../components/world/worldJetSkiCourseGeometry";
import {JET_SKI_ARCHES,JET_SKI_ROCKS,jetSkiRockAt,jetSkiSegmentClear} from "../lib/world/jetSkiCourse";
import {JET_SKI_GATES} from "../lib/world/jetSkiRace";
import {SEA_SURFACE} from "../lib/world/model";

test("wave-eroded arch geometry clears the actual gate and joins physical rock legs",()=>{
 for(const arch of JET_SKI_ARCHES){
  const geo=createSeaArchGeometry(arch),p=geo.attributes.position;
  assert.equal(p.count,25*8);
  assert.ok(geo.getAttribute("color"));
  assert.ok(geo.boundingSphere&&geo.boundingSphere.radius>8);
  // Center channel must not be filled by a torus or a secret roof collider.
  const centerX=arch.span*.5;
  let lowest=Infinity;
  for(let i=12*8;i<13*8;i++)lowest=Math.min(lowest,p.getY(i));
  assert.ok(lowest>SEA_SURFACE+5,
   "sufficient unobstructed hull/head clearance below arch crown");
  for(const end of [0,24]){
   const x=p.getX(end*8),z=p.getZ(end*8);
   assert.ok(Math.abs(Math.abs(x)-arch.span/2)<.001);
   assert.ok(Math.abs(z)<4);
  }
  assert.equal(jetSkiRockAt(arch.center),null,
   "hull collider must not extend beneath rendered stone bridge");
  assert.deepEqual(JET_SKI_GATES[arch.gateIndex],arch.center);
  geo.dispose();
 }
});

test("offshore stacks have deterministic weathered strata within their collision envelope",()=>{
 for(const rock of JET_SKI_ROCKS){
  const a=createSeaStackGeometry(rock),b=createSeaStackGeometry(rock);
  const vertex=a.attributes.position,colors=a.attributes.color;
  assert.equal(vertex.count,130);
  assert.deepEqual(Array.from(vertex.array),Array.from(b.attributes.position.array));
  assert.ok(a.boundingSphere?.radius&&a.boundingSphere.radius<rock.height*2.3);
  let maxR=0,outerBandCount=0;
  const swatches=new Set<string>();
  for(let i=0;i<vertex.count;i++){
   maxR=Math.max(maxR,Math.hypot(vertex.getX(i),vertex.getZ(i)));
   const l=(i/13|0);
   if(l<2)outerBandCount++;
   swatches.add(colors.getX(i).toFixed(2));
   for(const v of [vertex.getX(i),vertex.getY(i),vertex.getZ(i)])assert.ok(Number.isFinite(v));
  }
  assert.equal(outerBandCount,26);
  assert.ok(maxR<=rock.radius+.65+.001,"visual rock must not overhang physical hull collider");
  assert.ok(swatches.size>3,"layer coloring should express erosion");
  a.dispose();b.dispose();
 }
});

test("all landmark arches remain real race crossings and all approach lines stay clear",()=>{
 const route=[...JET_SKI_GATES];
 for(let i=0;i<route.length-1;i++)assert.ok(jetSkiSegmentClear(route[i],route[i+1],1.25));
 const scene=new THREE.Scene(),coast=createJetSkiCoastGeometry(scene);
 assert.equal(coast.archCount,2);
 assert.equal(coast.rockCount,JET_SKI_ROCKS.length);
 for(const arch of JET_SKI_ARCHES){
  const group=coast.root.getObjectByName(arch.id);
  assert.ok(group instanceof THREE.Group);
  assert.ok(group.getObjectByName(arch.id+"-wave-eroded-crown") instanceof THREE.Mesh);
 }
 coast.dispose();
 assert.equal(scene.children.length,0);
});
