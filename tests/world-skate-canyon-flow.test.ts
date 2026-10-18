import test from "node:test";
import assert from "node:assert/strict";
import {
 CANYON_FLOW,CANYON_MANUAL_PADS,CANYON_RAIL_CHAINS,
 SKATE_PARK_RAILS,SKATE_LOOP,
 insideMeadowConnector,insideCanyonFlow,insideSkatePark,canyonFlowRise,skateParkSurface,
 advanceRailChain,railLiftAt,skateParkLipCrossing,skateParkZone,
} from "../lib/world/skatepark";
import {terrainHeight,isWater} from "../lib/world/model";
import {nearestGrind,groundHeight} from "../lib/world/activities";

test("canyon link stays on dry native terrain and fades smoothly at all edges",()=>{
 let raised=0;
 for(let x=CANYON_FLOW.startX;x<=CANYON_FLOW.endX+.001;x+=.21){
  for(let z=CANYON_FLOW.centerZ-CANYON_FLOW.halfWidth;
    z<=CANYON_FLOW.centerZ+CANYON_FLOW.halfWidth+.001;z+=.27){
   const p={x,z};
   if(!insideCanyonFlow(p))continue;
   assert.equal(isWater(p),false);
   const height=skateParkSurface(p);
   assert.ok(height!==null&&Number.isFinite(height));
   if(!insideSkatePark(p)){
    assert.ok(Math.abs(height!-
      (terrainHeight(x,z)+canyonFlowRise(p)+
       CANYON_MANUAL_PADS.reduce((h,pad)=>{
        const r=Math.hypot(x-pad.center.x,z-pad.center.z);
        return h+(r<pad.radius?pad.lift:0);
       },0)))<=.4,
       "all raised features belong to one wheel support field");
   }
   if(canyonFlowRise(p)>.25)raised++;
  }
 }
 assert.ok(raised>80,"eastern flow path must contain substantive rollers");
 for(const z of [35.1,37.6,39.4,42.2,43.8]){
  const a={x:7.99,z},b={x:8.01,z};
  assert.ok(Math.abs(groundHeight(a)-groundHeight(b))<.13,
   "east seam must not contain a wheel-catching ledge");
 }
 assert.equal(skateParkSurface({x:36,z:39.4}),null,
  "outside the authored path native terrain remains authoritative");
});

test("eastern forest route has real pump rollers, two low manual pads and an exit hip",()=>{
 assert.equal(CANYON_MANUAL_PADS.length,2);
 for(const r of CANYON_FLOW.rollers){
  const center={x:r.x,z:CANYON_FLOW.centerZ};
  assert.ok(canyonFlowRise(center)>.20);
  assert.ok(groundHeight(center)>terrainHeight(center.x,center.z)+.20);
 }
 for(const pad of CANYON_MANUAL_PADS){
  assert.ok(insideCanyonFlow(pad.center));
  assert.ok(groundHeight(pad.center)>terrainHeight(pad.center.x,pad.center.z)+pad.lift*.85);
 }
 const p={x:CANYON_FLOW.hip.x-.14,z:CANYON_FLOW.hip.z};
 const q={x:CANYON_FLOW.hip.x+.18,z:CANYON_FLOW.hip.z};
 const crossed=skateParkLipCrossing(p,q,{x:1,z:0},8.1);
 assert.equal(crossed?.id,"canyon-wood-hip");
 assert.equal(skateParkLipCrossing(p,q,{x:-1,z:0},9),null);
 assert.equal(skateParkLipCrossing(p,q,{x:1,z:0},1.5),null);
});

test("eight rail lines have matching endpoints, polished rises and safe placement",()=>{
 assert.equal(CANYON_RAIL_CHAINS.length,8);
 const names=new Set<string>();
 for(const chain of CANYON_RAIL_CHAINS){
  assert.ok(chain.points.length>=3);
  assert.equal(chain.heights.length,chain.points.length);
  assert.ok(!names.has(chain.id));names.add(chain.id);
  const rails=SKATE_PARK_RAILS.filter(s=>s.chainId===chain.id)
   .sort((a,b)=>(a.segment??0)-(b.segment??0));
  assert.equal(rails.length,chain.points.length-1);
  for(let i=0;i<rails.length;i++){
   const rail=rails[i];
   assert.equal(rail.segment,i);
   assert.ok(insideSkatePark(rail.a)||insideMeadowConnector(rail.a));
   assert.ok(insideSkatePark(rail.b)||insideMeadowConnector(rail.b));
   assert.equal(isWater(rail.a),false);
   assert.equal(isWater(rail.b),false);
   assert.ok(Math.hypot(rail.a.x-rail.b.x,rail.a.z-rail.b.z)>.9);
   assert.ok(Math.abs(railLiftAt(rail,0)-chain.heights[i])<1e-8);
   assert.ok(Math.abs(railLiftAt(rail,1)-chain.heights[i+1])<1e-8);
   assert.ok(Math.abs(railLiftAt(rail,1)-railLiftAt(rail,0))<.28);
   if(i>0)assert.deepEqual(rails[i-1].b,rail.a);
   // No new feature may pass inside the existing high-speed inversion gate.
   const dist=Math.hypot(rail.a.x-SKATE_LOOP.center.x,
    rail.a.z-SKATE_LOOP.center.z);
   assert.ok(dist>SKATE_LOOP.radius*.60);
  }
 }
 const mid={x:11.4,z:37.65};
 const nearest=nearestGrind(mid,.08);
 assert.ok(nearest&&"chainId" in nearest.log);
 assert.equal(nearest.log.chainId,"canyon-snake");
 assert.equal(skateParkZone({x:17,z:39.4}),"canyon-flow");
 assert.equal(SKATE_PARK_RAILS.filter(r=>!r.chainId).length,3,
  "all legacy rail targets must be retained");
});

test("switchbacks and zigzags travel through every linked segment at 10-60 FPS",()=>{
 for(const chain of CANYON_RAIL_CHAINS){
  const segments=SKATE_PARK_RAILS.filter(s=>s.chainId===chain.id);
  for(const direction of [-1,1] as const){
   const first=segments[direction>0?0:segments.length-1];
   for(const fps of [10,20,40,60]){
    let current=first,t=direction>0?0:1;
    let meters=0,finished=false,visited=new Set<number>();
    for(let i=0;i<15*fps&&!finished;i++){
     visited.add(current.segment!);
     const step=advanceRailChain(current,t,direction,8.5/fps);
     assert.ok(step.covered>=0&&step.covered<=8.5/fps+1e-6);
     assert.ok(step.rail.chainId===chain.id);
     meters+=step.covered;current=step.rail;t=step.t;
     finished=step.finished;
    }
    assert.ok(finished,"chain must have finite exit: "+chain.id+" "+fps);
    assert.equal(visited.size,segments.length,"do not drop a kink: "+chain.id);
    const length=segments.reduce((sum,seg)=>sum+
     Math.hypot(seg.b.x-seg.a.x,seg.b.z-seg.a.z),0);
    assert.ok(Math.abs(meters-length)<1e-5,
     "grind scoring must count path arclength, not Euclidean shortcut");
    assert.ok(Math.abs(t-(direction>0?1:0))<1e-7);
   }
  }
 }
});
