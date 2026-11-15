import assert from "node:assert/strict";
import test from "node:test";
import {SkiV4Physics,SKI_V4_TUNING,NEUTRAL_V4_INPUT,solveSkiContact,
  type SkiV4Input,type Surface} from "../lib/world/ski/v4/core";

const dt=SKI_V4_TUNING.dt;
function ski(h:Surface=()=>0){
  const sim=new SkiV4Physics(h,0,0);
  sim.setHeading(0,1);sim.setHorizontalVelocity(0,5);
  return sim;
}
function drive(sim:SkiV4Physics,seconds:number,
  controls:Partial<SkiV4Input>|((tick:number,sim:SkiV4Physics)=>Partial<SkiV4Input>)){
  for(let tick=0;tick<Math.round(seconds/dt);tick++){
    const sample=typeof controls==="function"?controls(tick,sim):controls;
    sim.advance(dt,()=>({...NEUTRAL_V4_INPUT,...sample}));
  }
  return sim;
}
const speed=(sim:SkiV4Physics)=>Math.hypot(sim.velocity.x,sim.velocity.z);

test("V4 flat glide loses speed, and deliberate snowplow can bring skier to rest",()=>{
  const glide=drive(ski(),3,{}),brake=drive(ski(),3,{brake:1});
  assert.ok(speed(glide)<5&&speed(glide)>2);
  assert.ok(speed(brake)<.15);
  assert.ok(brake.position.z<glide.position.z*.6);
});
test("V4 downhill edging turns momentum uphill and slows versus straight descent",()=>{
  const h:Surface=(_x,z)=>-.12*z;
  const straight=drive(ski(h),6,{}),turn=drive(ski(h),6,{steer:.75});
  assert.ok(speed(straight)>7.5);
  assert.ok(speed(turn)<speed(straight)-1.2);
  assert.ok(turn.position.x>12&&turn.velocity.z<0);
  assert.ok(turn.telemetry.carveAcceleration>.1);
});
test("V4 equal and opposite edge inputs mirror paths without added propulsion",()=>{
  const left=drive(ski(),3,{steer:-.8}),right=drive(ski(),3,{steer:.8});
  assert.ok(left.position.x<0&&right.position.x>0);
  assert.ok(Math.abs(left.position.x+right.position.x)<1e-8);
  assert.ok(Math.abs(left.position.z-right.position.z)<1e-8);
  assert.ok(right.telemetry.carveAcceleration>0&&left.telemetry.carveAcceleration<0);
});
test("V4 progressive brake generates real dissipative snow resistance",()=>{
  const weak=drive(ski(),2,{brake:.35}),strong=drive(ski(),2,{brake:1});
  assert.ok(speed(strong)<speed(weak)-.8);
  assert.ok(strong.telemetry.skidDeceleration>weak.telemetry.skidDeceleration);
  assert.ok(strong.telemetry.powerToSnow>=0);
});
test("V4 left/right loaded patches sample exact snow and respect ski flex bounds",()=>{
  const h:Surface=(x,z)=>.14*x-.13*z;
  const a=solveSkiContact(h,{x:0,z:0},.5,.4,-1,.6);
  const b=solveSkiContact(h,{x:0,z:0},.5,.4,1,.4);
  assert.notEqual(a.boot.x,b.boot.x);
  for(const c of [a,b]){
    assert.equal(c.loaded,true);
    assert.ok(c.contactStations>=1);
    assert.ok(c.minGap>-.07);
    assert.ok(c.maxBend<=SKI_V4_TUNING.maxSoleFlex+1e-9);
    assert.ok(c.sections.every(p=>Number.isFinite(p.gap)));
  }
});
test("V4 physically brakes on a real steep grade rather than accelerating with S held",()=>{
  const slope:Surface=(_x,z)=>-.5*z;
  const straight=drive(ski(slope),2,{}),braked=drive(ski(slope),2,{brake:1});
  assert.ok(speed(straight)>10);
  assert.ok(speed(braked)<.5,`2s downhill speed after hard snowplow: ${speed(braked)}`);
  assert.ok(braked.position.z<straight.position.z*.5);
  assert.ok(braked.contact.every(c=>c.loaded));
  assert.ok(braked.brakeEngagement>.99);
  drive(braked,.5,{brake:0});
  assert.ok(braked.brakeEngagement<.01,"releasing S must release brake pressure");
});
test("V4 steer-plus-brake generates an uphill speed check on a very steep grade",()=>{
  const slope:Surface=(_x,z)=>-1.2*z;
  const straight=drive(ski(slope),2,{});
  const checked=drive(ski(slope),2,{steer:.8,brake:1});
  assert.ok(speed(straight)>11);
  assert.ok(speed(checked)<.5,`2s strong edge/snow check speed ${speed(checked)}`);
  assert.ok(checked.telemetry.powerToSnow>=0);
});

test("V4 fixed tick input replay is identical at 20/30/60/120 FPS and jitter",()=>{
  const samples:number[][]=[];
  for(const fps of [20,30,60,120]){
    const sim=ski((_,z)=>-.12*z);
    for(let i=0;i<fps*4;i++)sim.advance((i%2?.84:1.16)/fps,
      tick=>({...NEUTRAL_V4_INPUT,steer:tick<110?.7:tick<300?-.5:.4,brake:tick>250?.6:0}));
    samples.push([sim.tick,sim.position.x,sim.position.y,sim.position.z,
      sim.velocity.x,sim.velocity.z,sim.edgeAngle,sim.yaw]);
  }
  for(const sample of samples)assert.deepEqual(sample,samples[0]);
});
test("V4 only jumps on Space hold and release; touchdown returns to free skiing",()=>{
  const sim=ski();drive(sim,.35,{jump:true});
  assert.equal(sim.phase,"charging");
  drive(sim,dt,{jump:false});assert.equal(sim.phase,"air");
  drive(sim,2,{});
  assert.equal(sim.landing,"clean");assert.equal(sim.phase,"riding");
});
