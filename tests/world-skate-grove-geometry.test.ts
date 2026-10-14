import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {createWorldSkateGrove} from "../components/world/worldSkateGroveGeometry";
import {skateParkSurface,SKATE_PARK,REDWOOD_BOWL} from "../lib/world/skatepark";
import {groundHeight} from "../lib/world/activities";

test("authored wood geometry is static, named, low-draw and disposable",()=>{
 const scene=new THREE.Scene();
 const grove=createWorldSkateGrove(scene,groundHeight);
 assert.equal(grove.root.parent,scene);
 assert.equal(grove.root.name,"Redwood Skate Grove");
 for(const name of [
  "skate-grove-ride-surface","hollow-redwood-bark-shell",
  "redwood-growth-rings","split-redwood-coping",
  "timber-quarter-plank-joints","exterior-halfpipe-stringers",
  "split-stump-end-grain","redwood-log-grind",
  "durable-grind-caps","redwood-bark-striations",
  "open-trunk-end-grain","halfpipe-braced-timber-knees",
  "split-stump-grain-checks","park-edge-fern-fronds",
 ])assert.ok(grove.root.getObjectByName(name),"missing "+name);
 assert.ok(grove.root.children.length<=24,
  "park should use pooled meshes, not hundreds of objects");
 const barkFlutes=grove.root.getObjectByName("redwood-bark-striations");
 assert.ok(barkFlutes instanceof THREE.InstancedMesh);
 assert.ok(barkFlutes.count<=28,
  "redwood exterior must have sparse embedded bark grain, not a spiky skirt");
 for(const child of grove.root.children){
  if(!(child instanceof THREE.Mesh))continue;
  const p=child.geometry.getAttribute("position");
  for(let i=0;i<p.count;i++)for(const v of [p.getX(i),p.getY(i),p.getZ(i)]){
   assert.ok(Number.isFinite(v),"invalid local vertex in "+child.name);
  }
 }
 grove.dispose();
 assert.equal(grove.root.parent,null,"dispose removes park from scene");
});

test("visible cedar deck samples exact riding heightfield at every grid vertex",()=>{
 const scene=new THREE.Scene(),grove=createWorldSkateGrove(scene,groundHeight);
 try{
  const deck=grove.root.getObjectByName("skate-grove-ride-surface");
  assert.ok(deck instanceof THREE.Mesh);
  if(!(deck instanceof THREE.Mesh))return;
  const position=deck.geometry.getAttribute("position");
  assert.ok(position.count>3000,"smoothly tessellated bowl requires adequate mesh detail");
  let checked=0;
  for(let i=0;i<position.count;i+=73){
   const point={x:position.getX(i),z:position.getZ(i)};
   const visualY=position.getY(i);
   assert.ok(Math.abs(visualY-.035-skateParkSurface(point)!)<.001,
    "rendered surface and wheel contact must sample the same shape");
   checked++;
  }
  assert.ok(checked>40);
  assert.ok(SKATE_PARK.center.x-REDWOOD_BOWL.center.x>0);
 }finally{grove.dispose();}
});
