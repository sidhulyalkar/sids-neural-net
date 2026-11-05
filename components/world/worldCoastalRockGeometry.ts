import * as THREE from "three/src/Three.Core.js";
import {SEA_SURFACE,seaFloorHeight} from "@/lib/world/model";
import type {JetSkiRock,JetSkiArch,JetSkiRockKind} from "@/lib/world/jetSkiCourse";

/** Faceted, strata-aware offshore geology; no model downloads or per-frame
 * geometry allocation. Rendered bases stay within the collision radii (+.65m
 * hull margin), and crowns never put a hidden obstacle in the arch opening. */
const palette:Record<JetSkiRockKind,[number,number,number]>={
 sandstone:[.66,.52,.37],
 "sea-stack":[.41,.44,.41],
 basalt:[.19,.24,.26],
};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const colorFor=(kind:JetSkiRockKind,level:number,fracture:number)=>{
 const base=palette[kind];
 // Angular weathering, dark wet foot, and fine bedding/joint planes.
 const wet=.73+.27*clamp(level*3,0,1);
 const bands=kind==="basalt"?
   .93+.08*Math.sin(level*45+fracture):
   .91+.11*Math.sin(level*33+fracture*1.3);
 const value=wet*bands*(.95+.06*Math.sin(fracture*3));
 return base.map(c=>clamp(c*value,0,1)) as [number,number,number];
};
const finish=(positions:number[],colors:number[],indices:number[])=>{
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return geometry;
};
/** Tapered sea stacks with eroded necks, wide wave-cut feet and chipped lips.
 * Their largest plan radius is <1.2x the rock's collider radius. */
export function createSeaStackGeometry(rock:JetSkiRock):THREE.BufferGeometry{
 const sides=13,levels=10,vertices:number[]=[],colors:number[]=[],indices:number[]=[];
 const seed=rock.point.x*.81+rock.point.z*1.17;
 for(let j=0;j<levels;j++){
  const t=j/(levels-1);
  const lowFoot=.13*Math.exp(-t*20);
  const taper=1-.48*t-.13*Math.sin(Math.PI*t)+lowFoot;
  const undercut=.07*Math.sin(t*13+seed);
  for(let i=0;i<sides;i++){
   const angle=i/sides*Math.PI*2;
   const angular=.049*Math.sin(angle*5+seed)+
     .035*Math.sin(angle*9-seed*.4+t*3.1);
   const radius=rock.radius*clamp(taper+undercut+angular,.32,1.14);
   const edge=(i%4===0?.09:0)*Math.sin(t*13+seed);
   vertices.push(Math.cos(angle)*radius,
    SEA_SURFACE-1.7+rock.height*t+edge,
    Math.sin(angle)*radius);
   colors.push(...colorFor(rock.kind,t,angle+seed));
  }
 }
 for(let j=0;j<levels-1;j++)for(let i=0;i<sides;i++){
  const a=j*sides+i,b=j*sides+(i+1)%sides;
  const c=(j+1)*sides+i,d=(j+1)*sides+(i+1)%sides;
  indices.push(a,c,b,b,c,d);
 }
 for(let i=1;i<sides-1;i++)
  indices.push((levels-1)*sides,(levels-1)*sides+i+1,(levels-1)*sides+i);
 return finish(vertices,colors,indices);
}
/** A single weathered vault with submerged feet. Adjacent cross sections
 * share vertices all the way around each shoulder and across the soffit. */
export function createSeaArchGeometry(arch:JetSkiArch):THREE.BufferGeometry{
 const sides=16, steps=32, positions:number[]=[], colors:number[]=[], indices:number[]=[];
 const half=arch.span/2, basalt=arch.kind==="basalt";
 for(let j=-1;j<=steps+1;j++){
  const angle=Math.PI*clamp(j/steps,0,1);
  const rise=Math.sin(angle), lateral=Math.cos(angle);
  const cx=-half*lateral + (basalt ? -.85 : 1.1)*rise*rise;
  const cy=arch.height*rise*(.94+.09*lateral+.034*Math.sin(4*angle));
  // Normal to the elliptical spine in the plane of the arch.
  const length=Math.hypot(arch.height*.94*lateral,half*rise);
  const nx=-arch.height*.94*lateral/length, ny=half*rise/length;
  for(let i=0;i<sides;i++){
   const a=i*2*Math.PI/sides;
   const weather=1+.065*Math.sin(3*a+angle*3)+.045*Math.cos(5*a-angle*2);
   const thickness=(2.48-.48*rise+.85*rise*lateral+.24*rise*Math.cos(5*angle))*weather;
   const x=cx+nx*Math.sin(a)*thickness;
   const z=Math.cos(a)*(2.48+(basalt?.2:.5)*rise)*weather+.42*rise*Math.sin(angle*3);
   let y=cy+ny*Math.sin(a)*thickness;
   if(j<0||j>steps){
    const wx=arch.center.x+x*Math.cos(arch.heading)+z*Math.sin(arch.heading);
    const wz=arch.center.z-x*Math.sin(arch.heading)+z*Math.cos(arch.heading);
    y=Math.min(-2,seaFloorHeight(wx,wz)-SEA_SURFACE-.6);
   }
   positions.push(x,y,z);
   colors.push(...colorFor(arch.kind,clamp(y/arch.height,0,1),a+.35*Math.sin(angle*3)));
  }
 }
 const last=(steps+2)*sides;
 for(let k=0;k<last;k+=sides)for(let i=0;i<sides;i++){
  const a=k+i,b=k+(i+1)%sides;
  indices.push(a,a+sides,b,b,a+sides,b+sides);
 }
 for(let i=1;i<sides-1;i++)indices.push(0,i,i+1,last,last+i+1,last+i);
 return finish(positions,colors,indices);
}
