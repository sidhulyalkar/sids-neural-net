import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  EAGLE_FEVER_COUNT, EAGLE_FEVER_COHORTS, EAGLE_FEVER_MOBILE_COUNT,
  EAGLE_FEVER_MIN_CLEARANCE, sampleEagleFever,
} from "../lib/world/rayFever";
import { createRayPassage } from "../components/world/worldRayPassage";
import { SEA_SURFACE, maxDiveDepth, seaFloorHeight, waterZone, constrainMove, constrainSwimMove, WORLD_BOUNDS, SOUTH_CHANNEL_MIN_Z } from "../lib/world/model";
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
      assert.equal(waterZone(p),"south-channel",`ray ${i}`);
      assert.ok([p.x,p.y,p.z,p.yaw,p.roll,p.flap,p.size].every(Number.isFinite));
      assert.ok(p.x>-8&&p.x<43&&p.z>-166&&p.z<-96);
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
  assert.ok(rayPassageDepth(17,-127)>17);
  assert.ok(SEA_SURFACE-seaFloorHeight(17,-127)>19,"southern arch has deep water");
  assert.ok(maxDiveDepth({x:17,z:-127})>14,"southern inner channel allows deep exploration");
  assert.ok(maxDiveDepth({x:-54,z:8})<=10,"original kelp dive limit unchanged");
  assert.ok(maxDiveDepth({x:68,z:8})<=10,"original lagoon dive limit unchanged");
  assert.equal(rayPassageDepth(82,8),0,"original lagoon has no fever trench");
  assert.equal(rayPassageDepth(17,-96),0,"island boundary unchanged");
  assert.equal(rayPassageDepth(17,-166),0,"south ocean boundary unchanged");
  for(const z of [-96,-98,-105,-112,-120,-127,-140,-158,-166]){
    const p={x:17,z};
    const floor=seaFloorHeight(17,z);
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

test("southern snorkeling route crosses the old map edge, land sports do not",()=>{
  const landTarget={x:17,z:-127};
  assert.equal(constrainMove({x:17,z:-95},landTarget,[]).z,WORLD_BOUNDS.minZ);
  const swimming=constrainSwimMove({x:17,z:-95},landTarget);
  assert.deepEqual(swimming,landTarget);
  assert.equal(waterZone(swimming),"south-channel");
  assert.equal(constrainSwimMove(swimming,{x:17,z:-999}).z,SOUTH_CHANNEL_MIN_Z);
  assert.equal(waterZone({x:-42,z:-94}),"kelp");
  assert.equal(waterZone({x:-42,z:-100}),"south-channel");
  assert.equal(waterZone({x:65,z:-94}),"lagoon");
  assert.equal(waterZone({x:65,z:-100}),"south-channel");
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
