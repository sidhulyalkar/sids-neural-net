import assert from "node:assert/strict";
import test from "node:test";
import {auditDiscGolfFairways} from "../lib/world/discGolfFairway";
import {DISC_GOLF_HOLES} from "../lib/world/discGolf";
import {isWater} from "../lib/world/model";

test("nine fairway surveys preserve the course order and describe measured terrain",()=>{
 const audit=auditDiscGolfFairways();
 assert.equal(audit.length,9);
 assert.equal(new Set(audit.map(h=>h.id)).size,9);
 assert.deepEqual(audit,auditDiscGolfFairways(),"the fairway survey must be reproducible");
 for(let i=0;i<audit.length;i++){
  const h=audit[i];
  assert.equal(h.id,DISC_GOLF_HOLES[i].id);
  assert.equal(h.hole,i+1);
  assert.ok(h.distance>20&&Number.isFinite(h.climb));
  assert.ok(Number.isFinite(h.maxSlope)&&h.maxSlope>=0);
  assert.ok(Number.isFinite(h.basketSlope)&&h.basketSlope>=0);
  assert.ok(!isWater(DISC_GOLF_HOLES[i].tee)&&!isWater(DISC_GOLF_HOLES[i].target));
  assert.ok(typeof h.teeBiome==="string"&&typeof h.basketBiome==="string");
 }
});
test("fairway warnings are advisory and do not masquerade as rendered obstacle clearance",()=>{
 const report=auditDiscGolfFairways();
 for(const h of report){
  assert.ok(h.waterSamples>=0&&h.waterSamples<=25);
  assert.ok(h.risks.every(r=>[
   "over-water","steep-target","steep-fairway",
   "landmark-clearance","large-elevation-change",
  ].includes(r)));
  if(h.waterSamples>0)assert.ok(h.risks.includes("over-water"));
  if(h.nearbyLandmarks.length>0)assert.ok(h.risks.includes("landmark-clearance"));
 }
});
