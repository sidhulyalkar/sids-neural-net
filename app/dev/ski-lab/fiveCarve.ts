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
export function createTrial(footprint=false){
 const sim=new SkiSimulation(terrainHeight,pipe.centerX,-57,footprint);
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
   if(!sim.footprint&&sim.phase!=="air"&&sim.contact[i]){
    fitSkiContact(sim.position,this.forward,sign,height,pose);
   }else{
    pose.rotation.copy(sim.rotation);
    pose.position.set(sign*.23,0,0).applyQuaternion(pose.rotation).add(sim.position);
   }
   let min=Infinity,max=-Infinity,sum=0;
   // Twice the fitting grid resolution also samples gaps between fit stations.
   for(let j=0;j<=32;j++)for(let w=-1;w<=1;w++){
    this.point.set(w*SKI_HALF_WIDTH,SKI_SOLE_Y,(j/16-1)*SKI_HALF_LENGTH)
     .applyQuaternion(pose.rotation).add(pose.position);
    const gap=this.point.y-height(this.point);
    min=Math.min(min,gap);max=Math.max(max,gap);sum+=gap;
   }
   return {min,mean:sum/99,max};
  });
 }
}
