import * as THREE from "three/src/Three.Core.js";
import {MYSTIC_GROVE} from "@/lib/world/mysticGrove";

/** Lightweight animated branch-to-branch electrical filaments.
 * One draw call and one fixed Float32Array for the whole grove, with
 * deterministic time-sampled motion and distance/reduced-motion culling.
 * No real lights, particles per frame, colliders or postprocessing bloom. */
export function createMysticElectricity(
 scene:THREE.Scene,links:readonly (readonly [THREE.Vector3,THREE.Vector3])[],
){
 const subdivisions=9,stride=2*3;
 const positions=new Float32Array(links.length*subdivisions*stride);
 const geometry=new THREE.BufferGeometry();
 const position=new THREE.BufferAttribute(positions,3);
 position.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute("position",position);
 const material=new THREE.LineBasicMaterial({
  color:"#a7ffe9",transparent:true,opacity:.52,
  depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
 });
 const lines=new THREE.LineSegments(geometry,material);
 lines.name="mystic-grove-interbranch-electrical-arcs";
 lines.frustumCulled=false;
 scene.add(lines);
 let lastBucket=-1;
 const redraw=(t:number)=>{
  let cursor=0;
  for(let k=0;k<links.length;k++){
   const [a,b]=links[k],dx=b.x-a.x,dz=b.z-a.z;
   const d=Math.max(1e-5,Math.hypot(dx,dz)),nx=-dz/d,nz=dx/d;
   const pointAt=(u:number,out:number)=>{
    const internal=u>0&&u<1;
    const envelope=Math.sin(Math.PI*u);
    const zig=internal?(
     Math.sin(k*17.2+u*69.7+t*12.5)*.21+
     Math.sin(k*3.4+u*36.2-t*17.1)*.11)*envelope:0;
    positions[out]=a.x+(b.x-a.x)*u+nx*zig;
    positions[out+1]=a.y+(b.y-a.y)*u+
     (internal?Math.sin(k*5.7+u*25+t*16)*.15*envelope:0);
    positions[out+2]=a.z+(b.z-a.z)*u+nz*zig;
   };
   for(let i=0;i<subdivisions;i++){
    pointAt(i/subdivisions,cursor);
    pointAt((i+1)/subdivisions,cursor+3);
    cursor+=stride;
   }
  }
  position.needsUpdate=true;
 };
 redraw(0);
 return {
  count:links.length,
  update(elapsed:number,near:boolean,reducedMotion:boolean){
   lines.visible=near&&links.length>0;
   if(!lines.visible)return;
   if(reducedMotion){
    material.opacity=.28;
    if(lastBucket!==-2){redraw(0);lastBucket=-2;}
    return;
   }
   material.opacity=.29+.22*(.5+.5*Math.sin(elapsed*3.1));
   const bucket=Math.floor(elapsed*MYSTIC_GROVE.arcsPerSecond);
   if(bucket===lastBucket)return;
   lastBucket=bucket;
   redraw(bucket/MYSTIC_GROVE.arcsPerSecond);
  },
  dispose(){
   scene.remove(lines);geometry.dispose();material.dispose();
  },
 };
}
