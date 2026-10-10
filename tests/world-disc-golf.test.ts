import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
 DISC_GOLF_HOLES,DISC_GOLF_VERSION,discGolfBasketPosition,discGolfWind,
 startDiscGolf,idleDiscGolf,discGolfThrow,stepDiscGolf,discGolfScoreName,
 discGolfRemaining,
} from "../lib/world/discGolf";
import { terrainHeight,isWater } from "../lib/world/model";
import { createDiscGolfGeometry } from "../components/world/worldDiscGolfGeometry";
const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
const ordinary={power:74,accuracy:0,loft:25,aimOffset:0};
test("four playable island holes have continuously moving chain baskets away from water",()=>{
 assert.equal(DISC_GOLF_HOLES.length,4);
 assert.equal(new Set(DISC_GOLF_HOLES.map(h=>h.id)).size,4);
 for(const h of DISC_GOLF_HOLES){
  assert.ok(!isWater(h.tee)&&!isWater(h.target),h.id);
  assert.ok(Math.hypot(h.tee.x-h.target.x,h.tee.z-h.target.z)>13);
  const p0=discGolfBasketPosition(h,0),p1=discGolfBasketPosition(h,h.period/4);
  assert.ok(Math.hypot(p0.x-p1.x,p0.z-p1.z)>1,h.id);
  const p2=discGolfBasketPosition(h,h.period);
  assert.ok(Math.hypot(p2.x-p0.x,p2.z-p0.z)<1e-8);
  assert.ok(Number.isFinite(ground(p0)));
 }
 assert.ok(DISC_GOLF_VERSION.includes("disc-golf"));
});
test("wind is deterministic and time varying; throw is locked to release wind",()=>{
 const a=discGolfWind(1,4);
 assert.deepEqual(a,discGolfWind(1,4));
 assert.notDeepEqual(a,discGolfWind(1,14));
 assert.ok(a.speed<4);
 const begin=startDiscGolf(1,ground,4);
 const shot=discGolfThrow(begin,ordinary,ground);
 assert.equal(shot.phase,"flying");
 assert.equal(shot.strokes,1);
 assert.deepEqual(shot.lockedWind,a);
 assert.notEqual(shot.velocity.y,0);
 assert.equal(discGolfThrow(shot,ordinary,ground),shot);
});
test("pullback power, release accuracy, aim and throw angle all influence disc flight",()=>{
 const s=startDiscGolf(0,ground,1);
 const slow=discGolfThrow(s,{...ordinary,power:15},ground);
 const fast=discGolfThrow(s,{...ordinary,power:95},ground);
 const lateral=discGolfThrow(s,{...ordinary,accuracy:1},ground);
 const tilt=discGolfThrow(s,{...ordinary,aimOffset:18},ground);
 const high=discGolfThrow(s,{...ordinary,loft:40},ground);
 assert.ok(Math.hypot(fast.velocity.x,fast.velocity.z)>
   Math.hypot(slow.velocity.x,slow.velocity.z)+9);
 assert.notEqual(lateral.velocity.x,fast.velocity.x);
 assert.notEqual(tilt.velocity.z,fast.velocity.z);
 assert.ok(high.velocity.y>slow.velocity.y);
});
test("real heightfield shots settle on ground at a playable new lie",()=>{
 let s=discGolfThrow(startDiscGolf(0,ground,0),ordinary,ground);
 for(let i=0;i<1000&&s.phase==="flying";i++)
  s=stepDiscGolf(s,.05,ground,isWater,-1.4);
 assert.ok(["landed","holed"].includes(s.phase),JSON.stringify(s));
 assert.ok(s.flightTime>.5&&s.flightTime<10);
 assert.equal(s.strokes,1);
 if(s.phase==="landed"){
  assert.ok(Math.abs(s.disc.y-ground(s.lie)-.16)<.001);
  assert.deepEqual({x:s.disc.x,z:s.disc.z},s.lie);
  const second=discGolfThrow(s,{...ordinary,power:35},ground);
  assert.equal(second.strokes,2);
 }
});
test("water and bounds preserve last lie and refund the shot",()=>{
 const low=(p:{x:number;z:number})=>p.x>0?-3:0;
 let s=startDiscGolf(0,low,0);
 s={...s,lie:{x:-2,z:0},disc:{x:-2,z:0,y:1.1},phase:"flying",strokes:1,
  velocity:{x:18,y:0,z:0},lockedWind:{x:0,z:0,speed:0},flightTime:0};
 for(let i=0;i<400&&s.phase==="flying";i++)
  s=stepDiscGolf(s,.05,low,p=>p.x>0,0);
 assert.equal(s.phase,"water",JSON.stringify(s));
 assert.equal(s.strokes,0);
 assert.equal(s.waterRedos,1);
 assert.deepEqual(s.lie,{x:-2,z:0});
 const retry=discGolfThrow(s,ordinary,low);
 assert.equal(retry.strokes,1);
 assert.equal(retry.phase,"flying");
});
test("water masks take precedence over elevated analytic terrain",()=>{
  const falseGround=()=>3;
  let s=startDiscGolf(0,falseGround,0);
  s={...s,lie:{x:-2,z:0},disc:{x:-2,z:0,y:5},
    phase:"flying",strokes:1,flightTime:0,
    velocity:{x:9,y:-.5,z:0},lockedWind:{x:0,z:0,speed:0}};
  for(let i=0;i<350&&s.phase==="flying";i++)
    s=stepDiscGolf(s,.05,falseGround,p=>p.x>0,0);
  assert.equal(s.phase,"water",JSON.stringify(s));
  assert.equal(s.strokes,0);
  assert.deepEqual(s.lie,{x:-2,z:0});
});
test("moving chains catch discs in the target zone and scoring is explicit",()=>{
 const s=startDiscGolf(2,ground,5);
 const basket=discGolfBasketPosition(DISC_GOLF_HOLES[s.holeIndex],s.clock);
 const catching={...s,phase:"flying" as const,strokes:2,flightTime:1,
  disc:{...basket,y:ground(basket)+1.35},
  velocity:{x:0,y:.1,z:0}};
 const result=stepDiscGolf(catching,.0125,ground,isWater,-1.4);
 assert.equal(result.phase,"holed");
 assert.equal(result.strokes,2);
 assert.equal(discGolfThrow(result,ordinary,ground),result);
 assert.ok(discGolfRemaining(s)>0);
 assert.equal(discGolfScoreName(1,3),"Ace!");
 assert.equal(discGolfScoreName(2,3),"Birdie");
 assert.equal(discGolfScoreName(3,3),"Par");
 assert.equal(idleDiscGolf().phase,"off");
});
test("active chain basket, disc and landing beacon render efficiently and dispose",()=>{
 const scene=new THREE.Scene(),v=createDiscGolfGeometry(scene);
 assert.ok(v.drawCalls<=9);
 assert.equal(scene.children.length,3);
 let s=startDiscGolf(0,ground);
 v.update(s);
 assert.ok(scene.children[0].visible);
 assert.ok(!scene.children[2].visible);
 const lie=s.lie;
 s={...s,phase:"landed",disc:{...lie,y:ground(lie)+.16}};
 v.update(s);
 assert.ok(scene.children[2].visible,"beam from the landed disc");
 assert.equal(scene.children[2].position.x,lie.x);
 v.update(idleDiscGolf());
 assert.ok(scene.children.every(o=>!o.visible));
 v.dispose();
 assert.equal(scene.children.length,0);
});
