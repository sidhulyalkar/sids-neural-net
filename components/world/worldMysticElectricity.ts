import * as THREE from "three/src/Three.Core.js";
import {MYSTIC_GROVE,mysticCircuitIntensity,mysticCircuitPhase}
 from "@/lib/world/mysticGrove";

/**
 * One living electrical circuit connecting the six existing dendritic trees.
 * The strand is always connected, while a bright traveling packet moves from
 * one branch tip to the next. This keeps the effect readable from the shore
 * without a wall of constantly flashing lightning.
 *
 * Exactly one line draw call, fixed typed arrays, 16 Hz geometry/color updates,
 * no additional light sources or collisions, deterministic at different FPS.
 */
export function createMysticElectricity(
 scene:THREE.Scene,
 links:readonly (readonly [THREE.Vector3,THREE.Vector3])[],
){
 const subdivisions=12,verticesPerLink=subdivisions*2;
 const positions=new Float32Array(links.length*verticesPerLink*3);
 const colors=new Float32Array(positions.length);
 const geometry=new THREE.BufferGeometry();
 const position=new THREE.BufferAttribute(positions,3);
 const color=new THREE.BufferAttribute(colors,3);
 position.setUsage(THREE.DynamicDrawUsage);
 color.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute("position",position);
 geometry.setAttribute("color",color);
 const ambient=new THREE.Color("#174c55");
 const charged=new THREE.Color("#c8ffe6");
 const tint=new THREE.Color();
 const material=new THREE.LineBasicMaterial({
  color:"#ffffff",vertexColors:true,transparent:true,opacity:.87,
  depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
 });
 const lines=new THREE.LineSegments(geometry,material);
 lines.name="mystic-grove-interbranch-electrical-arcs";
 lines.frustumCulled=false;
 scene.add(lines);
 let lastBucket=-1,lastActiveLink=-1,lastProgress=0;
 const redraw=(t:number,reducedMotion=false)=>{
  let cursor=0;
  const phase=mysticCircuitPhase(t,links.length);
  lastActiveLink=reducedMotion?-2:phase.link;
  lastProgress=phase.progress;
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
    tint.copy(ambient).lerp(charged,
     mysticCircuitIntensity(t,k,u,links.length,reducedMotion));
    colors[out]=tint.r;colors[out+1]=tint.g;colors[out+2]=tint.b;
   };
   for(let i=0;i<subdivisions;i++){
    pointAt(i/subdivisions,cursor);
    pointAt((i+1)/subdivisions,cursor+3);
    cursor+=6;
   }
  }
  position.needsUpdate=true;
  color.needsUpdate=true;
 };
 redraw(0);
 return {
  count:links.length,
  get activeLink(){return lastActiveLink;},
  get progress(){return lastProgress;},
  update(elapsed:number,near:boolean,reducedMotion:boolean){
   lines.visible=near&&links.length>0;
   if(!lines.visible){
    lastActiveLink=-1;return;
   }
   if(reducedMotion){
    if(lastBucket!==-2){redraw(0,true);lastBucket=-2;}
    return;
   }
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
