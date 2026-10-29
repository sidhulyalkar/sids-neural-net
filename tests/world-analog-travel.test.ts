import test from "node:test";
import assert from "node:assert/strict";
import {stepTravel,stepSwim,type Travel} from "../lib/world/activities";

const START:Travel = {point:{x:0,z:0},heading:{x:0,z:-1},speed:0};
function travelFrames(effort:number,frames=90):Travel {
  let travel=START;
  for(let i=0;i<frames;i++)travel=stepTravel(
    travel,{x:0,z:-effort},1/60,"run",[],false,null,0,()=>0);
  return travel;
}
function swimFrames(effort:number,frames=90):Travel {
  let travel=START;
  for(let i=0;i<frames;i++)travel=stepSwim(travel,{x:0,z:-effort},1/60);
  return travel;
}
test("analog land movement is slower at quarter than full deflection",()=>{
  const full=travelFrames(1),gentle=travelFrames(.25);
  assert.ok(full.speed>gentle.speed*2,JSON.stringify({full,gentle}));
  assert.ok(full.point.z<gentle.point.z);
  assert.ok(gentle.point.z<0);
});
test("swimming retains analog speed range",()=>{
  const full=swimFrames(1),gentle=swimFrames(.25);
  assert.ok(full.speed>gentle.speed*2,JSON.stringify({full,gentle}));
  assert.ok(full.point.z<gentle.point.z);
});
test("keyboard diagonal is clamped to full strength, not boosted",()=>{
  const straight=stepTravel(START,{x:0,z:-1},.05,"run",[],false,null,0,()=>0);
  const diagonal=stepTravel(START,{x:1,z:-1},.05,"run",[],false,null,0,()=>0);
  assert.ok(Math.abs(straight.speed-diagonal.speed)<1e-9);
});
test("neutral input brakes instead of latching motion",()=>{
  const cruising=travelFrames(1);
  const stopped=stepTravel(cruising,{x:0,z:0},.05,"run",[],false,null,0,()=>0);
  assert.ok(stopped.speed<cruising.speed);
});
