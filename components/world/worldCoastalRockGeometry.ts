import * as THREE from "three/src/Three.Core.js";
import {SEA_SURFACE} from "@/lib/world/model";
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
   const radius=rock.radius*clamp(taper+undercut+angular,.32,1.18);
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
  indices.push(a,b,c,b,d,c);
 }
 for(let i=1;i<sides-1;i++)
  indices.push((levels-1)*sides,(levels-1)*sides+i,(levels-1)*sides+i+1);
 return finish(vertices,colors,indices);
}
/** A thick wave-cut stone bridge, sampled as a crooked tapered beam over the
 * water. Ends are buried into the exact arch-leg collision stacks; the center
 * stays fully open. No torus/donut silhouettes or floating block shoulders. */
export function createSeaArchGeometry(arch:JetSkiArch):THREE.BufferGeometry{
 const sections=24,sides=8,positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const half=arch.span*.5,basalt=arch.kind==="basalt";
 for(let j=0;j<=sections;j++){
  const t=j/sections,u=t*2-1;
  const vault=Math.pow(Math.max(0,1-u*u),basalt?.62:.78);
  const centerY=arch.height*(.49+.47*vault);
  // Weathering is deterministic; the two arch types weather differently.
  const shear=(basalt?.36:.25)*Math.sin(t*12.7+arch.center.z*.17);
  const depth=(basalt?2.6:3.2)*(1+.13*Math.cos(t*17));
  const thickness=(basalt?2.15:2.35)*(1+.10*Math.sin(t*14+1.2));
  const centerZ=shear+.19*Math.sin(t*5.7);
  for(let i=0;i<sides;i++){
   const a=2*Math.PI*i/sides;
   const side=Math.cos(a),height=Math.sin(a);
   positions.push(-half+arch.span*t,
    centerY+height*thickness,
    centerZ+side*depth);
   colors.push(...colorFor(arch.kind,.4+.5*vault,a+t*13));
  }
 }
 for(let j=0;j<sections;j++)for(let i=0;i<sides;i++){
  const a=j*sides+i,b=j*sides+(i+1)%sides,c=(j+1)*sides+i,d=(j+1)*sides+(i+1)%sides;
  indices.push(a,b,c,b,d,c);
 }
 for(let i=1;i<sides-1;i++){
  indices.push(0,i+1,i);
  const k=sections*sides;
  indices.push(k,k+i,k+i+1);
 }
 return finish(positions,colors,indices);
}
