import assert from "node:assert/strict";
import test from "node:test";
import {
 DISC_GOLF_AERO_PROFILES,discGolfAeroCoefficients,stepDiscGolfAero,
} from "../lib/world/discGolfAerodynamics";
import {discGolfThrow,stepDiscGolf,traceDiscGolfShot,
 startDiscGolf} from "../lib/world/discGolf";
const flat=()=>0,water=()=>false;
test("physical air-relative force coefficients are finite, profile dependent and angle dependent",()=>{
 for(const style of ["putter","midrange","fairway","driver"] as const){
  const p=DISC_GOLF_AERO_PROFILES[style];
  assert.ok(p.mass>.1&&p.radius>.08&&p.radius<.15);
  const low=discGolfAeroCoefficients(style,-.1),high=discGolfAeroCoefficients(style,.18);
  assert.ok(high.cl>low.cl,"positive angle of attack increases lift");
  assert.ok(high.cm>low.cm,"pitch moment reverses as angle of attack rises");
  for(const alpha of [-.45,-.25,0,.15,.4]){
   const c=discGolfAeroCoefficients(style,alpha);
   assert.ok(Object.values(c).every(Number.isFinite));
   assert.ok(c.cd>0,"drag coefficient must stay positive");
  }
 }
 assert.notDeepEqual(discGolfAeroCoefficients("putter",0),
  discGolfAeroCoefficients("driver",0));
});
test("a pure lift force does not add energy; aerodynamic drag dissipates airspeed",()=>{
 const input={velocity:{x:0,y:0,z:20},pitchDegrees:0,rollDegrees:0,
  spinRpm:650,discStyle:"midrange" as const,releaseStyle:"backhand" as const};
 const step=stepDiscGolfAero(input,{x:0,z:0},.0125);
 assert.ok(step.telemetry.liftNewtons>0);
 assert.ok(step.telemetry.dragNewtons>0);
 assert.ok(step.state.velocity.z<20,"drag must slow forward speed");
 assert.ok(step.state.velocity.y>-10.8*.0125,
  "wing lift must counter some gravity");
 const windMatched=stepDiscGolfAero({...input,velocity:{x:2,y:0,z:3}},
  {x:2,z:3},.0125);
 assert.equal(windMatched.telemetry.liftNewtons,0,
  "no air-relative motion means no lift or drag");
});
test("a stronger flick increases angular momentum and resists precession",()=>{
 const base={velocity:{x:0,y:-2,z:21},pitchDegrees:8,rollDegrees:4,
  discStyle:"midrange" as const,releaseStyle:"backhand" as const};
 const low=stepDiscGolfAero({...base,spinRpm:250},{x:0,z:0},.0125);
 const high=stepDiscGolfAero({...base,spinRpm:1000},{x:0,z:0},.0125);
 assert.ok(Math.abs(low.telemetry.precessionDegreesPerSecond)>
  Math.abs(high.telemetry.precessionDegreesPerSecond)*1.5,
  "precession should decrease as gyroscopic angular momentum rises");
 assert.ok(low.state.spinRpm<250&&high.state.spinRpm<1000);
});
test("turn reverses into fade as attack angle passes the moment trim",()=>{
 const input={velocity:{x:0,y:0,z:20},pitchDegrees:0,rollDegrees:0,
  spinRpm:650,discStyle:"fairway" as const,releaseStyle:"backhand" as const};
 const early=stepDiscGolfAero({...input,pitchDegrees:0},{x:0,z:0},.0125);
 const late=stepDiscGolfAero({...input,pitchDegrees:18},{x:0,z:0},.0125);
 assert.ok(early.telemetry.precessionDegreesPerSecond>0);
 assert.ok(late.telemetry.precessionDegreesPerSecond<0,
  "higher angle of attack reverses pitching moment and bank precession");
 const forehand=stepDiscGolfAero({...input,releaseStyle:"forehand"},
  {x:0,z:0},.0125);
 assert.ok(forehand.telemetry.precessionDegreesPerSecond<0);
});
test("release nose and disc profile alter lift, spin flick and winding hand are stored",()=>{
 const a=startDiscGolf(0,flat);
 const shot={power:80,accuracy:0,loft:25,aimOffset:0,
  spinRpm:950,noseAngle:8,discStyle:"driver" as const,
  releaseStyle:"forehand" as const};
 const released=discGolfThrow(a,shot,flat);
 assert.equal(released.spinRpm,950);
 assert.equal(released.pitchDegrees,33);
 assert.equal(released.discStyle,"driver");
 assert.equal(released.releaseStyle,"forehand");
 const stepped=stepDiscGolf(released,.05,flat,water,-1.4);
 assert.ok(stepped.spinPhase<0,"forehand spins the rendered disc opposite to backhand");
 assert.ok(stepped.spinRpm<released.spinRpm);
 assert.ok(stepped.aero&&Number.isFinite(stepped.aero.angleOfAttackDegrees));
 const flatNose=traceDiscGolfShot(a,{...shot,noseAngle:0},flat,water,-1.4);
 const highNose=traceDiscGolfShot(a,shot,flat,water,-1.4);
 assert.ok(Math.hypot(flatNose.end.x-highNose.end.x,flatNose.end.z-highNose.end.z)>1,
  "nose attitude must materially change the landing");
 const mid=traceDiscGolfShot(a,{...shot,discStyle:"midrange"},flat,water,-1.4);
 assert.ok(Math.hypot(mid.end.x-highNose.end.x,mid.end.z-highNose.end.z)>.1);
});
test("preview and gameplay remain identical with spin, nose and chosen disc",()=>{
 const start=startDiscGolf(1,flat,3.2);
 for(const releaseStyle of ["backhand","forehand"] as const){
  for(const discStyle of ["putter","driver"] as const){
   const shot={power:73,accuracy:0,loft:26,aimOffset:0,
    spinRpm:700,noseAngle:2,bankAngle:10,releaseStyle,discStyle};
   const expected=traceDiscGolfShot(start,shot,flat,water,-1.4);
   let live=discGolfThrow(start,shot,flat);
   for(let i=0;i<90&&live.phase==="flying";i++)
    live=stepDiscGolf(live,.1,flat,water,-1.4);
   assert.equal(expected.outcome,live.phase);
   assert.equal(expected.gatesCleared,live.gatesCleared);
   assert.ok(Math.hypot(live.disc.x-expected.end.x,live.disc.z-expected.end.z)<1e-7);
  }
 }
});
