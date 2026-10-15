import * as THREE from "three/src/Three.Core.js";
import { createFishGeometry, createRayWingGeometry } from "./worldFaunaGeometry";
import { seaFloorHeight, worldFloorHeight, SEA_SURFACE } from "@/lib/world/model";
import {
  NORTH_SHORE_COUNTS,shoreAnimalAnchor,shoreAnimalMotion,shoreLifeVisible,
} from "@/lib/world/northShoreEcology";
import type { SkimPoint } from "@/lib/world/skimboarding";

/** Small sandy-bottom habitat, independent of the kelp and lagoon habitats.
 * Instanced fish, flounder and crabs; three articulated glide silhouettes.
 * Everything disappears from draw calls when the explorer leaves the beach. */
export function createNorthShoreLife(scene:THREE.Scene){
  const root=new THREE.Group();
  root.name="north-shore-marine-life";
  root.visible=false;
  scene.add(root);
  const ownedGeometries:THREE.BufferGeometry[]=[];
  const ownedMaterials:THREE.Material[]=[];
  const geometry=<T extends THREE.BufferGeometry>(g:T)=>{ownedGeometries.push(g);return g;};
  const material=<T extends THREE.Material>(m:T)=>{ownedMaterials.push(m);return m;};
  const dummy=new THREE.Object3D();
  const fishGeo=geometry(createFishGeometry("anchovy","#a8c7b3"));
  const fishMat=material(new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.75,metalness:.12,side:THREE.DoubleSide,
  }));
  const fish=new THREE.InstancedMesh(fishGeo,fishMat,NORTH_SHORE_COUNTS.baitfish);
  fish.name="shore-baitfish-school";
  fish.castShadow=false;fish.receiveShadow=false;
  fish.frustumCulled=false;
  root.add(fish);

  const rayGeo=geometry(createRayWingGeometry());
  const rayMat=material(new THREE.MeshStandardMaterial({
    color:"#8c9381",roughness:.83,side:THREE.DoubleSide,
  }));
  const tailGeo=geometry(new THREE.CylinderGeometry(.007,.023,1.55,6));
  const tailMat=material(new THREE.MeshStandardMaterial({color:"#666e62",roughness:.83}));
  const rays=Array.from({length:NORTH_SHORE_COUNTS.stingray},(_,i)=>{
    const group=new THREE.Group();
    group.name="north-shore-stingray-"+i;
    const wing=new THREE.Mesh(rayGeo,rayMat);
    wing.rotation.x=Math.PI/2;
    wing.scale.set(.50+(i%2)*.09,.51,.52);
    wing.castShadow=false;
    group.add(wing);
    const tail=new THREE.Mesh(tailGeo,tailMat);
    tail.rotation.x=Math.PI/2;
    tail.position.z=-.94;
    tail.castShadow=false;
    group.add(tail);
    root.add(group);
    return {group,wing};
  });

  const shellGeo=geometry(new THREE.SphereGeometry(1,10,6));
  const flatMat=material(new THREE.MeshStandardMaterial({
    color:"#a89f80",roughness:.92,
  }));
  const flatfish=new THREE.InstancedMesh(shellGeo,flatMat,NORTH_SHORE_COUNTS.flatfish);
  flatfish.name="north-shore-flatfish";
  flatfish.frustumCulled=false;
  root.add(flatfish);
  const crabMat=material(new THREE.MeshStandardMaterial({
    color:"#b78965",roughness:.91,
  }));
  const crabs=new THREE.InstancedMesh(shellGeo,crabMat,NORTH_SHORE_COUNTS.crab);
  crabs.name="shoreline-sand-crabs";
  crabs.frustumCulled=false;root.add(crabs);

  // Small shells and sand-dollar disks are inert scenery, not collision bodies.
  const shellMat=material(new THREE.MeshStandardMaterial({
    color:"#eadcc0",roughness:.93,side:THREE.DoubleSide,
  }));
  const shells=new THREE.InstancedMesh(shellGeo,shellMat,19);
  shells.name="sand-dollars-and-shells";
  shells.frustumCulled=false;
  for(let i=0;i<19;i++){
    const x=-25+i*2.75,z=shoreAnimalAnchor("crab",i).z+
      (i%3)*.65-1.0;
    const y=worldFloorHeight(x,z)+.06;
    dummy.position.set(x,y,z);
    dummy.rotation.set(0,i*.71,0);
    dummy.scale.set(i%4===0?.23:.12,.038,i%4===0?.24:.15);
    dummy.updateMatrix();shells.setMatrixAt(i,dummy.matrix);
  }
  shells.instanceMatrix.needsUpdate=true;
  root.add(shells);
  let active=false;
  function update(seconds:number,viewer:SkimPoint){
    const shouldShow=shoreLifeVisible(viewer);
    root.visible=shouldShow;
    if(!shouldShow){active=false;return;}
    active=true;
    for(let i=0;i<NORTH_SHORE_COUNTS.baitfish;i++){
      const p=shoreAnimalMotion("baitfish",i,seconds,viewer);
      const floor=seaFloorHeight(p.x,p.z);
      const y=Math.min(SEA_SURFACE-.24,
        floor+.42+(i%3)*.14+Math.sin(seconds*2.2+i)*.07);
      const heading=seconds*.56+i*2.399;
      dummy.position.set(p.x,y,p.z);
      dummy.rotation.set(0,heading,Math.sin(seconds*4+i)*.08);
      const scale=.20+(i%4)*.025;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();fish.setMatrixAt(i,dummy.matrix);
    }
    fish.instanceMatrix.needsUpdate=true;
    for(let i=0;i<rays.length;i++){
      const p=shoreAnimalMotion("stingray",i,seconds,viewer);
      const y=Math.min(SEA_SURFACE-.24,seaFloorHeight(p.x,p.z)+.23);
      const ray=rays[i],phase=seconds*(.16+i*.013)+i*2.4;
      ray.group.position.set(p.x,y+Math.sin(phase*3)*.075,p.z);
      ray.group.rotation.set(0,-phase,Math.sin(phase*2)*.04);
      ray.wing.scale.x=(.48+(i%2)*.09)*(1+Math.sin(phase*6)*.09);
    }
    for(let i=0;i<NORTH_SHORE_COUNTS.flatfish;i++){
      const p=shoreAnimalMotion("flatfish",i,seconds,viewer);
      dummy.position.set(p.x,seaFloorHeight(p.x,p.z)+.08,p.z);
      dummy.rotation.set(0,seconds*.08+i*1.7,0);
      dummy.scale.set(.29,.055,.38);
      dummy.updateMatrix();flatfish.setMatrixAt(i,dummy.matrix);
    }
    flatfish.instanceMatrix.needsUpdate=true;
    for(let i=0;i<NORTH_SHORE_COUNTS.crab;i++){
      const p=shoreAnimalMotion("crab",i,seconds,viewer);
      dummy.position.set(p.x,worldFloorHeight(p.x,p.z)+.10,p.z);
      dummy.rotation.set(0,i*.9+Math.sin(seconds*.7+i)*.28,0);
      dummy.scale.set(.17,.10,.12);
      dummy.updateMatrix();crabs.setMatrixAt(i,dummy.matrix);
    }
    crabs.instanceMatrix.needsUpdate=true;
  }
  return {
    update,
    get visible(){return active;},
    counts:NORTH_SHORE_COUNTS,
    dispose(){
      scene.remove(root);
      for(const g of ownedGeometries)g.dispose();
      for(const m of ownedMaterials)m.dispose();
    },
  };
}
