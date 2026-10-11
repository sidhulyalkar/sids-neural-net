import assert from "node:assert/strict";
import test from "node:test";
import {clampDiscGolfRail,discGolfRailPower,
 discGolfRailIdeal,discGolfRailStatus} from "../lib/world/discGolfPowerRail";
import {discGolfPullback} from "../lib/world/discGolf";
test("the launch rail maps touch, stylus and mouse positions to the same power",()=>{
 assert.equal(discGolfRailPower(100,100,250),4);
 assert.equal(discGolfRailPower(225,100,250),50);
 assert.equal(discGolfRailPower(350,100,250),100);
 assert.equal(discGolfRailPower(0,100,250),4);
 assert.equal(discGolfRailPower(500,100,250),100);
 assert.equal(discGolfRailPower(225,100,0),4);
 assert.equal(discGolfRailPower(NaN,100,250),4);
 assert.equal(discGolfRailPower(225,100,Infinity),4);
});
test("ideal target stays visible at both rail endpoints",()=>{
 assert.deepEqual(discGolfRailIdeal(4),{ideal:4,low:4,high:10});
 assert.deepEqual(discGolfRailIdeal(99),{ideal:99,low:93,high:100});
 assert.deepEqual(discGolfRailIdeal(75),{ideal:75,low:69,high:81});
 for(let p=4;p<=100;p++){
  const t=discGolfRailIdeal(p);
  assert.ok(t.low<=t.ideal&&t.ideal<=t.high);
  assert.ok(t.low>=4&&t.high<=100);
 }
});
test("release feedback compares the chosen launch, not the animation frame",()=>{
 assert.equal(discGolfRailStatus(70,76),"in-zone");
 assert.equal(discGolfRailStatus(83,76),"near");
 assert.equal(discGolfRailStatus(15,76),"outside");
 assert.equal(clampDiscGolfRail(120),100);
 assert.equal(clampDiscGolfRail(-40),4);
});
test("existing Space tap and held windup remain the source of truth",()=>{
 const recommended=73;
 assert.equal(discGolfPullback(80,recommended).power,recommended);
 assert.equal(discGolfPullback(239,recommended).power,recommended);
 assert.ok(discGolfPullback(700,recommended).manual);
 assert.ok(discGolfPullback(700,recommended).power>=4);
 assert.ok(discGolfPullback(700,recommended).power<=100);
});
