import test from "node:test";
import assert from "node:assert/strict";
import {followRideSurfacePose} from "../lib/world/rideSurface";
import {stepTravel,type Travel} from "../lib/world/activities";

const eps=1e-9;
test("bike, skateboard and ski steer by gameplay heading, regardless of slope filtering",()=>{
 const previous={pitch:0,roll:0,yaw:1.8};
 const pitchRoll={pitch:.72,roll:-.52};
 for(const yaw of [0,.4,Math.PI/2,Math.PI,-Math.PI/2,-2.5]){
  const result=followRideSurfacePose(previous,{...pitchRoll,yaw},1/60);
  assert.ok(Math.abs(result.yaw-yaw)<eps,"terrain banking must never delay facing");
  assert.ok(result.pitch>0&&result.pitch<pitchRoll.pitch);
  assert.ok(result.roll<0&&result.roll>pitchRoll.roll);
 }
});
test("ride bank damps toward support even at slow FPS, never freezes",()=>{
 let pose={pitch:0,roll:0,yaw:0};
 for(let i=0;i<40;i++)
  pose=followRideSurfacePose(pose,{pitch:.4,roll:-.25,yaw:Math.PI},.05);
 assert.ok(Math.abs(pose.pitch-.4)<.001);
 assert.ok(Math.abs(pose.roll+.25)<.001);
 assert.equal(pose.yaw,Math.PI);
});
test("skate wheels can pivot away from a solid sudden lip instead of freezing heading",()=>{
 const from={x:8,z:-54.2};
 const current:Travel={point:from,heading:{x:0,z:1},speed:11};
 const shelf=(p:{x:number;z:number})=>p.z>-53.98?30:0;
 const next=stepTravel(current,{x:1,z:0},.05,"skate",[],
  false,null,0,shelf,false,0);
 assert.equal(next.speed,0,"a genuine vertical face must remain solid");
 assert.deepEqual(next.point,from);
 assert.ok(next.heading.x>.01,"blocked riders must be able to turn away");
});
