import test from "node:test";
import assert from "node:assert/strict";
import {makeTreatFlight,sampleTreatFlight,treatWithinMouth,scoreTreatFlight,planTreatCatchGoal} from "../lib/world/shastaTreatCatch";
test("flight arc deterministic and bounded",()=>{
 const a=makeTreatFlight({x:0,z:0},{x:12,z:0},0,70,0);
 assert.deepEqual(a,makeTreatFlight({x:0,z:0},{x:12,z:0},0,70,0));
 assert.equal(sampleTreatFlight(a,0).y,1.55);
 assert.ok(sampleTreatFlight(a,a.duration/2).y>1.55);
 assert.ok(Math.abs(sampleTreatFlight(a,a.duration).x-a.landing.x)<1e-7);
 assert.ok(Math.abs(sampleTreatFlight(a,a.duration).y-.35)<1e-7);
 const b=makeTreatFlight({x:0,z:0},{x:0,z:0},0,999,999);
 assert.equal(b.power,100);assert.equal(b.angle,35);
});
test("mouth catches require a spatial intercept, not just a timed event",()=>{
 const f=makeTreatFlight({x:0,z:0},{x:12,z:0},0,70,0);
 const t=f.duration/2,p=sampleTreatFlight(f,t);
 assert.equal(treatWithinMouth(f,t,{x:p.x,z:p.z},p.y),true);
 assert.equal(treatWithinMouth(f,t,{x:p.x+5,z:p.z},p.y),false);
 assert.equal(treatWithinMouth(f,.02,{x:p.x,z:p.z},p.y),false);
 assert.equal(scoreTreatFlight(f,t,true).caught,true);
 assert.equal(scoreTreatFlight(f,t,false).score,0);
});
test("angle increases difficulty and long catches score more",()=>{
 const short=makeTreatFlight({x:0,z:0},{x:10,z:0},0,20,0);
 const long=makeTreatFlight({x:0,z:0},{x:25,z:0},0,100,20);
 assert.ok(scoreTreatFlight(long,long.duration,true).score>
   scoreTreatFlight(short,short.duration,true).score);
 assert.equal(scoreTreatFlight(long,long.duration,true).label,"Long-range trickshot");
});

test("pursuit aims root behind or ahead so muzzle reaches descending projectile",()=>{
 const f=makeTreatFlight({x:0,z:0},{x:18,z:0},0,70,0);
 const p=sampleTreatFlight(f,f.duration-.11);
 const fromBehind=planTreatCatchGoal(f,{x:0,z:0});
 const fromAhead=planTreatCatchGoal(f,{x:45,z:0});
 assert.ok(Math.abs(fromBehind.x+1.16-p.x)<1e-9);
 assert.ok(Math.abs(fromAhead.x-1.16-p.x)<1e-9);
 assert.ok(Math.abs(fromBehind.z)<1e-9);
});
