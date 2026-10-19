import type {Point} from "./model";
import {GROVE_TUNNEL} from "./skatepark";
export const TUBE_TAU=2*Math.PI;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
type V=[number,number,number];
const unit=(v:V):V=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n) as V;};
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function sequoiaTubePoint(x:number,angle:number,floorY:number,outer=false){
 const g=GROVE_TUNNEL,taper=1-g.taper*(x-g.center.x)/g.halfLength;
 return {x,y:floorY+g.innerRadius*taper-(outer?g.outerRadius:g.innerRadius)*taper*Math.cos(angle),
  z:g.center.z+(outer?g.outerHalfWidth:g.innerHalfWidth)*taper*Math.sin(angle)};
}
export type SkateTunnelRide={
 x:number;angle:number;vx:number;vt:number;speed:number;direction:1|-1;
 progress:number;startAngle:number;spin:1|-1;startX:number;endX:number;
 air?:{position:V;velocity:V};
};
export function canStartSkateTunnelRide(p:Point,h:Point,speed:number){
 return Number.isFinite(speed)&&speed>.2&&Math.hypot(h.x,h.z)>.5&&
  Math.abs(p.x-GROVE_TUNNEL.center.x)<GROVE_TUNNEL.halfLength&&
  Math.abs(p.z-GROVE_TUNNEL.center.z)<.7;
}
export function beginSkateTunnelRide(p:Point,h:Point,speed:number,spin:1|-1=1):SkateTunnelRide|null{
 if(!canStartSkateTunnelRide(p,h,speed))return null;
 const direction=h.x>=0?1:-1;
 const radius=GROVE_TUNNEL.innerHalfWidth*(1-GROVE_TUNNEL.taper*(p.x-GROVE_TUNNEL.center.x)/GROVE_TUNNEL.halfLength);
 const angle=Math.asin(clamp((p.z-GROVE_TUNNEL.center.z)/radius,-1,1));
 return {x:p.x,angle,vx:speed*h.x,vt:speed*h.z,speed,direction,progress:0,startAngle:angle,
  spin,startX:p.x,endX:GROVE_TUNNEL.center.x+direction*GROVE_TUNNEL.halfLength};
}
export function skateTunnelSample(r:SkateTunnelRide,floorAt:(p:Point)=>number){
 const g=GROVE_TUNNEL,taper=1-g.taper*(r.x-g.center.x)/g.halfLength;
 const ry=g.innerRadius*taper,rz=g.innerHalfWidth*taper;
 const floor=floorAt({x:r.x,z:g.center.z}),p=sequoiaTubePoint(r.x,r.angle,floor);
 const dy=ry*Math.sin(r.angle),dz=rz*Math.cos(r.angle),ds=Math.hypot(dy,dz);
 const tangent:V=[0,dy/ds,dz/ds];
 const slope=(floorAt({x:r.x+.02,z:g.center.z})-floorAt({x:r.x-.02,z:g.center.z}))/.04;
 const taperSlope=-g.taper/g.halfLength;
 const axis:V=unit([1,slope+g.innerRadius*taperSlope*(1-Math.cos(r.angle)),g.innerHalfWidth*taperSlope*Math.sin(r.angle)]);
 const up=unit(cross(tangent,axis));
 const forward=unit(axis.map((n,i)=>n*r.vx+tangent[i]*r.vt) as V);
 if(Math.hypot(r.vx,r.vt)<.01){forward[0]=r.direction;forward[1]=forward[2]=0;}
 const right=unit(cross(up,forward));
 const curvature=ry*rz/(ds*ds*ds);
 const wheelLift=.5*curvature*(.63*.63*r.vt*r.vt+.33*.33*r.vx*r.vx)/Math.max(.01,r.speed*r.speed);
 const pos=r.air?.position??[p.x,p.y,p.z];
 return {point:{x:pos[0],z:pos[2]},y:pos[1],roll:r.angle,angle:r.angle,
  up,forward,right,tangent,axis,ds,curvature,wheelLift,
  heading:{x:forward[0]/(Math.hypot(forward[0],forward[2])||1),z:forward[2]/(Math.hypot(forward[0],forward[2])||1)}};
}
export function jumpSkateTunnel(r:SkateTunnelRide,floor:(p:Point)=>number):SkateTunnelRide{
 if(r.air)return r;
 const p=skateTunnelSample(r,floor);
 return {...r,air:{position:[p.point.x+p.up[0]*.04,p.y+p.up[1]*.04,p.point.z+p.up[2]*.04],
  velocity:p.forward.map((v,i)=>v*r.speed+p.up[i]*3.5) as V}};
}
/** Two free surface coordinates, tangential gravity and real ballistic jumps.
 * No preset helix, speed floor, compulsory revolution or dedicated stunt key. */
export function advanceSkateTunnelRide(start:SkateTunnelRide,delta:number,
 input:{steer:number;push:boolean;brake:boolean}={steer:0,push:false,brake:false},floor:(p:Point)=>number=()=>0){
 let r={...start,air:start.air?{position:[...start.air.position] as V,velocity:[...start.air.velocity] as V}:undefined};
 if(!Number.isFinite(delta)||delta<=0)return {ride:r,completed:false};
 const steps=Math.ceil(Math.min(delta,.5)/.008),dt=Math.min(delta,.5)/steps;
 let completed=false;
 for(let i=0;i<steps;i++){
  const p=skateTunnelSample(r,floor);
  if(r.air){
   r.air.velocity[1]-=3.8*dt;
   for(let k=0;k<3;k++)r.air.position[k]+=r.air.velocity[k]*dt;
   r.x=r.air.position[0];
   const taper=1-GROVE_TUNNEL.taper*(r.x-GROVE_TUNNEL.center.x)/GROVE_TUNNEL.halfLength;
   const ry=GROVE_TUNNEL.innerRadius*taper,rz=GROVE_TUNNEL.innerHalfWidth*taper;
   const y=(r.air.position[1]-floor({x:r.x,z:GROVE_TUNNEL.center.z})-ry)/ry;
   const z=(r.air.position[2]-GROVE_TUNNEL.center.z)/rz;
   if(y*y+z*z>=1){
    r.angle=Math.atan2(z,-y)+Math.round((r.angle-Math.atan2(z,-y))/TUBE_TAU)*TUBE_TAU;
    const hit=skateTunnelSample(r,floor);
    r.vx=dot(r.air.velocity,hit.axis);r.vt=dot(r.air.velocity,hit.tangent);r.air=undefined;
   }
  }else{
   // Steering rotates the velocity in the surface plane and preserves energy.
   const turn=clamp(input.steer,-1,1)*1.65*dt;
   const vx=r.vx*Math.cos(turn)-r.vt*Math.sin(turn);
   const vt=r.vx*Math.sin(turn)+r.vt*Math.cos(turn);
   const drag=input.brake?3:.045;
   const push=input.push&&r.speed<10?2.7:0;
   r.vx=vx+(-3.8*p.axis[1]+push*vx/Math.max(r.speed,.1)-drag*vx)*dt;
   r.vt=vt+(-3.8*p.tangent[1]+push*vt/Math.max(r.speed,.1)-drag*vt)*dt;
   if(input.push&&r.speed<.1)r.vx+=r.direction*2.7*dt;
   r.x+=r.vx*p.axis[0]*dt;r.angle+=r.vt/p.ds*dt;
   // Lose ceiling contact naturally when centripetal support is insufficient.
   if(r.vt*r.vt*p.curvature+3.8*p.up[1]<0){
    r.air={position:[p.point.x+p.up[0]*.01,p.y+p.up[1]*.01,p.point.z+p.up[2]*.01],
     velocity:p.forward.map(v=>v*r.speed) as V};
   }
  }
  r.speed=Math.hypot(r.vx,r.vt);if(Math.abs(r.vx)>.8)r.direction=r.vx>=0?1:-1;
  r.progress=Math.abs(r.angle-r.startAngle)/TUBE_TAU;
  if(Math.abs(r.x-GROVE_TUNNEL.center.x)>=GROVE_TUNNEL.halfLength){completed=true;break;}
 }
 return {ride:r,completed};
}

/** Predict the short ballistic window so assisted flips catch before the wall. */
export function skateTunnelJumpDuration(start:SkateTunnelRide,floor:(p:Point)=>number){
 let ride=jumpSkateTunnel(start,floor),seconds=0;
 while(ride.air&&seconds<2){
  const next=advanceSkateTunnelRide(ride,.008,undefined,floor);
  ride=next.ride;seconds+=.008;
  if(next.completed)return .44;
 }
 return Math.max(.08,seconds*.85);
}
