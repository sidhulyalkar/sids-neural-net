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
test("V4 low-speed steering redirects true velocity uphill and reduces speed",()=>{
  const h:Surface=(_x,z)=>-.12*z;
  const first=drive(ski(h),2,{steer:.75});
  assert.ok(first.velocity.z<-.15,"snow-edge force must bend velocity uphill");
  const straight=drive(ski(h),6,{}),turn=drive(ski(h),6,{steer:.75});
  assert.ok(speed(straight)>3&&speed(straight)<6);
  assert.ok(speed(turn)<speed(straight)-1);
  assert.ok(turn.position.x>6);
  assert.ok(turn.telemetry.carveAcceleration>.1);
});
test("V4 starts planted at activity entry, then launches when W is pressed",()=>{
  const sim=new SkiV4Physics((_x,z)=>-.5*z,0,0);
  drive(sim,5,{});
  assert.equal(sim.awaitingStart,true);
  assert.equal(speed(sim),0);
  assert.equal(sim.position.z,0);
  drive(sim,1,{tuck:true});
  assert.equal(sim.awaitingStart,false);
  assert.ok(sim.position.z>1&&speed(sim)>2);
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
  assert.ok(speed(straight)>6,"descending grade must accelerate without braking");
  assert.ok(speed(braked)<.5&&speed(braked)<speed(straight)*.1,`2s downhill speed after hard snowplow: ${speed(braked)}`);
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
  assert.ok(speed(straight)>7,"steep grade still accelerates the skier");
  assert.ok(speed(checked)<.5&&speed(checked)<speed(straight)*.1,`2s strong edge/snow check speed ${speed(checked)}`);
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

test("a real low-slip V4 carve preserves loaded edge contact and measures path curvature",()=>{
  const sim=drive(ski(),1.5,{steer:.75});
  const t=sim.telemetry;
  assert.equal(t.turnRegime,"carve");
  assert.ok(Math.abs(t.actualSlipRadians)<.10,
    "Carving should not label a 10+ degree side-slip as clean");
  assert.ok(t.contactCoverage>.65);
  assert.ok(t.carveQuality>.75);
  assert.ok(t.observedTurnRate>.05&&t.observedTurnRadius!==null);
  assert.ok(sim.position.x>1.5);
  assert.ok(sim.contact[0].load>sim.contact[1].load,
    "A right-hand carve should load the outside (left) ski more");
});
test("high velocity-relative attack skids instead of inventing carved force",()=>{
  const sim=ski();sim.setHeading(1,0);
  drive(sim,.05,{steer:.9});
  assert.ok(Math.abs(sim.telemetry.actualSlipRadians)>.5);
  assert.ok(sim.telemetry.carveQuality===0);
  assert.ok(sim.telemetry.carveAcceleration===0);
  assert.equal(sim.telemetry.turnRegime,"skid");
});
test("unsupported ski bindings cannot produce edge traction or claim a carve",()=>{
  const sim=new SkiV4Physics((x,z)=>5*Math.abs(x)-.12*z,0,0);
  sim.setHeading(1,0);sim.setHorizontalVelocity(5,0);
  drive(sim,dt,{steer:1});
  assert.equal(sim.contact[0].loaded,false);
  assert.equal(sim.contact[1].loaded,false);
  assert.equal(sim.telemetry.contactCoverage,0);
  assert.equal(sim.telemetry.carveAcceleration,0);
  assert.equal(sim.telemetry.turnRegime,"unsupported");
  // An unsupported grounded state is a separate remaining design defect.
  assert.equal(sim.phase,"riding");
});
test("edge-only turns never create kinetic energy on level snow",()=>{
  const sim=ski();
  let previous=speed(sim);
  for(let i=0;i<500;i++){
    drive(sim,dt,{steer:.85,brake:0});
    const current=speed(sim);
    assert.ok(current<=previous+1e-8,"Centripetal force must redirect, not accelerate");
    previous=current;
  }
});
test("edge-to-edge reversals are slew-limited and progress through neutral",()=>{
  const sim=ski();drive(sim,.5,{steer:.9});
  assert.ok(sim.edgeAngle>.65);
  const history:number[]=[];
  for(let i=0;i<70;i++){
    drive(sim,dt,{steer:-.9});
    history.push(sim.edgeAngle);
  }
  assert.ok(history[0]>0);
  assert.ok(history.some(x=>Math.abs(x)<.05));
  assert.ok(history.at(-1)!<-.65);
  for(let i=1;i<history.length;i++)
    assert.ok(Math.abs(history[i]-history[i-1])<=SKI_V4_TUNING.edgeRise*dt+1e-7);
});
test("a deliberate snowplow is classified as skid rather than clean carving",()=>{
  const sim=drive(ski(),.8,{steer:.6,brake:1});
  assert.equal(sim.telemetry.turnRegime,"skid");
  assert.ok(sim.telemetry.skidDeceleration>0);
  assert.ok(sim.brakeEngagement>.95);
});
