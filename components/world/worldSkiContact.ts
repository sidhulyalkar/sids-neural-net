import * as THREE from "three/src/Three.Core.js";
import type {Point} from "@/lib/world/model";

export const SKI_HALF_LENGTH=1.275;
export const SKI_HALF_WIDTH=.095;
export const SKI_STANCE=.23;
export const SKI_SOLE_Y=-.0125;
export type SkiContact={
 position:THREE.Vector3;
 rotation:THREE.Quaternion;
 matrix:THREE.Matrix4;
 right:THREE.Vector3;
 up:THREE.Vector3;
 forward:THREE.Vector3;
};

export const createSkiContact=():SkiContact=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion(),
 matrix:new THREE.Matrix4(),right:new THREE.Vector3(),up:new THREE.Vector3(),forward:new THREE.Vector3()});

/** Fit a rigid ski to its own footprint, then remove penetration of the sole.
 * The binding stays above the fitted support plane, rather than the highest
 * terrain sample translated a second time by the skier's tilt. */
export function fitSkiContact(point:Point,heading:Point,side:number,height:(p:Point)=>number,pose=createSkiContact()):SkiContact{
 const length=Math.hypot(heading.x,heading.z)||1;
 const fx=heading.x/length,fz=heading.z/length;
 const x=point.x+fz*side*SKI_STANCE,z=point.z-fx*side*SKI_STANCE;
 const dx=(height({x:x+.12,z})-height({x:x-.12,z}))/.24;
 const dz=(height({x,z:z+.12})-height({x,z:z-.12}))/.24;
 const up=pose.up.set(-dx,1,-dz).normalize();
 const forward=pose.forward.set(fx,dx*fx+dz*fz,fz).normalize();
 const right=pose.right.crossVectors(up,forward).normalize();
 pose.rotation.setFromRotationMatrix(pose.matrix.makeBasis(right,up,forward));
 const position=pose.position.set(x,height({x,z}),z);
 let lift=-Infinity;
 for(let j=0;j<=16;j++)for(const width of [-SKI_HALF_WIDTH,0,SKI_HALF_WIDTH]){
  const along=-SKI_HALF_LENGTH+2*SKI_HALF_LENGTH*j/16;
  const sx=x+forward.x*along+right.x*width+up.x*SKI_SOLE_Y;
  const sz=z+forward.z*along+right.z*width+up.z*SKI_SOLE_Y;
  const sy=position.y+forward.y*along+right.y*width+up.y*SKI_SOLE_Y;
  lift=Math.max(lift,height({x:sx,z:sz})-sy);
 }
 position.y+=lift+.008;
 return pose;
}

export function skiFollowYaw(current:number,heading:Point,dt:number){
 const target=Math.atan2(-heading.x,-heading.z);
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
 return current+delta*(1-Math.exp(-Math.min(.05,Math.max(0,dt))*3.2));
}

/** Lift the camera over the complete sightline to a wall, not just its endpoint. */
export function skiCameraHeight(look:{x:number;y:number;z:number},camera:{x:number;y:number;z:number},height:(p:Point)=>number){
 let y=camera.y;
 for(let i=1;i<=24;i++){
  const t=i/24;
  const p={x:look.x+(camera.x-look.x)*t,z:look.z+(camera.z-look.z)*t};
  y=Math.max(y,look.y+(height(p)+.35-look.y)/t);
 }
 return y;
}

/** Shorten an occluded boom before resorting to a distant overhead shot.
 * Mutates caller-owned vectors; also applies after interpolation so the actual
 * lens cannot travel through a bank between two valid target poses. */
export function constrainSkiCamera(look:THREE.Vector3,camera:THREE.Vector3,height:(p:Point)=>number){
 look.y=Math.max(look.y,height(look)+.35);
 const dx=camera.x-look.x,dz=camera.z-look.z;
 const baseY=Math.min(camera.y,look.y+8);
 for(let i=0;i<=12;i++){
  const scale=Math.pow(.8,i);
  camera.x=look.x+dx*scale;camera.z=look.z+dz*scale;camera.y=baseY;
  const clearY=skiCameraHeight(look,camera,height);
  if(clearY<=look.y+8||i===12){camera.y=clearY;return;}
 }
}
