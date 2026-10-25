import assert from "node:assert/strict";
import test from "node:test";
import {JOSHUA_TRIAL,JOSHUA_GATES,JOSHUA_FINISH_GATE,
  armJoshuaTrial,abortJoshuaTrial,tickJoshuaTrial,crossedTrialGate,
} from "../lib/world/trials";
import {DESERT_TRACK_LENGTH,DESERT_JUMPS,desertTrackSampleAt} from "../lib/world/desertTrack";
import {distance} from "../lib/world/model";

test("Joshua adventure lap gates follow single unique route and avoid both gaps",()=>{
 assert.equal(JOSHUA_GATES.length,12);
 assert.equal(JOSHUA_GATES[0].id,"start-finish");
 let previous=-Infinity;
 for(const gate of JOSHUA_GATES){
   assert.ok(gate.s>previous,gate.id);
   assert.ok(gate.s>=0&&gate.s<DESERT_TRACK_LENGTH);
   assert.ok(gate.halfWidth>=2.8&&gate.halfWidth<=3.4);
   assert.ok(Math.abs(Math.hypot(gate.forward.x,gate.forward.z)-1)<.001);
   assert.ok(DESERT_JUMPS.every(j=>distance(gate.point,j.point)>j.landing+3.7),
     gate.id+" near an obstacle at s="+gate.s.toFixed(2));
   previous=gate.s;
 }
 assert.equal(JOSHUA_FINISH_GATE,JOSHUA_GATES[0]);
});
test("a gate is a one-way swept plane with finite lateral width",()=>{
 const gate=JOSHUA_GATES[3],f=gate.forward,p=gate.point;
 const before={x:p.x-f.x*.48,z:p.z-f.z*.48},after={x:p.x+f.x*.48,z:p.z+f.z*.48};
 assert.ok(crossedTrialGate(before,after,gate));
 assert.ok(!crossedTrialGate(after,before,gate));
 assert.ok(!crossedTrialGate(before,before,gate));
 const side={x:f.z*(gate.halfWidth+.2),z:-f.x*(gate.halfWidth+.2)};
 assert.ok(!crossedTrialGate({x:before.x+side.x,z:before.z+side.z},
   {x:after.x+side.x,z:after.z+side.z},gate));
});
test("a contiguous lap passes all ordered gates then crosses real finish once",()=>{
 let run=armJoshuaTrial();
 const step=.35,point=(s:number)=>desertTrackSampleAt(s);
 for(let s=-1;s<DESERT_TRACK_LENGTH+.8;s+=step){
   run=tickJoshuaTrial(run,point(s),point(s+step),.05,"bike");
   assert.notEqual(run.phase,"invalidated",run.reason);
 }
 assert.equal(run.phase,"complete");
 assert.equal(run.nextGate,JOSHUA_GATES.length+1);
 assert.equal(run.splitsMs.length,JOSHUA_GATES.length);
 assert.ok(run.elapsedMs>20000&&run.elapsedMs<90000);
});
test("wrong mode, teleport, shortcut, pause and crossing skipped gate cannot set records",()=>{
 const initial=armJoshuaTrial(),gate=JOSHUA_GATES[0],v=gate.forward;
 const before={x:gate.point.x-v.x*.30,z:gate.point.z-v.z*.30};
 const after={x:gate.point.x+v.x*.30,z:gate.point.z+v.z*.30};
 assert.equal(tickJoshuaTrial(initial,before,after,.05,"ski").phase,"invalidated");
 assert.equal(tickJoshuaTrial(initial,before,after,.05,"bike",true).phase,"invalidated");
 const start=tickJoshuaTrial(initial,before,after,.05,"bike");
 assert.equal(start.phase,"running");
 assert.equal(start.nextGate,1);
 assert.equal(tickJoshuaTrial(start,after,{x:after.x+50,z:after.z},.05,"bike").phase,"invalidated");
 assert.equal(abortJoshuaTrial(start,"Menu").phase,"invalidated");
 const skipped=JOSHUA_GATES[5],f=skipped.forward;
 const result=tickJoshuaTrial(start,
   {x:skipped.point.x-f.x*.25,z:skipped.point.z-f.z*.25},
   {x:skipped.point.x+f.x*.25,z:skipped.point.z+f.z*.25},.05,"bike");
 assert.equal(result.nextGate,1,"later checkpoint cannot advance state out of order");
 assert.equal(JOSHUA_TRIAL.requiredMode,"bike");
});
