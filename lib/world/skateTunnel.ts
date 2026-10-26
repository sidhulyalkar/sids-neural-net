import type {Point} from "./model";
import {GROVE_TUNNEL} from "./skatepark";
/** End grain and bark can never acquire a grind/tube ride. Wall capture is
 * reserved for inner wood well inside the log, above ordinary wheel height. */
export const LOG_RIM_MIN_HEIGHT=.85;
export const LOG_MOUTH_BLEND=.55;
export const LOG_ROLL_IN_HALF_WIDTH=.85;
export const LOG_ROLL_IN_TOLERANCE=.24;
export const TUBE_TAU=2*Math.PI;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export type V=[number,number,number];
type Floor=(p:Point)=>number;
export type LogSurface="inner"|"outer"|"rim";
const unit=(v:V):V=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n) as V;};
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function sequoiaTubePoint(x:number,angle:number,floorY:number,outer=false){
 const g=GROVE_TUNNEL,taper=1-g.taper*(x-g.center.x)/g.halfLength;
 return {x,y:floorY+g.innerRadius*taper-(outer?g.outerRadius:g.innerRadius)*taper*Math.cos(angle),
  z:g.center.z+(outer?g.outerHalfWidth:g.innerHalfWidth)*taper*Math.sin(angle)};
}
export type SkateTunnelRide={
 facing?:number;
 x:number;angle:number;vx:number;vt:number;speed:number;direction:1|-1;
 surface?:LogSurface;rimSide?:1|-1;rimT?:number;
 progress:number;startAngle:number;spin:1|-1;startX:number;endX:number;
 air?:{position:V;velocity:V};
 centerJump?:{elapsed:number;duration:number;from:V;to:V;normal:V;angle:number;speed:number};
};
/** Normal travel-menu arrival on the bark, also useful for practicing jumps. */
export function beginSkateLogTopRide():SkateTunnelRide{
 const g=GROVE_TUNNEL,x=g.center.x+g.halfLength*.6;
 return {x,angle:Math.PI,surface:"outer",vx:0,vt:0,speed:0,direction:-1,
  progress:0,startAngle:Math.PI,spin:1,startX:x,endX:g.center.x-g.halfLength};
}
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
/** The renderer and contact solver share the same tapered shell. */
export function skateTunnelSample(r:SkateTunnelRide,floorAt:Floor){
 const g=GROVE_TUNNEL,outer=r.surface==="outer",rim=r.surface==="rim";
 const taper=1-g.taper*(r.x-g.center.x)/g.halfLength;
 const weight=outer?1:rim?clamp(r.rimT??0,0,1):0;
 const radiusY=g.innerRadius+(g.outerRadius-g.innerRadius)*weight;
 const radiusZ=g.innerHalfWidth+(g.outerHalfWidth-g.innerHalfWidth)*weight;
 const ry=radiusY*taper,rz=radiusZ*taper;
 const floor=floorAt({x:r.x,z:g.center.z});
 const p={x:r.x,y:floor+g.innerRadius*taper-ry*Math.cos(r.angle),z:g.center.z+rz*Math.sin(r.angle)};
 const dy=ry*Math.sin(r.angle),dz=rz*Math.cos(r.angle),ds=Math.hypot(dy,dz);
 const tangent:V=[0,dy/ds,dz/ds];
 const slope=(floorAt({x:r.x+.02,z:g.center.z})-floorAt({x:r.x-.02,z:g.center.z}))/.04;
 const taperSlope=-g.taper/g.halfLength;
 const derivative:V=rim?[0,-(g.outerRadius-g.innerRadius)*taper*Math.cos(r.angle),
  (g.outerHalfWidth-g.innerHalfWidth)*taper*Math.sin(r.angle)]:
  [1,slope+taperSlope*(g.innerRadius-radiusY*Math.cos(r.angle)),radiusZ*taperSlope*Math.sin(r.angle)];
 const skew=dot(derivative,tangent);
 const axis=unit(derivative.map((v,i)=>v-skew*tangent[i]) as V);
 const metric=dot(derivative,axis);
 let up:V=rim?[r.rimSide??1,0,0]:cross(tangent,axis).map(v=>v*(outer?-1:1)) as V;
 const forward=unit(axis.map((n,i)=>n*r.vx+tangent[i]*r.vt) as V);
 if(Math.hypot(r.vx,r.vt)<.01){for(let i=0;i<3;i++)forward[i]=axis[i]*r.direction;}
 if(r.centerJump){
  const t=clamp(r.centerJump.elapsed/r.centerJump.duration,0,1),blend=t*t*(3-2*t);
  const a=r.centerJump.angle*(1-blend);
  up=[0,Math.cos(a),-Math.sin(a)];
  forward[0]=r.direction;forward[1]=forward[2]=0;
 }
 const motionForward=[...forward] as V;
 // Board is symmetric fore/aft: reversing is fakie, not a 180-degree snap.
 // Keep movement direction separate from the drawn contact frame.
 if(r.facing!==undefined&&!r.centerJump){
  const rendered=unit(axis.map((v,i)=>v*Math.cos(r.facing!)+tangent[i]*Math.sin(r.facing!)) as V);
  for(let i=0;i<3;i++)forward[i]=rendered[i];
 }
 const right=unit(cross(up,forward));
 const curvature=rim?0:(outer?-1:1)*ry*rz/(ds*ds*ds);
 // Fit the actual four wheels to the *same elliptical inner shell* drawn by
 // the mesh. A speed-weighted curvature estimate changed wheel clearance on
 // turns and could let the front or rear pair clip through the wood.
 let wheelLift=.5*curvature*(.63*.63*r.vt*r.vt+.33*.33*r.vx*r.vx)/Math.max(.01,r.speed*r.speed);
 if(!outer&&!rim&&!r.air){
  const footprint=[] as {x:number;y:number;z:number;floorY:number}[];
  for(const track of [-.33,.33])for(const axle of [-.63,.63]){
   const x=p.x+right[0]*track+forward[0]*axle;
   const y=p.y+right[1]*track+forward[1]*axle;
   const z=p.z+right[2]*track+forward[2]*axle;
   if(Math.abs(x-g.center.x)>g.halfLength)continue;
   footprint.push({x,y,z,floorY:floorAt({x,z:g.center.z})});
  }
  const wheelPenetrates=(lift:number)=>footprint.some(w=>{
   const taperAt=1-g.taper*(w.x-g.center.x)/g.halfLength;
   const localRy=g.innerRadius*taperAt,localRz=g.innerHalfWidth*taperAt;
   const y=(w.y+up[1]*lift-w.floorY-localRy)/localRy;
   const z=(w.z+up[2]*lift-g.center.z)/localRz;
   return y*y+z*z>1+1e-7;
  });
  if(!wheelPenetrates(0))wheelLift=0;
  else{
   let low=0,high=.30;
   // Do not introduce a large magnetic correction near the entrance.
   if(wheelPenetrates(high))wheelLift=high;
   else{
    for(let i=0;i<12;i++){
     const mid=(low+high)*.5;
     if(wheelPenetrates(mid))low=mid;else high=mid;
    }
    wheelLift=high;
   }
  }
 }
 const pos=r.air?.position??[p.x,p.y,p.z];
 return {point:{x:pos[0],z:pos[2]},y:pos[1],roll:r.angle,angle:r.angle,
  up,forward,motionForward,right,tangent,axis,ds,curvature,wheelLift,metric,skew,
  heading:{x:motionForward[0]/(Math.hypot(motionForward[0],motionForward[2])||1),z:motionForward[2]/(Math.hypot(motionForward[0],motionForward[2])||1)}};
}

/** Signed distance bound for the SOLID wood, including its two annular ends.
 * Negative means wood; the bore and the space above the bark remain empty. */
export function skateLogShellDistance(p:V,floor:Floor){
 const g=GROVE_TUNNEL,x=clamp(p[0],g.center.x-g.halfLength,g.center.x+g.halfLength);
 const taper=1-g.taper*(x-g.center.x)/g.halfLength;
 const y=p[1]-floor({x,z:g.center.z})-g.innerRadius*taper,z=p[2]-g.center.z;
 const inner=(Math.hypot(y/(g.innerRadius*taper),z/(g.innerHalfWidth*taper))-1)*g.innerHalfWidth*taper;
 const outer=(Math.hypot(y/(g.outerRadius*taper),z/(g.outerHalfWidth*taper))-1)*g.outerHalfWidth*taper;
 const end=Math.abs(p[0]-g.center.x)-g.halfLength;
 return {distance:Math.max(end,outer,-inner),surface:(-inner>=end-.00002&&-inner>=outer?"inner":outer>=end-.00002&&outer>=-inner?"outer":"rim") as LogSurface};
}
export type LogHit={point:V;t:number;surface:LogSurface};
/** Conservative advancement checks the entire segment, including thin end rims.
 * The field is a distance bound (with a safety factor for taper/terrain slope),
 * so even a fast frame cannot hop from outside to inside without hitting wood. */
export function sweepSkateLog(from:V,to:V,floor:Floor,clearance=0):LogHit|null{
 if(![...from,...to].every(Number.isFinite))return null;
 const g=GROVE_TUNNEL;
 if(Math.min(from[0],to[0])>g.center.x+g.halfLength+clearance+.01||Math.max(from[0],to[0])<g.center.x-g.halfLength-clearance-.01||
  Math.min(from[2],to[2])>g.center.z+(g.outerHalfWidth*1.03+clearance)||Math.max(from[2],to[2])<g.center.z-(g.outerHalfWidth*1.03+clearance))return null;
 const delta=to.map((v,i)=>v-from[i]) as V,length=Math.hypot(...delta);
 if(length<1e-8)return null;
 let t=0;
 // A bounded segment is used only for physical frames, never destination warps.
 for(let step=0;step<2048&&t<=1;step++){
  const point=from.map((v,i)=>v+delta[i]*t) as V,field=skateLogShellDistance(point,floor);
  field.distance-=clearance;
  if(field.distance<=.00001){
   // Ignore grazing/separating contact at the start of a jump or mouth exit.
   const ahead=from.map((v,i)=>v+delta[i]*Math.min(1,t+.0001/length)) as V;
   if(t===0&&field.distance>=-.0001&&skateLogShellDistance(ahead,floor).distance-clearance>=field.distance){t=Math.min(1,.0002/length);if(t===1)return null;continue;}
   return {point,t,surface:field.surface};
  }
  if(t===1)return null;
  t=Math.min(1,t+Math.max(.000005,field.distance*.4)/length);
 }
 return null;
}
function rideAtLogHit(hit:LogHit,velocity:V,floor:Floor):SkateTunnelRide{
 const g=GROVE_TUNNEL,x=clamp(hit.point[0],g.center.x-g.halfLength,g.center.x+g.halfLength);
 const side=x>=g.center.x?1:-1,taper=1-g.taper*(x-g.center.x)/g.halfLength;
 const y=hit.point[1]-floor({x,z:g.center.z})-g.innerRadius*taper,z=hit.point[2]-g.center.z;
 let weight=hit.surface==="outer"?1:0;
 if(hit.surface==="rim"){
  let low=0,high=1;
  for(let i=0;i<30;i++){
   const mid=(low+high)/2,ry=(g.innerRadius+(g.outerRadius-g.innerRadius)*mid)*taper,
    rz=(g.innerHalfWidth+(g.outerHalfWidth-g.innerHalfWidth)*mid)*taper;
   if(Math.hypot(y/ry,z/rz)>1)low=mid;else high=mid;
  }
  weight=(low+high)/2;
 }
 const ry=(g.innerRadius+(g.outerRadius-g.innerRadius)*weight)*taper,
  rz=(g.innerHalfWidth+(g.outerHalfWidth-g.innerHalfWidth)*weight)*taper;
 const angle=Math.atan2(z/rz,-y/ry);
 const ride:SkateTunnelRide={x,angle,surface:hit.surface,rimSide:side,rimT:weight,
  vx:0,vt:0,speed:0,direction:velocity[0]>=0?1:-1,progress:0,startAngle:angle,spin:1,startX:x,endX:g.center.x+side*g.halfLength};
 const pose=skateTunnelSample(ride,floor);
 ride.vx=dot(velocity,pose.axis);ride.vt=dot(velocity,pose.tangent);ride.speed=Math.hypot(ride.vx,ride.vt);
 return ride;
}
export function contactSkateLog(from:V,to:V,velocity:V,floor:Floor){
 const hit=sweepSkateLog(from,to,floor);
 return hit&&canRideLogContact(hit,floor)?rideAtLogHit(hit,velocity,floor):null;
}
export function canRideLogContact(hit:LogHit,floor:Floor){
 // An outer-bark or cut-end strike is COLLISION, never a grind acquisition.
 // Wheel-level contact on the bottom of the bore belongs to the roll-in.
 // The inner-wall acquisition band is recessed so neither entrance lip can
 // magnetically pull an approaching skater up from the dry runout.
 const x=hit.point[0],g=GROVE_TUNNEL;
 return hit.surface==="inner"&&
  Math.abs(x-g.center.x)<g.halfLength-LOG_MOUTH_BLEND&&
  hit.point[1]-floor({x,z:hit.point[2]})>=LOG_RIM_MIN_HEIGHT;
}
/** Wheel contact plus a short capsule for the rider. Body-only impacts slide
 * outside the wood rather than attaching the board through the wall. */
export function resolveSkateLogMotion(from:V,to:V,velocity:V,floor:Floor,up:V=[0,1,0],grounded=false){
 let position=[...from] as V,target=[...to] as V,v=[...velocity] as V,blocked=false;
 for(let iteration=0;iteration<3;iteration++){
  const wheel=sweepSkateLog(position,target,floor);
  let body:LogHit|null=null;
  for(const height of [.45,.95,1.45]){
   const a=position.map((n,i)=>n+up[i]*height) as V,b=target.map((n,i)=>n+up[i]*height) as V;
   const hit=sweepSkateLog(a,b,floor,.19);
   if(hit&&(!body||hit.t<body.t))body=hit;
  }
  // Ignore low mouth seams; only the wheel path inside the actual bore may
  // attach to the tube. Bark and elevated cut end-grain remain collision-only.
  const wheelRide=wheel&&canRideLogContact(wheel,floor);
  // The low, centered mouth is an open floor. Off-center end grain remains
  // solid at ALL heights, so a skateboard cannot tunnel through bark just
  // because it is below torso height. Neither can ever become a grind.
  const lowCenter=wheel&&
    Math.abs(wheel.point[2]-GROVE_TUNNEL.center.z)<=LOG_ROLL_IN_HALF_WIDTH&&
    wheel.point[1]-floor({x:wheel.point[0],z:wheel.point[2]})<LOG_RIM_MIN_HEIGHT;
  const solidWheel=wheel&&wheel.surface!=="inner"&&!lowCenter;
  if(solidWheel&&(!body||wheel!.t<body.t))body=wheel;
  if(wheelRide&&(!body||wheel!.t<=body.t+.00001))
    return {ride:rideAtLogHit(wheel!,v,floor),position:wheel!.point,velocity:v,blocked};
  if(!body)return {ride:null,position:target,velocity:v,blocked};
  blocked=true;
  let normal=skateTunnelSample(rideAtLogHit(body,v,floor),floor).up;
  // A grounded rider cannot slide down through terrain under the overhang.
  // Resolve that contact in the horizontal plane; flight retains the full normal.
  if(grounded&&Math.hypot(normal[0],normal[2])>.001)normal=unit([normal[0],0,normal[2]]);
  const movement=target.map((n,i)=>n-position[i]) as V;
  position=position.map((n,i)=>n+movement[i]*Math.max(0,body.t-.0001)+normal[i]*.002) as V;
  const into=dot(v,normal);if(into<0)v=v.map((n,i)=>n-normal[i]*into) as V;
  const remaining=movement.map(n=>n*(1-body!.t)) as V,penetration=Math.min(0,dot(remaining,normal));
  target=position.map((n,i)=>n+remaining[i]-normal[i]*penetration) as V;
 }
 return {ride:null,position,velocity:v,blocked};
}
export function jumpSkateTunnel(r:SkateTunnelRide,floor:(p:Point)=>number):SkateTunnelRide{
 if(r.air)return r;
 const p=skateTunnelSample(r,floor);
 if(!r.surface||r.surface==="inner"){
  const height=Math.max(0,p.y-floor(p.point)),duration=clamp(.45+Math.sqrt(height/8),.45,1.4);
  const x=clamp(r.x+r.direction*Math.max(2,r.speed)*duration*.5,GROVE_TUNNEL.center.x-GROVE_TUNNEL.halfLength+.25,GROVE_TUNNEL.center.x+GROVE_TUNNEL.halfLength-.25);
  const from:V=[p.point.x,p.y,p.point.z],to:V=[x,floor({x,z:GROVE_TUNNEL.center.z}),GROVE_TUNNEL.center.z];
  const angle=Math.atan2(Math.sin(r.angle),Math.cos(r.angle));
  return {...r,centerJump:{elapsed:0,duration,from,to,normal:p.up,angle,speed:Math.max(2,r.speed)},
    air:{position:[...from],velocity:[r.vx,0,0]}};
 }
 return {...r,air:{position:[p.point.x+p.up[0]*.04,p.y+p.up[1]*.04,p.point.z+p.up[2]*.04],
  velocity:p.motionForward.map((v,i)=>v*r.speed+p.up[i]*3.5) as V}};
}
/** Two free surface coordinates, tangential gravity and real ballistic jumps.
 * No preset helix, speed floor, compulsory revolution or dedicated stunt key. */
export function advanceSkateTunnelRide(start:SkateTunnelRide,delta:number,
 input:{steer:number;push:boolean;brake:boolean}={steer:0,push:false,brake:false},floor:Floor=()=>0){
 let r={...start,air:start.air?{position:[...start.air.position] as V,velocity:[...start.air.velocity] as V}:undefined};
 if(!Number.isFinite(delta)||delta<=0)return {ride:r,completed:false};
 const steps=Math.ceil(Math.min(delta,.5)/.008),dt=Math.min(delta,.5)/steps;
 let completed=false;
 for(let i=0;i<steps;i++){
  const p=skateTunnelSample(r,floor);
  if(r.centerJump){
   const jump={...r.centerJump,elapsed:Math.min(r.centerJump.duration,r.centerJump.elapsed+dt)};
   const t=jump.elapsed/jump.duration,b=t*t*(3-2*t),lift=.6*Math.sin(Math.PI*t);
   const position=jump.from.map((v,k)=>v+(jump.to[k]-v)*b+jump.normal[k]*lift) as V;
   // Taper and terrain change the bore along its axis. Keep the assisted
   // flight inside that local ellipse rather than cutting through its skin.
   const taper=1-GROVE_TUNNEL.taper*(position[0]-GROVE_TUNNEL.center.x)/GROVE_TUNNEL.halfLength;
   const ry=GROVE_TUNNEL.innerRadius*taper,rz=GROVE_TUNNEL.innerHalfWidth*taper;
   const cy=floor({x:position[0],z:GROVE_TUNNEL.center.z})+ry;
   const y=position[1]-cy,z=position[2]-GROVE_TUNNEL.center.z,radius=Math.hypot(y/ry,z/rz);
   if(radius>.999){position[1]=cy+y*.999/radius;position[2]=GROVE_TUNNEL.center.z+z*.999/radius;}
   const before=r.air!.position,velocity=position.map((v,k)=>(v-before[k])/dt) as V;
   r={...r,x:position[0],centerJump:jump,air:{position,velocity}};
   if(t>=1)r={...r,x:jump.to[0],angle:0,facing:r.direction>0?0:Math.PI,surface:"inner",vx:r.direction*jump.speed,vt:0,speed:jump.speed,air:undefined,centerJump:undefined};
   continue;
  }
  if(r.air){
   const before=[...r.air.position] as V;
   r.air.velocity[1]-=3.8*dt;
   const after=before.map((v,k)=>v+r.air!.velocity[k]*dt) as V;
   const motion=resolveSkateLogMotion(before,after,r.air.velocity,floor,p.up),hit=motion.ride;
   if(hit){
    const angle=hit.angle+Math.round((r.angle-hit.angle)/TUBE_TAU)*TUBE_TAU;
    r={...hit,angle,facing:r.facing,startAngle:r.startAngle,progress:r.progress,air:undefined};
   }else{
    r.air.position=motion.position;r.air.velocity=motion.velocity;r.x=motion.position[0];
    const g=GROVE_TUNNEL;
    // Retain log flight while nearby so a jump can land on either skin or rim.
    if(Math.abs(r.x-g.center.x)>g.halfLength||
      Math.abs(motion.position[2]-g.center.z)>g.outerHalfWidth+1||motion.position[1]<=floor({x:r.x,z:motion.position[2]})){
     completed=true;break;
    }
   }
  }else{
   const turn=clamp(input.steer,-1,1)*1.65*dt;
   const vx=r.vx*Math.cos(turn)-r.vt*Math.sin(turn),vt=r.vx*Math.sin(turn)+r.vt*Math.cos(turn);
   const drag=input.brake?3:.045,push=input.push&&r.speed<14?4.5:0;
   r.vx=vx+(-3.8*p.axis[1]+push*vx/Math.max(r.speed,.1)-drag*vx)*dt;
   r.vt=vt+(-3.8*p.tangent[1]+push*vt/Math.max(r.speed,.1)-drag*vt)*dt;
   if(input.push&&r.speed<.1)r.vx+=r.direction*4.5*dt;
   const along=r.vx/p.metric*dt;
   if(r.surface==="rim")r.rimT=(r.rimT??0)+along;else r.x+=along;
   r.angle+=(r.vt*dt-along*p.skew)/p.ds;
   if(r.surface==="rim"&&((r.rimT??0)<0||(r.rimT??0)>1)){
    r.surface=(r.rimT??0)>1?"outer":"inner";
    r.x=(GROVE_TUNNEL.center.x+(r.rimSide??1)*GROVE_TUNNEL.halfLength)-(r.rimSide??1)*.0001;
    r.vx=-(r.rimSide??1)*Math.abs(r.vx);
   }
   r.speed=Math.hypot(r.vx,r.vt);
   const previousFacing=r.facing??Math.atan2(start.vt,start.vx||start.direction*.001);
   if(r.speed>.15){
    const target=Math.atan2(r.vt,r.vx);
    // Wrap by pi so reversing rolls backwards on the same board frame.
    const delta=.5*Math.atan2(Math.sin(2*(target-previousFacing)),Math.cos(2*(target-previousFacing)));
    r.facing=previousFacing+clamp(delta,-6*dt,6*dt);
   }else r.facing=previousFacing;
   const next=skateTunnelSample(r,floor);
   if(r.surface!=="rim"&&Math.abs(r.x-GROVE_TUNNEL.center.x)>=GROVE_TUNNEL.halfLength){completed=true;break;}
   // Signed curvature: the outer crown releases at speed instead of gluing
   // the rider to the underside. Low-speed top contact remains stable.
   if(r.surface==="rim"&&next.y-floor(next.point)<LOG_RIM_MIN_HEIGHT){
    r.air={position:[next.point.x+next.up[0]*.01,next.y,next.point.z],velocity:next.motionForward.map(v=>v*r.speed) as V};
    completed=true;break;
   }
   if(r.vt*r.vt*next.curvature+3.8*next.up[1]<-.001){
    r.air={position:[next.point.x+next.up[0]*.002,next.y+next.up[1]*.002,next.point.z+next.up[2]*.002],
     velocity:next.motionForward.map(v=>v*r.speed) as V};
   }else if(r.surface!==undefined&&r.surface!=="inner"&&next.y<floor(next.point)-.02){completed=true;break;}
  }
  r.speed=r.air?Math.hypot(...r.air.velocity):Math.hypot(r.vx,r.vt);
  if(Math.abs(r.vx)>.8)r.direction=r.vx>=0?1:-1;
  r.progress=Math.abs(r.angle-r.startAngle)/TUBE_TAU;
 }
 return {ride:r,completed};
}

/** Predict the short ballistic window so assisted flips catch before the wall. */
export function skateTunnelJumpDuration(start:SkateTunnelRide,floor:(p:Point)=>number){
 let ride=jumpSkateTunnel(start,floor),seconds=0;
 if(ride.centerJump)return ride.centerJump.duration*.85;
 while(ride.air&&seconds<2){
  const next=advanceSkateTunnelRide(ride,.008,undefined,floor);
  ride=next.ride;seconds+=.008;
  if(next.completed)return .44;
 }
 return Math.max(.08,seconds*.85);
}

/** Cross an open mouth in 3D. Never acquire through bark or snap a flying board down. */
export function enterSkateTunnel(previous:Point,point:Point,y:number,velocity:V,
 floor:(p:Point)=>number):SkateTunnelRide|null{
 const g=GROVE_TUNNEL;
 if(![previous.x,previous.z,point.x,point.z,y,...velocity].every(Number.isFinite))return null;
 if(Math.abs(point.x-g.center.x)>=g.halfLength)return null;
 // A low central approach is a roll-in, NOT a collision-grind on the end.
 // The tube's shared analytic surface will take over wheel contact *after*
 // the entrance plane is crossed, without teleporting up onto the rim.
 const side=previous.x>=g.center.x?1:-1,mouth=g.center.x+side*g.halfLength;
 if(side*(previous.x-mouth)<0||side*velocity[0]>=-.05)return null;
 const t=(mouth-previous.x)/(point.x-previous.x),z=previous.z+(point.z-previous.z)*t;
 const taper=1-g.taper*(point.x-g.center.x)/g.halfLength;
 const ry=g.innerRadius*taper,rz=g.innerHalfWidth*taper,floorY=floor({x:point.x,z:g.center.z});
 const qy=(y-floorY-ry)/ry,qz=(point.z-g.center.z)/rz;
 if(Math.abs(z-g.center.z)>rz||qy*qy+qz*qz>1.055||y<floorY-.08)return null;
 const angle=Math.atan2(qz,-qy),direction=velocity[0]>=0?1:-1;
 let ride:SkateTunnelRide={x:point.x,angle,surface:"inner",vx:0,vt:0,speed:Math.hypot(...velocity),
  direction,progress:0,startAngle:angle,spin:1,startX:point.x,endX:g.center.x+direction*g.halfLength};
 const pose=skateTunnelSample(ride,floor),distance=Math.hypot(point.z-pose.point.z,y-pose.y);
 const lowRollIn=y-floor({x:point.x,z:point.z})<LOG_RIM_MIN_HEIGHT;
 if(lowRollIn){
  // At the low center of both mouths, the board rides into the open bore.
  // Never pull an off-center skater, a high nose, or a falling board onto it.
  if(Math.abs(z-g.center.z)>LOG_ROLL_IN_HALF_WIDTH||
    Math.abs(point.z-g.center.z)>LOG_ROLL_IN_HALF_WIDTH||
    distance>LOG_ROLL_IN_TOLERANCE||Math.abs(velocity[1])>.8)return null;
 }else if(distance>g.innerRadius*.95)return null;
 ride={...ride,vx:dot(velocity,pose.axis),vt:dot(velocity,pose.tangent)};
 ride.speed=Math.hypot(ride.vx,ride.vt);
 if(!lowRollIn&&distance>.075)
  ride.air={position:[point.x,y,point.z],velocity:[...velocity]};
 return ride;
}
export function skateTunnelCameraPoint(side:1|-1,floor:(p:Point)=>number){
 const x=GROVE_TUNNEL.center.x+side*(GROVE_TUNNEL.halfLength+3.8);
 return {x,y:floor({x,z:GROVE_TUNNEL.center.z})+GROVE_TUNNEL.innerRadius,z:GROVE_TUNNEL.center.z};
}
