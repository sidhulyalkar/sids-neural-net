import * as THREE from "three/src/Three.Core.js";
import { GeometryBatch } from "./worldGeometry";
import { UNDERWATER_TRIDENTS, tridentBaseY } from "@/lib/world/artifacts";

/** Modest handcrafted gold silhouettes, two batched zone-root meshes. */
export function createWorldTridents(kelpRoot:THREE.Group,lagoonRoot:THREE.Group) {
 const shaft=new THREE.CylinderGeometry(0.045,0.062,1,6);
 const tip=new THREE.ConeGeometry(0.11,0.39,6);
 const batchFor=(zone:"kelp"|"lagoon")=>{
   const batch=new GeometryBatch();
   const add=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number,
     sx:number,sy:number,sz:number,rz=0)=>
     batch.add(g,color,new THREE.Vector3(x,y,z),new THREE.Vector3(sx,sy,sz),new THREE.Euler(0,0,rz));
   const sep=0.31;
   for(const t of UNDERWATER_TRIDENTS.filter(x=>x.zone===zone)){
     const {x,z}=t.point,y=tridentBaseY(t);
     // Vertical shaft, pronged crown and swept lateral tines.
     add(shaft,"#ab8337",x,y+0.66,z,1,1.28,1);
     add(shaft,"#d4ad5b",x,y+1.43,z,1,0.47,1);
     for(const side of [-1,0,1]){
       const tx=x+side*sep;
       if(side){
         const a=new THREE.Vector3(x,y+1.30,z),b=new THREE.Vector3(tx,y+1.60,z);
         const mid=a.clone().add(b).multiplyScalar(.5),dir=b.clone().sub(a);
         const q=new THREE.Quaternion().setFromUnitVectors(
           new THREE.Vector3(0,1,0),dir.clone().normalize());
         batch.add(shaft,"#cba452",mid,new THREE.Vector3(.8,dir.length(),.8),
           new THREE.Euler().setFromQuaternion(q));
       }
       add(tip,side===0?"#f0d384":"#deb962",tx,y+1.88,z,.9,1,.9);
     }
     add(shaft,"#7c643e",x,y+0.11,z,2.2,.2,2.2);
   }
   return batch.finish();
 };
 const material=new THREE.MeshStandardMaterial({
   vertexColors:true,metalness:.57,roughness:.34,side:THREE.DoubleSide,
 });
 const meshes=[
   new THREE.Mesh(batchFor("kelp"),material),
   new THREE.Mesh(batchFor("lagoon"),material),
 ];
 kelpRoot.add(meshes[0]);lagoonRoot.add(meshes[1]);
 meshes[0].name="ucsd-inspired-kelp-trident";
 meshes[1].name="ucsd-inspired-lagoon-tridents";
 for(const m of meshes){m.castShadow=false;m.receiveShadow=true;}
 return {count:UNDERWATER_TRIDENTS.length,dispose(){
    kelpRoot.remove(meshes[0]);lagoonRoot.remove(meshes[1]);
    for(const mesh of meshes)mesh.geometry.dispose();
    material.dispose();shaft.dispose();tip.dispose();
 }};
}
