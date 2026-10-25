import test from "node:test";
import assert from "node:assert/strict";
import {isContinuousRideRise,rideWheelProbe,rideTerrainAttitude} from "../lib/world/rideSurface";
import {beginRideWipeout,idleRideWipeout,stepRideWipeout,rideWipeoutPose} from "../lib/world/rideWipeout";
import type {Point} from "../lib/world/model";

test("steep but continuous terrain is rideable without an abrupt movement lock",()=>{
 const from={x:0,z:0},to={x:0,z:.6},grade=(p:Point)=>p.z*1.65;
 assert.ok(grade(to)-grade(from)>.6);
 assert.equal(isContinuousRideRise(from,to,grade,grade),true);
});
test("discontinuous rock, cliff and vertical wall remain non-rideable",()=>{
 const from={x:0,z:0},to={x:0,z:.7},flat=(_p:Point)=>2;
 const lid=(p:Point)=>2+(p.z>.3?1.8:0);
 assert.equal(isContinuousRideRise(from,to,lid,flat),false);
 assert.equal(isContinuousRideRise(from,to,lid,lid),false);
 assert.equal(isContinuousRideRise(from,to,p=>p.z*5,p=>p.z*5),false);
});
test("wheel samples ignore raised boulder lids unless the rider is actually on the lid",()=>{
 const center={x:0,z:0},probe={x:0,z:.7};
 const flat=(_p:Point)=>2,shelf=(p:Point)=>p.z>.4?4.2:2;
 assert.equal(rideWheelProbe(center,probe,shelf,flat),2);
 assert.equal(rideWheelProbe(probe,probe,shelf,flat),4.2);
 const ramp=(p:Point)=>2+p.z*1.2;
 assert.equal(rideWheelProbe(center,probe,ramp,ramp),2+.7*1.2);
});
test("rider pitch/roll remain finite at steep terrain seams",()=>{
 for(const mode of ["bike","skate","ski"] as const){
  const pose=rideTerrainAttitude(4,-8,mode);
  assert.ok(pose.pitch<=1.04&&pose.roll>=-.86);
  assert.deepEqual(rideTerrainAttitude(NaN,Infinity,mode),{pitch:0,roll:0});
 }
});
test("a wipeout always transitions through a stand-up back to riding",()=>{
 let state=beginRideWipeout();let sawDown=false,sawRising=false;
 assert.equal(rideWipeoutPose(state).locked,true);
 for(let i=0;i<100;i++){
  state=stepRideWipeout(state,.02);
  if(state.phase==="down")sawDown=true;
  if(state.phase==="rising")sawRising=true;
 }
 assert.ok(sawDown&&sawRising);
 assert.deepEqual(state,idleRideWipeout());
 assert.equal(rideWipeoutPose(state).collapse,0);
});
