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
   "landmark-clearance","large-elevation-change","steep-tee",
   "crowded-tee","crowded-green","coastal-tee","coastal-green",
   "short-first-shot","first-shot-water",
  ].includes(r)));
  if(h.waterSamples>0)assert.ok(h.risks.includes("over-water"));
  if(h.nearbyLandmarks.length>0)assert.ok(h.risks.includes("landmark-clearance"));
 }
});

test("every hole starts with an unhindered real throw and a usable green",()=>{
 const report=auditDiscGolfFairways();
 for(const h of report){
  const label="Hole "+h.hole+" ("+h.id+")";
  assert.ok(h.teeCoastMargin>=6,label+": tee too close to water "+h.teeCoastMargin);
  assert.ok(h.greenCoastMargin>=6,label+": green too close to water "+h.greenCoastMargin);
  assert.ok(h.teeFeatureClearance>=2,label+": tee crowded by authored feature "+h.teeFeatureClearance);
  assert.ok(h.greenFeatureClearance>=2,label+": basket crowded by authored feature "+h.greenFeatureClearance);
  assert.ok(h.teeSlope<=1.35,label+": tee too steep "+h.teeSlope);
  assert.ok(h.basketSlope<=1.45,label+": green too steep "+h.basketSlope);
  assert.ok(h.firstShotDistance>=7,label+": first shot dies within "+h.firstShotDistance);
  assert.ok(["landed","holed"].includes(h.firstShotPhase),
    label+": first shot must settle on a real lie, not "+h.firstShotPhase);
 }
});
