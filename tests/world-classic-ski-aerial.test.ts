import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceClassicSkiSpin,beginClassicSkiAir,classicSkiDisplayYaw,
  initialClassicSkiSpin,queueClassicSkiSpin,
} from "../lib/world/ski/classicAerial";

const simulate=(degrees:-360|-180|180|360,frames=16)=>{
 let state=queueClassicSkiSpin(beginClassicSkiAir(initialClassicSkiSpin()),degrees);
 for(let i=0;i<frames;i++)state=advanceClassicSkiSpin(state,.05,true);
 return advanceClassicSkiSpin(state,.05,false);
};
test("left/right 180 lands facing switch; 360 returns original stance",()=>{
 for(const direction of [-1,1] as const){
  for(const size of [180,360] as const){
   const landed=simulate((size*direction) as -360|-180|180|360);
   assert.equal(landed.landing,"clean");
   assert.equal(landed.stance,size===180?180:0);
   assert.equal(landed.completed,1);
   assert.equal(landed.serial,1);
   assert.equal(landed.targetDegrees,0);
  }
 }
});
test("two same-direction 180s combine into a genuine 360",()=>{
 let state=beginClassicSkiAir(initialClassicSkiSpin());
 state=queueClassicSkiSpin(state,180);
 state=queueClassicSkiSpin(state,180);
 assert.equal(state.targetDegrees,360);
 for(let i=0;i<12;i++)state=advanceClassicSkiSpin(state,.05,true);
 state=advanceClassicSkiSpin(state,.05,false);
 assert.equal(state.landing,"clean");
 assert.equal(state.stance,0);
});
test("short landings do not award rotations or fake switch stance",()=>{
 let state=queueClassicSkiSpin(beginClassicSkiAir(initialClassicSkiSpin()),360);
 state=advanceClassicSkiSpin(state,.05,true);
 state=advanceClassicSkiSpin(state,.05,false);
 assert.equal(state.landing,"short");
 assert.equal(state.completed,0);
 assert.equal(state.failed,1);
 assert.equal(state.stance,0);
});
test("unsuccessful mountain landing never earns a clean spin",()=>{
 let state=queueClassicSkiSpin(beginClassicSkiAir(initialClassicSkiSpin()),180);
 for(let i=0;i<15;i++)state=advanceClassicSkiSpin(state,.05,true);
 state=advanceClassicSkiSpin(state,.05,false,false);
 assert.equal(state.landing,"missed");
 assert.equal(state.completed,0);
});
test("opposing commands are ignored; repeats bounded to two revolutions",()=>{
 let state=queueClassicSkiSpin(beginClassicSkiAir(initialClassicSkiSpin()),180);
 assert.equal(queueClassicSkiSpin(state,-180),state);
 state=queueClassicSkiSpin(state,360);
 state=queueClassicSkiSpin(state,180);
 state=queueClassicSkiSpin(state,180);
 assert.equal(state.targetDegrees,720);
 assert.equal(queueClassicSkiSpin(state,360),state);
});
test("spin changes the render heading, not the trajectory",()=>{
 let state=queueClassicSkiSpin(beginClassicSkiAir(initialClassicSkiSpin()),-180);
 state=advanceClassicSkiSpin(state,.05,true);
 assert.equal(classicSkiDisplayYaw(state),-Math.PI/5);
 const idle=advanceClassicSkiSpin(initialClassicSkiSpin(),.05,false);
 assert.equal(classicSkiDisplayYaw(idle),0);
 assert.equal(idle.serial,0);
});
test("180 switch can transition back to forward with a second 180",()=>{
 let state=simulate(180);
 state=queueClassicSkiSpin(beginClassicSkiAir(state),-180);
 for(let i=0;i<8;i++)state=advanceClassicSkiSpin(state,.05,true);
 state=advanceClassicSkiSpin(state,.05,false);
 assert.equal(state.stance,0);
 assert.equal(state.completed,2);
});
