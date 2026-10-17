import assert from "node:assert/strict";
import test from "node:test";
import {stepShastaCameraAnchor,shastaCameraShot} from "../lib/world/shastaCamera";
import {shastaGaitPose,shastaStrideLength} from "../lib/world/shastaGait";

test("Shasta fetch follow camera remains behind dog and shows body",()=>{
 const dog={x:5,y:11,z:-20},angle=.6;
 const anchor=stepShastaCameraAnchor(null,dog,angle,.016);
 const close=shastaCameraShot(anchor,"shasta",()=>0);
 const wide=shastaCameraShot(anchor,"chase",()=>0);
 assert.ok(close.boom>=7&&wide.boom>close.boom+3);
 const ahead=Math.sin(angle)*(close.look.x-dog.x)+
  Math.cos(angle)*(close.look.z-dog.z);
 assert.ok(ahead>=1&&ahead<3);
 const behind=Math.sin(angle)*(dog.x-close.camera.x)+
  Math.cos(angle)*(dog.z-close.camera.z);
 assert.ok(behind>7,"the camera should show Shasta from behind, not his eyes");
 assert.ok(close.camera.y>dog.y+4);
});

test("Shasta camera filters heightfield jitter and sudden heading noise",()=>{
 let anchor=stepShastaCameraAnchor(null,{x:0,y:8,z:0},0,.016);
 let maxVertical=0,maxHeading=0;
 for(let i=0;i<180;i++){
  const old=anchor;
  const target={x:i*.055,y:8+(i%2?1:-1)*.14,z:0};
  anchor=stepShastaCameraAnchor(anchor,target,(i%2?1:-1)*.22,.016);
  maxVertical=Math.max(maxVertical,Math.abs(anchor.point.y-old.point.y));
  maxHeading=Math.max(maxHeading,Math.abs(anchor.heading-old.heading));
 }
 assert.ok(maxVertical<.02,"camera must reject alternating per-frame terrain noise");
 assert.ok(maxHeading<.03,"camera yaw must not snap to changing navigation direction");
 assert.ok(anchor.point.x>7&&anchor.point.x<10);
});

test("camera respects floor clearance and resets after true teleport",()=>{
 const begin=stepShastaCameraAnchor(null,{x:0,y:0,z:0},0,.016);
 const raised=stepShastaCameraAnchor(begin,{x:1,y:1,z:2},.2,.016);
 assert.ok(raised.point.x>0&&raised.point.x<1);
 const teleported=stepShastaCameraAnchor(raised,{x:100,y:13,z:120},1,.016);
 assert.equal(teleported.point.x,100);
 const pose=shastaCameraShot(teleported,"shasta",()=>28);
 assert.ok(pose.camera.y>=31);
});

test("walk-to-trot-to-canter stride geometry changes smoothly with speed",()=>{
 for(const boundary of [3.25,8.5]){
  const a=shastaGaitPose(boundary-.001,1.8,1);
  const b=shastaGaitPose(boundary+.001,1.8,1);
  assert.ok(Math.abs(shastaStrideLength(boundary-.001)-
   shastaStrideLength(boundary+.001))<.001);
  for(let i=0;i<4;i++){
   assert.ok(Math.abs(a.feet[i].z-b.feet[i].z)<.02,
    "foot must not jump when changing gait at speed threshold");
   assert.ok(Math.abs(a.feet[i].y-b.feet[i].y)<.02,
    "individual paw height must remain continuous");
  }
 }
});
