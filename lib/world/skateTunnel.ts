import type {Point} from "./model";
import {GROVE_TUNNEL} from "./skatepark";

/** Shared elliptic contact for the complete, OPEN-ENDED hollow trunk.
 * angle=0 is the polished bottom; π is the inner ceiling. Exterior bark
 * is thicker but never a second collision authority. */
export const TUBE_TAU=2*Math.PI;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function sequoiaTubePoint(x:number,angle:number,floorY:number,outer=false){
 const g=GROVE_TUNNEL;
 const taper=1-g.taper*(x-g.center.x)/g.halfLength;
 const innerY=g.innerRadius*taper;
 const ry=(outer?g.outerRadius:g.innerRadius)*taper;
 const rz=(outer?g.outerHalfWidth:g.innerHalfWidth)*taper;
 return {
  x,y:floorY+innerY-ry*Math.cos(angle),
  z:g.center.z+rz*Math.sin(angle),
 };
}

export type SkateTunnelRide={
 progress:number;speed:number;startX:number;endX:number;
 startAngle:number;spin:1|-1;direction:1|-1;
};
export function canStartSkateTunnelRide(point:Point,heading:Point,speed:number){
 const g=GROVE_TUNNEL;
 const along=(point.x-g.center.x);
 const length=Math.hypot(heading.x,heading.z);
 // No teleport from outside the tree, sideways motion, or a stationary
 // proximity trigger. Q/E initiate a deliberate arcade barrel wall-ride.
 return Number.isFinite(speed)&&speed>=4.2&&length>.01&&
  Math.abs(heading.x)/length>.75&&
  Math.abs(along)<g.halfLength-.15&&
  Math.abs(point.z-g.center.z)<.58;
}
export function beginSkateTunnelRide(
 point:Point,heading:Point,speed:number,spin:1|-1,
):SkateTunnelRide|null{
 if(!canStartSkateTunnelRide(point,heading,speed))return null;
 const direction:1|-1=heading.x>=0?1:-1;
 const endX=GROVE_TUNNEL.center.x+
  direction*(GROVE_TUNNEL.halfLength-.15);
 const radius=GROVE_TUNNEL.innerHalfWidth*
  (1-GROVE_TUNNEL.taper*(point.x-GROVE_TUNNEL.center.x)/
   GROVE_TUNNEL.halfLength);
 const startAngle=Math.asin(clamp((point.z-GROVE_TUNNEL.center.z)/
  radius,-.3,.3));
 return {progress:0,speed,startX:point.x,endX,startAngle,spin,direction};
}

/** A real helix along the interior wall, not a floating avatar pose.
 * The sampled point is on the very same inner wood vertex surface rendered by
 * worldSkateGroveGeometry. Start/end both lie at the bottom bore. */
export function skateTunnelSample(ride:SkateTunnelRide,floorAt:(p:Point)=>number){
 const t=clamp(ride.progress,0,1);
 const x=ride.startX+(ride.endX-ride.startX)*t;
 const angle=ride.startAngle+ride.spin*TUBE_TAU*t;
 const floorY=floorAt({x,z:GROVE_TUNNEL.center.z});
 const point=sequoiaTubePoint(x,angle,floorY);
 return {point:{x:point.x,z:point.z},y:point.y,
  roll:ride.spin*TUBE_TAU*t+ride.startAngle,angle};
}
export function advanceSkateTunnelRide(ride:SkateTunnelRide,delta:number){
 if(!Number.isFinite(delta)||delta<=0)return {ride,completed:false};
 const length=Math.hypot(Math.abs(ride.endX-ride.startX),
  TUBE_TAU*(GROVE_TUNNEL.innerRadius+GROVE_TUNNEL.innerHalfWidth)*.5);
 let progress=clamp(ride.progress,0,1),speed=ride.speed;
 const slices=Math.max(1,Math.ceil(clamp(delta,0,.5)/.025));
 const dt=clamp(delta,0,.5)/slices;
 for(let i=0;i<slices;i++){
  speed=Math.max(4.2,speed-.12*dt);
  progress=Math.min(1,progress+speed*dt/length);
 }
 return {ride:{...ride,progress,speed},completed:progress>=1-1e-9};
}
