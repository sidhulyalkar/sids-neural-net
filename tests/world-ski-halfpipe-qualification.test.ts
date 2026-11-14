import assert from "node:assert/strict";
import test from "node:test";
import {SkiHalfpipeQualification,type HalfpipeSample}
  from "../lib/world/ski/halfpipeQualification";

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
  assert.equal(q.metrics.bankCrossings,0,"requires renewed center approach");
  q.observe(sample(30,7,-48,-2));
  q.observe(sample(42,3,-47,-2));
  assert.equal(q.metrics.bankCrossings,1);
});
