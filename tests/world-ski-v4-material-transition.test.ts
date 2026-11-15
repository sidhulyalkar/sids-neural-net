import assert from "node:assert/strict";
import test from "node:test";
import {SkiV4Physics,NEUTRAL_V4_INPUT,SKI_V4_TUNING,type SkiV4Input} from "../lib/world/ski/v4/core";

function run(sim:SkiV4Physics,seconds:number,input:Partial<SkiV4Input>){
  for(let t=0;t<Math.round(seconds/SKI_V4_TUNING.dt);t++)
    sim.advance(SKI_V4_TUNING.dt,()=>({...NEUTRAL_V4_INPUT,...input}));
  return sim;
}
const magnitude=(sim:SkiV4Physics)=>Math.hypot(sim.velocity.x,sim.velocity.z);
test("bare rock never creates ski-edge traction or snow work",()=>{
  const sim=new SkiV4Physics(()=>0,0,0,undefined,()=>0);
  sim.setHorizontalVelocity(0,5);sim.setHeading(0,1);
  run(sim,.6,{steer:1,brake:1});
  const p=sim.telemetry;
  assert.equal(p.surfaceMode,"ground");
  assert.equal(p.turnRegime,"ground");
  assert.equal(p.snowCoverage,0);
  assert.equal(p.carveAcceleration,0);
  assert.equal(p.contactCoverage,0);
  assert.equal(p.skidDeceleration,0);
  assert.equal(p.snowResistance,0);
  assert.equal(p.powerToSnow,0);
  assert.equal(sim.edgeAngle,0);
  assert.ok(sim.contact.every(c=>c.snowFraction===0&&c.snowLoad===0));
});
test("off-snow W/A/S/D uses directional walking without edging",()=>{
  const sim=new SkiV4Physics(()=>0,0,0,undefined,()=>0);
  run(sim,1,{pitch:1});
  const first=magnitude(sim);
  assert.ok(first>2.8&&first<3.5);
  run(sim,.65,{pitch:1,steer:1});
  assert.ok(sim.yaw>.4&&sim.position.x>.3);
  assert.equal(sim.telemetry.carveAcceleration,0);
  assert.ok(sim.telemetry.observedTurnRate!==0);
  run(sim,1,{pitch:-1});
  assert.ok(magnitude(sim)<3.6);
  assert.equal(sim.telemetry.snowCoverage,0);
});
test("crossing snow to bare ground retains momentum but retires ski edge",()=>{
  const coverage=(_x:number,z:number)=>z<1?1:0;
  const sim=new SkiV4Physics(()=>0,0,0,undefined,coverage);
  sim.setHorizontalVelocity(0,5);sim.setHeading(0,1);
  run(sim,.05,{steer:.75});
  assert.equal(sim.telemetry.surfaceMode,"snow");
  assert.ok(Math.abs(sim.telemetry.carveAcceleration)>0);
  const previous={...sim.position};
  let transitioned=false;
  for(let i=0;i<180;i++){
    sim.advance(SKI_V4_TUNING.dt,()=>({...NEUTRAL_V4_INPUT,pitch:0,steer:0}));
    if(sim.telemetry.surfaceMode==="ground"){transitioned=true;break;}
  }
  assert.ok(transitioned,"must leave snow without a forced teleport");
  assert.ok(Math.hypot(sim.position.x-previous.x,sim.position.z-previous.z)<8);
  run(sim,.5,{steer:1,pitch:1});
  assert.equal(sim.telemetry.carveAcceleration,0);
  assert.equal(sim.telemetry.snowResistance,0);
  assert.equal(sim.telemetry.turnRegime,"ground");
});
test("mixed ground lowers snow-edge traction compared with an identical snow slope",()=>{
  const full=new SkiV4Physics(()=>0,0,0,undefined,()=>1);
  const mixed=new SkiV4Physics(()=>0,0,0,undefined,()=>.5);
  for(const x of [full,mixed]){x.setHorizontalVelocity(0,5);x.setHeading(0,1);}
  run(full,.35,{steer:.6});run(mixed,.35,{steer:.6});
  assert.equal(full.telemetry.surfaceMode,"snow");
  assert.equal(mixed.telemetry.surfaceMode,"mixed");
  assert.ok(mixed.telemetry.contactCoverage<full.telemetry.contactCoverage);
  assert.ok(mixed.telemetry.snowCoverage>.45&&mixed.telemetry.snowCoverage<.55);
  assert.ok(Math.abs(mixed.telemetry.carveAcceleration)<Math.abs(full.telemetry.carveAcceleration));
});
test("same slope height but no painted snow means no carving",()=>{
  const height=(_x:number,z:number)=>-.15*z;
  const snowy=new SkiV4Physics(height,0,0,undefined,()=>1);
  const bare=new SkiV4Physics(height,0,0,undefined,()=>0);
  for(const x of [snowy,bare]){x.setHorizontalVelocity(0,4);x.setHeading(0,1);}
  run(snowy,.5,{steer:.7});run(bare,.5,{steer:.7});
  assert.ok(Math.abs(snowy.telemetry.carveAcceleration)>0);
  assert.equal(bare.telemetry.carveAcceleration,0);
  assert.ok(Math.abs(snowy.telemetry.gravityAcceleration.z)>0);
  assert.equal(bare.telemetry.snowResistance,0);
});
