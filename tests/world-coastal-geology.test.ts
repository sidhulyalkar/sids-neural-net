import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {createSeaArchGeometry,createSeaStackGeometry} from "../components/world/worldCoastalRockGeometry";
import {createJetSkiCoastGeometry} from "../components/world/worldJetSkiCourseGeometry";
import {JET_SKI_ARCHES,JET_SKI_ROCKS,jetSkiRockAt,jetSkiSegmentClear} from "../lib/world/jetSkiCourse";
import {JET_SKI_GATES} from "../lib/world/jetSkiRace";
import {northShoreZ} from "../lib/world/skimboarding";

test("wave-eroded arch geometry clears the actual gate and joins physical rock legs",()=>{
 for(const arch of JET_SKI_ARCHES){
  const geo=createSeaArchGeometry(arch),p=geo.attributes.position;
  const edges=new Map<string,number>(),index=geo.getIndex()!;
  for(let i=0;i<index.count;i+=3)for(let j=0;j<3;j++){
   const a=index.getX(i+j),b=index.getX(i+(j+1)%3);
   const key=a<b?a+"/"+b:b+"/"+a;
   edges.set(key,(edges.get(key)??0)+1);
  }
  assert.ok([...edges.values()].every(count=>count===2),"closed rock surface");
  let leftFoot=false,rightFoot=false,clearance=Infinity;
  for(let i=0;i<p.count;i++){
   if(p.getY(i)<-2 && p.getX(i)<0)leftFoot=true;
   if(p.getY(i)<-2 && p.getX(i)>0)rightFoot=true;
   if(Math.abs(p.getX(i))<2)clearance=Math.min(clearance,p.getY(i));
  }
  assert.ok(leftFoot&&rightFoot&&Number.isFinite(clearance)&&clearance>5);
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
  assert.ok(a.attributes.normal.getX(5*13)>.2,
   "sea-stack normals must point toward exterior water");
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
  for(const foot of JET_SKI_ROCKS.filter(r=>r.archId===arch.id))
   assert.equal(coast.root.getObjectByName(foot.id),undefined);
  assert.ok(group.getObjectByName(arch.id+"-wave-eroded-crown") instanceof THREE.Mesh);
 }
 coast.dispose();
 assert.equal(scene.children.length,0);
});

test("north-shore surfing foreground stays free of race arch supports",()=>{
 const arch=JET_SKI_ARCHES.find(arch=>arch.id==="natural-bridges");
 assert.ok(arch,"Northern race arch must remain a real checkpoint");
 const supportRocks=JET_SKI_ROCKS.filter(rock=>rock.id.startsWith("natural-bridge-"));
 assert.equal(supportRocks.length,2);
 // Rocks are offshore beyond the shorebreak and three planted boards; they
 // remain visible and collidable to racers rather than being hidden by mode.
 for(const rock of supportRocks){
  assert.ok(rock.point.z-northShoreZ(rock.point.x)>30,
   "Solid arch support cannot dominate the skimboard near-shore foreground");
 }
 assert.deepEqual(JET_SKI_GATES[arch.gateIndex],arch.center);
 assert.equal(jetSkiRockAt(arch.center),null);
 assert.ok(jetSkiSegmentClear(JET_SKI_GATES[3],arch.center,1),
  "Northern arch approach remains navigable");
 assert.ok(jetSkiSegmentClear(arch.center,JET_SKI_GATES[5],1),
  "Northern arch exit remains navigable");
});
