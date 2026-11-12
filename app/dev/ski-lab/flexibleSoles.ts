import * as THREE from "three";
import {createSkiContact,fitSkiContact,SKI_HALF_LENGTH,SKI_HALF_WIDTH,
 SKI_SOLE_Y} from "@/components/world/worldSkiContact";
import {terrainHeight} from "@/lib/world/model";
import type {SkiSimulation} from "@/lib/world/ski/simulation";

export type SoleDeformation="rigid"|"bounded"|"surface";
export type SoleMetrics={
 active:boolean;min:number;mean:number;max:number;
 maxVerticalBend:number;maxCurvature:number;vertexCount:number;
};
const SECTIONS=32,WIDTHS=3,CLEARANCE=.008;
const height=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
// Continuously saturating deformation prevents a sharp crease where a hard
// per-vertex clamp meets the curved snow. This is a lab tuning envelope, not
// a calibrated ski stiffness or beam constraint.
const constrain=(n:number,limit:number)=>limit===0?0:limit*Math.tanh(n/limit);

/** Experimental diagnostic of rigid support vs constrained flex vs ideal contact.
 * Not an authoritative ski collider, leg rig or reference-game material model.
 * The surface mode is an unattainable upper bound when bank curvature is high.
 */
export class FlexibleSoles {
 readonly poses=[createSkiContact(),createSkiContact()];
 readonly geometry=[this.makeGeometry(),this.makeGeometry()];
 readonly metrics:SoleMetrics[]=[
  {active:false,min:0,mean:0,max:0,maxVerticalBend:0,maxCurvature:0,vertexCount:0},
  {active:false,min:0,mean:0,max:0,maxVerticalBend:0,maxCurvature:0,vertexCount:0},
 ];
 private readonly heading=new THREE.Vector3();
 private readonly point=new THREE.Vector3();
 private readonly center=[new Float64Array(SECTIONS+1),new Float64Array(SECTIONS+1)];
 constructor(readonly mode:SoleDeformation="bounded",readonly maxBend=.3){
  if(!Number.isFinite(maxBend)||maxBend<0)throw Error("Invalid ski bending limit");
 }
 private makeGeometry(){
  const positions=new Float32Array((SECTIONS+1)*WIDTHS*3);
  const indices:number[]=[];
  for(let j=0;j<SECTIONS;j++)for(let w=0;w<WIDTHS-1;w++){
   const a=j*WIDTHS+w,b=a+WIDTHS;
   indices.push(a,b,a+1,b,b+1,a+1);
  }
  const mesh=new THREE.BufferGeometry();
  const attribute=new THREE.BufferAttribute(positions,3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  mesh.setAttribute("position",attribute);
  mesh.setIndex(indices);
  return mesh;
 }
 update(sim:SkiSimulation){
  this.heading.set(0,0,1).applyQuaternion(sim.rotation);
  for(let i=0;i<2;i++){
   const side=2*i-1,pose=this.poses[i];
   const active=sim.phase!=="air"&&sim.contact[i];
   if(active)fitSkiContact(sim.position,this.heading,side,height,pose);
   else{
    pose.rotation.copy(sim.rotation);
    pose.position.set(side*.23,0,0).applyQuaternion(pose.rotation).add(sim.position);
   }
   const arr=this.geometry[i].getAttribute("position") as THREE.BufferAttribute;
   const m=this.metrics[i];
   let min=Infinity,max=-Infinity,sum=0,maxVerticalBend=0;
   for(let j=0;j<=SECTIONS;j++){
    const along=(j/SECTIONS*2-1)*SKI_HALF_LENGTH;
    for(let k=0;k<WIDTHS;k++){
     const across=(k-1)*SKI_HALF_WIDTH;
     this.point.set(across,SKI_SOLE_Y,along).applyQuaternion(pose.rotation).add(pose.position);
     const oldGap=this.point.y-height(this.point);
     const ideal=CLEARANCE-oldGap;
     const bend=active?(this.mode==="rigid"?0:
      this.mode==="surface"?ideal:constrain(ideal,this.maxBend)):0;
     const y=this.point.y+bend;
     arr.setXYZ(j*WIDTHS+k,this.point.x,y,this.point.z);
     const gap=oldGap+bend;
     min=Math.min(min,gap);max=Math.max(max,gap);sum+=gap;
     maxVerticalBend=Math.max(maxVerticalBend,Math.abs(bend));
     if(k===1)this.center[i][j]=y;
    }
   }
   let curvature=0;
   // Diagnostic finite-difference curvature, world units^-1; not a ski stiffness model.
   const ds=2*SKI_HALF_LENGTH/SECTIONS;
   for(let j=1;j<SECTIONS;j++){
    const y0=this.center[i][j-1],y1=this.center[i][j],y2=this.center[i][j+1];
    curvature=Math.max(curvature,Math.abs(y2-2*y1+y0)/(ds*ds));
   }
   arr.needsUpdate=true;
   this.geometry[i].computeVertexNormals();
   Object.assign(m,{active,min,mean:sum/((SECTIONS+1)*WIDTHS),max,
    maxVerticalBend,maxCurvature:curvature,vertexCount:(SECTIONS+1)*WIDTHS});
  }
  return this.metrics;
 }
 dispose(){for(const g of this.geometry)g.dispose();}
}
