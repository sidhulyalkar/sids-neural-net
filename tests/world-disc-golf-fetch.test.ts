import assert from "node:assert/strict";
import test from "node:test";
import {
 idleDiscGolfFetch,startDiscGolfFetch,stepDiscGolfFetch,discGolfFetchCameraPhase,\n DISC_FETCH_LANDING_HOLD,DISC_FETCH_POV_DELAY,DISC_FETCH_FOUND_HOLD,\n DISC_FETCH_CHASE_TIMEOUT,
} from "../lib/world/discGolfFetch";
import {
 DISC_GOLF_HOLES,discGolfOpeningClearance,startDiscGolf,
} from "../lib/world/discGolf";
import {
 DISC_GOLF_FUNNY_NAMES,discGolfName,
} from "../lib/world/discGolfNames";
import {emptyDiscGolfRound,recordDiscGolfHole} from "../lib/world/discGolfRound";
import {terrainHeight,isWater} from "../lib/world/model";

const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
test("the entire disc flight belongs to the shot camera; Shasta waits for landing",()=>{
 const game=startDiscGolf(0,ground);
 let fetch=startDiscGolfFetch(0);
 assert.equal(fetch.phase,"flight");
 assert.equal(fetch.target,null,"dog must not chase a still-flying disc");
 const flying={...game,phase:"flying" as const,
  disc:{x:12,y:7,z:24}};
 fetch=stepDiscGolfFetch(fetch,flying,{x:0,z:0},.5);
 assert.equal(fetch.phase,"flight");
 assert.equal(fetch.target,null);
 assert.equal(discGolfFetchCameraPhase(fetch,.5),"disc");
 const landed={...flying,phase:"landed" as const,
  lie:{x:17,z:26},disc:{x:17,y:1,z:26}};
 fetch=stepDiscGolfFetch(fetch,landed,{x:0,z:0},2);
 assert.equal(fetch.phase,"landed");
 assert.deepEqual(fetch.target,landed.lie);
 assert.equal(discGolfFetchCameraPhase(fetch,2),"landing");
 assert.equal(stepDiscGolfFetch(fetch,landed,{x:0,z:0},2.5).phase,"landed");
 fetch=stepDiscGolfFetch(fetch,landed,{x:0,z:0},2+DISC_FETCH_LANDING_HOLD+.02);
 assert.equal(fetch.phase,"chase");
 assert.equal(discGolfFetchCameraPhase(fetch,2.9),"chase",
  "show Shasta beginning to run before switching into his view");
 assert.equal(discGolfFetchCameraPhase(fetch,
  2+DISC_FETCH_LANDING_HOLD+DISC_FETCH_POV_DELAY+.05),"shasta");
 fetch=stepDiscGolfFetch(fetch,landed,{x:17.3,z:26.3},4);
 assert.equal(fetch.phase,"found");
 assert.equal(discGolfFetchCameraPhase(fetch,4),"shasta");
 assert.equal(stepDiscGolfFetch(fetch,landed,{x:17,z:26},4.8).phase,"found");
 assert.deepEqual(stepDiscGolfFetch(fetch,landed,{x:17,z:26},
  4+DISC_FETCH_FOUND_HOLD+.01),idleDiscGolfFetch());
});
test("Shasta finds a caught disc at the basket, not the previous lie",()=>{
 const game=startDiscGolf(0,ground);
 const basket=DISC_GOLF_HOLES[0].target;
 const holed={...game,phase:"holed" as const,
  disc:{...basket,y:1.35}};
 const fetch=stepDiscGolfFetch(startDiscGolfFetch(0),holed,
  {x:game.lie.x,z:game.lie.z},2);
 assert.deepEqual(fetch.target,basket);
 assert.equal(fetch.phase,"landed");
});
test("water, exits, another throw and timeout cleanly cancel the cinematic",()=>{
 const game=startDiscGolf(0,ground);
 const active=startDiscGolfFetch(0);
 for(const phase of ["water","off","ready"] as const)
  assert.deepEqual(stepDiscGolfFetch(active,{...game,phase},{x:0,z:0},1),
   idleDiscGolfFetch());
 const landed={...game,phase:"landed" as const};
 const showing=stepDiscGolfFetch(active,landed,{x:0,z:0},2);
 const chasing=stepDiscGolfFetch(showing,landed,{x:0,z:0},4);
 assert.equal(chasing.phase,"chase");
 assert.deepEqual(stepDiscGolfFetch(chasing,{...game,phase:"flying"},
  {x:0,z:0},4.1),idleDiscGolfFetch(),
  "new shot interrupts old fetch sequence");
 assert.deepEqual(stepDiscGolfFetch(chasing,landed,{x:0,z:0},
  2+DISC_FETCH_CHASE_TIMEOUT+.1),idleDiscGolfFetch(),
  "no unreachable fetch may hold the camera forever");
});
test("reduced motion avoids every extra automatic fetch camera transition",()=>{
 const on=startDiscGolfFetch(1);
 assert.equal(discGolfFetchCameraPhase(on,1,true),"off");
 const landed={...on,phase:"landed" as const,landedAt:2};
 const chase={...landed,phase:"chase" as const};
 for(const stage of [on,landed,chase,{...chase,phase:"found" as const}]){
  assert.equal(discGolfFetchCameraPhase(stage,4,true),"off");
 }
 assert.equal(discGolfFetchCameraPhase(idleDiscGolfFetch(),8),"off");
});
test("first fairway reserves a continuous clean corridor across island terrain",()=>{
 const tee=DISC_GOLF_HOLES[0].tee,target=DISC_GOLF_HOLES[0].target;
 assert.ok(!isWater(tee)&&!isWater(target));
 assert.ok(Math.hypot(target.x-tee.x,target.z-tee.z)>30);
 assert.notDeepEqual(DISC_GOLF_HOLES.at(-1)?.target,tee);
 assert.ok(Math.hypot(target.x-tee.x,target.z-tee.z)<80);
 for(let i=0;i<=16;i++){
  const t=i/16;
  const point={x:tee.x+(target.x-tee.x)*t,z:tee.z+(target.z-tee.z)*t};
  assert.ok(!isWater(point),"all ground in the opening lane must be dry");
  assert.ok(discGolfOpeningClearance(point),"the route must be protected");
  assert.ok(Number.isFinite(ground(point)));
 }
 assert.ok(!discGolfOpeningClearance({x:-10,z:6}),
  "do not clear the existing redwood grove");
});
test("funny names are distinct for each hole, persist with the round and reroll",()=>{
 assert.ok(DISC_GOLF_FUNNY_NAMES.length>=18);
 for(const seed of [0,1,24,55,123456,2147483646]){
  const names=DISC_GOLF_HOLES.map((_,i)=>discGolfName(i,seed));
  assert.equal(new Set(names).size,9);
  assert.deepEqual(names,DISC_GOLF_HOLES.map((_,i)=>discGolfName(i,seed)));
 }
 const recorded=recordDiscGolfHole(emptyDiscGolfRound(null,21),0,4);
 assert.equal(recorded.nameSeed,21);
 assert.notEqual(discGolfName(0,21),discGolfName(0,22));
 assert.equal(emptyDiscGolfRound(recorded.bestTotal,22).scores[0],null);
});
