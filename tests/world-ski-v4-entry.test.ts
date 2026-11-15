import assert from "node:assert/strict";
import test from "node:test";
import {activityLanding} from "../lib/world/activities";
import {MOUNTAIN_HALFPIPE,withinMountainHalfpipe} from "../lib/world/mountainHalfpipe";
test("Ski V4 selection starts on supported Granite Ridge snow while legacy start stays unchanged",()=>{
  const p=activityLanding("ski",true);
  assert.ok(p);
  assert.equal(p.x,MOUNTAIN_HALFPIPE.centerX);
  assert.equal(p.z,MOUNTAIN_HALFPIPE.startZ+2.5);
  assert.equal(withinMountainHalfpipe(p),true);
  const legacy=activityLanding("ski");
  assert.ok(legacy);
  assert.equal(legacy.z,MOUNTAIN_HALFPIPE.startZ+(process.env.NEXT_PUBLIC_SKI_V3==="1"?-.05:-1.65));
  assert.deepEqual(activityLanding("skate",true),activityLanding("skate"));
});
