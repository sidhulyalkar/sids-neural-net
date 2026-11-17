import assert from "node:assert/strict";
import test from "node:test";
import {advanceWinter,INITIAL_WINTER_STATE,winterNeedsResources} from "../lib/world/ski/winterState";

test("normal world requires no winter resources",()=>{
  assert.equal(INITIAL_WINTER_STATE.blend,0);
  assert.equal(winterNeedsResources(INITIAL_WINTER_STATE),false);
  assert.deepEqual(advanceWinter(INITIAL_WINTER_STATE,1,false,true),INITIAL_WINTER_STATE);
});
test("ski selection causes a finite, clamped arrival",()=>{
  let state=INITIAL_WINTER_STATE;
  for(let i=0;i<30;i++)state=advanceWinter(state,.1,true,true);
  assert.equal(state.phase,"winter");
  assert.equal(state.blend,1);
  assert.equal(winterNeedsResources(state),true);
});
test("rapid mode changes resume from current snow coverage, without a jump",()=>{
  const a=advanceWinter(INITIAL_WINTER_STATE,.25,true,true);
  const b=advanceWinter(a,.2,false,true);
  const c=advanceWinter(b,.1,true,true);
  assert.ok(b.blend<a.blend);
  assert.ok(c.blend>b.blend);
  assert.ok(c.blend<1);
});
test("midair exit retains winter support until landing",()=>{
  const full={phase:"winter" as const,blend:1};
  const protectedExit=advanceWinter(full,.2,false,false);
  assert.deepEqual(protectedExit,full);
  const landed=advanceWinter(protectedExit,.2,false,true);
  assert.equal(landed.phase,"departing");
  assert.ok(landed.blend<1&&landed.blend>0);
});
test("winter never leaks after safe restoration",()=>{
  let state={phase:"winter" as const,blend:1};
  for(let i=0;i<30;i++)state=advanceWinter(state,.1,false,true);
  assert.equal(state.phase,"normal");
  assert.equal(state.blend,0);
  assert.equal(winterNeedsResources(state),false);
});
test("zero, invalid and huge dt cannot create an invalid state",()=>{
  for(const delta of [NaN,Infinity,-2,0,1e8]){
    const state=advanceWinter(INITIAL_WINTER_STATE,delta,true,true);
    assert.ok(state.blend>=0&&state.blend<=1);
  }
});
