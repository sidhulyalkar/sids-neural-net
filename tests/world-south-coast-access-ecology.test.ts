import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {SEA_SURFACE,WORLD_BOUNDS,terrainHeight,seaFloorHeight,
  southernChannelFloorHeight,waterZone,maxDiveDepth} from "../lib/world/model";
import {southCoastDryShore,southCoastEntry,southCoastLanding,
  SOUTH_ENTRY_SURFACE_Y} from "../lib/world/southCoastAccess";
import {SOUTH_HABITATS,southHabitatPoint,southHabitatTotals} from "../lib/world/southCoastHabitats";
import {createSouthCoastalEcology} from "../components/world/worldSouthCoastalEcology";
import {stepSwim,stepTravel} from "../lib/world/activities";

test("all dry southern shoreline samples enter while old land bounds remain protected",()=>{
  const shore:number[]=[];
  for(let x=-36;x<=62;x+=1){
    if(!southCoastDryShore(x))continue;
    shore.push(x);
    const p={x,z:-95.95};
    assert.equal(waterZone(p),null,`dry entry point x=${x}`);
    const entry=southCoastEntry(p,{x:0,z:-1},true,true);
    assert.ok(entry,`blocked shoreline x=${x}`);
    assert.equal(entry?.z,-96.9);
    assert.ok(seaFloorHeight(x,entry!.z)<SOUTH_ENTRY_SURFACE_Y-.2,
      `entry puts swimmer under physical floor at x=${x}`);
    assert.equal(waterZone(entry!),"south-channel");
    assert.equal(southCoastEntry(p,{x:0,z:1},true,true),null);
    assert.equal(southCoastEntry(p,{x:0,z:-1},true,false),null);
    assert.equal(southCoastEntry(p,{x:0,z:-1},false,true),null);
    const land=southCoastLanding({x,z:-95.5});
    assert.ok(land);
    assert.equal(waterZone(land!),null);
    assert.ok(Math.abs(terrainHeight(x,-96)-(SEA_SURFACE+.16))<1.1,
      `south bank misaligned at x=${x}`);
    assert.ok(Math.abs(southernChannelFloorHeight(x,-96)-
      terrainHeight(x,-96))<1e-9,`terrain seam x=${x}`);
  }
  assert.ok(shore.length>50,`coverage x samples=${shore.length}`);
  assert.equal(WORLD_BOUNDS.minZ,-96);
  assert.equal(SOUTH_ENTRY_SURFACE_Y,SEA_SURFACE-.42);
  for(const x of [-80,80])assert.equal(southCoastDryShore(x),false);
});

test("ordinary running actually reaches each south entry without changing sport bounds",()=>{
  for(let x=-29;x<=52;x+=7){
    let travel={point:{x,z:-91.8},heading:{x:0,z:-1},speed:0};
    let entered=false;
    for(let i=0;i<180;i++){
      travel=stepTravel(travel,{x:0,z:-1},.05,"run",[],false,null,
        0,p=>terrainHeight(p.x,p.z));
      const target=southCoastEntry(travel.point,{x:0,z:-1},true,true);
      if(target){
        entered=true;
        assert.equal(waterZone(target),"south-channel");
        break;
      }
    }
    assert.ok(entered,`runner could not reach south shore entry x=${x}`);
  }
});

test("surface swimmer can depart south and return through every landing segment",()=>{
  for(let x=-30;x<=53;x+=5){
    const entry=southCoastEntry({x,z:-95.96},{x:0,z:-1},true,true);
    assert.ok(entry,`missing entry at ${x}`);
    let travel={point:entry!,heading:{x:0,z:-1},speed:2.5};
    for(let i=0;i<15;i++)travel=stepSwim(travel,{x:0,z:-1},.12);
    assert.equal(waterZone(travel.point),"south-channel");
    for(let i=0;i<35;i++){
      travel=stepSwim(travel,{x:0,z:1},.12);
      if(waterZone(travel.point)===null)break;
    }
    assert.equal(waterZone(travel.point),null,`could not exit x=${x}`);
    assert.ok(southCoastLanding(travel.point));
  }
});

test("california kelp shelf deeper while original lagoon reef is unchanged",()=>{
  assert.ok(SEA_SURFACE-seaFloorHeight(62,-132)>6);
  assert.ok(maxDiveDepth({x:62,z:-132})>4);
  assert.ok(SEA_SURFACE-seaFloorHeight(17,-127)>16);
  assert.equal(waterZone({x:70,z:15}),"lagoon");
  assert.equal(waterZone({x:-65,z:15}),"kelp");
  assert.ok(southCoastDryShore(17));
  for(const x of [-60,17,62]){
    const a=southernChannelFloorHeight(x,-96);
    const b=southernChannelFloorHeight(x,-96.0001);
    assert.ok(Math.abs(a-b)<.05,`shelf seam x=${x}`);
  }
});

test("southwest reef ribbon continuously covers west side; southeast has mammals",()=>{
  const west=SOUTH_HABITATS.filter(p=>p.side==="southwest-reef");
  const east=SOUTH_HABITATS.filter(p=>p.side==="southeast-kelp");
  assert.equal(west.length,7);assert.equal(east.length,5);
  for(let x=-86;x<=-4;x+=2)
    assert.ok(west.some(p=>Math.hypot(x-p.x,-119-p.z)<p.radius+3),
      `southwest reef gap at x=${x}`);
  const eastCounts=southHabitatTotals("southeast-kelp");
  for(const k of ["giant-kelp","bull-kelp","garibaldi","sea-otter",
    "sea-lion","harbor-seal","leopard-shark","octopus","abalone"])
    assert.ok((eastCounts[k as keyof typeof eastCounts]??0)>0,k);
  let total=0;
  for(const p of SOUTH_HABITATS)for(const [kind,n] of Object.entries(p.population)){
    for(let i=0;i<n;i++){
      const q=southHabitatPoint(p,kind as keyof typeof p.population,i);
      assert.deepEqual(q,southHabitatPoint(p,kind as keyof typeof p.population,i));
      assert.equal(waterZone(q),"south-channel");
      assert.equal(q.y,seaFloorHeight(q.x,q.z));
      assert.ok(q.y<SEA_SURFACE-1);
      total++;
    }
  }
  assert.ok(total>750,`incomplete habitat: ${total}`);
});

test("south coast fauna shares GPU geometries, animates and cleans up",()=>{
  const parent=new THREE.Group();const eco=createSouthCoastalEcology(parent);
  assert.equal(parent.children.length,1);
  assert.ok(eco.draws<=23,`too many batches: ${eco.draws}`);
  const root=parent.children[0] as THREE.Group;
  assert.equal(root.children.length,2);
  for(const region of root.children){
    for(const mesh of region.children){
      assert.ok(mesh instanceof THREE.InstancedMesh);
      const inst=mesh as THREE.InstancedMesh;
      assert.ok(inst.count>0);
      const m=new THREE.Matrix4(),pos=new THREE.Vector3(),
        q=new THREE.Quaternion(),scale=new THREE.Vector3();
      for(let i=0;i<inst.count;i++){
        inst.getMatrixAt(i,m);m.decompose(pos,q,scale);
        assert.ok([...pos.toArray(),...scale.toArray()].every(Number.isFinite));
        assert.ok(scale.length()>0);
        assert.ok(pos.y<SEA_SURFACE+.1,`rendered dry: ${inst.name}:${i}`);
      }
    }
  }
  const seaLion=root.getObjectByName("south-southeast-kelp-sea-lion") as THREE.InstancedMesh;
  const m0=new THREE.Matrix4(),m1=new THREE.Matrix4();
  seaLion.getMatrixAt(0,m0);
  eco.update(12,{x:62,z:-128});
  seaLion.getMatrixAt(0,m1);
  assert.notDeepEqual(m0.elements,m1.elements);
  eco.dispose();assert.equal(parent.children.length,0);
});

test("animated southern animals stay submerged throughout their swimming routes",()=>{
  const parent=new THREE.Group(),eco=createSouthCoastalEcology(parent);
  const matrix=new THREE.Matrix4();
  const swimmers=new Set(["sea-lion","harbor-seal","sea-otter","garibaldi","sheephead","kelp-bass","leopard-shark"]);
  try {
    for(let time=0;time<=60;time+=.5){
      eco.update(time);
      parent.traverse(object=>{
        if(!(object instanceof THREE.InstancedMesh))return;
        const kind=object.name.replace("south-southeast-kelp-","");
        if(!swimmers.has(kind))return;
        object.geometry.computeBoundingBox();
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,matrix);
          const box=object.geometry.boundingBox!.clone().applyMatrix4(matrix);
          const center=box.getCenter(new THREE.Vector3());
          assert.ok(box.max.y<SEA_SURFACE,`${kind} breaches at ${time}`);
          assert.ok(box.min.y>seaFloorHeight(center.x,center.z),`${kind} clips floor at ${time}`);
        }
      });
    }
  } finally {eco.dispose();}
});
