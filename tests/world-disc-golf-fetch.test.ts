import assert from "node:assert/strict";
import test from "node:test";
import {
 idleDiscGolfFetch,startDiscGolfFetch,stepDiscGolfFetch,discGolfFetchCameraPhase,
 discGolfHandoffTarget,
 DISC_FETCH_LANDING_HOLD,DISC_FETCH_POV_DELAY,DISC_FETCH_FOUND_HOLD,
 DISC_FETCH_CHASE_TIMEOUT,DISC_FETCH_MIN_CHASE_FRAMES,
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
const reachFound=(
 start:Parameters<typeof stepDiscGolfFetch>[0],
 game:Parameters<typeof stepDiscGolfFetch>[1],
 dog:Parameters<typeof stepDiscGolfFetch>[2],
 at:number,
)=>{
 let current=start;
 for(let frame=0;frame<DISC_FETCH_MIN_CHASE_FRAMES+1&&
   current.phase==="chase";frame++){
  current=stepDiscGolfFetch(current,game,dog,at+frame*.015);
 }
 assert.equal(current.phase,"found","a real multi-frame chase must resolve");
 return current;
};
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
 assert.equal(stepDiscGolfFetch(fetch,landed,{x:0,z:0},2.12).phase,"landed");
 fetch=stepDiscGolfFetch(fetch,landed,{x:0,z:0},2+DISC_FETCH_LANDING_HOLD+.02);
 assert.equal(fetch.phase,"chase");
 assert.equal(discGolfFetchCameraPhase(fetch,2.9),"chase",
  "show Shasta beginning to run before switching into his view");
 assert.equal(discGolfFetchCameraPhase(fetch,
  2+DISC_FETCH_LANDING_HOLD+DISC_FETCH_POV_DELAY+.05),"chase",
  "one fixed, wider follow shot without first-person cut");
 const firstFrame=stepDiscGolfFetch(fetch,landed,{x:17.3,z:26.3},4);
 assert.equal(firstFrame.phase,"chase",
  "even a dog already at the disc must have visible chase frames");
 fetch=reachFound(firstFrame,landed,{x:17.3,z:26.3},4.015);
 assert.equal(fetch.phase,"found");
 assert.equal(discGolfFetchCameraPhase(fetch,4),"chase");
 assert.equal(stepDiscGolfFetch(fetch,landed,{x:17,z:26},
  fetch.foundAt+DISC_FETCH_FOUND_HOLD*.7).phase,"found",
  "Shasta holds the find pose before its configured brief release");
 assert.deepEqual(stepDiscGolfFetch(fetch,landed,{x:17,z:26},
  fetch.foundAt+DISC_FETCH_FOUND_HOLD+.01),idleDiscGolfFetch());
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
test("the avatar stays at the previous tee until Shasta finishes finding the disc",()=>{
 const start=startDiscGolf(1,ground);
 const playerAtTee={...start.lie};
 const result={...start,phase:"landed" as const,
  lie:{x:start.lie.x-19,z:start.lie.z-12},
  disc:{x:start.lie.x-19,y:1,z:start.lie.z-12}};
 let previous=startDiscGolfFetch(0);
 let next=stepDiscGolfFetch(previous,{...result,phase:"flying"},
  playerAtTee,.5);
 assert.equal(discGolfHandoffTarget(previous,next,result),null);
 previous=next;
 next=stepDiscGolfFetch(previous,result,playerAtTee,1);
 assert.equal(discGolfHandoffTarget(previous,next,result),null,
  "the landing reveal cannot teleport the avatar");
 previous=next;
 next=stepDiscGolfFetch(previous,result,playerAtTee,1+DISC_FETCH_LANDING_HOLD+.02);
 assert.equal(next.phase,"chase");
 assert.equal(discGolfHandoffTarget(previous,next,result),null);
 previous=next;
 const chaseTime=1+DISC_FETCH_LANDING_HOLD+DISC_FETCH_POV_DELAY+.05;
 next=reachFound(previous,result,result.lie,chaseTime);
 assert.equal(next.phase,"found");
 assert.equal(discGolfHandoffTarget(previous,next,result),null,
  "the avatar stays at the tee while Shasta sniffs");
 previous=next;
 next=stepDiscGolfFetch(previous,result,result.lie,
  previous.foundAt+DISC_FETCH_FOUND_HOLD+.01);
 assert.equal(next.phase,"idle");
 assert.deepEqual(discGolfHandoffTarget(previous,next,result),result.lie);
 assert.deepEqual(playerAtTee,start.lie,
  "pure fetch logic must not change the player or flight state");
 assert.equal(discGolfHandoffTarget(next,next,result),null,
  "handoff is a one-time event, not a continual teleport");
});
test("basket completion relocates after finding chains, never to the old lie",()=>{
 const start=startDiscGolf(0,ground);
 const disc=DISC_GOLF_HOLES[0].target;
 const finished={...start,phase:"holed" as const,
  disc:{...disc,y:ground(disc)+1.35}};
 const ending={...startDiscGolfFetch(2),phase:"found" as const,foundAt:4};
 const idle=stepDiscGolfFetch(ending,finished,disc,4+DISC_FETCH_FOUND_HOLD+.01);
 assert.deepEqual(discGolfHandoffTarget(ending,idle,finished),disc);
 assert.notDeepEqual(disc,start.lie);
});
test("short shots still show a minimum visible Shasta run before handoff",()=>{
 const game=startDiscGolf(0,ground);
 const short={...game,phase:"landed" as const,lie:{x:2,z:2}};
 const landing={...startDiscGolfFetch(0),phase:"landed" as const,landedAt:1,
  target:short.lie};
 const chase=stepDiscGolfFetch(landing,short,short.lie,1+DISC_FETCH_LANDING_HOLD+.01);
 assert.equal(chase.phase,"chase");
 const tooEarly=stepDiscGolfFetch(chase,short,short.lie,1+DISC_FETCH_LANDING_HOLD+.1);
 assert.equal(tooEarly.phase,"chase");
 assert.equal(discGolfHandoffTarget(chase,tooEarly,short),null);
 const found=reachFound(tooEarly,short,short.lie,
  1+DISC_FETCH_LANDING_HOLD+DISC_FETCH_POV_DELAY+.02);
 assert.equal(found.phase,"found");
 assert.equal(discGolfHandoffTarget(tooEarly,found,short),null);
});
test("water, exit and in-flight cancellation never hand the avatar to a bogus lie",()=>{
 const start=startDiscGolf(0,ground);
 const chasing={...startDiscGolfFetch(0),phase:"chase" as const,
  landedAt:1,target:{x:30,z:20}};
 for(const phase of ["water","off","flying"] as const){
  const game={...start,phase};
  const canceled=stepDiscGolfFetch(chasing,game,start.lie,3);
  assert.equal(discGolfHandoffTarget(chasing,canceled,game),null);
 }
 const stalled={...start,phase:"landed" as const,lie:{x:21,z:9}};
 const timeout=stepDiscGolfFetch(chasing,stalled,start.lie,
  1+DISC_FETCH_CHASE_TIMEOUT+.1);
 assert.equal(timeout.phase,"idle");
 assert.deepEqual(discGolfHandoffTarget(chasing,timeout,stalled),stalled.lie,
  "unreachable targets eventually release controls with a safe fallback");
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
