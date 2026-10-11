/** Reduced-order spinning-disc flight model. SI-like world scales:
 * one world unit ~= 1 m; mass 175 g; wind and launch in m/s.
 *
 * It is NOT a measured 6-DOF rigid-body model. The disc is assumed to
 * remain in coordinated forward flight with its yaw following airspeed;
 * its normal is determined by pitch (nose) and gyroscopic roll.
 *
 * Crucial: spin does not create an arbitrary horizontal "Magnus boost".
 * Airflow across the disc supplies lift; spin stabilizes the pitch/roll
 * through angular momentum and aerodynamic pitching moment. Aerodynamic
 * coefficients are configurable hypotheses, NOT measured manufacturer data.
 */
export type DiscGolfFlightStyle="putter"|"midrange"|"fairway"|"driver";
export type DiscGolfReleaseStyle="backhand"|"forehand";
export type AeroVector={x:number;y:number;z:number};
export type AeroDisc={
 mass:number;radius:number;lift0:number;liftSlope:number;
 drag0:number;dragSlope:number;trimAoA:number;
 moment0:number;momentSlope:number;spinInertia:number;
};
export const DISC_GOLF_AERO_PROFILES:Record<DiscGolfFlightStyle,AeroDisc>={
 putter:{mass:.175,radius:.109,lift0:.23,liftSlope:2.55,drag0:.115,
  dragSlope:2.6,trimAoA:-.025,moment0:-.005,momentSlope:.065,spinInertia:.00105},
 midrange:{mass:.175,radius:.108,lift0:.21,liftSlope:2.7,drag0:.095,
  dragSlope:2.9,trimAoA:-.04,moment0:-.009,momentSlope:.065,spinInertia:.00102},
 fairway:{mass:.175,radius:.107,lift0:.195,liftSlope:2.85,drag0:.082,
  dragSlope:3,trimAoA:-.05,moment0:-.013,momentSlope:.065,spinInertia:.001},
 driver:{mass:.175,radius:.106,lift0:.18,liftSlope:2.95,drag0:.074,
  dragSlope:3.15,trimAoA:-.06,moment0:-.018,momentSlope:.07,spinInertia:.00098},
};
export const DISC_GOLF_SPIN_MIN_RPM=200;
export const DISC_GOLF_SPIN_MAX_RPM=1100;
export const DISC_GOLF_NOSE_MAX_DEGREES=15;
export type AeroState={
 velocity:AeroVector; pitchDegrees:number;rollDegrees:number;
 spinRpm:number;releaseStyle:DiscGolfReleaseStyle;discStyle:DiscGolfFlightStyle;
};
export type AeroTelemetry={
 angleOfAttackDegrees:number;liftNewtons:number;dragNewtons:number;
 precessionDegreesPerSecond:number;airspeed:number;spinRpm:number;
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const rad=Math.PI/180;
const density=1.225;
const gravity=10.8; // Matches existing island gravity units.
export function discGolfAeroCoefficients(style:DiscGolfFlightStyle,alphaRad:number){
 const d=DISC_GOLF_AERO_PROFILES[style];
 const alpha=clamp(alphaRad,-.46,.52);
 return {
  cl:clamp(d.lift0+d.liftSlope*alpha,-.19,1.15),
  cd:clamp(d.drag0+d.dragSlope*(alpha-d.trimAoA)**2,.055,1.2),
  cm:clamp(d.moment0+d.momentSlope*alpha,-.065,.065),
 };
}
/** One bounded integration substep. Exactly the same function runs in preview
 * and live flight. Low-speed fallback prevents singular angular momentum. */
export function stepDiscGolfAero(
 state:AeroState,wind:{x:number;z:number},dt:number,
):{state:AeroState;telemetry:AeroTelemetry}{
 const h=clamp(Number.isFinite(dt)?dt:0,0,.016);
 const vx=state.velocity.x-wind.x,vy=state.velocity.y,
  vz=state.velocity.z-wind.z;
 const airspeed=Math.hypot(vx,vy,vz);
 const planar=Math.hypot(vx,vz);
 if(airspeed<.15||planar<.12||h===0)
  return {state,telemetry:{angleOfAttackDegrees:0,liftNewtons:0,
   dragNewtons:0,precessionDegreesPerSecond:0,airspeed,spinRpm:state.spinRpm}};
 const fx=vx/planar,fz=vz/planar;
 const pitch=clamp(state.pitchDegrees,-45,65)*rad;
 const roll=clamp(state.rollDegrees,-70,70)*rad;
 // Horizontal right vector = (fz, 0, -fx). Tilted normal:
 const nx=-fx*Math.sin(pitch)*Math.cos(roll)+fz*Math.sin(roll);
 const ny=Math.cos(pitch)*Math.cos(roll);
 const nz=-fz*Math.sin(pitch)*Math.cos(roll)-fx*Math.sin(roll);
 const ax=vx/airspeed,ay=vy/airspeed,az=vz/airspeed;
 const dot=clamp(nx*ax+ny*ay+nz*az,-1,1);
 const alpha=Math.asin(-dot); // positive when nose is above relative flow.
 const profile=DISC_GOLF_AERO_PROFILES[state.discStyle];
 const co=discGolfAeroCoefficients(state.discStyle,alpha);
 const area=Math.PI*profile.radius**2,q=.5*density*airspeed**2;
 const lift=q*area*co.cl,drag=q*area*co.cd;
 // Lift is perpendicular to the AIR-relative velocity, not ground travel.
 const npx=nx-dot*ax,npy=ny-dot*ay,npz=nz-dot*az;
 const inv=1/Math.max(.01,Math.hypot(npx,npy,npz));
 const liftAx=lift*npx*inv/profile.mass;
 const liftAy=lift*npy*inv/profile.mass;
 const liftAz=lift*npz*inv/profile.mass;
 const resistance=drag/profile.mass;
 const velocity={
  x:state.velocity.x+(liftAx-resistance*ax)*h,
  y:state.velocity.y+(liftAy-resistance*ay-gravity)*h,
  z:state.velocity.z+(liftAz-resistance*az)*h,
 };
 // Pitch moment about the transverse body axis produces roll by gyroscopic
 // precession. Sign is reversed by the rotational sense of a forehand throw.
 // Moment scale is a tunable reduced-order coupling, not a 6-DOF fit.
 const angularSpeed=Math.max(10,state.spinRpm)*Math.PI/30;
 const torque=q*area*(2*profile.radius)*co.cm;
 const sense=state.releaseStyle==="forehand"?-1:1;
 const rollRate=clamp(-sense*.24*torque/
  Math.max(.014,profile.spinInertia*angularSpeed),-.55,.55);
 const rollDegrees=clamp(state.rollDegrees+rollRate*h/rad,-65,65);
 const spinRpm=Math.max(0,state.spinRpm*Math.exp(-.12*h));
 return {
  state:{...state,velocity,rollDegrees,spinRpm},
  telemetry:{angleOfAttackDegrees:alpha/rad,liftNewtons:lift,
   dragNewtons:drag,precessionDegreesPerSecond:rollRate/rad,
   airspeed,spinRpm},
 };
}
