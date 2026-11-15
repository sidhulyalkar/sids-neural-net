import assert from "node:assert/strict";
import test from "node:test";
import {minRigidSoleClearance,evaluateCurrentHalfpipeBudget} from "../lib/world/ski/v4/geometryBudget";
import {SKI_V4_TUNING} from "../lib/world/ski/v4/core";

test("ski clearance minimax gives zero gap on any affine slope",()=>{
  for(const slope of [-2,-.2,0,.3,4]){
    const r=minRigidSoleClearance(x=>7+slope*x,3.5,1.275);
    assert.ok(r.rigidMaxGap<1e-8,"perfect straight snow must fit straight sole");
  }
});
test("sole clearance diagnostic exposes genuine concavity rather than a single contact point",()=>{
  const v=minRigidSoleClearance(x=>Math.abs(x),0,1);
  assert.ok(v.rigidMaxGap>.4);
  assert.throws(()=>minRigidSoleClearance(()=>0,0,-1));
});
test("halfpipe contact budget reports both banks with finite geometry, never claims a release pass",()=>{
  const samples=evaluateCurrentHalfpipeBudget();
  assert.equal(samples.length,2*9*5);
  for(const s of samples){
    assert.ok(Number.isFinite(s.rigidMaxGap)&&s.rigidMaxGap>=0);
    assert.ok(Number.isFinite(s.unavoidableFlexGap)&&s.unavoidableFlexGap>=0);
    assert.ok(Number.isFinite(s.nominalSlopeDegrees)&&s.nominalSlopeDegrees>=0);
    assert.ok(Number.isFinite(s.radiusOfCurvature)&&s.radiusOfCurvature>0);
    assert.equal(s.withinBudget,s.unavoidableFlexGap<=SKI_V4_TUNING.contactTolerance);
  }
  // Symmetric cross-section must give the same feasibility on either wall.
  for(let i=0;i<samples.length/2;i++){
    assert.ok(Math.abs(samples[i].rigidMaxGap-samples[i+samples.length/2].rigidMaxGap)<1e-6);
  }
});
