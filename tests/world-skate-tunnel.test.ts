import test from "node:test";
import assert from "node:assert/strict";
import {
 GROVE_TUNNEL,insideSkatePark,skateParkSurface,
} from "../lib/world/skatepark";
import {groundHeight} from "../lib/world/activities";
import {
 sequoiaTubePoint,beginSkateTunnelRide,canStartSkateTunnelRide,
 skateTunnelSample,advanceSkateTunnelRide,TUBE_TAU,
} from "../lib/world/skateTunnel";
import {idleSkateTrick,scoreSkateTunnel} from "../lib/world/skateTricks";

const g=GROVE_TUNNEL;
const left={x:-1,z:0},right={x:1,z:0};
const p={x:g.center.x+g.halfLength-.65,z:g.center.z};

test("hollow sequoia contact forms a complete 360 degree inner ellipse",()=>{
 for(const x of [g.center.x-g.halfLength+.20,g.center.x,
  g.center.x+g.halfLength-.20]){
  const floor=groundHeight({x,z:g.center.z});
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2,TUBE_TAU]){
   const inner=sequoiaTubePoint(x,a,floor);
   const outer=sequoiaTubePoint(x,a,floor,true);
   assert.ok([inner.x,inner.y,inner.z,outer.y,outer.z].every(Number.isFinite));
   assert.ok(insideSkatePark({x:inner.x,z:inner.z}));
   if(a===0||a===TUBE_TAU)
    assert.ok(Math.abs(inner.y-floor)<1e-6,"wood contact joins the flat bore");
   if(a===Math.PI)assert.ok(inner.y>floor+5,"inverted ride needs actual wood ceiling");
   if(a===Math.PI/2)assert.ok(inner.z>g.center.z+2.35);
   if(a===3*Math.PI/2)assert.ok(inner.z<g.center.z-2.35);
   // Outer bark is outside the contact surface, never the riding authority.
   if(a===Math.PI)assert.ok(outer.y>inner.y+.35);
  }
 }
});

test("wall ride requires deliberate Q/E request, aligned motion and real interior",()=>{
 assert.ok(canStartSkateTunnelRide(p,left,6));
 assert.equal(canStartSkateTunnelRide(p,left,3),false);
 assert.equal(canStartSkateTunnelRide(p,{x:0,z:1},7),false);
 assert.equal(canStartSkateTunnelRide({...p,z:p.z+1},left,7),false);
 assert.equal(canStartSkateTunnelRide({x:p.x+3,z:p.z},left,7),false);
 assert.equal(canStartSkateTunnelRide(p,left,Number.NaN),false);
 assert.equal(beginSkateTunnelRide(p,left,2,1),null);
});

test("every wall ride hugs the SAME inner wood skin and exits through other mouth",()=>{
 for(const spin of [-1,1] as const){
  for(const heading of [left,right]){
   const entryPoint=heading.x<0?p:
    {x:g.center.x-g.halfLength+.65,z:g.center.z};
   let ride=beginSkateTunnelRide(entryPoint,heading,8.8,spin);
   assert.ok(ride);
   if(!ride)continue;
   let completed=false,maximum=0,upsideDown=false,steps=0;
   while(steps<1000&&!completed){
    const next=advanceSkateTunnelRide(ride,1/30);
    ride=next.ride;
    const pose=skateTunnelSample(ride,groundHeight);
    const skin=sequoiaTubePoint(pose.point.x,pose.angle,
     groundHeight({x:pose.point.x,z:g.center.z}));
    assert.ok(Math.hypot(skin.z-pose.point.z,skin.y-pose.y)<1e-7,
     "board wheels may not detach from the rendered wood");
    maximum=Math.max(maximum,pose.y);
    if(Math.abs(ride.progress-.5)<.025&&Math.abs(pose.roll)>2.75)upsideDown=true;
    completed=next.completed;steps++;
   }
   assert.ok(completed&&steps<270,"no stall under the roof");
   assert.ok(upsideDown,"real 180-degree inverted pose");
   assert.ok(maximum>groundHeight(p)+4);
   const finish=skateTunnelSample(ride,groundHeight);
   assert.ok(Math.abs(finish.point.x-ride.endX)<1e-6);
   assert.ok(Math.abs(finish.point.z-entryPoint.z)<1e-6);
   assert.ok(Math.abs(finish.y-groundHeight(finish.point))<.15);
   assert.ok(Math.sign(finish.point.x-entryPoint.x)===heading.x);
  }
 }
});

test("all tunnel completions survive 10 / 20 / 40 / 60 FPS",()=>{
 for(const fps of [10,20,40,60]){
  let ride=beginSkateTunnelRide(p,left,7.8,1);
  assert.ok(ride);
  if(!ride)continue;
  let done=false,n=0;
  while(n<10*fps&&!done){
   const next=advanceSkateTunnelRide(ride,1/fps);
   ride=next.ride;done=next.completed;n++;
  }
  assert.ok(done,"exit cannot leave visitor stuck inverted: "+fps+" FPS");
  assert.ok(n/fps<8);
 }
});

test("Sequoia Hollow 360 counts as a regular assisted skate trick",()=>{
 const state=idleSkateTrick();
 const next=scoreSkateTunnel(state,8,7);
 assert.equal(next.phase,"ground");
 assert.match(next.lastLabel,/Sequoia Hollow 360/);
 assert.ok(next.points>=350);
 assert.equal(scoreSkateTunnel(state,Number.NaN,7),state);
});

test("normal walk/ride uses the same clean tunnel floor as the exterior terrain",()=>{
 for(let x=g.center.x-g.halfLength+.5;x<g.center.x+g.halfLength-.5;x+=.18){
  const floor=groundHeight({x,z:g.center.z});
  assert.ok(Number.isFinite(floor));
  assert.ok(Math.abs(floor-skateParkSurface({x,z:g.center.z})!)<1e-6);
  assert.ok(Math.abs(floor-groundHeight({x:x+.1,z:g.center.z}))<.5);
 }
});
