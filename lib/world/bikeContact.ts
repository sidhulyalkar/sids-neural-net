import type {Point} from "./model";
/** Actual rendered tire radius, axle elevation and half wheelbase. */
export const BIKE_CONTACT={radius:(.43+.075)*1.16,axleY:.5,halfWheelbase:.96} as const;
/** Fit the rigid frame to both tire envelopes, rather than lifting the entire
 * bicycle to the highest terrain sample. Sample tire arcs to handle crests. */
export function wheelTerrainPose(point:Point,heading:Point,height:(p:Point)=>number,
 dimensions:{radius:number;axleY:number;halfWheelbase:number;halfTrack?:number;roll?:number}){
 const {radius,axleY,halfWheelbase,halfTrack=0,roll=0}=dimensions;
 const n=Math.hypot(heading.x,heading.z)||1,fx=heading.x/n,fz=heading.z/n;
 const ground=(along:number,side:number)=>height({x:point.x+fx*along+fz*side,z:point.z+fz*along-fx*side});
 const required=(along:number,side:number)=>{
  let y=-Infinity;
  for(let i=0;i<=12;i++){
   const a=-Math.PI/2+i*Math.PI/12;
   y=Math.max(y,ground(along+radius*Math.sin(a),side)+radius*Math.cos(a));
  }
  return y;
 };
 const evaluate=(tilt:number)=>{
  const c=Math.cos(tilt),s=Math.sin(tilt);
  const axle=(end:number)=>Math.max(...(halfTrack?[ -halfTrack,halfTrack ]:[0]).map(side=>{
   const cross=side*Math.cos(roll)-axleY*Math.sin(roll);
   const localY=side*Math.sin(roll)+axleY*Math.cos(roll);
   return required(end*halfWheelbase*c-localY*s,cross)-localY*c-end*halfWheelbase*s;
  }));
  const front=axle(1),rear=axle(-1);
  return {front,rear};
 };
 let lo=-1.35,hi=1.35;
 for(let i=0;i<14;i++){
  const mid=(lo+hi)/2,r=evaluate(mid);
  if(r.front>r.rear)lo=mid;else hi=mid;
 }
 const tilt=(lo+hi)/2,r=evaluate(tilt);
 return {pitch:-tilt,y:Math.max(r.front,r.rear),error:Math.abs(r.front-r.rear)};
}

export function bikeTerrainPose(point:Point,heading:Point,height:(p:Point)=>number){
 return wheelTerrainPose(point,heading,height,BIKE_CONTACT);
}
