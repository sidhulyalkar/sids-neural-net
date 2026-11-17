import {Vector3} from "three";
import {createSkiContact, fitSkiContact, SKI_HALF_LENGTH, SKI_HALF_WIDTH, SKI_SOLE_Y} from "@/components/world/worldSkiContact";
import {terrainHeight} from "@/lib/world/model";
import {MOUNTAIN_HALFPIPE as pipe} from "@/lib/world/mountainHalfpipe";
import {neutral,SkiSimulation} from "@/lib/world/ski/simulation";

export const bankOffset=pipe.floorHalfWidth+.5*(pipe.lipHalfWidth-pipe.floorHalfWidth);
export function inside(x:number,z:number){
 return Math.abs(x-pipe.centerX)<=pipe.lipHalfWidth&&z>=pipe.startZ&&z<=pipe.endZ;
}
export function bank(x:number,z:number,grounded:boolean){
 if(!grounded||!inside(x,z)||Math.abs(x-pipe.centerX)<bankOffset)return 0;
 return Math.sign(x-pipe.centerX);
}
const height=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
export function createTrial(footprint:boolean|"independent"=false,pivot:boolean|"overhang"=false){
 const sim=new SkiSimulation(terrainHeight,pipe.centerX,-57,footprint,pivot);
 sim.velocity.set(6,0,3);
 return sim;
}
export function trialInput(sim:SkiSimulation,target:number){
 const heading=new Vector3(0,0,1).applyQuaternion(sim.rotation);
 const desired=target*1.45;
 const error=desired-Math.atan2(heading.x,heading.z);
 return {...neutral,steer:Math.max(-1,Math.min(1,2*Math.atan2(Math.sin(error),Math.cos(error))))};
}
export class SoleProbe{
 readonly poses=[createSkiContact(),createSkiContact()];
 readonly forward=new Vector3();
 private readonly point=new Vector3();
 update(sim:SkiSimulation){
  this.forward.set(0,0,1).applyQuaternion(sim.rotation);
  return this.poses.map((pose,i)=>{
   const sign=2*i-1;
   if(sim.footprint==="independent"&&sim.phase!=="air"){
    pose.rotation.copy(sim.soles[i].rotation);pose.position.copy(sim.soles[i].position);
   }else if(!sim.footprint&&sim.phase!=="air"&&sim.contact[i]){
    fitSkiContact(sim.position,this.forward,sign,height,pose);
   }else{
    pose.rotation.copy(sim.rotation);
    pose.position.set(sign*.23,0,0).applyQuaternion(pose.rotation).add(sim.position);
   }
   let min=Infinity,max=-Infinity,sum=0,minStation=0,maxStation=0,minEdge=0,maxEdge=0;
   let insideMax=-Infinity;
   let closestX=0,closestZ=0,farthestX=0,farthestZ=0;
   // Twice the fitting grid resolution also samples gaps between fit stations.
   const stations=sim.footprint==="independent"?64:32;
   for(let j=0;j<=stations;j++)for(let w=-1;w<=1;w++){
    this.point.set(w*SKI_HALF_WIDTH,SKI_SOLE_Y,(2*j/stations-1)*SKI_HALF_LENGTH)
     .applyQuaternion(pose.rotation).add(pose.position);
    const gap=this.point.y-height(this.point);
    if(gap<min){min=gap;minStation=j;minEdge=w;closestX=this.point.x;closestZ=this.point.z;}
    if(gap>max){max=gap;maxStation=j;maxEdge=w;farthestX=this.point.x;farthestZ=this.point.z;}
    if(inside(this.point.x,this.point.z))insideMax=Math.max(insideMax,gap);
    sum+=gap;
   }
   return {insideMax,min,mean:sum/(3*(stations+1)),max,minStation,maxStation,minEdge,maxEdge,closestX,closestZ,farthestX,farthestZ};
  });
 }
}
