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
  assert.ok(h.routeDistance>=60&&Number.isFinite(h.climb),
   "all holes must span multiple throws");
  assert.ok(h.gateCount>=1&&h.gateCount<=3);
  assert.equal(h.legDistances.length,h.gateCount+1);
  assert.equal(h.gateReachable.length,h.gateCount);
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
   "short-first-shot","first-shot-water","unsafe-gate",
   "short-leg","missed-gate-from-staging",
  ].includes(r)));
  if(h.waterSamples>0)assert.ok(h.risks.includes("over-water"));
  if(h.nearbyLandmarks.length>0)assert.ok(h.risks.includes("landmark-clearance"));
 }
});

test("every hole starts with an unhindered real throw and a usable green",()=>{
 const failures:string[]=[];
 for(const h of auditDiscGolfFairways()){
  const label="Hole "+h.hole+" ("+h.id+")";
  if(h.teeCoastMargin<6)failures.push(label+" tee near coast "+h.teeCoastMargin);
  if(h.greenCoastMargin<6)failures.push(label+" green near coast "+h.greenCoastMargin);
  if(h.teeFeatureClearance<2)failures.push(label+" crowded tee "+h.teeFeatureClearance);
  if(h.greenFeatureClearance<2)failures.push(label+" crowded green "+h.greenFeatureClearance);
  if(h.teeSlope>1.35)failures.push(label+" steep tee "+h.teeSlope);
  if(h.basketSlope>1.45)failures.push(label+" steep green "+h.basketSlope);
  if(h.legDistances.some(d=>d<14))failures.push(label+" route leg too short");
  h.gateClearance.forEach((d,i)=>{if(d<1.2)failures.push(label+" gate "+(i+1)+" crowded "+d);});
  h.gateSlope.forEach((d,i)=>{if(d>2.2)failures.push(label+" gate "+(i+1)+" steep "+d);});
  h.gateReachable.forEach((ok,i)=>{if(!ok)failures.push(label+" gate "+(i+1)+" unachievable from staging");});
  if(h.firstShotDistance<7)failures.push(label+" opening dies at "+h.firstShotDistance);
  if(!["landed","holed"].includes(h.firstShotPhase))
   failures.push(label+" opening ends in "+h.firstShotPhase);
 }
 assert.deepEqual(failures,[],"Fix every unsafe tee and green before passing CI");
});
