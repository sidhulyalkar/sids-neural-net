import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  EAGLE_FEVER_COUNT, EAGLE_FEVER_COHORTS, EAGLE_FEVER_MOBILE_COUNT,
  EAGLE_FEVER_MIN_CLEARANCE, sampleEagleFever,
} from "../lib/world/rayFever";
import { createRayPassage } from "../components/world/worldRayPassage";
import { SEA_SURFACE, maxDiveDepth, seaFloorHeight, waterZone } from "../lib/world/model";
import { rayPassageDepth } from "../lib/world/rayPassage";

test("eagle fever fills a large vertical channel with 120 deterministic ray trajectories",()=>{
  assert.equal(EAGLE_FEVER_COUNT,120);
  assert.equal(EAGLE_FEVER_MOBILE_COUNT,96);
  const bands=new Set<number>();
  for(const seconds of [0,1,20,90,240]) {
    const poses=Array.from({length:EAGLE_FEVER_COUNT},(_,i)=>
      sampleEagleFever(i,seconds,seaFloorHeight,SEA_SURFACE));
    for(let i=0;i<poses.length;i++) {
      const p=poses[i];
      assert.deepEqual(p,sampleEagleFever(i,seconds,seaFloorHeight,SEA_SURFACE));
      assert.equal(waterZone(p),"lagoon",`ray ${i}`);
      assert.ok([p.x,p.y,p.z,p.yaw,p.roll,p.flap,p.size].every(Number.isFinite));
      assert.ok(p.x>70&&p.x<94&&p.z>-45&&p.z<55);
      assert.ok(p.y <= SEA_SURFACE-.7);
      assert.ok(p.y >= seaFloorHeight(p.x,p.z)+EAGLE_FEVER_MIN_CLEARANCE-1e-7,
        `ray ${i} breached seafloor`);
      bands.add(p.depthBand);
    }
    assert.ok(poses.some(p=>SEA_SURFACE-p.y<4),"surface snorkeler sees rays");
    assert.ok(poses.some(p=>SEA_SURFACE-p.y>10),"deep rays visibly layer beneath");
  }
  assert.equal(bands.size,6);
  assert.throws(()=>sampleEagleFever(-1,0,seaFloorHeight,SEA_SURFACE),RangeError);
  assert.throws(()=>sampleEagleFever(120,0,seaFloorHeight,SEA_SURFACE),RangeError);
});

test("ray fever trench has room for deeper strata but beaches and shore sports stay unchanged",()=>{
  assert.ok(rayPassageDepth(82,8)>13);
  assert.ok(SEA_SURFACE-seaFloorHeight(82,8)>16,"channel has deep water");
  assert.ok(maxDiveDepth({x:82,z:8})>14,"inner channel enables deeper observation");
  assert.ok(maxDiveDepth({x:-54,z:8})<=10,"kelp depth unchanged");
  assert.ok(maxDiveDepth({x:68,z:8})<=10,"shoreline retains normal safety limit");
  assert.equal(rayPassageDepth(58,8),0,"island boundary unchanged");
  assert.equal(rayPassageDepth(94,8),0,"outer world edge unchanged");
  for(const x of [60,62,64,66,68,70,74,80,86,90,92,94]){
    const p={x,z:8};
    const floor=seaFloorHeight(x,8);
    if(waterZone(p)==="lagoon"){
      const depth=maxDiveDepth(p);
      assert.ok(depth>=0&&depth<=16);
      if(depth>0) assert.ok(SEA_SURFACE-depth>=floor+1.15-1e-6,
        `diving floor clearance failed at x=${x}`);
      else assert.ok(SEA_SURFACE-floor<=1.15+1e-6,
        `a deep enough water cell must permit some diving at x=${x}`);
    }
  }
});

test("120 eagle ray bodies use only four instanced draws, tails one, with lifecycle cleanup",()=>{
  const lagoon=new THREE.Group();
  const passage=createRayPassage(lagoon);
  assert.equal(passage.feverCount,120);
  assert.equal(passage.visibleFeverCount,120); // Node / desktop setting
  assert.equal(passage.feverDrawCalls,5);
  assert.equal(passage.count,132);
  const root=lagoon.getObjectByName("eagle-ray-cleaning-passage")!;
  const bodies=Array.from({length:EAGLE_FEVER_COHORTS},(_,i)=>
    root.getObjectByName(`eagle-fever-bodies-${i}`) as THREE.InstancedMesh);
  assert.ok(bodies.every(b=>b instanceof THREE.InstancedMesh));
  assert.ok(bodies.every(b=>b.count===30));
  const tails=root.getObjectByName("eagle-fever-tails") as THREE.InstancedMesh;
  assert.ok(tails instanceof THREE.InstancedMesh);
  assert.equal(tails.count,120);
  const m=new THREE.Matrix4(),position=new THREE.Vector3(),
    rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const mesh of [...bodies,tails]){
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,m);m.decompose(position,rotation,scale);
      assert.ok([...position.toArray(),...scale.toArray()].every(Number.isFinite));
      assert.ok(scale.length()>0);
    }
  }
  const body=bodies[0],positions=body.geometry.getAttribute("position") as THREE.BufferAttribute;
  const before=positions.getY(100);
  passage.update(19);
  assert.notEqual(positions.getY(100),before,"flapping animation actually changes geometry");
  passage.dispose();
  assert.equal(lagoon.children.length,0);
});

test("close-up rays gently part to let the snorkeler enter the fever",()=>{
  for(const i of [0,19,42,77,116]){
    const unperturbed=sampleEagleFever(i,14,seaFloorHeight,SEA_SURFACE);
    const near=sampleEagleFever(i,14,seaFloorHeight,SEA_SURFACE,unperturbed);
    const deflection=Math.hypot(near.x-unperturbed.x,near.z-unperturbed.z);
    assert.ok(deflection>2 && deflection<=2.401);
    assert.ok(near.y>=seaFloorHeight(near.x,near.z)+EAGLE_FEVER_MIN_CLEARANCE-1e-7);
    assert.equal(waterZone(near),"lagoon");
    const far=sampleEagleFever(i,14,seaFloorHeight,SEA_SURFACE,
      {x:unperturbed.x+100,y:unperturbed.y,z:unperturbed.z+100});
    assert.deepEqual(far,unperturbed,"distant swimmer cannot affect remote fish");
  }
});
