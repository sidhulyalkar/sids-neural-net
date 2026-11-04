import assert from "node:assert/strict";
import test from "node:test";
import {ALPINE_HALFPIPE,ALPINE_KICKERS,ALPINE_FEATURE_BOXES} from "../lib/world/alpineTerrainPark";
import {
 idleAlpineTrick,halfpipeLipCrossing,alpineKickerCrossing,alpineBoxExitCrossing,
 beginAlpineTrick,alpineGrab,alpineSpin,advanceAlpineTrick,landAlpineTrick,
 alpineTrickPose,cancelAlpineTrick,
} from "../lib/world/alpineTricks";
import {rampImpulseCrossing,rampImpulseAt,stepAirborne,RIDE_RAMPS} from "../lib/world/activities";

const h=ALPINE_HALFPIPE;
const z=(h.startZ+h.endZ)/2;
const lip=h.rimHalfWidth-.32;
const center=h.centerX;
/** All trick evidence is integrated over valid simulation substeps, never
 * an invalid one-second shortcut that the runtime rightly refuses. */
const integrate=(state:ReturnType<typeof idleAlpineTrick>,seconds:number,clearance:number,step=.05)=>{
 let left=seconds,next=state;
 while(left>1e-9){const dt=Math.min(step,left);next=advanceAlpineTrick(next,dt,clearance);left-=dt}
 return next;
};
const crossing=(side:-1|1,delta=.36)=>({
  before:{x:center+side*(lip-delta),z},
  after:{x:center+side*(lip+.12),z},
  heading:{x:side,z:-.2},
});
test("both halfpipe coping edges launch only on actual outward crossings",()=>{
 for(const side of [-1,1] as const){
  const p=crossing(side);
  const hit=halfpipeLipCrossing(p.before,p.after,p.heading,9);
  assert.equal(hit?.id,side===1?"alpine-halfpipe-right":"alpine-halfpipe-left");
  assert.ok(hit&&hit.impulse>=3.5&&hit.impulse<=6.35);
  assert.equal(rampImpulseCrossing(p.before,p.after,p.heading,"ski",9)?.id,hit.id);
  assert.equal(halfpipeLipCrossing(p.after,p.before,{x:-side,z:0},10),null,
    "riding inward does not launch a halfpipe trick");
  assert.equal(halfpipeLipCrossing(p.before,p.after,{x:-side,z:0},10),null,
    "heading opposite to outward displacement does not launch");
  assert.equal(halfpipeLipCrossing(p.before,p.after,p.heading,5.79),null);
  assert.equal(halfpipeLipCrossing(p.before,p.after,p.heading,NaN),null);
  assert.equal(halfpipeLipCrossing(p.before,p.after,p.heading,Infinity),null);
  assert.equal(halfpipeLipCrossing({...p.before,z:h.startZ+.8},
    {...p.after,z:h.startZ+.8},p.heading,9),null,
    "entry/exit transition is not a lip");
  assert.equal(halfpipeLipCrossing({...p.before,z:h.endZ-.9},
    {...p.after,z:h.endZ-.9},p.heading,9),null);
  assert.equal(halfpipeLipCrossing(p.before,
    {...p.after,x:p.after.x+side*4},p.heading,10),null,
    "teleport may not count as a lip crossing");
  assert.equal(halfpipeLipCrossing({x:center+side*(lip+.8),z},
    {x:center+side*(lip+1.0),z},p.heading,9),null,
    "starting outside is not a physical takeoff");
  assert.equal(rampImpulseCrossing(p.before,p.after,p.heading,"run",9),null);
 }
});
test("halfpipe crossing retains bounded impulse across a large speed range",()=>{
 const p=crossing(1);
 for(let speed=5.8;speed<=27;speed+=.4){
   const hit=halfpipeLipCrossing(p.before,p.after,p.heading,speed);
   assert.ok(hit&&hit.impulse<=6.35&&hit.impulse>=3.5);
 }
 for(let i=-25;i<=25;i++){
   const testZ=z+i*.16;
   const hit=halfpipeLipCrossing({...p.before,z:testZ},
     {...p.after,z:testZ},p.heading,8.2);
   assert.ok(hit,"inside the center halfpipe section must have no dead seam at "+testZ);
 }
});
test("every alpine kicker is swept, direction-aware, and immune to standing/retrigger",()=>{
 for(const kicker of ALPINE_KICKERS){
  const len=Math.hypot(kicker.heading.x,kicker.heading.z);
  const f={x:kicker.heading.x/len,z:kicker.heading.z/len};
  const normal={x:f.z,z:-f.x};
  const before={x:kicker.point.x-f.x*.24,z:kicker.point.z-f.z*.24};
  const after={x:kicker.point.x+f.x*.24,z:kicker.point.z+f.z*.24};
  assert.equal(alpineKickerCrossing(before,after,f,7.5)?.id,kicker.id);
  assert.equal(rampImpulseCrossing(before,after,f,"ski",7.5)?.id,kicker.id);
  assert.equal(rampImpulseCrossing(before,after,f,"bike",7.5)?.id,kicker.id);
  assert.equal(rampImpulseCrossing(after,after,f,"ski",7.5),null);
  assert.equal(rampImpulseCrossing(after,before,{x:-f.x,z:-f.z},"ski",7.5),null);
  assert.equal(alpineKickerCrossing(before,after,f,4.99),null);
  assert.equal(alpineKickerCrossing(
    {x:before.x+normal.x*1.5,z:before.z+normal.z*1.5},
    {x:after.x+normal.x*1.5,z:after.z+normal.z*1.5},f,8),null);
  assert.equal(alpineKickerCrossing(before,after,{x:normal.x,z:normal.z},9),null);
  // Legacy proximity helper is still useful for other authored features,
  // but may not automatically bypass the new alpine sweep.
  assert.equal(rampImpulseAt(kicker.point,f,"ski",7.5)?.id,kicker.id);
  assert.equal(rampImpulseCrossing(kicker.point,kicker.point,f,"ski",7.5),null);
 }
});
test("large snowpark box produces a single bounded pop off the far end",()=>{
 for(const box of ALPINE_FEATURE_BOXES){
  const dx=box.to.x-box.from.x,dz=box.to.z-box.from.z,l=Math.hypot(dx,dz);
  const forward={x:dx/l,z:dz/l},side={x:-forward.z,z:forward.x};
  const before={x:box.to.x-forward.x*.25,z:box.to.z-forward.z*.25};
  const after={x:box.to.x+forward.x*.3,z:box.to.z+forward.z*.3};
  assert.equal(alpineBoxExitCrossing(before,after,forward,6)?.id,box.id);
  assert.equal(rampImpulseCrossing(before,after,forward,"ski",6)?.id,box.id);
  assert.equal(alpineBoxExitCrossing(after,before,{x:-forward.x,z:-forward.z},6),null);
  assert.equal(alpineBoxExitCrossing(before,after,forward,3),null);
  assert.equal(alpineBoxExitCrossing(before,after,{x:side.x,z:side.z},7),null);
  const far={x:after.x+side.x*2,z:after.z+side.z*2};
  assert.equal(alpineBoxExitCrossing(before,far,forward,7),null);
  assert.ok(alpineBoxExitCrossing(before,after,forward,25)!.impulse<=4.6);
 }
});
test("land a real halfpipe air with timed grab and completed 180°",()=>{
 const trigger=halfpipeLipCrossing(crossing(-1).before,crossing(-1).after,{x:-1,z:0},10)!;
 let state=beginAlpineTrick(idleAlpineTrick(),trigger,10,10);
 assert.equal(state.phase,"air");assert.equal(state.attempts,1);
 assert.strictEqual(beginAlpineTrick(state,trigger,10.1,10),state);
 assert.strictEqual(alpineSpin(state,-1,10.01),state,"spin too soon is rejected");
 state=alpineGrab(state,"left");
 state=advanceAlpineTrick(state,.18,.62);
 state=alpineSpin(state,-1,10.18);
 assert.equal(state.spinDegrees,-180);
 assert.equal(alpineTrickPose(state,10.38).grab,"left");
 state=advanceAlpineTrick(state,.25,1.25);
 state=alpineGrab(state,"none");
 state=advanceAlpineTrick(state,.2,.38);
 state=landAlpineTrick(state,10.64,8.4,true);
 assert.equal(state.phase,"landed");
 assert.equal(state.landings,1);
 assert.equal(state.bails,0);
 assert.equal(state.combo,1);
 assert.ok(state.score>200);
 assert.equal(state.best,state.score);
 assert.equal(state.stance,"switch","a completed half-turn must remain switch on landing");
 assert.ok(Math.abs(alpineTrickPose(state,10.66).yaw-Math.PI)<1e-9);
 assert.match(state.lastLabel,/Halfpipe air \+ 180° \+ grab/);
 assert.strictEqual(alpineGrab(state,"right"),state);
 assert.strictEqual(alpineSpin(state,1,11),state);
});
test("trick edge cases: short flight, no altitude, missed landings, early spins",()=>{
 const trigger={id:"alpine-flat-box",kind:"box" as const,impulse:3.8};
 let s=beginAlpineTrick(idleAlpineTrick(),trigger,0,6);
 s=alpineSpin(s,1,.12);
 s=alpineSpin(s,1,.14);
 assert.equal(s.spinDegrees,180,"a held J key cannot queue duplicate 180s");
 s=advanceAlpineTrick(s,.15,.55);
 let result=landAlpineTrick(s,.16,7,true);
 assert.equal(result.phase,"bailed");
 assert.equal(result.score,0);
 assert.equal(result.bails,1);
 const zeroPeak=landAlpineTrick(integrate(
   beginAlpineTrick(result,trigger,1,6),.8,0),1.8,7,true);
 assert.equal(zeroPeak.phase,"bailed");
 const unsafe=landAlpineTrick(integrate(
   beginAlpineTrick(result,trigger,3,6),.5,.9),3.5,8,false);
 assert.equal(unsafe.phase,"bailed");
 const snap720=beginAlpineTrick(result,trigger,4,8);
 const cheated={...snap720,spinDegrees:720,airtime:.25,peakClearance:.5};
 assert.equal(landAlpineTrick(cheated,4.25,9,true).phase,"bailed",
   "impossible last-frame 720° cannot earn points");
 assert.equal(cancelAlpineTrick(snap720).phase,"bailed");
 assert.equal(cancelAlpineTrick(result),result);
});
test("rotation starts without a visual snap and cannot be scored unfinished",()=>{
 const takeoff={id:"alpine-halfpipe-right",kind:"halfpipe" as const,impulse:5};
 let state=beginAlpineTrick(idleAlpineTrick(),takeoff,0,9);
 state=alpineSpin(state,1,.21);
 assert.ok(Math.abs(alpineTrickPose(state,.21).yaw)<1e-9,
   "the body must not instantly jump to the queued 180-degree target");
 const middle=alpineTrickPose(state,.32).yaw;
 assert.ok(middle>.1&&middle<Math.PI-.1,
   "the queued spin should be visibly progressing");
 state=integrate(state,.56,.9);
 assert.equal(landAlpineTrick(state,.29,8,true).phase,"bailed",
   "a late 180 cannot be claimed after only 80 ms");
 const landed=landAlpineTrick(state,.56,8,true);
 assert.equal(landed.phase,"landed");
 assert.equal(landed.stance,"switch");
});
test("feature combos reward real landings but expire, bails break lines",()=>{
 let s=idleAlpineTrick();
 const trig={id:"alpine-halfpipe-pop",kind:"halfpipe" as const,impulse:4.6};
 const land=(takeoffAt:number,finishAt:number)=>{
   s=beginAlpineTrick(s,trig,takeoffAt,8);
   s=integrate(s,finishAt-takeoffAt,.8);
   s=landAlpineTrick(s,finishAt,7,true);
 };
 land(1,1.6);
 const first=s.score;assert.equal(s.combo,1);
 land(3,3.55);
 assert.equal(s.combo,2);assert.ok(s.score>first);
 const best=s.best;
 s=beginAlpineTrick(s,trig,4,7);
 s=advanceAlpineTrick(s,.3,.5);
 s=landAlpineTrick(s,4.3,0,false);
 assert.equal(s.combo,0);assert.equal(s.score,0);assert.equal(s.best,best);
 land(11,11.6);assert.equal(s.combo,1);
 assert.equal(s.landings,3);
});
test("180-degree switch landing persists across runs and another 180 recovers regular stance",()=>{
 let s=idleAlpineTrick();
 const trig={id:"alpine-tabletop",kind:"kicker" as const,impulse:7};
 s=beginAlpineTrick(s,trig,1,9);
 s=alpineSpin(s,1,1.2);
 s=integrate(s,.55,1.2);
 s=landAlpineTrick(s,1.55,8,true);
 assert.equal(s.stance,"switch");
 assert.ok(Math.abs(alpineTrickPose(s,2).yaw-Math.PI)<1e-9);
 s=beginAlpineTrick(s,trig,3,9);
 s=alpineSpin(s,-1,3.2);
 s=integrate(s,.55,1.2);
 assert.ok(alpineTrickPose(s,3.5).yaw<Math.PI);
 s=landAlpineTrick(s,3.55,7.5,true);
 assert.equal(s.stance,"regular");
});
test("trick evidence is stable under 20, 30 and 60 Hz frame advances",()=>{
 const trig={id:"alpine-halfpipe-left",kind:"halfpipe" as const,impulse:5.1};
 const results=[1/20,1/30,1/60].map(step=>{
   let s=beginAlpineTrick(idleAlpineTrick(),trig,0,8);
   s=alpineGrab(s,"left");
   s=integrate(s,.6,.82,step);
   s=alpineGrab(s,"none");
   return landAlpineTrick(s,.6,7,true);
 });
 assert.ok(results.every(s=>s.phase==="landed"));
 assert.deepEqual(results.map(s=>s.score),[results[0].score,results[0].score,results[0].score]);
 const inAir=beginAlpineTrick(idleAlpineTrick(),trig,1,8);
 assert.strictEqual(advanceAlpineTrick(inAir,.7,1),inAir,
   "oversized timing updates are rejected, not used to fabricate airtime");
 assert.strictEqual(advanceAlpineTrick(inAir,NaN,1),inAir);
});
test("real jump physics supports a finite air arc and touchdown",()=>{
 const ground=12,launch=4.7;let y=ground+.03,v=launch,up=false,landed=false;
 for(let i=0;i<200;i++){
  const next=stepAirborne(y,v,ground,.016);
  if(next.airHeight>.25)up=true;
  y=next.y;v=next.verticalSpeed;
  if(up&&next.airHeight===0){landed=true;break}
 }
 assert.ok(up&&landed,"normal gravity brings a park pop back to its skiable support");
});
test("non-alpine authored ramp behavior is preserved",()=>{
 const ramp=RIDE_RAMPS.find(x=>x.id==="ski-kicker")!;
 const norm=Math.hypot(ramp.heading.x,ramp.heading.z);
 const head={x:ramp.heading.x/norm,z:ramp.heading.z/norm};
 const p={x:ramp.point.x-head.x*.24,z:ramp.point.z-head.z*.24};
 const q={x:ramp.point.x+head.x*.24,z:ramp.point.z+head.z*.24};
 assert.equal(rampImpulseCrossing(p,q,head,"ski",8)?.id,"ski-kicker");
});
