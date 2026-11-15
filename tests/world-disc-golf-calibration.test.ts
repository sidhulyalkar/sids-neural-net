import test from "node:test";
import assert from "node:assert/strict";
import {DISC_GOLF_AERO_PROFILES} from "../lib/world/discGolfAerodynamics";
import {simulateDiscObservations,fitRecordedDiscThrow,
 validateMeasuredThrow,type MeasuredDiscThrow} from "../lib/world/discGolfCalibration";
const base:MeasuredDiscThrow={
 discStyle:"midrange",releaseStyle:"backhand",
 initialPosition:{x:0,y:1.4,z:0},headingRadians:0,
 launchDegrees:17,bankDegrees:8,noseDegrees:1,spinRpm:660,speedMps:21,
 windMps:{x:.2,y:0,z:-.4},
 samples:Array.from({length:9},(_,i)=>({
  timeSeconds:.1+i*.09,position:{x:0,y:0,z:0},
 })),
};
test("flight observations require increasing timestamps and real release measurements",()=>{
 const bad={...base,samples:[...base.samples].reverse()};
 assert.throws(()=>validateMeasuredThrow(bad),/increasing/);
 assert.throws(()=>validateMeasuredThrow({...base,speedMps:Infinity}),/Non-finite/);
 assert.throws(()=>validateMeasuredThrow({...base,samples:base.samples.slice(0,4)}),/five/);
});
test("measured trajectory fitter returns bounded coefficients and held-out error",()=>{
 const truth={...DISC_GOLF_AERO_PROFILES.midrange,lift0:.28,drag0:.13};
 const measurements=simulateDiscObservations(base,truth);
 const sample={...base,samples:measurements};
 const initial=fitRecordedDiscThrow(sample,0);
 const fitted=fitRecordedDiscThrow(sample,2);
 assert.equal(fitted.sampleCount,9);
 assert.ok(fitted.trainingRmseMeters<=initial.trainingRmseMeters+1e-9);
 assert.ok(fitted.validationRmseMeters>=0);
 assert.ok(Number.isFinite(fitted.validationRmseMeters));
 assert.equal(fitted.status,"candidate-not-validated");
 assert.deepEqual(fitted.profile,fitRecordedDiscThrow(sample,2).profile);
});
