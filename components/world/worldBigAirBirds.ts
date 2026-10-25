import * as THREE from "three/src/Three.Core.js";
import {
  BIG_AIR_BIRDS,bigAirBirdPositions,type BigAirState,
} from "@/lib/world/bigAir";

/** Three identifiable companion silhouettes for flight only: three instanced
 * batches regardless of flock size. No audio autoplay, shadow or network. */
export function createBigAirBirds(scene:THREE.Scene){
 const bodyGeo=new THREE.SphereGeometry(1,9,7);
 const wingGeo=new THREE.SphereGeometry(1,7,4);
 const tailGeo=new THREE.ConeGeometry(1,1,4);
 const mat=new THREE.MeshStandardMaterial({
   color:"#ffffff",roughness:.82,metalness:0,side:THREE.DoubleSide,
 });
 const bodies=new THREE.InstancedMesh(bodyGeo,mat,BIG_AIR_BIRDS.length);
 const wings=new THREE.InstancedMesh(wingGeo,mat,BIG_AIR_BIRDS.length*2);
 const tails=new THREE.InstancedMesh(tailGeo,mat,BIG_AIR_BIRDS.length);
 const dummy=new THREE.Object3D();
 for(const mesh of [bodies,wings,tails]){
   mesh.castShadow=false;mesh.receiveShadow=false;
   mesh.frustumCulled=false;
   mesh.visible=false;
   scene.add(mesh);
 }
 bodies.name="big-air-macaw-and-parrot-bodies";
 wings.name="big-air-flapping-wings";
 tails.name="big-air-bird-tails";
 BIG_AIR_BIRDS.forEach((b,i)=>{
   bodies.setColorAt(i,new THREE.Color(b.color));
   tails.setColorAt(i,new THREE.Color(b.wing));
   for(let side=0;side<2;side++)
     wings.setColorAt(i*2+side,new THREE.Color(b.wing));
 });
 for(const mesh of [bodies,wings,tails])
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 const update=(flight:BigAirState,time:number,reduceMotion:boolean)=>{
   const positions=bigAirBirdPositions(flight,reduceMotion?0:time);
   const active=positions.length>0;
   for(const mesh of [bodies,wings,tails])mesh.visible=active;
   if(!active)return;
   for(const [i,p] of positions.entries()){
     const scale=p.scale;
     dummy.position.set(p.x,p.y,p.z);
     dummy.rotation.set(0,p.yaw,0);
     dummy.scale.set(.28*scale,.35*scale,.59*scale);
     dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);
     dummy.position.set(p.x-Math.sin(p.yaw)*.57*scale,
       p.y-.05*scale,p.z-Math.cos(p.yaw)*.57*scale);
     dummy.rotation.set(Math.PI/2,0,0);
     dummy.scale.set(.18*scale,.57*scale,.18*scale);
     dummy.updateMatrix();tails.setMatrixAt(i,dummy.matrix);
     for(const side of [-1,1]){
       dummy.position.set(p.x+Math.cos(p.yaw)*side*.60*scale,
         p.y+.04*scale,p.z-Math.sin(p.yaw)*side*.60*scale);
       dummy.rotation.set(0,p.yaw,side*(.16+((p.wingBeat+1)/2)*.73),"YXZ");
       dummy.scale.set(.70*scale,.10*scale,.33*scale);
       dummy.updateMatrix();wings.setMatrixAt(i*2+(side===-1?0:1),dummy.matrix);
     }
   }
   for(const mesh of [bodies,wings,tails])mesh.instanceMatrix.needsUpdate=true;
 };
 return {update,drawCalls:3,count:BIG_AIR_BIRDS.length,
  get active(){return bodies.visible&&wings.visible&&tails.visible;},
  dispose(){
   for(const mesh of [bodies,wings,tails]){
     scene.remove(mesh);mesh.dispose();
   }
   bodyGeo.dispose();wingGeo.dispose();tailGeo.dispose();mat.dispose();
 }};
}
