/** Rigid-body flight of an axisymmetric spinning sports disc.
 * Coordinates: world Y up, body Y disc normal, body Z nose/forward.
 * Attitude is a normalized body-to-world quaternion and angular momentum
 * is WORLD-frame. The axial spin is part of the attitude quaternion.
 *
 * This solves six coupled translational/rotational DOFs using measured-style
 * force/moment equations, but the coefficients and inertia are still nominal.
 * There is no empirical validation against a specific commercial disc yet.
 */
import {DISC_GOLF_AERO_PROFILES,discGolfModelCoefficients,
 type AeroDisc,type AeroTelemetry,type DiscGolfFlightStyle,
 type DiscGolfReleaseStyle,type AeroVector} from "./discGolfAerodynamics";
export type V3=AeroVector;
export type Quat={x:number;y:number;z:number;w:number};
export type RigidDisc={orientation:Quat;momentum:V3};
export type RigidFlight={velocity:V3;rigid:RigidDisc;spinRpm:number;
 discStyle:DiscGolfFlightStyle;releaseStyle:DiscGolfReleaseStyle;model?:AeroDisc};
const pi=Math.PI,rad=pi/180,density=1.225,gravity=10.8;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:V3,b:V3):V3=>({
 x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x,
});
const scale=(a:V3,v:number):V3=>({x:a.x*v,y:a.y*v,z:a.z*v});
const add=(a:V3,b:V3):V3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const length=(a:V3)=>Math.hypot(a.x,a.y,a.z);
const norm=(a:V3):V3=>scale(a,1/Math.max(1e-9,length(a)));
const identity:Quat={x:0,y:0,z:0,w:1};
export function multiplyQuat(a:Quat,b:Quat):Quat{
 return {x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
 y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
 z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
 w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z};
}
export function normalizeQuat(q:Quat):Quat{
 const m=Math.hypot(q.x,q.y,q.z,q.w);
 return m<1e-12?{...identity}:
 {x:q.x/m,y:q.y/m,z:q.z/m,w:q.w/m};
}
export function rotateQuat(q:Quat,v:V3):V3{
 // q*(v,0)*conjugate(q), expanded to avoid object allocations.
 const u={x:q.x,y:q.y,z:q.z},t=scale(cross(u,v),2);
 return add(v,add(scale(t,q.w),cross(u,t)));
}
const axisQuat=(axis:V3,angle:number):Quat=>{
 const s=Math.sin(angle*.5);return {x:axis.x*s,y:axis.y*s,z:axis.z*s,w:Math.cos(angle*.5)};
};
const X={x:1,y:0,z:0},Y={x:0,y:1,z:0},Z={x:0,y:0,z:1};
export function discInitialOrientation(heading:number,pitchDegrees:number,bankDegrees:number):Quat{
 // Nose-up pitching rotates local +Z toward world +Y.
 return normalizeQuat(multiplyQuat(multiplyQuat(
  axisQuat(Y,heading),axisQuat(X,-pitchDegrees*rad)),
  axisQuat(Z,-bankDegrees*rad)));
}
export function initializeRigidDisc(heading:number,pitchDegrees:number,
 bankDegrees:number,spinRpm:number,hand:DiscGolfReleaseStyle,
 style:DiscGolfFlightStyle):RigidDisc{
 const orientation=discInitialOrientation(heading,pitchDegrees,bankDegrees);
 const normal=rotateQuat(orientation,Y);
 const spin=(hand==="forehand"?-1:1)*spinRpm*pi/30;
 return {orientation,momentum:scale(normal,DISC_GOLF_AERO_PROFILES[style].spinInertia*spin)};
}
const transverseInertia=(p:AeroDisc)=>p.spinInertia*.56;
function bodyAngularVelocity(rigid:RigidDisc,p:AeroDisc):V3{
 const q=rigid.orientation;
 const inv={x:-q.x,y:-q.y,z:-q.z,w:q.w};
 const body=rotateQuat(inv,rigid.momentum);
 const ix=transverseInertia(p);
 return {x:body.x/ix,y:body.y/p.spinInertia,z:body.z/ix};
}
export function discNormal(rigid:RigidDisc):V3{
 return rotateQuat(rigid.orientation,Y);
}
export function discRigidAngles(rigid:RigidDisc,heading:number){
 // Extract nose-up pitch and signed bank without following printed spin.
 const n=discNormal(rigid);
 const f={x:Math.sin(heading),y:0,z:Math.cos(heading)};
 const right={x:f.z,y:0,z:-f.x};
 const pitch=Math.atan2(-dot(n,f),Math.max(1e-6,n.y))/rad;
 const bank=Math.atan2(dot(n,right),Math.max(1e-6,n.y))/rad;
 return {pitchDegrees:clamp(pitch,-89,89),rollDegrees:clamp(bank,-89,89)};
}
export type RigidTelemetry=AeroTelemetry&{nutationRadiansPerSecond:number;
 angularMomentum:number};
export function stepRigidDisc(state:RigidFlight,wind:V3,dt:number):
 {state:RigidFlight;telemetry:RigidTelemetry}{
 const h=clamp(Number.isFinite(dt)?dt:0,0,.016);
 if(h===0){
  return {state,telemetry:{angleOfAttackDegrees:0,liftNewtons:0,
   dragNewtons:0,precessionDegreesPerSecond:0,airspeed:0,spinRpm:state.spinRpm,
   nutationRadiansPerSecond:0,angularMomentum:length(state.rigid.momentum)}};
 }
 const p=state.model??DISC_GOLF_AERO_PROFILES[state.discStyle],area=pi*p.radius**2;
 const nsteps=Math.max(1,Math.ceil(h/.003));
 const sub=h/nsteps;
 let {velocity,rigid}=state;
 let tele:RigidTelemetry={angleOfAttackDegrees:0,liftNewtons:0,dragNewtons:0,
  precessionDegreesPerSecond:0,airspeed:0,spinRpm:state.spinRpm,
  nutationRadiansPerSecond:0,angularMomentum:0};
 const spinSign=state.releaseStyle==="forehand"?-1:1;
 for(let j=0;j<nsteps;j++){
  const air={x:velocity.x-wind.x,y:velocity.y-wind.y,z:velocity.z-wind.z};
  const speed=length(air);
  const n=discNormal(rigid);
  const wbody=bodyAngularVelocity(rigid,p);
  const rollRate=Math.hypot(wbody.x,wbody.z);
  const spin=wbody.y;
  const applied=length(air)>.15;
  let force={x:0,y:-p.mass*gravity,z:0};
  let torque={x:0,y:0,z:0};
  let lift=0,drag=0,alpha=0;
  if(applied){
   const direction=scale(air,1/speed);
   const alphaRad=Math.asin(clamp(-dot(n,direction),-1,1));
   alpha=alphaRad/rad;
   const co=discGolfModelCoefficients(p,alphaRad);
   const dynamic=.5*density*speed*speed;
   // Playable-flight tuning: retain angle-of-attack response, but avoid
   // the high-drag, negative-lift nose dive that kills ordinary releases.
   // This is an intentional arcade calibration, not measured disc data.
   lift=dynamic*area*Math.max(.16,co.cl);
   drag=dynamic*area*co.cd*.68;
   const lateral=add(n,scale(direction,-dot(n,direction)));
   const liftDirection=norm(lateral);
   // A little upright stability makes the path predictable without
   // removing player-controlled hyzer/anhyzer or gyroscopic precession.
   const uprightLift=add(scale(liftDirection,.82),{x:0,y:.18,z:0});
   force=add(force,add(scale(norm(uprightLift),lift),scale(direction,-drag)));
   // Pitch axis is transverse to the disc normal and incoming air.
   // Actual pressure-center moment, NOT an arbitrary sideways force.
   const axis=norm(cross(n,direction));
   const moment=dynamic*area*(2*p.radius)*co.cm;
   torque=scale(axis,moment);
  }
  // Small aerodynamic damping on transverse angular rate prevents an
  // infinitely undamped nutation mode, but is uncalibrated for each mold.
  const rotation=rigid.orientation;
  const transverseDamping=.00045;
  const dampedTorque=add(torque,rotateQuat(rotation,{
   x:-transverseDamping*wbody.x,
   y:-.12*p.spinInertia*wbody.y,
   z:-transverseDamping*wbody.z,
  }));
  const momentum=add(rigid.momentum,scale(dampedTorque,sub));
  const predicted={orientation:rigid.orientation,momentum};
  const omega=bodyAngularVelocity(predicted,p);
  // Quaternion exponential rotation is stable for high axial spin. Use the
  // current body-frame velocity with a small internal integration step.
  const omegaMagnitude=length(omega);
  const dq=omegaMagnitude>1e-9?
   axisQuat(scale(omega,1/omegaMagnitude),omegaMagnitude*sub):identity;
  const orientation=normalizeQuat(multiplyQuat(rigid.orientation,dq));
  rigid={orientation,momentum};
  velocity=add(velocity,scale(force,sub/p.mass));
  // Read axial RPM from the angular momentum along the disc normal, rather
  // than independently inventing a second angular velocity.
  const actualOmega=bodyAngularVelocity(rigid,p);
  tele={
   angleOfAttackDegrees:alpha,liftNewtons:lift,dragNewtons:drag,
   precessionDegreesPerSecond:spinSign*rollRate/rad,airspeed:speed,
   spinRpm:Math.abs(actualOmega.y)*30/pi,
   nutationRadiansPerSecond:Math.hypot(actualOmega.x,actualOmega.z),
   angularMomentum:length(rigid.momentum),
  };
 }
 const omega=bodyAngularVelocity(rigid,p);
 const spinRpm=Math.abs(omega.y)*30/pi;
 return {state:{...state,velocity,rigid,spinRpm},telemetry:{...tele,spinRpm}};
}
