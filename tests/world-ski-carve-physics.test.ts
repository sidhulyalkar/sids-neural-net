import assert from "node:assert/strict";
import test from "node:test";
import {SkiSimulation,SKI_CARVE_BASELINE,neutral,tuning} from "../lib/world/ski/simulation";

function snapshot(s:SkiSimulation){
 return [...s.position,...s.velocity,...s.rotation,...s.load,
   ...s.contact.map(Number),s.edge,s.grip,s.tick];
}
test("explicit baseline is identical to original Ski V3 at every physics tick",()=>{
 const height=(x:number,z:number)=>.15*x-.2*z;
 const original=new SkiSimulation(height,7,-57,"independent");
 const experimental=new SkiSimulation(height,7,-57,"independent",false,
   undefined,{...SKI_CARVE_BASELINE});
 original.velocity.set(4.5,0,3.5);experimental.velocity.copy(original.velocity);
 for(let tick=0;tick<1100;tick++){
  const input={...neutral,steer:Math.cos(tick/63),tuck:tick%80<40};
  original.advance(tuning.dt,()=>input);
  experimental.advance(tuning.dt,()=>input);
  assert.deepEqual(snapshot(experimental),snapshot(original),"tick "+tick);
 }
});
test("increased edge force never creates speed on level snow",()=>{
 for(const multiplier of [1,1.25,1.5,2]){
  const sim=new SkiSimulation(()=>0,0,0,"independent",false,
    undefined,{contactForceScale:multiplier,maxTurn:3.4,engagedGrip:9});
  sim.velocity.set(7,0,3);
  let previous=sim.velocity.length();
  for(let tick=0;tick<500;tick++){
   sim.advance(tuning.dt,()=>({...neutral,steer:tick<250?1:-1}));
   const speed=sim.velocity.length();
   assert.ok(speed<=previous+1e-8,"edge must dissipate, not power the rider");
   assert.ok(sim.position.toArray().every(Number.isFinite));
   assert.equal(sim.phase,"riding","unarmed level snow must not create air");
   previous=speed;
  }
 }
});
test("invalid experimental force and turn parameters fail closed",()=>{
 for(const bad of [{contactForceScale:Infinity},{contactForceScale:-1},
  {contactForceScale:4},{maxTurn:NaN},{drag:-.05},
  {surfaceTransport:-.1},{surfaceTransport:1.1},{surfaceTransport:Infinity},
  {carveRedirect:-.1},{carveRedirect:1.01},{carveRedirect:NaN}])
  assert.throws(()=>new SkiSimulation(()=>0,0,0,false,false,undefined,bad));
});

test("curved-snow normal transport is finite and cannot exceed gravity impulse",()=>{
 for(const fraction of [0,.5,1]){
  const height=(x:number,z:number)=>1.6*Math.sin(x/4)+.04*z;
  const sim=new SkiSimulation(height,0,0,"independent",false,
    undefined,{surfaceTransport:fraction});
  sim.velocity.set(5,0,4);
  for(let tick=0;tick<700;tick++){
   const before=sim.velocity.length();
   sim.advance(tuning.dt,()=>({...neutral,steer:Math.sin(tick/70)}));
   assert.ok(sim.velocity.length()<=before+tuning.gravity*tuning.dt+1e-6,
     "contact curvature cannot add kinetic impulse beyond gravity");
   assert.ok(sim.velocity.toArray().every(Number.isFinite));
   assert.ok(sim.position.toArray().every(Number.isFinite));
  }
 }
});

test("bounded edge redirection conserves speed but retains more momentum than braking",()=>{
 const baseline=new SkiSimulation(()=>0,0,0,"independent");
 const redirect=new SkiSimulation(()=>0,0,0,"independent",false,
   undefined,{carveRedirect:1});
 baseline.velocity.set(6,0,3);
 redirect.velocity.copy(baseline.velocity);
 let originalSpeed=baseline.velocity.length();
 let sawLessDissipation=false;
 for(let tick=0;tick<600;tick++){
  const input={...neutral,steer:tick%160<80?1:-1};
  baseline.advance(tuning.dt,()=>input);
  const beforeRedirect=redirect.velocity.length();
  redirect.advance(tuning.dt,()=>input);
  const now=redirect.velocity.length();
  assert.ok(now<=beforeRedirect+1e-8,
    "redirection may preserve lateral energy but cannot add it");
  assert.ok(now<=originalSpeed+1e-8,"no perpetual boost on flat snow");
  assert.ok(redirect.position.toArray().every(Number.isFinite));
  if(now>baseline.velocity.length()+.0001)sawLessDissipation=true;
 }
 assert.ok(sawLessDissipation,
   "redirected edge impulse should retain forward momentum relative to baseline");
});
