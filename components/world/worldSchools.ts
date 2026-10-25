import * as THREE from "three/src/Three.Core.js";
import { MARINE_SCHOOLS, sampleFish } from "@/lib/world/schools";

/** Two draw calls per coherent shoal, no new React state or per-fish meshes. */
export function createMarineSchools(kelpRoot:THREE.Group,lagoonRoot:THREE.Group) {
  const bodyGeo=new THREE.SphereGeometry(1,7,5);
  const finGeo=new THREE.ConeGeometry(1,1,4);
  const material=new THREE.MeshStandardMaterial({
    color:"#ffffff",roughness:0.76,metalness:0.05,side:THREE.DoubleSide,
  });
  const dummy=new THREE.Object3D();
  const groups=MARINE_SCHOOLS.map(spec=>{
    const body=new THREE.InstancedMesh(bodyGeo,material,spec.count);
    const tails=new THREE.InstancedMesh(finGeo,material,spec.count);
    body.name=`school-${spec.id}-body`;
    tails.name=`school-${spec.id}-tails`;
    body.frustumCulled=tails.frustumCulled=false; // moving matrix bounds
    const root=spec.zone==="kelp"?kelpRoot:lagoonRoot;
    root.add(body,tails);
    const base=new THREE.Color(spec.color);
    for(let i=0;i<spec.count;i++){
      const color=base.clone().multiplyScalar(0.76+0.24*((i*7)%11)/10);
      body.setColorAt(i,color);
      tails.setColorAt(i,color.clone().multiplyScalar(.78));
    }
    body.instanceColor!.needsUpdate=true;
    tails.instanceColor!.needsUpdate=true;
    return {spec,body,tails,root};
  });
  let last=-Infinity;
  const update=(time:number,reduceMotion=false)=>{
    if(time-last<0.075 && !reduceMotion)return;
    last=time;
    for(const {spec,body,tails,root} of groups){
      if(!root.visible)continue;
      for(let i=0;i<spec.count;i++){
        const fish=sampleFish(spec,i,reduceMotion?0:time);
        dummy.position.set(fish.x,fish.y,fish.z);
        dummy.rotation.set(0,fish.yaw,0);
        dummy.scale.set(fish.size*.62,fish.size*.45,fish.size*1.7);
        dummy.updateMatrix();
        body.setMatrixAt(i,dummy.matrix);
        const backward={x:-Math.sin(fish.yaw),z:-Math.cos(fish.yaw)};
        dummy.position.set(fish.x+backward.x*fish.size*1.65,
          fish.y,fish.z+backward.z*fish.size*1.65);
        dummy.rotation.set(Math.PI/2,fish.yaw,Math.sin(time*4+i)*0.12);
        dummy.scale.set(fish.size*.40,fish.size*.08,fish.size*.55);
        dummy.updateMatrix();
        tails.setMatrixAt(i,dummy.matrix);
      }
      body.instanceMatrix.needsUpdate=true;
      tails.instanceMatrix.needsUpdate=true;
    }
  };
  // Populate matrices at construction for stable context recovery.
  for(const g of groups) {
    const wasVisible=g.root.visible;
    g.root.visible=true;
    update(0,true);
    g.root.visible=wasVisible;
  }
  return {
    update,
    count:MARINE_SCHOOLS.reduce((a,g)=>a+g.count,0),
    dispose(){
      for(const {body,tails,root} of groups)root.remove(body,tails);
      for(const {body,tails} of groups){body.dispose();tails.dispose();}
      bodyGeo.dispose();finGeo.dispose();material.dispose();
    },
  };
}
