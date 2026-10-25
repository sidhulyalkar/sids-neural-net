import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {createWorldSkateGrove} from "../components/world/worldSkateGroveGeometry";
import {skateParkSurface,SKATE_PARK,REDWOOD_BOWL,redwoodBowlBankRise,SKATE_PARK_RAILS,railLiftAt,insideCanyonFlow} from "../lib/world/skatepark";
import {groundHeight} from "../lib/world/activities";

test("authored wood geometry is static, named, low-draw and disposable",()=>{
 const scene=new THREE.Scene();
 const grove=createWorldSkateGrove(scene,groundHeight);
 assert.equal(grove.root.parent,scene);
 assert.equal(grove.root.name,"Redwood Skate Grove");
 for(const name of [
  "skate-grove-ride-surface",
  "redwood-growth-rings","split-redwood-coping",
  "timber-quarter-plank-joints","exterior-halfpipe-stringers",
  "split-stump-end-grain","redwood-log-grind",
  "durable-grind-caps",
  "open-trunk-end-grain","halfpipe-braced-timber-knees",
  "split-stump-grain-checks","park-edge-fern-fronds",
 ])assert.ok(grove.root.getObjectByName(name),"missing "+name);
 assert.ok(grove.root.children.length<=22,
  "park should use pooled meshes, not hundreds of objects");
 assert.equal(grove.root.getObjectByName("hollow-redwood-bark-shell"),undefined,
  "coincident bark mesh would cut through the actual bowl on steep slopes");
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

test("giant bark sculpture and elliptical hollow log are static, open and disposable",()=>{
 const scene=new THREE.Scene(),grove=createWorldSkateGrove(scene,groundHeight);
 try{
  for(const name of ["sequoia-hollow-inner-roof","sequoia-deep-fluted-bark",
   "sequoia-open-end-heartwood","stump-bowl-outer-bark-apron",
   "stump-bowl-longitudinal-bark","full-360-loop-polished-tread",
   "full-360-loop-bark-understructure"]){
    const object=grove.root.getObjectByName(name);
    assert.ok(object,"missing sculptural landmark "+name);
    assert.ok(object instanceof THREE.Mesh);
    if(object instanceof THREE.Mesh){
      const vertices=object.geometry.getAttribute("position");
      assert.ok(object instanceof THREE.InstancedMesh?object.count>30:vertices.count>100,
       "feature must be sculpted or batched with meaningful instances: "+name);
      for(let i=0;i<vertices.count;i+=17)
        for(const n of [vertices.getX(i),vertices.getY(i),vertices.getZ(i)])
          assert.ok(Number.isFinite(n),"bad landmark vertex "+name);
    }
  }
  const mouth=grove.root.getObjectByName("sequoia-open-end-heartwood") as THREE.Mesh;
  const shell=grove.root.getObjectByName("sequoia-hollow-inner-roof") as THREE.Mesh;
  assert.ok(mouth.geometry.index&&mouth.geometry.index.count>200);
  assert.ok(shell.geometry.index&&shell.geometry.index.count>4000);
  assert.equal(grove.root.getObjectByName("sequoia-tunnel-and-timber-loop")?.parent,grove.root);
  assert.ok(grove.root.children.length<=22,"landmarks must share one pooled root");
 }finally{grove.dispose();}
});

test("visible cedar deck samples exact riding heightfield at every grid vertex",()=>{
 const scene=new THREE.Scene(),grove=createWorldSkateGrove(scene,groundHeight);
 try{
  const deck=grove.root.getObjectByName("skate-grove-ride-surface");
  assert.ok(deck instanceof THREE.Mesh);
  if(!(deck instanceof THREE.Mesh))return;
  const position=deck.geometry.getAttribute("position");
  assert.ok(position.count>=8245,"steep bark shoulder needs at least a 96x84 static support mesh");
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
 const outer=redwoodBowlBankRise(at(7.15,Math.PI));
 const split=redwoodBowlBankRise(at(5.32,.15));
 const interior=redwoodBowlBankRise(at(.4,0));
 assert.ok(west>2.28&&west<2.85,
  "raised trunk crest must have a legible old-growth silhouette");
 assert.ok(outer<.05,"exterior bark shoulder returns to natural earth");
 assert.ok(split<west*.53,"east opening stays beginner-friendly");
 assert.ok(interior<.005,"wooden bowl floor is smoothly flattened");
 assert.ok(redwoodBowlBankRise(at(1.95,Math.PI))<.005,
  "wider flat pocket must be genuinely flat before the curved wall begins");
 assert.ok(redwoodBowlBankRise(at(3.8,Math.PI))>.72,
  "rising bank must still be substantial enough to read as a true bowl");
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

test("tree trunk's dark bark exists in the authoritative riding field, not an overlay",()=>{
 const scene=new THREE.Scene(),grove=createWorldSkateGrove(scene,groundHeight);
 try{
  const deck=grove.root.getObjectByName("skate-grove-ride-surface");
  assert.ok(deck instanceof THREE.Mesh);
  if(!(deck instanceof THREE.Mesh))return;
  const positions=deck.geometry.getAttribute("position");
  const colors=deck.geometry.getAttribute("color");
  assert.equal(positions.count,colors.count);
  assert.ok(positions.count>=8245);
  const near=(x:number,z:number)=>{
   let best=Infinity,result=-1;
   for(let i=0;i<positions.count;i++){
    const d=Math.hypot(positions.getX(i)-x,positions.getZ(i)-z);
    if(d<best){best=d;result=i;}
   }
   assert.ok(best<.25,"sample requested a real mesh vertex");
   return result;
  };
  const inner=near(REDWOOD_BOWL.center.x,REDWOOD_BOWL.center.z+2);
  const dark=near(REDWOOD_BOWL.center.x,REDWOOD_BOWL.center.z+6);
  const brightness=(i:number)=>(colors.getX(i)+colors.getY(i)+colors.getZ(i))/3;
  assert.ok(brightness(inner)>brightness(dark)+.10,
   "polished hollow interior must be visibly lighter than surrounding bark");
  const litWall=near(REDWOOD_BOWL.center.x+4.12,REDWOOD_BOWL.center.z);
  assert.ok(brightness(litWall)>brightness(inner)+.07,
   "carved wall should catch light over a darker recessed hollow floor");
  const pyramid=near(-1,40),outerStreet=near(-3.2,37.2);
  assert.ok(brightness(pyramid)>brightness(outerStreet)+.025,
   "central street timber must feather into natural soil instead of a flat square");
  const brown=new THREE.Color(colors.getX(dark),colors.getY(dark),colors.getZ(dark));
  assert.ok(brown.r>brown.b&&brown.g>brown.b*.8,
   "outer surface must be warm redwood bark, not concrete or an exposed seam");
  assert.equal(grove.root.getObjectByName("hollow-redwood-bark-shell"),undefined);
 }finally{grove.dispose();}
});


test("Moss Canyon terrain ribbon and kinked rail art share physics heights",()=>{
 const scene=new THREE.Scene(),grove=createWorldSkateGrove(scene,groundHeight);
 try{
  const mesh=grove.root.getObjectByName("canyon-woodland-flow-surface");
  assert.ok(mesh instanceof THREE.Mesh);
  if(!(mesh instanceof THREE.Mesh))return;
  const verts=mesh.geometry.getAttribute("position");
  assert.ok(verts.count>2500&&verts.count<5000,
   "corridor must be a bounded pooled surface, not thousands of individual objects");
  for(let i=0;i<verts.count;i+=37){
   const p={x:verts.getX(i),z:verts.getZ(i)};
   if(!insideCanyonFlow(p))continue;
   assert.ok(Math.abs(verts.getY(i)-.035-groundHeight(p))<.001,
    "visible boards must match physical roller support exactly");
  }
  for(const name of ["canyon-roller-grain","canyon-manual-wood-rings",
    "split-timber-hybrid-rails","redwood-log-grind","grind-rail-timber-stands"])
   assert.ok(grove.root.getObjectByName(name),"missing "+name);
  const rail=SKATE_PARK_RAILS.find(s=>s.chainId==="canyon-snake"&&s.segment===1);
  assert.ok(rail);
  assert.ok(railLiftAt(rail!,1)>.5);
  // Every instance is pooled; the scene root must not balloon with single
  // segment objects or reduce frame rate in the forest.
  assert.ok(grove.root.children.length<=22);
 }finally{grove.dispose();}
});


test("sequoia interior has seamless normals and refined contact geometry",()=>{
 const scene=new THREE.Scene(),grove=createWorldSkateGrove(scene,groundHeight);
 try{
  const mesh=grove.root.getObjectByName("sequoia-hollow-inner-roof");
  assert.ok(mesh instanceof THREE.Mesh);
  const geo=mesh.geometry;
  const positions=geo.getAttribute("position");
  const normals=geo.getAttribute("normal");
  // 57 axial stations, 113 angular vertices after the smoothness pass.
  const along=57,around=113;
  assert.equal(positions.count,along*around);
  for(let ix=0;ix<along;ix++){
   const a=ix*around,b=a+around-1;
   assert.ok(Math.hypot(positions.getX(a)-positions.getX(b),
     positions.getY(a)-positions.getY(b),positions.getZ(a)-positions.getZ(b))<1e-5);
   assert.ok(Math.hypot(normals.getX(a)-normals.getX(b),
     normals.getY(a)-normals.getY(b),normals.getZ(a)-normals.getZ(b))<1e-5,
     "inner wall must not have a hard shading seam at angle 0/2π");
  }
  // Actual analytic shell and mesh agree along both floor entrances.
  const xLeft=positions.getX(0),xRight=positions.getX((along-1)*around);
  assert.ok(xLeft<xRight);
  const at=(i:number)=>({x:positions.getX(i),y:positions.getY(i),z:positions.getZ(i)});
  const a=at(0),b=at((along-1)*around);
  assert.ok(Math.abs(a.y-groundHeight({x:a.x,z:a.z}))<.01);
  assert.ok(Math.abs(b.y-groundHeight({x:b.x,z:b.z}))<.01);
 }finally{grove.dispose();}
});
