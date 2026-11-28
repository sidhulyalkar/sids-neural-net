import assert from "node:assert/strict";
import test from "node:test";
import {DISC_GOLF_HOLES} from "../lib/world/discGolf";
import {
 DISC_GOLF_ROUND_KEY,emptyDiscGolfRound,recordDiscGolfHole,
 discGolfRoundSummary,nextUnplayedDiscGolfHole,loadDiscGolfRound,persistDiscGolfRound,
} from "../lib/world/discGolfRound";

test("a nine-hole round records each basket only once and never awards strokes for a switch",()=>{
 let round=emptyDiscGolfRound();
 assert.equal(round.scores.length,9);
 assert.equal(discGolfRoundSummary(round).holesPlayed,0);
 assert.equal(nextUnplayedDiscGolfHole(round),0);
 for(let i=0;i<9;i++){
  assert.equal(nextUnplayedDiscGolfHole(round,i-1),i);
  round=recordDiscGolfHole(round,i,DISC_GOLF_HOLES[i].par);
  assert.equal(round.scores[i],DISC_GOLF_HOLES[i].par);
  const snapshot=round;
  assert.equal(recordDiscGolfHole(round,i,42),snapshot,
   "practice replay must not corrupt an existing recorded score");
 }
 const result=discGolfRoundSummary(round);
 assert.equal(result.holesPlayed,9);
 assert.equal(result.complete,true);
 assert.equal(result.strokes,result.coursePar);
 assert.equal(result.toPar,0);
 assert.equal(nextUnplayedDiscGolfHole(round,8),null);
 assert.equal(round.bestTotal,result.strokes);
});
test("out-of-order hole selection never creates fake scores",()=>{
 let round=emptyDiscGolfRound();
 round=recordDiscGolfHole(round,4,5);
 round=recordDiscGolfHole(round,7,3);
 assert.equal(nextUnplayedDiscGolfHole(round,7),8);
 assert.equal(nextUnplayedDiscGolfHole(round,8),0);
 assert.equal(discGolfRoundSummary(round).holesPlayed,2);
 assert.equal(round.scores[0],null);
 assert.equal(recordDiscGolfHole(round,-1,2),round);
 assert.equal(recordDiscGolfHole(round,9,2),round);
 assert.equal(recordDiscGolfHole(round,1,0),round);
 assert.equal(recordDiscGolfHole(round,1,1.5),round);
 const complete=DISC_GOLF_HOLES.reduce((state,h,i)=>recordDiscGolfHole(state,i,h.par+2),round);
 assert.ok(discGolfRoundSummary(complete).complete);
 assert.equal(complete.scores[4],5);
 assert.equal(complete.scores[7],3);
});
test("a fresh round preserves previous best and can improve it",()=>{
 let first=emptyDiscGolfRound();
 for(let i=0;i<9;i++)first=recordDiscGolfHole(first,i,DISC_GOLF_HOLES[i].par+2);
 const earlier=first.bestTotal!;
 let second=emptyDiscGolfRound(earlier);
 assert.equal(discGolfRoundSummary(second).holesPlayed,0);
 for(let i=0;i<9;i++)second=recordDiscGolfHole(second,i,DISC_GOLF_HOLES[i].par);
 assert.equal(second.bestTotal,earlier-18);
});
test("round serialization validates storage and ignores corrupt or different-length records",()=>{
 const data=new Map<string,string>();
 const oldWindow=(globalThis as {window?:unknown}).window;
 (globalThis as {window?:unknown}).window={localStorage:{
  getItem:(key:string)=>data.get(key)??null,
  setItem:(key:string,value:string)=>{data.set(key,value);},
 }};
 try{
  let round=emptyDiscGolfRound();
  round=recordDiscGolfHole(round,0,3);
  persistDiscGolfRound(round);
  assert.deepEqual(loadDiscGolfRound(),round);
  data.set(DISC_GOLF_ROUND_KEY,JSON.stringify({scores:[3],bestTotal:0}));
  assert.deepEqual(loadDiscGolfRound(),emptyDiscGolfRound());
  data.set(DISC_GOLF_ROUND_KEY,"{ invalid json");
  assert.deepEqual(loadDiscGolfRound(),emptyDiscGolfRound());
  data.set(DISC_GOLF_ROUND_KEY,JSON.stringify({
   scores:Array(9).fill(2.25),bestTotal:7,
  }));
  assert.deepEqual(loadDiscGolfRound(),emptyDiscGolfRound());
 }finally{
  if(oldWindow===undefined)delete (globalThis as {window?:unknown}).window;
  else (globalThis as {window?:unknown}).window=oldWindow;
 }
});
