import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {createSeaArchGeometry,createSeaStackGeometry} from "../components/world/worldCoastalRockGeometry";
import {createJetSkiCoastGeometry} from "../components/world/worldJetSkiCourseGeometry";
import {JET_SKI_ARCHES,JET_SKI_ROCKS,isJetSkiArchSupport,jetSkiRockAt,jetSkiSegmentClear} from "../lib/world/jetSkiCourse";
import {JET_SKI_GATES} from "../lib/world/jetSkiRace";
import {northShoreZ} from "../lib/world/skimboarding";
import {SEA_SURFACE} from "../lib/world/model";

test("arch is one sculpted continuous rock with two water-rooted legs and an open passage",()=>{
 for(const arch of JET_SKI_ARCHES){
  const geometry=createSeaArchGeometry(arch);
  const position=geometry.getAttribute("position"),normal=geometry.getAttribute("normal");
  const colors=geometry.getAttribute("color");
  assert.ok(position.count>700&&position.count<10000,
   "a local sculpted landmark should be detailed but bounded");
  assert.equal(normal.count,position.count);
  assert.equal(colors.count,position.count);
  assert.equal(geometry.userData.coastalArchStyle,"continuous-wave-cut-v2");
  assert.ok(geometry.boundingSphere&&geometry.boundingSphere.radius>arch.span*.5);
  const bounds=geometry.boundingBox;
  assert.ok(bounds&&bounds.min.y<-1&&bounds.max.y>arch.height*.97,
   "legs must reach beneath the wave line while the crest stands clear");
  let feetLeft=0,feetRight=0,centerLow=0;
  for(let i=0;i<position.count;i++){
   const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
   for(const number of [x,y,z,normal.getX(i),normal.getY(i),normal.getZ(i),
     colors.getX(i),colors.getY(i),colors.getZ(i)])assert.ok(Number.isFinite(number));
   if(y<.2&&x<-arch.span*.40)feetLeft++;
   if(y<.2&&x>arch.span*.40)feetRight++;
   if(Math.abs(x)<.65&&y<arch.height*.57)centerLow++;
  }
  assert.ok(feetLeft>0&&feetRight>0,"both load-bearing feet must be real geometry");
  assert.equal(centerLow,0,"no mesh may curtain across the traversable opening");
  const doubleSide=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,doubleSide),ray=new THREE.Raycaster();
  ray.set(new THREE.Vector3(0,arch.height*.32,-20),new THREE.Vector3(0,0,1));
  assert.equal(ray.intersectObject(mesh).length,0,
   "a craft-sized ray through the opening must never hit hidden stone");
  ray.set(new THREE.Vector3(0,arch.height*.92,-20),new THREE.Vector3(0,0,1));
  assert.ok(ray.intersectObject(mesh).length>0,"roof must be genuinely solid");
  assert.equal(jetSkiRockAt(arch.center),null,"hull collider may not cover gate");
  assert.deepEqual(JET_SKI_GATES[arch.gateIndex],arch.center);
  doubleSide.dispose();geometry.dispose();
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
 const supports=JET_SKI_ROCKS.filter(isJetSkiArchSupport);
 assert.equal(supports.length,4,"two supports per authored arch");
 assert.equal(coast.visibleStackCount,JET_SKI_ROCKS.length-supports.length);
 for(const rock of supports)assert.equal(coast.root.getObjectByName(rock.id),undefined,
  "legacy full-height leg stack must not overlap the unified arch");
 for(const rock of JET_SKI_ROCKS.filter(rock=>!isJetSkiArchSupport(rock)))
  assert.ok(coast.root.getObjectByName(rock.id) instanceof THREE.Mesh,
   "unrelated sea stacks remain intact: "+rock.id);
 for(const arch of JET_SKI_ARCHES){
  const group=coast.root.getObjectByName(arch.id);
  assert.ok(group instanceof THREE.Group);
  assert.ok(group.getObjectByName(arch.id+"-continuous-sea-arch") instanceof THREE.Mesh);
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

test('submerged stack toes and both arch feet penetrate the sampled seabed',async()=>{
 const {seaFloorHeight}=await import('../lib/world/model');
 for(const rock of JET_SKI_ROCKS){
  const g=createSeaStackGeometry(rock),p=g.getAttribute('position');
  for(let i=0;i<13;i++)assert.ok(p.getY(i)<seaFloorHeight(rock.point.x+p.getX(i),rock.point.z+p.getZ(i))-.5);
  g.dispose();
 }
 for(const arch of JET_SKI_ARCHES){
  const g=createSeaArchGeometry(arch),p=g.getAttribute('position');
  for(const side of [-1,1]){
   let buried=0;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i);
    if(x*side<arch.span*.35)continue;
    const wx=arch.center.x+x*Math.cos(arch.heading)+z*Math.sin(arch.heading);
    const wz=arch.center.z-x*Math.sin(arch.heading)+z*Math.cos(arch.heading);
    if(p.getY(i)+SEA_SURFACE<seaFloorHeight(wx,wz)-.3)buried++;
   }
   assert.ok(buried>5,`${arch.id} foot ${side} must be buried`);
  }
  g.dispose();
 }
});
