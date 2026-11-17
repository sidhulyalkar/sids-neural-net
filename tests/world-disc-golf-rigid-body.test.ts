import assert from "node:assert/strict";
import test from "node:test";
import {discInitialOrientation,initializeRigidDisc,
 stepRigidDisc,discNormal,dot,type RigidFlight} from "../lib/world/discGolfRigidBody";
import {discImpact,discGroundNormal,stepGroundSlide} from "../lib/world/discGolfGroundContact";
import {DISC_GOLF_AERO_PROFILES} from "../lib/world/discGolfAerodynamics";
import {discGolfThrow,startDiscGolf,stepDiscGolf,traceDiscGolfShot} from "../lib/world/discGolf";
const flat=()=>0,water=()=>false;
const shot={power:70,loft:23,accuracy:0,aimOffset:0};
test("disc rigid-body release has a normalized orientation and physical spin momentum",()=>{
 const q=discInitialOrientation(.5,18,25);
 assert.ok(Math.abs(Math.hypot(q.w,q.x,q.y,q.z)-1)<1e-12);
 const r=initializeRigidDisc(.5,18,25,700,"backhand","midrange");
 const n=discNormal(r);
 assert.ok(n.y>0&&Math.abs(Math.hypot(n.x,n.y,n.z)-1)<1e-9);
 const L=dot(n,r.momentum);
 const expected=DISC_GOLF_AERO_PROFILES.midrange.spinInertia*700*Math.PI/30;
 assert.ok(Math.abs(L-expected)<1e-9);
 const forehand=initializeRigidDisc(.5,18,25,700,"forehand","midrange");
 assert.ok(dot(n,forehand.momentum)<0);
});
test("six-DOF orientation, translational energy and spin remain bounded",()=>{
 let state:RigidFlight={velocity:{x:0,y:0,z:25},
  rigid:initializeRigidDisc(0,16,19,700,"backhand","fairway"),
  spinRpm:700,releaseStyle:"backhand" as const,discStyle:"fairway" as const};
 let firstLift=0,lastSpeed=25;
 for(let i=0;i<900;i++){
  const result=stepRigidDisc(state,{x:0,y:0,z:0},.0125);
  state=result.state;
  const q=state.rigid.orientation;
  assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-8);
  assert.ok([state.velocity.x,state.velocity.y,state.velocity.z,state.spinRpm,
   q.x,q.y,q.z,q.w].every(Number.isFinite));
  assert.ok(state.spinRpm<1150,"no unbounded spinning from torque");
  if(i===0)firstLift=result.telemetry.liftNewtons;
  lastSpeed=Math.hypot(state.velocity.x,state.velocity.z);
 }
 assert.ok(firstLift>0);
 assert.ok(lastSpeed<25,"drag slows horizontal speed");
 assert.ok(state.spinRpm<700,"spin-down must dissipate axial rotation");
});
test("banked releases follow different trajectories with quaternion spin",()=>{
 const init=startDiscGolf(0,flat);
 const a=traceDiscGolfShot(init,{...shot,bankAngle:-35},flat,water,-1.4);
 const b=traceDiscGolfShot(init,{...shot,bankAngle:35},flat,water,-1.4);
 assert.equal(a.outcome,"landed");
 assert.equal(b.outcome,"landed");
 assert.ok(Math.hypot(a.end.x-b.end.x,a.end.z-b.end.z)>2);
});
test("shallow level rim impacts skip, steep impacts slide and brake",()=>{
 const p={x:0,z:0};
 const flatHeight=()=>0;
 const flatRigid=initializeRigidDisc(0,0,0,750,"backhand","midrange");
 const skip=discImpact({x:0,y:-2,z:22},p,flatHeight,flatRigid,0);
 assert.equal(skip.contact.mode,"air");
 assert.ok(skip.velocity.y>0);
 assert.equal(skip.contact.impacts,1);
 const drop=discImpact({x:0,y:-9,z:4},p,flatHeight,flatRigid,0);
 assert.equal(drop.contact.mode,"slide");
 assert.ok(drop.velocity.z<4);
 const tilted=initializeRigidDisc(0,0,66,750,"backhand","midrange");
 const roll=discImpact({x:0,y:-4,z:12},p,flatHeight,tilted,0);
 assert.equal(roll.contact.mode,"roll");
 const rolling=stepGroundSlide(roll.position,roll.velocity,roll.contact,.05,flatHeight);
 assert.ok(Math.abs(rolling.contact.rollAngle??0)>0);
 assert.ok(Math.hypot(rolling.velocity.x,rolling.velocity.z)>0);
 const slider=stepGroundSlide(drop.position,
  {x:0,y:0,z:6},drop.contact,.05,flatHeight);
 assert.ok(slider.position.z>drop.position.z);
 assert.ok(slider.velocity.z<6);
});
test("slopes redirect skids downhill and water remains a free redo",()=>{
 const ramp=(p:{x:number;z:number})=>.15*p.x;
 const n=discGroundNormal({x:0,z:0},ramp);
 assert.ok(n.x<0&&n.y>.9);
 const state={mode:"slide" as const,impacts:1,elapsed:0};
 const step=stepGroundSlide({x:0,y:.16,z:0},{x:0,y:0,z:5},
  state,.05,ramp);
 assert.ok(step.velocity.x<0,"down-slope acceleration follows negative terrain gradient");
});
test("the rigid model and contact dynamics remain preview/live identical",()=>{
 const initial=startDiscGolf(1,flat,3.5);
 for(const bankAngle of [-20,0,20]){
  const input={...shot,bankAngle,spinRpm:850,noseAngle:3,
   discStyle:"driver" as const};
  const predicted=traceDiscGolfShot(initial,input,flat,water,-1.4);
  let live=discGolfThrow(initial,input,flat);
  for(let i=0;i<100&&live.phase==="flying";i++)
   live=stepDiscGolf(live,.1,flat,water,-1.4);
  assert.equal(live.phase,predicted.outcome);
  assert.equal(live.gatesCleared,predicted.gatesCleared);
  assert.ok(Math.hypot(live.disc.x-predicted.end.x,
   live.disc.z-predicted.end.z)<1e-7);
 }
});
