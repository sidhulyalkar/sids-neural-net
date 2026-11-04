import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {terrainHeight} from "../lib/world/model";
import {
  ALPINE_HALFPIPE,ALPINE_ROCK_RIBS,GLACIER_PASSAGE,
  glacierVaultHeight,glacierCeilingHeight,glacierConstrainSkiMove,halfpipeBankSlope,
} from "../lib/world/alpineTerrainPark";
import {createWorldAlpineMicroDetail} from "../components/world/worldAlpineMicroDetail";
import {createWorldAlpineTerrainPark} from "../components/world/worldAlpineTerrainPark";

test("inner glacier vault is the same contact roof as the visual construction",()=>{
  const g=GLACIER_PASSAGE;
  for(const x of [g.westX,(g.westX+g.eastX)/2,g.eastX]){
    const floor=terrainHeight(x,g.centerZ);
    for(const frac of [-.99,-.65,-.2,0,.2,.65,.99]){
      const p={x,z:g.centerZ+frac*g.innerHalfWidth};
      const contact=glacierCeilingHeight(p,q=>terrainHeight(q.x,q.z));
      const roof=glacierVaultHeight(p,floor);
      assert.ok(contact!==null&&roof!==null);
      assert.ok(Math.abs(contact-roof)<1e-8);
      const shell=glacierVaultHeight(p,floor,true);
      assert.ok(shell!==null&&shell>=roof,
        "outer blue ice skin must not shrink safe headroom");
    }
  }
  assert.equal(glacierVaultHeight({x:0,z:g.centerZ+g.innerHalfWidth+.01},10),null);
});
test("halfpipe bank has finite symmetric slope and C1 lip and floor",()=>{
  const h=ALPINE_HALFPIPE,z=(h.startZ+h.endZ)/2;
  for(const side of [-1,1]){
    for(const x of [h.floorHalfWidth,h.rimHalfWidth]){
      assert.equal(halfpipeBankSlope({x:h.centerX+side*x,z}),0);
    }
    const midpoint=(h.floorHalfWidth+h.rimHalfWidth)*.5;
    const grade=halfpipeBankSlope({x:h.centerX+side*midpoint,z});
    assert.ok(Number.isFinite(grade));
    assert.ok(grade*side>.35&&grade*side<2.2);
  }
  assert.equal(halfpipeBankSlope({x:h.centerX,z}),0);
});
test("glacier sidewall collision is real, symmetric and leaves both portals free",()=>{
  const g=GLACIER_PASSAGE,x=(g.westX+g.eastX)/2,center=g.centerZ;
  for(const sign of [-1,1]){
    const inside={x,z:center};
    const crash={x,z:center+sign*(g.innerHalfWidth+1)};
    const stopped=glacierConstrainSkiMove(inside,crash);
    assert.ok(Math.abs(stopped.z-(center+sign*(g.innerHalfWidth-.42)))<1e-9);
    const outside={x,z:center+sign*(g.innerHalfWidth+1)};
    const sideApproach=glacierConstrainSkiMove(outside,
      {x,z:center+sign*(g.innerHalfWidth-.25)});
    assert.ok(Math.abs(sideApproach.z-center)>=g.innerHalfWidth+.41,
      "entering through the ice side wall must remain impossible");
  }
  for(const sign of [-1,1]){
    const from={x:sign===1?g.westX-.4:g.eastX+.4,z:center};
    const to={x:sign===1?g.westX+.4:g.eastX-.4,z:center};
    assert.deepEqual(glacierConstrainSkiMove(from,to),to,
      "crossing a real open glacier portal must not move the rider sideways");
  }
  const far={x:g.eastX+9,z:center+8};
  assert.deepEqual(glacierConstrainSkiMove({x:far.x-1,z:far.z},far),far);
});

test("alpine render geometry is watertight in attribute count and physics registered",()=>{
  const scene=new THREE.Scene();
  const park=createWorldAlpineTerrainPark(scene);
  const detail=createWorldAlpineMicroDetail(scene);
  try{
    assert.ok(park.rails>=12 && park.jumps===2);
    assert.equal(park.meshes.length,5,"halfpipe, ice floor, vault, kickers, batched fixtures");
    assert.ok(detail.statistics.iceBands>150);
    assert.ok(detail.statistics.corduroy>250);
    assert.ok(detail.statistics.fixtures>70);
    assert.ok(detail.statistics.rockLayers>15);
    assert.ok(detail.statistics.sequoiaDetails>0);
    assert.equal(ALPINE_ROCK_RIBS.length,14);
    assert.ok(scene.children.includes(detail.mesh));
    const seen=new Set<string>();
    for(const mesh of [...park.meshes,detail.mesh]){
      assert.ok(!seen.has(mesh.name));
      seen.add(mesh.name);
      const a=mesh.geometry.getAttribute("position");
      assert.ok(a.count>20,mesh.name+" must contain real mesh detail");
      for(let i=0;i<a.count;i++){
        assert.ok(Number.isFinite(a.getX(i))&&
          Number.isFinite(a.getY(i))&&Number.isFinite(a.getZ(i)));
      }
    }
    const shell=park.meshes.find(x=>x.name==="glacier-blue-ice-open-arch");
    assert.ok(shell);
    const y=terrainHeight((GLACIER_PASSAGE.westX+GLACIER_PASSAGE.eastX)/2,GLACIER_PASSAGE.centerZ);
    const roof=glacierVaultHeight({x:-4,z:GLACIER_PASSAGE.centerZ},y);
    assert.ok(roof!==null);
    const v=shell.geometry.getAttribute("position");
    const innerCenter:number[]=[];
    for(let i=0;i<v.count;i++){
      if(Math.abs(v.getX(i)+4)<.0001&&
        Math.abs(v.getZ(i)-GLACIER_PASSAGE.centerZ)<.0001)
        innerCenter.push(v.getY(i));
    }
    assert.ok(innerCenter.length>0,"real visible inner roof must cover cave midpoint");
    assert.ok(Math.min(...innerCenter)>=roof-.01&&
      Math.abs(Math.min(...innerCenter)-(roof+.045))<.025,
      "mesh must match cave headroom, allowing only a small rendering clearance");
  }finally{
    park.dispose();detail.dispose();
  }
  assert.equal(scene.children.length,0,"every new alpine detail mesh is disposable");
});