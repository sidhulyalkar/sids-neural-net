import * as THREE from "three/src/Three.Core.js";
import type { SkimPoint } from "@/lib/world/skimboarding";

/** Rendering-only foam wake; scoring and collisions never depend on it. */
export function createSkimWake(scene: THREE.Scene) {
  const count=12,lifetime=.95;
  const material=new THREE.MeshBasicMaterial({
    color:"#e8fbf4",transparent:true,opacity:.62,
    depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
  });
  const bands=([-1,1] as const).map(side=>{
    const geometry=new THREE.BufferGeometry();
    const coordinates=new Float32Array((count+1)*2*3);
    const position=new THREE.BufferAttribute(coordinates,3);
    position.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position",position);
    const indices:number[]=[];
    for(let i=0;i<count;i++){
      const a=2*i;indices.push(a,a+2,a+1,a+1,a+2,a+3);
    }
    geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=side<0?"skim-wake-left":"skim-wake-right";
    mesh.visible=false;mesh.frustumCulled=false;
    mesh.castShadow=false;mesh.receiveShadow=false;
    scene.add(mesh);
    return {side,geometry,coordinates,position,mesh};
  });
  type Sample={point:SkimPoint;heading:SkimPoint;time:number};
  let history:Sample[]=[];
  let visible=false,lastTime=-Infinity;
  function clear(){
    history=[];visible=false;
    for(const band of bands)band.mesh.visible=false;
  }
  function sampleAt(seconds:number):Sample {
    for(let i=1;i<history.length;i++){
      const next=history[i-1],prev=history[i];
      if(prev.time<=seconds){
        const t=THREE.MathUtils.clamp(
          (seconds-prev.time)/Math.max(.0001,next.time-prev.time),0,1);
        const h={
          x:prev.heading.x+(next.heading.x-prev.heading.x)*t,
          z:prev.heading.z+(next.heading.z-prev.heading.z)*t,
        },size=Math.hypot(h.x,h.z)||1;
        return {point:{
          x:prev.point.x+(next.point.x-prev.point.x)*t,
          z:prev.point.z+(next.point.z-prev.point.z)*t,
        },heading:{x:h.x/size,z:h.z/size},time:seconds};
      }
    }
    return history[history.length-1];
  }
  function update(point:SkimPoint,heading:SkimPoint,speed:number,
    now:number,riding:boolean,waterHeight:(p:SkimPoint)=>number){
    if(!riding||speed<2||!Number.isFinite(now)){clear();return;}
    if(now<lastTime||now-lastTime>1.1||history.length&&
      Math.hypot(point.x-history[0].point.x,point.z-history[0].point.z)>16)
      history=[];
    lastTime=now;
    history.unshift({point:{...point},heading:{...heading},time:now});
    history=history.filter(s=>now-s.time<=lifetime).slice(0,24);
    visible=history.length>=2;
    for(const band of bands){
      band.mesh.visible=visible;
      if(!visible)continue;
      for(let i=0;i<=count;i++){
        const fraction=i/count;
        const sample=sampleAt(now-fraction*lifetime);
        const normal={x:sample.heading.z,z:-sample.heading.x};
        const thickness=(.022+.15*Math.sin(fraction*Math.PI))*
          Math.min(1,speed/8);
        const offset=band.side*(.17+fraction*.34);
        for(let edge=0;edge<2;edge++){
          const lateral=offset+(edge?thickness:-thickness);
          const p={
            x:sample.point.x-sample.heading.x*.42+normal.x*lateral,
            z:sample.point.z-sample.heading.z*.42+normal.z*lateral,
          };
          const k=3*(i*2+edge);
          band.coordinates[k]=p.x;
          band.coordinates[k+1]=waterHeight(p)+.035;
          band.coordinates[k+2]=p.z;
        }
      }
      band.position.needsUpdate=true;
    }
  }
  return {
    update,clear,
    get visible(){return visible;},
    dispose(){
      clear();
      for(const band of bands){scene.remove(band.mesh);band.geometry.dispose();}
      material.dispose();
    },
  };
}
