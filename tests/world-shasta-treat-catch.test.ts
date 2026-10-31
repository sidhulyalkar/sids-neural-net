import test from "node:test";
import assert from "node:assert/strict";
import {
 makeTreatFlight,sampleTreatFlight,treatWithinMouth,scoreTreatFlight,
 planTreatCatchGoal,descendingTreatTime,stepTreatFlight,
 type TreatVector,
} from "../lib/world/shastaTreatCatch";

const player={x:0,z:0};
const flat=()=>0;
const close=(a:number,b:number,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
test("the elevated cinematic arc is deterministic, symmetric and reaches the floor",()=>{
 for(const power of [20,65,100]){
  const f=makeTreatFlight(player,{x:18,z:0},0,power,0);
  assert.deepEqual(f,makeTreatFlight(player,{x:18,z:0},0,power,0));
  const mid=sampleTreatFlight(f,f.duration/2);
  const end=sampleTreatFlight(f,f.duration);
  close(sampleTreatFlight(f,0).y,1.55);
  close(end.y,.35);close(end.x,f.landing.x);
  close(mid.y,(1.55+.35)/2+f.arcLift);
  assert.ok(mid.y>6,"treat must clear a deliberately tall, readable arc");
  assert.ok(f.duration>1.8&&f.duration<3.3);
 }
 const left=makeTreatFlight(player,{x:18,z:0},0,70,-35);
 const right=makeTreatFlight(player,{x:18,z:0},0,70,35);
 close(left.landing.x,right.landing.x);close(left.landing.z,-right.landing.z);
});
test("power, angle, and zero-separation inputs never produce unstable flight",()=>{
 for(const input of [-Infinity,NaN,-50,20,65,100,1e9,Infinity]){
  const f=makeTreatFlight(player,player,-4,input,input);
  assert.ok(Number.isFinite(f.velocity.x)&&Number.isFinite(f.velocity.y));
  assert.ok(Number.isFinite(f.velocity.z)&&Number.isFinite(f.duration));
  assert.ok(f.power>=20&&f.power<=100);
  assert.ok(f.angle>=-35&&f.angle<=35);
  close(sampleTreatFlight(f,f.duration).y,-3.65);
 }
});
test("catch goal aligns muzzle with the descending height from either direction",()=>{
 const f=makeTreatFlight(player,{x:30,z:0},0,100,0);
 const t=descendingTreatTime(f,1.267);
 const p=sampleTreatFlight(f,t);
 close(p.y,1.267,1e-6);
 assert.ok(t>f.duration*.55);
 const fromBehind=planTreatCatchGoal(f,{x:0,z:0},1.267);
 const fromAhead=planTreatCatchGoal(f,{x:80,z:0},1.267);
 close(fromBehind.x+1.16,p.x);close(fromAhead.x-1.16,p.x);
 assert.ok(Number.isFinite(planTreatCatchGoal(f,player,999).x));
});
test("swept collision catches a midair treat missed by sparse frames",()=>{
 const f=makeTreatFlight(player,{x:24,z:0},0,70,0);
 const t=descendingTreatTime(f,1.3);
 const at=sampleTreatFlight(f,t);
 const mouth:TreatVector={x:at.x,y:1.3,z:at.z};
 const result=stepTreatFlight(f,t-.24,t+.24,mouth,mouth,flat);
 assert.equal(result.kind,"caught");
 const miss=stepTreatFlight(f,t-.24,t+.24,
  {...mouth,x:mouth.x+5},{...mouth,x:mouth.x+5},flat);
 assert.notEqual(miss.kind,"caught");
 assert.equal(treatWithinMouth(f,t,{x:at.x,z:at.z},1.3),true);
 assert.equal(treatWithinMouth(f,.01,{x:at.x,z:at.z},1.3),false);
});
test("ground, cliff, frame hitch, timeout and invalid intervals never award false catches",()=>{
 const f=makeTreatFlight(player,{x:20,z:0},0,65,0);
 const low={x:500,y:1.3,z:500};
 const collision=stepTreatFlight(f,0,f.duration,low,low,()=>100);
 assert.equal(collision.kind,"terrain");
 assert.equal(scoreTreatFlight(f,collision.time,false,"terrain").score,0);
 const ended=stepTreatFlight(f,f.duration-.25,1000,low,low,flat);
 assert.equal(ended.kind,"landed");
 const zero=stepTreatFlight(f,-100,0,low,low,flat);
 assert.equal(zero.kind,"flying");
 assert.equal(scoreTreatFlight(f,0,false,"interrupted").label,"Throw interrupted");
 assert.equal(scoreTreatFlight(f,0,false,"unsafe").score,0);
});
test("one moving muzzle may catch; huge spatial jumps cannot score via timing alone",()=>{
 const f=makeTreatFlight(player,{x:25,z:0},0,100,12);
 const t=descendingTreatTime(f,1.25),p=sampleTreatFlight(f,t);
 const end:TreatVector={x:p.x,y:p.y,z:p.z};
 const a:TreatVector={x:p.x-1,y:p.y,z:p.z};
 assert.equal(stepTreatFlight(f,t-.1,t+.05,a,end,flat).kind,"caught");
 assert.notEqual(stepTreatFlight(f,t-.1,t+.05,
  {x:p.x+30,y:p.y,z:p.z},{x:p.x+30,y:p.y,z:p.z},flat).kind,"caught");
});
test("successful long angled catches get more points than short catches; misses never score",()=>{
 const short=makeTreatFlight(player,{x:10,z:0},0,20,0);
 const long=makeTreatFlight(player,{x:30,z:0},0,100,20);
 assert.ok(scoreTreatFlight(long,long.duration,true).score>
   scoreTreatFlight(short,short.duration,true).score);
 assert.equal(scoreTreatFlight(long,long.duration,true).label,"Long-range trickshot");
 assert.equal(scoreTreatFlight(long,long.duration,false).score,0);
});
