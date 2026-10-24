import test from "node:test";
import assert from "node:assert/strict";
import {boundedWorldFrameDelta,rideCooldownReady} from "../lib/world/frameClock";
test("RAF timestamps never rewind authored stunt cooldowns",()=>{
 let elapsed=10,last=20000;
 for(const now of [18500,19500,20000,20017,20034,20500]){
  const dt=boundedWorldFrameDelta(now,last);
  assert.ok(dt>=0&&dt<=.5,"physics delta always finite and nonnegative");
  elapsed+=Math.min(dt,.05);
  assert.ok(elapsed>=10);
  last=now;
 }
 assert.equal(boundedWorldFrameDelta(NaN,1000),0);
 assert.equal(boundedWorldFrameDelta(1000,Infinity),0);
});
test("loop/tunnel gates recover from stale future clocks without disabling cooldowns",()=>{
 assert.equal(rideCooldownReady(10,-Infinity,.15),true);
 assert.equal(rideCooldownReady(10,11,.15),true);
 assert.equal(rideCooldownReady(10,9.95,.15),false);
 assert.equal(rideCooldownReady(10,9.84,.15),true);
 assert.equal(rideCooldownReady(NaN,2,.15),false);
});
