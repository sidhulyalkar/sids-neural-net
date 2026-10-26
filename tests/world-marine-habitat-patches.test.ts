import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
  MARINE_HABITAT_PATCHES, marineHabitatPoint, marineHabitatCounts,
  marineHabitatAt, marineHabitatLabel,
  type ReefZone,
} from "../lib/world/marineHabitatPatches";
import { createMarineHabitatPatches } from "../components/world/worldMarineHabitatPatches";
import {
  SEA_SURFACE, seaFloorHeight, waterZone, WORLD_BOUNDS, coastlineX, eastCoastlineX, maxDiveDepth,
} from "../lib/world/model";

test("deterministic snorkeling microhabitats include the Wild Coast coral garden",()=>{
  assert.equal(MARINE_HABITAT_PATCHES.length,19);
  for(const zone of ["kelp","lagoon"] as const){
    const patches=MARINE_HABITAT_PATCHES.filter(p=>p.zone===zone);
    assert.equal(patches.length,zone==="kelp"?8:11);
    assert.equal(new Set(patches.map(p=>p.theme)).size,patches.length);
    assert.equal(new Set(patches.map(p=>p.id)).size,patches.length);
    assert.ok(Object.values(marineHabitatCounts(zone)).reduce((a,b)=>a+b,0)>250);
    for(const patch of patches){
      assert.equal(waterZone(patch),zone,`patch center must be submerged: ${patch.id}`);
      assert.ok(patch.radius>=6&&patch.radius<=12);
    }
  }
});

test("every coral, rock and animal placement is reproducible, underwater, in its own zone",()=>{
  let checked=0;
  const distinct=new Set<string>();
  for(const patch of MARINE_HABITAT_PATCHES){
    for(const [kind,count] of Object.entries(patch.population)){
      assert.ok(Number.isInteger(count)&&count>0&&count<100);
      for(let i=0;i<count;i++){
        const p=marineHabitatPoint(patch,kind as keyof typeof patch.population,i);
        assert.deepEqual(p,marineHabitatPoint(patch,kind as keyof typeof patch.population,i));
        assert.equal(p.patchId,patch.id);
        assert.equal(p.kind,kind);
        assert.equal(waterZone(p),patch.zone,`${patch.id} / ${kind}`);
        assert.ok(p.x>WORLD_BOUNDS.minX&&p.x<WORLD_BOUNDS.maxX);
        assert.ok(p.z>WORLD_BOUNDS.minZ&&p.z<WORLD_BOUNDS.maxZ);
        assert.equal(p.y,seaFloorHeight(p.x,p.z));
        assert.ok(p.y<SEA_SURFACE-.8,`dry ${kind}: ${patch.id}`);
        assert.ok(p.scale>.4&&p.scale<1.3);
        distinct.add(`${kind}:${Math.round(p.x)}:${Math.round(p.z)}`);
        checked++;
      }
    }
  }
  assert.ok(checked>600,`too sparse: ${checked}`);
  assert.ok(distinct.size>checked*.55,`too many overlapping organism anchors: ${distinct.size}/${checked}`);
  const patch=MARINE_HABITAT_PATCHES[0],kind=Object.keys(patch.population)[0] as keyof typeof patch.population;
  assert.throws(()=>marineHabitatPoint(patch,kind,-1),RangeError);
  assert.throws(()=>marineHabitatPoint(patch,kind,patch.population[kind]!),RangeError);
});

test("lagoon and kelp geometry reuses instances, paints species differently, stays disposable",()=>{
  const west=new THREE.Group(),east=new THREE.Group();
  const habitats=createMarineHabitatPatches(west,east);
  assert.equal(habitats.patchCount,19);
  assert.ok(habitats.drawCalls.kelp<=18, `west draws ${habitats.drawCalls.kelp}`);
  assert.ok(habitats.drawCalls.lagoon<=24, `east draws ${habitats.drawCalls.lagoon}`);
  assert.equal(west.children.length,1);
  assert.equal(east.children.length,1);
  const geometryRefs=new Set<THREE.BufferGeometry>();
  const props=new Set<string>();
  for(const [zone,group] of [["kelp",west],["lagoon",east]] as const) {
    const root=group.children[0] as THREE.Group;
    assert.equal(root.name,`marine-patches-${zone}`);
    for(const item of root.children){
      assert.ok(item instanceof THREE.InstancedMesh, `${zone} must be batched`);
      const mesh=item as THREE.InstancedMesh;
      const prefix=`marine-${zone}-`;
      assert.ok(mesh.name.startsWith(prefix));
      props.add(mesh.name.slice(prefix.length));
      assert.ok(mesh.count>0&&mesh.instanceColor);
      geometryRefs.add(mesh.geometry);
      const pos=new THREE.Vector3(),scale=new THREE.Vector3(),rot=new THREE.Quaternion(),matrix=new THREE.Matrix4();
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);matrix.decompose(pos,rot,scale);
        assert.ok([...pos.toArray(),...scale.toArray()].every(Number.isFinite));
        assert.ok(scale.length()>0);
        assert.ok(pos.y<SEA_SURFACE+.05,`${mesh.name} above water`);
        // Verify the actual highest vertex, not merely the instance origin.
        if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
        const localTop=mesh.geometry.boundingBox!.max.y;
        assert.ok(pos.y+localTop*scale.y<=SEA_SURFACE+.08,
          `${mesh.name} breaks surface at instance ${i}`);
      }
    }
  }
  assert.ok(props.has("branch-coral")&&props.has("kelp")&&props.has("moray")&&props.has("jelly"));
  assert.ok(props.has("lobster")&&props.has("nudibranch")&&props.has("anemone"));
  assert.ok(props.has("clownfish")&&props.has("angelfish"),"tropical fish must have their own silhouettes");
  assert.ok(geometryRefs.size<=26,`unexpected geometry families: ${geometryRefs.size}`);
  assert.ok(geometryRefs.size < habitats.drawCalls.kelp+habitats.drawCalls.lagoon,
    "source geometries must be reused across both coastlines");
  const live=west.getObjectByName("marine-kelp-baitfish") as THREE.InstancedMesh;
  assert.ok(live);
  const a=new THREE.Matrix4(),b=new THREE.Matrix4();
  live.getMatrixAt(0,a);
  west.visible=true;east.visible=true;habitats.update(19);live.getMatrixAt(0,b);
  assert.notDeepEqual(a.elements,b.elements,"schools should slowly move");
  habitats.dispose();
  assert.equal(west.children.length,0);
  assert.equal(east.children.length,0);
});

test("swimmers discover named east and west neighborhoods only within authored bounds",()=>{
  for(const patch of MARINE_HABITAT_PATCHES){
    const atCenter=marineHabitatAt({x:patch.x,z:patch.z},patch.zone);
    assert.ok(atCenter,`no neighborhood at ${patch.id}`);
    assert.ok(marineHabitatLabel(atCenter!).length>4);
  }
  assert.equal(marineHabitatLabel(MARINE_HABITAT_PATCHES[0]),"Kelp Cathedral");
  assert.equal(marineHabitatLabel(MARINE_HABITAT_PATCHES[6]),"Anemone Garden");
  assert.equal(marineHabitatAt({x:0,z:0},"kelp"),null);
  assert.equal(marineHabitatAt({x:0,z:0},"lagoon"),null);
});

test("marine habitats are independent of southern ray passage",()=>{
  assert.ok(MARINE_HABITAT_PATCHES.every(p=>["kelp","lagoon"].includes(p.zone)));
  assert.ok(MARINE_HABITAT_PATCHES.every(p=>p.z-p.radius>WORLD_BOUNDS.minZ));
  assert.equal(waterZone({x:17,z:-127}),"south-channel");
  for(const point of [{x:-69,z:5},{x:78,z:5}]){
    const floor=seaFloorHeight(point.x,point.z);
    assert.ok(Number.isFinite(floor));
    assert.ok(floor<SEA_SURFACE);
  }
});


test("new nearshore regions have continuous swimmable approaches and useful dive depth",()=>{
 const ids=["west-kelp-nursery","west-anemone-cove",
   "east-shallow-coral-lagoon","east-southern-reef-garden"];
 for(const id of ids){
  const patch=MARINE_HABITAT_PATCHES.find(p=>p.id===id)!;
  assert.ok(patch);
  const west=patch.zone==="kelp";
  const shore=west?coastlineX(patch.z):eastCoastlineX(patch.z);
  assert.ok(Math.abs(patch.x-shore)<19,"garden is a short swim from shore");
  assert.ok(maxDiveDepth(patch)>1.5,"enough clearance to explore below the surface");
  const entry=shore+(west?-1:1);
  for(let i=0;i<=40;i++){
   const x=entry+(patch.x-entry)*i/40,p={x,z:patch.z};
   assert.equal(waterZone(p),patch.zone,`${id}: uninterrupted water approach`);
   assert.ok(seaFloorHeight(x,p.z)<SEA_SURFACE-.8,`${id}: submerged approach`);
  }
  assert.equal(marineHabitatAt(patch,patch.zone)?.id,id);
 }
});
