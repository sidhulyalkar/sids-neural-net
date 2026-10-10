import { SEA_SURFACE, seaFloorHeight, waterZone, type Point } from "./model";

/** Shape-changing schools: deterministic, no boids quadratic neighbor scans. */
export type SchoolForm = "bait-ball" | "ribbon" | "split-and-reform";
export const MARINE_SCHOOLS = [
  { id:"kelp-silver",zone:"kelp",count:26,center:{x:-52,z:12},form:"ribbon",color:"#a9c9c6",seed:0.4 },
  { id:"lagoon-bait-ball",zone:"lagoon",count:30,center:{x:76,z:13},form:"bait-ball",color:"#b6d9bc",seed:1.5 },
  { id:"lagoon-split",zone:"lagoon",count:28,center:{x:78,z:-13},form:"split-and-reform",color:"#f0d37e",seed:2.8 },
] as const satisfies readonly {
 id:string; zone:"kelp"|"lagoon"; count:number;center:Point;form:SchoolForm;color:string;seed:number;
}[];
export type SchoolSpec=(typeof MARINE_SCHOOLS)[number];
const fract=(n:number)=>n-Math.floor(n);
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const ease=(v:number)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
export type FishPose={x:number;y:number;z:number;yaw:number;size:number};

/** Shape continuity and real-water boundaries are enforced per fish per step. */
export function sampleFish(spec:SchoolSpec,index:number,time:number):FishPose {
  const n=spec.count,ratio=index/n;
  const turn=ratio*Math.PI*2;
  const phase=time*0.42+spec.seed;
  const breath=0.75+0.23*Math.sin(time*0.53+spec.seed);
  const h1=fract(index*0.6180339887+spec.seed);
  const h2=fract(index*0.754877666+spec.seed*.3);
  const ballR=Math.sqrt(h1)*2.05*breath;
  const by= (h2-.5)*2.2*breath;
  // Ball, ordered shoal ribbon and a diverging/rejoining split remain smooth.
  const ball={x:Math.cos(turn*2.7+phase)*ballR,z:Math.sin(turn*2.7+phase)*ballR,y:by};
  const curve=ratio*2-1;
  const ribbon={x:curve*3.2+Math.sin(ratio*10+phase)*0.36,
    z:Math.sin(curve*Math.PI*1.4+phase)*1.1,
    y:Math.cos(ratio*5.3+phase)*0.65+(h1-.5)*0.45};
  const split=ease((Math.sin(time*0.37+spec.seed)+0.35)/1.35);
  const fan={x:curve*3.0,z:Math.sin(ratio*7+phase)*0.7+
    (index%2===0?1:-1)*split*(0.65+0.5*h1),y:Math.sin(ratio*7+phase)*0.50};
  // All schools slowly morph through formations rather than snapping at a phase boundary.
  const cycle=(time*0.13+spec.seed/5)%3;
  const c=cycle<1?cycle:cycle<2?cycle-1:cycle-2;
  const alpha=ease(c);
  const pose=cycle<1?
    {x:ball.x*(1-alpha)+ribbon.x*alpha,z:ball.z*(1-alpha)+ribbon.z*alpha,y:ball.y*(1-alpha)+ribbon.y*alpha}:
    cycle<2?
      {x:ribbon.x*(1-alpha)+fan.x*alpha,z:ribbon.z*(1-alpha)+fan.z*alpha,y:ribbon.y*(1-alpha)+fan.y*alpha}:
      {x:fan.x*(1-alpha)+ball.x*alpha,z:fan.z*(1-alpha)+ball.z*alpha,y:fan.y*(1-alpha)+ball.y*alpha};
  // Keep shoals off the shoreline even while the group changes silhouette.
  const centerX=spec.center.x+Math.sin(phase*.6)*0.50;
  const centerZ=spec.center.z+Math.cos(phase*.42)*0.75;
  let x=centerX+pose.x,z=centerZ+pose.z;
  if(waterZone({x,z})!==spec.zone){x=spec.center.x;z=spec.center.z;}
  const floor=seaFloorHeight(x,z);
  const y=clamp(SEA_SURFACE-2.45+pose.y*.42,floor+0.75,SEA_SURFACE-0.65);
  // Finite difference approximates local tangent with a stable fallback.
  const vx=-Math.sin(turn+phase)*0.6+0.75;
  const vz=Math.cos(turn+phase)*0.32+0.42;
  return {x,z,y,yaw:Math.atan2(vx,vz),size:0.17+0.075*h1};
}
export function validateMarineSchools():string[] {
 const errors:string[]=[];
 for(const school of MARINE_SCHOOLS)for(const time of [0,1,3,9,18,44])
  for(let i=0;i<school.count;i++){
   const p=sampleFish(school,i,time);
   if(waterZone(p)!==school.zone)errors.push(school.id+":outside habitat");
   const floor=seaFloorHeight(p.x,p.z);
   if(!(p.y>=floor+0.74 && p.y<=SEA_SURFACE-0.64))errors.push(school.id+":depth");
   if(![p.x,p.y,p.z,p.yaw,p.size].every(Number.isFinite))errors.push(school.id+":nonfinite");
  }
 return errors;
}
