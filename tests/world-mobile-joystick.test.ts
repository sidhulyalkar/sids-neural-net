import test from "node:test";
import assert from "node:assert/strict";
import {sampleMobileJoystick} from "../lib/world/mobileJoystick";

test("neutral and dead-zone jitter produce zero input",()=>{
  assert.deepEqual(sampleMobileJoystick(50,50,50,50,50),{x:0,y:0});
  assert.deepEqual(sampleMobileJoystick(54,52,50,50,50),{x:0,y:0});
});
test("cardinal forward, back and lateral directions preserve signs",()=>{
  assert.deepEqual(sampleMobileJoystick(50,0,50,50,50),{x:0,y:1});
  assert.deepEqual(sampleMobileJoystick(50,100,50,50,50),{x:0,y:-1});
  assert.deepEqual(sampleMobileJoystick(100,50,50,50,50),{x:1,y:0});
  assert.deepEqual(sampleMobileJoystick(0,50,50,50,50),{x:-1,y:0});
});
test("diagonals and out-of-bounds drags stay inside the unit circle",()=>{
  for(const [x,y] of [[100,0],[300,-200]]){
    const value=sampleMobileJoystick(x,y,50,50,50);
    assert.ok(Math.abs(Math.hypot(value.x,value.y)-1)<1e-12);
    assert.ok(value.x>0&&value.y>0);
  }
});
test("dead-zone transition is smooth and invalid coordinates are safe",()=>{
  assert.equal(sampleMobileJoystick(56.5,50,50,50,50).x,0);
  assert.ok(sampleMobileJoystick(57,50,50,50,50).x<.03);
  assert.deepEqual(sampleMobileJoystick(90,50,50,50,0),{x:0,y:0});
  assert.deepEqual(sampleMobileJoystick(NaN,50,50,50,50),{x:0,y:0});
});
