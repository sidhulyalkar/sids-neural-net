import assert from "node:assert/strict";
import test from "node:test";
import {SkiHalfpipeQualification,type HalfpipeSample}
  from "../lib/world/ski/halfpipeQualification";
import {SkiSimulation,neutral,tuning} from "../lib/world/ski/simulation";
import {createTrial} from "../app/dev/ski-lab/fiveCarve";
import {runEarlyEdge} from "../app/dev/ski-lab/earlyEdge";

const sample=(tick:number,x:number,z:number,vx:number,
  extras:Partial<HalfpipeSample>={}):HalfpipeSample=>
  ({tick,x,z,vx,speed:7,grounded:true,...extras});

test("halfpipe: two real alternating bank traversals, not scripted counters",()=>{
  const q=new SkiHalfpipeQualification();
  const frames=[
    sample(1,7,-55,2),
    sample(22,11.2,-52,2),
    sample(30,11.2,-51,-1), // same wall jitter does not double count
    sample(46,7,-49,-2),
    sample(68,2.8,-47,-2),
    sample(80,7,-45,2),
    sample(104,11,-43,2),
  ];
  for(const f of frames)q.observe(f);
  assert.equal(q.metrics.rightVisits,2);
  assert.equal(q.metrics.leftVisits,1);
  assert.equal(q.metrics.bankCrossings,2);
  assert.equal(q.metrics.lateralReversals,2);
});
test("halfpipe: no visit for off-face, flight, low speed or same bank",()=>{
  const q=new SkiHalfpipeQualification();
  [
    sample(1,7,-75,4),sample(20,11,-75,4),
    sample(25,7,-55,4,{grounded:false}),
    sample(45,11,-52,4,{grounded:false}),
    sample(60,7,-49,2,{speed:1}),
    sample(80,11,-48,2,{speed:1}),
  ].forEach(s=>q.observe(s));
  assert.equal(q.metrics.bankCrossings,0);
  assert.equal(q.metrics.leftVisits+q.metrics.rightVisits,0);
  q.observe(sample(100,7,-47,2));
  q.observe(sample(120,11.2,-46,2));
  q.observe(sample(140,7,-45,-2));
  q.observe(sample(155,11.2,-44,2));
  assert.equal(q.metrics.rightVisits,1);
  assert.equal(q.metrics.bankCrossings,0);
});
test("halfpipe: cannot count opposite bank without time and downhill travel",()=>{
  const q=new SkiHalfpipeQualification();
  q.observe(sample(1,7,-52,2));
  q.observe(sample(12,11,-50,2));
  q.observe(sample(13,7,-50,-2));
  q.observe(sample(17,3,-49.9,-2));
  assert.equal(q.metrics.bankCrossings,0);
  q.observe(sample(20,3,-49.5,-2));
  q.observe(sample(29,3,-48,-2));
  assert.equal(q.metrics.bankCrossings,0,"requires renewed center approach");
  q.observe(sample(30,7,-48,-2));
  q.observe(sample(42,3,-47,-2));
  assert.equal(q.metrics.bankCrossings,1);
});

test("fixed-step observation is identical at 20/30/60/120 FPS",()=>{
  const traces:string[][]=[];
  for(const fps of [20,30,60,120]){
    const sim=new SkiSimulation((_x,z)=>-.18*z,7,-55,"independent");
    sim.velocity.z=4;sim.setHeading(0,1);
    const observations:string[]=[];
    for(let frame=0;frame<fps*2;frame++)
      sim.advance(1/fps,tick=>({...neutral,steer:tick<95?1:-1}),s=>{
        observations.push([s.tick,s.position.x.toFixed(8),
          s.position.z.toFixed(8),s.velocity.x.toFixed(8),
          s.velocity.z.toFixed(8),s.phase].join(","));
      });
    assert.equal(sim.tick,240);
    assert.equal(observations.length,240);
    traces.push(observations);
  }
  for(const trace of traces.slice(1))assert.deepEqual(trace,traces[0]);
});
test("actual early-edge trial bank qualification is render-cadence invariant",()=>{
  const trial=runEarlyEdge(2);
  const outcomes=[];
  for(const fps of [20,30,60,120]){
    const sim=createTrial();
    const observed=new SkiHalfpipeQualification();
    let calls=0;
    for(let frame=0;sim.tick<trial.inputs.length;frame++){
      const dt=Math.min(1/fps,
        (trial.inputs.length-sim.tick)*tuning.dt-sim.remainder);
      sim.advance(dt,tick=>trial.inputs[tick]??neutral,s=>{
        calls++;
        observed.observe({tick:s.tick,x:s.position.x,z:s.position.z,
          vx:s.velocity.x,speed:Math.hypot(s.velocity.x,s.velocity.z),
          grounded:s.phase==="riding"&&s.contact.some(Boolean)});
      });
      assert.ok(frame<3600,"trial must not stall");
    }
    assert.equal(calls,trial.inputs.length);
    outcomes.push({...observed.metrics});
  }
  for(const value of outcomes.slice(1))assert.deepEqual(value,outcomes[0]);
  assert.ok(outcomes[0].bankCrossings<=trial.traversals,
    "qualification must never create extra bank crossings");
});
test("overloaded frames expose each executed tick without inventing elapsed physics",()=>{
  const sim=new SkiSimulation(()=>0,0,0);
  const ticks:number[]=[];
  sim.advance(.8,()=>neutral,s=>ticks.push(s.tick));
  assert.deepEqual(ticks,Array.from({length:30},(_,i)=>i+1));
  assert.ok(Math.abs(sim.droppedSeconds-.55)<1e-8);
});
