import assert from "node:assert/strict";
import test from "node:test";
import {worldFrameDelta} from "../lib/world/frameTiming";

test("startup, resume, and stalled frames cannot extrapolate camera or reverse physics",()=>{
 for(const raw of [-12,-.016,0,.008,.016,.05,3,NaN,Infinity]){
  const dt=worldFrameDelta(raw),alpha=1-Math.exp(-dt*3.6);
  assert.ok(dt>=0&&dt<=.05);
  assert.ok(alpha>=0&&alpha<1);
  const position=42+(7-42)*alpha;
  assert.ok(position>=7&&position<=42);
 }
 assert.equal(worldFrameDelta(1/60),1/60);
});
