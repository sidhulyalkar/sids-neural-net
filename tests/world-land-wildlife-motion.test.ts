import test from "node:test";
import assert from "node:assert/strict";
import {angularDifference,stepCritterLocomotion,type CritterLocomotion} from "../lib/world/landWildlifeMotion";
const start={point:{x:0,z:0},home:{x:0,z:0},heading:0,phase:1,
 roam:4,speed:1.5,panicUntil:0,fleeFrom:null};
test("small animals turn gradually rather than alternating directions each frame",()=>{
 let motion:CritterLocomotion=start,now=2,maxTurn=0,flips=0,previous=motion.heading;
 for(let i=0;i<550;i++){
  now+=1/60;
  const nearThreat=i%5<2?{x:motion.point.x+.4,z:motion.point.z+.2}:null;
  const out=stepCritterLocomotion(motion,1/60,now,nearThreat,()=>false);
  maxTurn=Math.max(maxTurn,Math.abs(angularDifference(motion.heading,out.motion.heading)));
  if(Math.abs(angularDifference(previous,out.motion.heading))>Math.PI*.7)flips++;
  previous=out.motion.heading;
  motion=out.motion;
  assert.ok(Math.hypot(motion.point.x,motion.point.z)<=start.roam*1.75+1e-6);
  assert.ok(Number.isFinite(motion.heading)&&Number.isFinite(motion.phase));
 }
 assert.equal(flips,0);
 assert.ok(maxTurn<.05,"turn capped to a few degrees per frame");
});
test("threat response persists through intermittent detections and wet edges",()=>{
 const scared=stepCritterLocomotion(start,.05,5,{x:.5,z:0},()=>false);
 assert.ok(scared.motion.panicUntil>6);
 const next=stepCritterLocomotion(scared.motion,.05,5.2,null,()=>false);
 assert.ok(next.motion.fleeFrom!==null);
 assert.equal(next.motion.panicUntil,scared.motion.panicUntil);
 const blocked=stepCritterLocomotion(next.motion,.05,5.3,null,()=>true);
 assert.deepEqual(blocked.motion.point,next.motion.point);
 assert.equal(blocked.step,0);
 const stopped=stepCritterLocomotion(next.motion,0,5.4,null,()=>false);
 assert.equal(stopped.motion,next.motion);
});

test("wildlife gait varies by species, rests naturally and flees immediately",()=>{
  const walk=(kind:"lizard"|"rabbit"|"quail")=>{
    let motion:CritterLocomotion={...start,kind,point:{...start.point},home:{...start.home}};
    let stopped=0,moved=0;
    for(let i=0;i<600;i++){
      const out=stepCritterLocomotion(motion,1/60,2+i/60,null,()=>false);
      if(out.step===0)stopped++;else moved++;
      motion=out.motion;
      assert.ok(Math.hypot(motion.point.x,motion.point.z)<start.roam*1.75+1e-6);
    }
    assert.ok(stopped>40 && moved>40,kind+" should pause and explore");
    const fleeing=stepCritterLocomotion(motion,1/60,13,
      {x:motion.point.x+.4,z:motion.point.z+.2},()=>false);
    assert.ok(fleeing.motion.panicUntil>13);
    assert.ok(fleeing.step>0,"threat overrides resting motion");
    return [motion.point.x,motion.point.z,stopped,moved];
  };
  assert.notDeepEqual(walk("lizard"),walk("rabbit"));
  assert.notDeepEqual(walk("quail"),walk("rabbit"));
  assert.deepEqual(walk("lizard"),walk("lizard"),"repeatable per-species animation");
});
