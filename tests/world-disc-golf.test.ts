import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three/src/Three.Core.js";
import {
 DISC_GOLF_HOLES,DISC_GOLF_VERSION,discGolfBasketPosition,discGolfWind,
 discGolfNextTarget,discGolfRouteLength,discGolfGateCrossing,
 startDiscGolf,idleDiscGolf,discGolfThrow,stepDiscGolf,discGolfScoreName,
 discGolfRemaining,discGolfTreeContact,traceDiscGolfShot,recommendDiscGolfPower,
 discGolfIntroPose,DISC_GOLF_INTRO_HOLD,DISC_GOLF_INTRO_PULLBACK,
 discGolfThrowCameraPose,discGolfPullback,DISC_GOLF_TAP_WINDOW_MS,
 DISC_GOLF_SWING_CYCLE_MS,
} from "../lib/world/discGolf";
import { terrainHeight,isWater } from "../lib/world/model";
import { createDiscGolfGeometry } from "../components/world/worldDiscGolfGeometry";
const ground=(p:{x:number;z:number})=>terrainHeight(p.x,p.z);
const ordinary={power:74,accuracy:0,loft:25,aimOffset:0};
test("nine independently placed tees and fixed greens remain on playable land",()=>{
 assert.equal(DISC_GOLF_HOLES.length,9);
 assert.equal(new Set(DISC_GOLF_HOLES.map(h=>h.id)).size,9);
 for(let i=0;i<DISC_GOLF_HOLES.length;i++){
  const h=DISC_GOLF_HOLES[i];
  assert.ok(!isWater(h.tee)&&!isWater(h.target),h.id);
  const length=Math.hypot(h.tee.x-h.target.x,h.tee.z-h.target.z);
  assert.ok(length>=48&&length<=138,`Hole ${i+1}: ${length} unit tee-to-basket length`);
  assert.ok(discGolfRouteLength(h)>58,`Hole ${i+1} must need multiple throws`);
  assert.ok(h.gates.length>=1&&h.gates.length<=3);
  const p0=discGolfBasketPosition(h,0),p1=discGolfBasketPosition(h,100);
  assert.deepEqual(p0,p1,"the basket must never move");
  if(i>0)assert.notDeepEqual(h.tee,DISC_GOLF_HOLES[i-1].target,
   "holes must have a separately prepared tee, not reuse a potentially blocked basket");
  assert.ok(Number.isFinite(ground(p0)));
  const p=ground(p0);
  const slope=Math.hypot(ground({x:p0.x+1,z:p0.z})-ground({x:p0.x-1,z:p0.z}),
    ground({x:p0.x,z:p0.z+1})-ground({x:p0.x,z:p0.z-1}));
  assert.ok(Number.isFinite(slope)&&Number.isFinite(p),"basket must be on measurable island terrain");
 }
 assert.notDeepEqual(DISC_GOLF_HOLES.at(-1)!.target,DISC_GOLF_HOLES[0].tee,
  "last basket gets its own safe putting green");
 assert.ok(DISC_GOLF_VERSION.includes("disc-golf"));
});
test("mandatory gates are crossed by actual flight segments in order",()=>{
 const h=DISC_GOLF_HOLES[1],gate=h.gates[0],source=h.tee;
 const dx=gate.point.x-source.x,dz=gate.point.z-source.z;
 const len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
 const before={x:gate.point.x-ux*2,z:gate.point.z-uz*2,y:5};
 const after={x:gate.point.x+ux*2,z:gate.point.z+uz*2,y:5};
 assert.equal(discGolfGateCrossing(before,after,h,0,()=>0),true);
 assert.equal(discGolfGateCrossing(after,before,h,0,()=>0),true,
  "a missed gate remains recoverable by flying back through it");
 assert.equal(discGolfGateCrossing({...before,x:before.x+30},{...after,x:after.x+30},h,0,()=>0),false);
 assert.equal(discGolfGateCrossing({...before,y:17},{...after,y:17},h,0,()=>0),false);
 assert.deepEqual(discGolfNextTarget(startDiscGolf(1,ground)),h.gates[0].point);
 const atLastGate={...startDiscGolf(1,ground),gatesCleared:h.gates.length};
 assert.deepEqual(discGolfNextTarget(atLastGate),h.target);
});
test("basket cannot score before mandatory gates even at chain height",()=>{
 const h=DISC_GOLF_HOLES[0],base=startDiscGolf(0,()=>0);
 const basket=h.target;
 const shot={...base,phase:"flying" as const,strokes:2,flightTime:1,
  lie:{...basket},disc:{...basket,y:1.35},
  velocity:{x:0,y:0,z:.02}};
 const blocked=stepDiscGolf(shot,.0125,()=>0,()=>false,-1.4);
 assert.notEqual(blocked.phase,"holed");
 const finished=stepDiscGolf({...shot,gatesCleared:h.gates.length},
  .0125,()=>0,()=>false,-1.4);
 assert.equal(finished.phase,"holed");
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
test("release bank curves the disc left or right instead of changing the initial aim",()=>{
 const flat=()=>0,water=()=>false;
 const initial=startDiscGolf(0,flat,0);
 const shot={power:76,accuracy:0,loft:28,aimOffset:0};
 const straight=discGolfThrow(initial,shot,flat);
 const left=discGolfThrow(initial,{...shot,bankAngle:-40},flat);
 const right=discGolfThrow(initial,{...shot,bankAngle:40},flat);
 assert.equal(left.bankAngle,-40);
 assert.equal(right.bankAngle,40);
 assert.equal(straight.bankAngle,0);
 assert.deepEqual(left.velocity,right.velocity,
  "bank angle bends during flight, not as a secret change to starting heading");
 const fly=(start:typeof straight)=>{
  let s=start;
  for(let i=0;i<210&&s.phase==="flying";i++)
   s=stepDiscGolf(s,.05,flat,water,-1.4);
  return s;
 };
 const a=fly(left),b=fly(right),center=fly(straight);
 assert.equal(a.phase,"landed");
 assert.equal(b.phase,"landed");
 assert.equal(center.phase,"landed");
 const norm=Math.hypot(straight.velocity.x,straight.velocity.z);
 const rx=straight.velocity.z/norm,rz=-straight.velocity.x/norm;
 const leftLateral=(a.disc.x-center.disc.x)*rx+(a.disc.z-center.disc.z)*rz;
 const rightLateral=(b.disc.x-center.disc.x)*rx+(b.disc.z-center.disc.z)*rz;
 assert.ok(leftLateral< -2,
  "negative bank must visibly bend to the traveler's left: "+leftLateral);
 assert.ok(rightLateral>2,
  "positive bank must visibly bend right: "+rightLateral);
 assert.ok(Math.hypot(a.disc.x-b.disc.x,a.disc.z-b.disc.z)>7);
});
test("curved flight preview, real landing and gate progress use identical physics",()=>{
 const flat=()=>0,water=()=>false;
 for(const bankAngle of [-40,-25,0,25,40]){
  const initial=startDiscGolf(1,flat,3.2);
  const shot={power:90,accuracy:0,loft:27,aimOffset:0,bankAngle};
  const preview=traceDiscGolfShot(initial,shot,flat,water,-1.4);
  let actual=discGolfThrow(initial,shot,flat);
  for(let i=0;i<90&&actual.phase==="flying";i++)
   actual=stepDiscGolf(actual,.1,flat,water,-1.4);
  assert.equal(preview.outcome,actual.phase);
  assert.equal(preview.gatesCleared,actual.gatesCleared);
  assert.ok(Math.hypot(preview.end.x-actual.disc.x,
   preview.end.z-actual.disc.z)<1e-7);
  assert.ok(Math.abs(preview.end.y-actual.disc.y)<1e-7);
  assert.equal(actual.bankAngle,bankAngle);
 }
});
test("bank control rejects invalid inputs and clamps excessive tilt",()=>{
 const init=startDiscGolf(0,()=>0);
 const shot={power:75,loft:24,accuracy:0,aimOffset:0};
 assert.equal(discGolfThrow(init,{...shot,bankAngle:Infinity},()=>0),init);
 assert.equal(discGolfThrow(init,{...shot,bankAngle:NaN},()=>0),init);
 assert.equal(discGolfThrow(init,{...shot,bankAngle:999},()=>0).bankAngle,40);
 assert.equal(discGolfThrow(init,{...shot,bankAngle:-999},()=>0).bankAngle,-40);
 assert.equal(discGolfThrow(init,shot,()=>0).bankAngle,0);
});
test("disc bank visibly tilts while the printed disc spins independently",()=>{
 const scene=new THREE.Scene(),geo=createDiscGolfGeometry(scene);
 const initial=startDiscGolf(1,()=>0);
 const airborne=discGolfThrow(initial,
  {power:80,accuracy:0,loft:24,aimOffset:0,bankAngle:30},()=>0);
 geo.update({...airborne,flightTime:1.2});
 const disc=scene.children[1] as THREE.Group;
 assert.ok(disc.rotation.z>.45);
 assert.ok(Math.abs(disc.rotation.y)>0);
 assert.ok((disc.children[0] as THREE.Group).rotation.y>10);
 geo.update(initial);
 assert.equal(disc.rotation.z,0);
 geo.dispose();
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
  gatesCleared:DISC_GOLF_HOLES[s.holeIndex].gates.length,
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
 assert.ok(v.drawCalls<=14);
 assert.equal(scene.children.length,7);
 let s=startDiscGolf(0,ground);
 v.update(s);
 assert.ok(scene.children[0].visible);
 assert.ok(scene.children[5].visible,"tee circle visible on the initial lie");
 assert.ok(scene.children[6].visible,"next mandatory gate visible");
 assert.ok(!scene.children[2].visible);
 const lie=s.lie;
 s={...s,phase:"landed",disc:{...lie,y:ground(lie)+.16}};
 v.update(s);
 assert.ok(!scene.children[5].visible,"tee pad hides after first throw");
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

test("suggested drive power reaches the fairway without auto-acing the whole course",()=>{
 let aces=0;
 for(let index=0;index<DISC_GOLF_HOLES.length;index++){
  const start=startDiscGolf(index,ground,5);
  const power=recommendDiscGolfPower(start,24,0,ground,isWater,-1.4);
  const projected=traceDiscGolfShot(start,{power,loft:24,aimOffset:0,accuracy:0},
   ground,isWater,-1.4);
  assert.ok(power>=4&&power<=100);
  assert.ok(["landed","holed"].includes(projected.outcome),
   "Hole "+(index+1)+" suggested shot must not vanish into water");
  if(projected.outcome==="holed")aces++;
 }
 assert.ok(aces<=2,"suggested power must not auto-score aces across nine holes");
});
test("short putts have reachable low power and a predicted catch",()=>{
 const flat=()=>0,water=()=>false;
 const h=DISC_GOLF_HOLES[0];
 const start=startDiscGolf(0,flat,0);
 const lie={x:h.target.x,z:h.target.z-2.2};
 const state={...start,phase:"landed" as const,lie,
  gatesCleared:h.gates.length,disc:{...lie,y:.16}};
 const power=recommendDiscGolfPower(state,24,0,flat,water,-1.4);
 assert.ok(power>=4&&power<45,"putts should not need full drive power: "+power);
 const trace=traceDiscGolfShot(state,{power,accuracy:0,loft:24,aimOffset:0},
  flat,water,-1.4);
 assert.equal(trace.outcome,"holed","an aimed short putt should reach stationary chains");
});

test("basket reveal holds target, flies back along fairway, and ends exactly at player pose",()=>{
 const tee={x:0,z:0},basket={x:62,z:-24};
 const followCamera={x:-10,y:9,z:7};
 const followLook={x:5,y:2.4,z:-2};
 const ground=()=>0;
 const reveal=discGolfIntroPose(tee,basket,followCamera,followLook,0,ground);
 assert.equal(reveal.stage,"basket");
 assert.ok(Math.hypot(reveal.camera.x-basket.x,reveal.camera.z-basket.z)<9);
 assert.deepEqual(reveal.look,{...basket,y:1.5});
 assert.deepEqual(discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD-.01,ground),reveal,"hold must not drift");
 const mid=discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD+DISC_GOLF_INTRO_PULLBACK*.5,ground);
 assert.equal(mid.stage,"pullback");
 assert.ok(mid.camera.x<reveal.camera.x);
 assert.ok(mid.camera.y>followCamera.y,"flyback rises to reveal a long fairway");
 const almost=discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD+DISC_GOLF_INTRO_PULLBACK-.001,ground);
 assert.ok(Math.hypot(almost.camera.x-followCamera.x,
  almost.camera.z-followCamera.z)<.01,"smooth handoff to normal aim");
 const done=discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD+DISC_GOLF_INTRO_PULLBACK,ground);
 assert.equal(done.stage,"complete");
 assert.deepEqual(done.camera,followCamera);
 assert.deepEqual(done.look,followLook);
});
test("flyback honors changing island elevation and reduced-motion camera cuts",()=>{
 const tee={x:0,z:0},basket={x:90,z:0},followCamera={x:-9,y:8,z:2};
 const followLook={x:3,y:2,z:0};
 const hill=(p:{x:number;z:number})=>10*Math.exp(-(((p.x-38)/11)**2));
 const middle=discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD+DISC_GOLF_INTRO_PULLBACK*.5,hill);
 assert.ok(middle.camera.y>=hill(middle.camera)+3.9,
  "flyback must not cut through the mountain");
 const reduced=discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD-.01,hill,true);
 assert.equal(reduced.stage,"basket");
 const cut=discGolfIntroPose(tee,basket,followCamera,followLook,
  DISC_GOLF_INTRO_HOLD+.01,hill,true);
 assert.equal(cut.stage,"complete");
 assert.deepEqual(cut.camera,followCamera);
 assert.deepEqual(cut.look,followLook);
});

test("short putts use a stable elevated third-person camera, not a zoom into chains",()=>{
 const lie={x:3,z:4},groundY=12;
 for(const d of [0,.05,1.2,3,6,9.9,10,10.1,40,75]){
  const p=discGolfThrowCameraPose(lie,{x:lie.x+d,z:lie.z},groundY);
  const boom=Math.hypot(p.camera.x-lie.x,p.camera.z-lie.z);
  assert.ok(boom>=19,"camera cannot collapse into the player at distance "+d);
  assert.ok(p.camera.y>=groundY+12);
  assert.ok(p.look.x<=lie.x+5.6,"look point cannot rush into the target");
  assert.equal(p.putting,d<=10);
 }
 const north=discGolfThrowCameraPose(lie,{x:3,z:-2},groundY);
 assert.ok(north.camera.z>lie.z,"camera should stay behind the direction of throw");
 const south=discGolfThrowCameraPose(lie,{x:3,z:9},groundY);
 assert.ok(south.camera.z<lie.z);
});
test("single elastic backswing is continuous across tap and hold with a forgiving target",()=>{
 for(const center of [4,12,35,70,95,100]){
  const tap=discGolfPullback(40,center);
  const boundary=discGolfPullback(DISC_GOLF_TAP_WINDOW_MS,center);
  const justHeld=discGolfPullback(DISC_GOLF_TAP_WINDOW_MS+.1,center);
  assert.equal(tap.power,boundary.power,"tap always uses recommended shot");
  assert.ok(Math.abs(boundary.power-justHeld.power)<=1,"no sudden short throw on hold");
  assert.equal(boundary.manual,false);
  assert.equal(justHeld.manual,true);
  assert.equal(tap.quality,"clean");
  for(let t=0;t<=3500;t+=47){
   const s=discGolfPullback(t,center);
   assert.ok(s.power>=4&&s.power<=100);
   assert.ok(s.windup>=0&&s.windup<=1);
  }
  const period=discGolfPullback(DISC_GOLF_TAP_WINDOW_MS+DISC_GOLF_SWING_CYCLE_MS,center);
  assert.equal(period.power,boundary.power,"meter can repeat safely");
 }
 const up=discGolfPullback(DISC_GOLF_TAP_WINDOW_MS+DISC_GOLF_SWING_CYCLE_MS*.25,55);
 const down=discGolfPullback(DISC_GOLF_TAP_WINDOW_MS+DISC_GOLF_SWING_CYCLE_MS*.75,55);
 assert.ok(up.power>55&&down.power<55,"hold offers both stronger and softer shots");
 assert.equal(discGolfPullback(Number.NaN,55).power,55);
});
