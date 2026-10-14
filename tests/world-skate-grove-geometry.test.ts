import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {createWorldSkateGrove} from "../components/world/worldSkateGroveGeometry";
import {skateParkSurface,SKATE_PARK,REDWOOD_BOWL,redwoodBowlBankRise} from "../lib/world/skatepark";
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

test("deep redwood silhouette belongs to the real surface, not a hidden art collider",()=>{
 const c=REDWOOD_BOWL.center;
 const at=(r:number,angle:number)=>({
  x:c.x+Math.cos(angle)*r,
  z:c.z+Math.sin(angle)*r,
 });
 const west=redwoodBowlBankRise(at(5.32,Math.PI));
 const outer=redwoodBowlBankRise(at(6.72,Math.PI));
 const split=redwoodBowlBankRise(at(5.32,.15));
 const interior=redwoodBowlBankRise(at(.4,0));
 assert.ok(west>1.72&&west<2.3,
  "raised trunk crest must have a legible old-growth silhouette");
 assert.ok(outer<.05,"exterior bark shoulder returns to natural earth");
 assert.ok(split<west*.53,"east opening stays beginner-friendly");
 assert.ok(interior<.005,"wooden bowl floor is smoothly flattened");
 for(const az of [-Math.PI,-2,-1,0,.35,1.7,2.5]){
  let prior=redwoodBowlBankRise(at(0,az));
  for(let r=.08;r<=7;r+=.08){
   const y=redwoodBowlBankRise(at(r,az));
   assert.ok(Number.isFinite(y)&&y>=0,"physical wood profile must remain finite");
   assert.ok(Math.abs(y-prior)<.34,
    "physical bark shoulder may be steep but cannot contain wheel-catching steps");
   prior=y;
  }
 }
});
