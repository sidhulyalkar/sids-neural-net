import test from "node:test";
import assert from "node:assert/strict";
import {stepTravel,type Travel} from "../lib/world/activities";
import {DESERT_TRACK_LENGTH,desertTrackFrame} from "../lib/world/desertTrack";
import {armJoshuaTrial,type TrialState,JOSHUA_GATES} from "../lib/world/trials";
import {JOSHUA_GHOSTS,JOSHUA_GHOST_ROUTE_LENGTH,
 joshuaGhostPose,joshuaPlayerFraction,joshuaRacePlace} from "../lib/world/joshuaGhostRace";
import {RIDE_BOOST_TARGETS,RIDE_BOOST_DURATION,RIDE_BOOST_COOLDOWN,
 RIDE_BOOST_RANGE,initialRideBoost,fireRideBoost,canFireRideBoost,
 activeRideBoost} from "../lib/world/rideBoost";

test("bike skill-shot targets belong to the actual Joshua track",()=>{
 const targets=RIDE_BOOST_TARGETS.filter(t=>t.activity==="bike");
 assert.equal(targets.length,4);
 for(const target of targets){
  assert.ok(desertTrackFrame(target.point).distance<.05,target.id);
 }
 for(const sport of ["ski","skate"]){
  assert.ok(RIDE_BOOST_TARGETS.filter(t=>t.activity===sport).length>=3);
 }
 assert.equal(new Set(RIDE_BOOST_TARGETS.map(t=>t.id)).size,
  RIDE_BOOST_TARGETS.length,"target IDs must be unique");
});

test("only an aimed shot while moving and in range grants boost",()=>{
 const target=RIDE_BOOST_TARGETS[0];
 const initial=initialRideBoost();
 const close={x:target.point.x+2,z:target.point.z};
 const far={x:target.point.x+RIDE_BOOST_RANGE+3,z:target.point.z};
 assert.equal(fireRideBoost(target,"bike",close,0,10,initial),initial);
 assert.equal(fireRideBoost(target,"ski",close,10,10,initial),initial);
 assert.equal(fireRideBoost(target,"bike",far,10,10,initial),initial);
 assert.equal(activeRideBoost(initial,10),false);
 const hit=fireRideBoost(target,"bike",close,9,10,initial);
 assert.notEqual(hit,initial);
 assert.equal(hit.hitId,target.id);
 assert.equal(hit.until,10+RIDE_BOOST_DURATION);
 assert.equal(activeRideBoost(hit,12),true);
 assert.equal(activeRideBoost(hit,hit.until),false);
 assert.equal(canFireRideBoost(target,"bike",close,9,11,hit),false);
 assert.equal(fireRideBoost(target,"bike",close,9,11,hit),hit,
  "proximity, spam clicking, or crossing target alone must never restack");
 const later=fireRideBoost(target,"bike",close,9,10+RIDE_BOOST_COOLDOWN,hit);
 assert.notEqual(later,hit);
});

test("skill-shot applies to bike, ski and skate without instant speed snapping",()=>{
 for(const activity of ["bike","ski","skate"] as const){
  const from:Travel={point:{x:0,z:0},speed:5,heading:{x:1,z:0}};
  const unboosted=stepTravel(from,{x:1,z:0},.05,activity,[],false,
    null,0,()=>0);
  const boosted=stepTravel(from,{x:1,z:0},.05,activity,[],false,
    null,0,()=>0,true);
  assert.ok(boosted.speed>unboosted.speed,activity);
  const coasting=stepTravel({...from,speed:100/6},{x:1,z:0},
    .05,activity,[],false,null,0,()=>0,false);
  assert.ok(coasting.speed<100/6&&coasting.speed>unboosted.speed,
    "expired boosts must coast back, not snap to standard cruise");
 }
});

test("Joshua pace ghosts are finite deterministic riders on a closed safe route",()=>{
 assert.equal(JOSHUA_GHOSTS.length,2);
 assert.ok(JOSHUA_GHOST_ROUTE_LENGTH>DESERT_TRACK_LENGTH*.7);
 for(const ghost of JOSHUA_GHOSTS){
  const first=joshuaGhostPose(0,ghost),again=joshuaGhostPose(0,ghost);
  assert.deepEqual(first,again);
  assert.equal(first.fraction,0);
  for(const ms of [500,1000,5000,10000,20000,30000]){
   const state=joshuaGhostPose(ms,ghost);
   assert.ok(Number.isFinite(state.heading));
   assert.ok(Number.isFinite(state.point.x)&&Number.isFinite(state.point.z));
   assert.ok(state.fraction>=0&&state.fraction<=1);
  }
  const last=joshuaGhostPose(1e8,ghost);
  assert.equal(last.done,true);
  assert.equal(last.fraction,1);
 }
});

test("ghost race position is based on ordered gates and real finish time",()=>{
 const idle=armJoshuaTrial();
 assert.equal(joshuaRacePlace(idle,JOSHUA_GATES[0].point),1);
 const running:TrialState={...idle,phase:"running",nextGate:1,elapsedMs:12000};
 assert.ok(joshuaPlayerFraction(running,JOSHUA_GATES[0].point)<.08);
 assert.equal(joshuaRacePlace(running,JOSHUA_GATES[0].point),3);
 const finish:TrialState={...running,phase:"complete",nextGate:13};
 const winning={...finish,elapsedMs:500};
 assert.equal(joshuaRacePlace(winning,JOSHUA_GATES[0].point),1);
 const slow={...finish,elapsedMs:1e6};
 assert.equal(joshuaRacePlace(slow,JOSHUA_GATES[0].point),3,
  "finishing last must not falsely show first place");
});
