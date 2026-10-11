import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
 DISC_GOLF_HOLES,DISC_GOLF_VERSION,discGolfBasketPosition,discGolfWind,
 startDiscGolf,idleDiscGolf,discGolfThrow,stepDiscGolf,discGolfScoreName,
 discGolfRemaining,discGolfTreeContact,traceDiscGolfShot,recommendDiscGolfPower,
} from "../lib/world/discGolf";
import { terrainHeight,isWater } from "../lib/world/model";
import { createDiscGolfGeometry } from "../components/world/worldDiscGolfGeometry";
const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
const ordinary={power:74,accuracy:0,loft:25,aimOffset:0};
test("four fixed baskets make a linked, multi-throw journey over safe land",()=>{
 assert.equal(DISC_GOLF_HOLES.length,4);
 assert.equal(new Set(DISC_GOLF_HOLES.map(h=>h.id)).size,4);
 for(let i=0;i<DISC_GOLF_HOLES.length;i++){
  const h=DISC_GOLF_HOLES[i];
  assert.ok(!isWater(h.tee)&&!isWater(h.target),h.id);
  assert.ok(Math.hypot(h.tee.x-h.target.x,h.tee.z-h.target.z)>45,h.id);
  const p0=discGolfBasketPosition(h,0),p1=discGolfBasketPosition(h,100);
  assert.deepEqual(p0,p1,"the basket must never move");
  if(i>0)assert.deepEqual(h.tee,DISC_GOLF_HOLES[i-1].target,
   "next tee should begin at the previous fixed basket");
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
test("fixed chains catch discs in the target zone and scoring is explicit",()=>{
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
 assert.ok(v.drawCalls<=10);
 assert.equal(scene.children.length,5);
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
 v.updatePreview(idleDiscGolf(),null,[]);
 assert.ok(scene.children.every(o=>!o.visible));
 v.dispose();
 assert.equal(scene.children.length,0);
});

test("swept tree-trunk contact checks real height as well as horizontal crossing",()=>{
 const obstacle={x:1.5,z:0,radius:.28,height:6};
 const from={x:0,y:2,z:0},to={x:3,y:2,z:0};
 const hit=discGolfTreeContact(from,to,obstacle,()=>0);
 assert.ok(hit && hit.x>0 && hit.x<1.5);
 assert.equal(discGolfTreeContact({...from,y:8},{...to,y:8},obstacle,()=>0),null,
   "discs clearing the canopy corridor must not collide with infinite columns");
 assert.equal(discGolfTreeContact(from,{x:0,y:2,z:4},obstacle,()=>0),null);
});
test("a disc striking a tree earns a ground lie, not a free water redo",()=>{
 const first=discGolfThrow(startDiscGolf(0,ground,0),
   {power:72,accuracy:0,loft:19,aimOffset:0},ground);
 let probe=first;
 for(let n=0;n<8;n++)probe=stepDiscGolf(probe,.05,ground,isWater,-1.4);
 const obstacle={x:probe.disc.x,z:probe.disc.z,radius:.65,height:12};
 let shot=first;
 for(let n=0;n<100&&shot.phase==="flying";n++)
   shot=stepDiscGolf(shot,.05,ground,isWater,-1.4,[obstacle]);
 assert.equal(shot.phase,"landed",JSON.stringify(shot));
 assert.match(shot.reason??"",/Tree contact/);
 assert.equal(shot.strokes,1);
 assert.equal(shot.waterRedos,0);
 assert.ok(Math.hypot(shot.lie.x-obstacle.x,shot.lie.z-obstacle.z)>=obstacle.radius+.60,
   "a landed shot must leave space for the explorer's walking collider");
 assert.ok(Math.abs(shot.disc.y-ground(shot.lie)-.16)<.001);
 const followUp=discGolfThrow(shot,{power:30,accuracy:0,loft:22,aimOffset:0},ground);
 assert.equal(followUp.strokes,2);
});
test("the ideal throw preview and actual flight use identical simulation",()=>{
 const init=startDiscGolf(1,ground,3.8);
 const preview=traceDiscGolfShot(init,ordinary,ground,isWater,-1.4);
 assert.ok(preview.points.length>6&&preview.points.length<=91);
 let actual=discGolfThrow(init,ordinary,ground);
 for(let i=0;i<90&&actual.phase==="flying";i++)
   actual=stepDiscGolf(actual,.10,ground,isWater,-1.4);
 assert.equal(preview.outcome,actual.phase);
 if(actual.phase!=="water"){
  assert.ok(Math.hypot(preview.end.x-actual.disc.x,preview.end.z-actual.disc.z)<1e-7);
  assert.ok(Math.abs(preview.end.y-actual.disc.y)<1e-7);
 }
 const scene=new THREE.Scene(),visual=createDiscGolfGeometry(scene);
 visual.update(init);
 visual.updatePreview(init,ordinary,[]);
 assert.ok(scene.children[3].visible,"preview is one line, not a field of meshes");
 const guide=scene.children[3] as THREE.Line;
 assert.ok(guide.geometry.drawRange.count>6);
 assert.ok(guide.geometry.drawRange.count<=96);
 visual.updatePreview(init,null,[]);
 assert.ok(!guide.visible);
 visual.dispose();
});
test("a water reset never creates a false drawn segment back to the tee",()=>{
 const flat=()=>0;
 const begin=startDiscGolf(0,flat,0);
 const shot={power:100,loft:11,accuracy:0,aimOffset:0};
 const preview=traceDiscGolfShot(begin,shot,flat,p=>p.x<begin.lie.x-.9,-1.4);
 if(preview.outcome==="water"){
  assert.ok(preview.points.length>=2);
  const last=preview.points.at(-1)!;
  assert.ok(Math.hypot(last.x-begin.lie.x,last.z-begin.lie.z)>.05);
 }
});

test("short putts have reachable low power and a predicted catch",()=>{
 const flat=()=>0,water=()=>false;
 const h=DISC_GOLF_HOLES[0];
 const start=startDiscGolf(0,flat,0);
 const lie={x:h.target.x,z:h.target.z-2.2};
 const state={...start,phase:"landed" as const,lie,
  disc:{...lie,y:.16}};
 const power=recommendDiscGolfPower(state,24,0,flat,water,-1.4);
 assert.ok(power>=4&&power<45,"putts should not need full drive power: "+power);
 const trace=traceDiscGolfShot(state,{power,accuracy:0,loft:24,aimOffset:0},
  flat,water,-1.4);
 assert.equal(trace.outcome,"holed","an aimed short putt should reach stationary chains");
});
