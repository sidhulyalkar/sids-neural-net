import assert from "node:assert/strict";
import test from "node:test";
import {
 idleDiscGolfFetch,startDiscGolfFetch,stepDiscGolfFetch,
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
test("Shasta chases a live disc, finds its landed lie and returns without teleporting",()=>{
 const game=startDiscGolf(0,ground);
 let fetch=startDiscGolfFetch(0);
 assert.equal(fetch.phase,"chase");
 const flying={...game,phase:"flying" as const,
  disc:{x:12,y:7,z:24}};
 fetch=stepDiscGolfFetch(fetch,flying,{x:0,z:0},.5);
 assert.deepEqual(fetch.target,{x:12,z:24});
 const landed={...flying,phase:"landed" as const,
  lie:{x:17,z:26},disc:{x:17,y:1,z:26}};
 fetch=stepDiscGolfFetch(fetch,landed,{x:15,z:26},2);
 assert.equal(fetch.phase,"chase");
 assert.deepEqual(fetch.target,landed.lie);
 fetch=stepDiscGolfFetch(fetch,landed,{x:17.3,z:26.3},3);
 assert.equal(fetch.phase,"found");
 assert.equal(stepDiscGolfFetch(fetch,landed,{x:17,z:26},4).phase,"found");
 assert.deepEqual(stepDiscGolfFetch(fetch,landed,{x:17,z:26},4.4),
  idleDiscGolfFetch());
});
test("Shasta finds a caught disc at the basket, not the previous lie",()=>{
 const game=startDiscGolf(0,ground);
 const basket=DISC_GOLF_HOLES[0].target;
 const holed={...game,phase:"holed" as const,
  disc:{...basket,y:1.35}};
 const fetch=stepDiscGolfFetch(startDiscGolfFetch(0),holed,
  {x:game.lie.x,z:game.lie.z},2);
 assert.deepEqual(fetch.target,basket);
 assert.equal(fetch.phase,"chase");
});
test("water shots, exits and unreachable terrain safely end fetch",()=>{
 const game=startDiscGolf(0,ground);
 const active=startDiscGolfFetch(0);
 for(const phase of ["water","off","ready"] as const)
  assert.equal(stepDiscGolfFetch(active,{...game,phase},{x:0,z:0},1).phase,"idle");
 assert.equal(stepDiscGolfFetch(active,{...game,phase:"flying"},{x:0,z:0},13).phase,"idle");
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
