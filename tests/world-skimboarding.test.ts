import assert from "node:assert/strict";
import test from "node:test";
import {
  SEA_SURFACE, isWater, terrainHeight, seaFloorHeight, regionLanding, WORLD_BOUNDS,
  waterZone, nearbyDiscovery,
} from "../lib/world/model";
import {
  SKIM_BOARDS, SKIM_HEAT_SECONDS, boardPoint, northShoreZ, beachBlend,
  skimOffshore, nearbySkimBoard, waveCrestOffshore, skimWaveAt, skimWaterHeight,
  idleSkimHeat, pickupSkimBoard, startSkimRide, skimAction, stepSkimHeat,
  skimTrickForKey, SKIM_TRICK_KEYS,
  type SkimHeat,
} from "../lib/world/skimboarding";

test("airborne tricks use Q/E/F and old number keys are not bound", () => {
  assert.deepEqual(
    ["q", "e", "f"].map(key => skimTrickForKey(key)),
    ["shuvit", "big-spin", "three-sixty"],
  );
  assert.equal(skimTrickForKey("Q"), SKIM_TRICK_KEYS.q);
  for (const key of ["1", "2", "3", "w", "a", "s", "d", "r", " "])
    assert.equal(skimTrickForKey(key), null);
  let heat = startSkimRide(
    pickupSkimBoard(boardPoint(1),1,idleSkimHeat()),
    boardPoint(1),9,{x:0,z:1},
  );
  // Tricks cannot be queued until after Space launches the rider.
  for (const key of ["q","e","f"]) {
    const trick = skimTrickForKey(key);
    assert.ok(trick);
    assert.equal(skimAction(heat,trick,boardPoint(1),0).pendingTrick,null);
  }
  heat = skimAction(heat,"pop",boardPoint(1),0);
  const trick = skimTrickForKey("e");
  assert.ok(trick);
  assert.equal(skimAction(heat,trick,boardPoint(1),0).pendingTrick,"big-spin");
});

test("north shore is a traversable beach and shares one physical waterline", () => {
  assert.ok(WORLD_BOUNDS.maxZ > northShoreZ(0)+25);
  const shore=northShoreZ(0);
  assert.ok(!isWater({x:0,z:shore-2}));
  assert.equal(waterZone({x:0,z:shore+1}),"north-shore");
  assert.ok(terrainHeight(0,shore-5)>terrainHeight(0,shore-1));
  assert.ok(beachBlend(0,shore-4)>.9);
  assert.ok(seaFloorHeight(0,shore+3)<SEA_SURFACE);
  assert.equal(nearbyDiscovery(regionLanding("north-shore")),"north-shore");
});

test("three photo-colored planted boards have independent reachable pickup hit areas", () => {
  assert.deepEqual(SKIM_BOARDS.map(b=>b.id),["amber","aqua","lime"]);
  for(let index=0;index<SKIM_BOARDS.length;index++){
    const point=boardPoint(index);
    assert.ok(!isWater(point));
    assert.equal(nearbySkimBoard(point),index);
    assert.equal(skimOffshore(point)<0,true);
    const heat=pickupSkimBoard(point,index,idleSkimHeat());
    assert.equal(heat.phase,"ready");
    assert.equal(heat.board,index);
    assert.equal(pickupSkimBoard(point,(index+1)%3,idleSkimHeat()).phase,"off");
    assert.equal(pickupSkimBoard(point,index,heat).board,index);
  }
});

test("visible wave crests are the same moving field sampled by ride physics",()=>{
  const x=0, offshore=waveCrestOffshore(0,0);
  const crest={x,z:northShoreZ(x)+offshore};
  assert.ok(skimWaveAt(crest,0)>.5);
  assert.ok(skimWaterHeight(crest,0,SEA_SURFACE)>SEA_SURFACE+.3);
  assert.ok(waveCrestOffshore(0,.25)<offshore);
  assert.ok(Number.isFinite(skimWaterHeight(crest,999,SEA_SURFACE)));
});

test("boarding requires an equipped board, speed, and safe surf run-in",()=>{
  const point=boardPoint(1);
  const ready=pickupSkimBoard(point,1,idleSkimHeat());
  assert.equal(startSkimRide(idleSkimHeat(),point,10,{x:0,z:1}).phase,"off");
  assert.equal(startSkimRide(ready,point,2,{x:0,z:1}).phase,"ready");
  assert.equal(startSkimRide(ready,{x:0,z:point.z-30},10,{x:0,z:1}).phase,"ready");
  const riding=startSkimRide(ready,point,9,{x:0,z:1});
  assert.equal(riding.phase,"riding");
  assert.ok(riding.speed>=7);
  assert.deepEqual(riding.heading,{x:0,z:1});
});

test("pop and shuv-it only score on touchdown rather than keypress",()=>{
  let point=boardPoint(1);
  let heat=startSkimRide(pickupSkimBoard(point,1,idleSkimHeat()),point,9,{x:0,z:1});
  heat=skimAction(heat,"pop",point,0);
  assert.ok(heat.air>0);
  const queued=skimAction(heat,"shuvit",point,0);
  assert.equal(queued.ridePoints,0);
  assert.equal(queued.pendingTrick,"shuvit");
  heat=queued;
  for(let i=0;i<45 && heat.phase==="riding";i++){
    const step=stepSkimHeat(heat,point,.025,i*.025,0,true);
    heat=step.heat;point=step.point;
    if(!heat.pendingTrick)break;
  }
  assert.ok(heat.ridePoints>=100,"one landed trick added meaningful score");
  assert.match(heat.lastTrick,/Shuv-it landed/);
  assert.equal(heat.repeats.shuvit,1);
});

test("heat timing is bounded and eventually ends even without completing a ride",()=>{
  let heat:SkimHeat=pickupSkimBoard(boardPoint(1),1,idleSkimHeat());
  assert.equal(heat.remaining,SKIM_HEAT_SECONDS);
  const point=boardPoint(1);
  for(let i=0;i<1900;i++)heat=stepSkimHeat(heat,point,.05,i*.05,0,false).heat;
  assert.equal(heat.phase,"finished");
  assert.equal(heat.remaining,0);
  assert.equal(stepSkimHeat(heat,point,.05,100,0,false).heat,heat);
});

test("recovery returns to ready and bad exits count as wipeouts",()=>{
  const p=boardPoint(1);
  const riding=startSkimRide(pickupSkimBoard(p,1,idleSkimHeat()),p,9,{x:0,z:1});
  const step=stepSkimHeat(riding,{x:0,z:northShoreZ(0)+29},.05,0,0,false);
  assert.equal(step.heat.phase,"recovering");
  assert.equal(step.heat.rides,1);
  let heat=step.heat;
  for(let i=0;i<50;i++)heat=stepSkimHeat(heat,p,.05,i*.05,0,false).heat;
  assert.equal(heat.phase,"ready");
});
