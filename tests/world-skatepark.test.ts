import test from "node:test";
import assert from "node:assert/strict";
import {terrainHeight,isWater} from "../lib/world/model";
import {groundHeight,nearestGrind,rampImpulseCrossing,stepTravel,type Travel} from "../lib/world/activities";
import {SKATE_PARK,SKATE_PARK_RAILS,insideSkatePark,skateParkSurface,skateParkLipCrossing} from "../lib/world/skatepark";
import {idleSkateTrick,startSkateTrick,finishSkateTrick,flickTrick,skateTrickPose,scoreSkateGrind} from "../lib/world/skateTricks";

test("south-meadow plaza is land, continuous at its boundary and under the actual rider",()=>{
 assert.equal(SKATE_PARK_RAILS.length,3);
 for(const x of [-19.9,-14,-6,0,7.9]){
  for(const z of [28.1,31,35,40,45,49,51.9]){
   const p={x,z};
   assert.equal(isWater(p),false,`park submerged at ${x},${z}`);
   const h=skateParkSurface(p);
   assert.ok(h!==null && Number.isFinite(h),`missing deck at ${x},${z}`);
   assert.ok(groundHeight(p)>=terrainHeight(x,z)-1e-6);
   assert.ok(Math.abs(groundHeight(p)-Math.max(terrainHeight(x,z),h!))<1e-5,
    "renderer and physics should sample same riding surface");
  }
 }
 for(const p of [{x:SKATE_PARK.center.x-SKATE_PARK.halfWidth,z:40},
                 {x:SKATE_PARK.center.x+SKATE_PARK.halfWidth,z:40},
                 {x:-6,z:28},{x:-6,z:52}]){
  assert.ok(Math.abs((skateParkSurface(p)??0)-terrainHeight(p.x,p.z))<1e-6,
    "blended apron must join the natural terrain without a ledge");
 }
 assert.equal(insideSkatePark({x:0,z:16}),false);
 assert.equal(insideSkatePark({x:0,z:40}),true);
});
test("bowl and quarterpipes have physically sampled relief",()=>{
 const bowl=skateParkSurface({x:-12,z:40})!;
 const coping=skateParkSurface({x:-17,z:40})!;
 assert.ok(bowl<coping-.25,"bowl must be concave");
 const flat=skateParkSurface({x:2,z:40})!;
 const quarter=skateParkSurface({x:2,z:31})!;
 assert.ok(quarter>flat+1,"quarter transition must rise above the plaza");
 for(let z=28;z<=52;z+=.2){
  const y=skateParkSurface({x:2,z});
  assert.ok(y!==null&&Number.isFinite(y));
 }
});
test("skate lip requires speed, forward heading and actual plane crossing",()=>{
 const from={x:2,z:31.25},to={x:2,z:30.75};
 assert.equal(skateParkLipCrossing(from,to,{x:0,z:-1},2),null);
 assert.equal(skateParkLipCrossing(to,from,{x:0,z:1},9),null);
 assert.equal(skateParkLipCrossing(from,to,{x:0,z:1},9),null);
 assert.equal(skateParkLipCrossing({x:18,z:31.25},{x:18,z:30.75},{x:0,z:-1},9),null);
 const hit=skateParkLipCrossing(from,to,{x:0,z:-1},9);
 assert.equal(hit?.id,"park-north-quarter");
 assert.ok(hit!.impulse>5);
 assert.equal(rampImpulseCrossing(from,to,{x:0,z:-1},"skate",9)?.id,hit?.id);
 assert.equal(rampImpulseCrossing(from,to,{x:0,z:-1},"bike",9)?.id,undefined);
});
test("park rails share deterministic grind targeting",()=>{
 const candidate=nearestGrind({x:5.1,z:40});
 assert.equal(candidate?.log.id,"park-flat-bar");
 assert.ok(candidate!.distance<.2);
 assert.ok(groundHeight(candidate!.point)>terrainHeight(candidate!.point.x,candidate!.point.z));
});
test("skateboard carves and coasts, but run mode retains standard braking",()=>{
 const from:Travel={point:{x:-6,z:40},speed:7,heading:{x:0,z:1}};
 const skate=stepTravel(from,{x:1,z:0},.05,"skate",[],false,null,0,()=>0);
 assert.ok(skate.heading.x>0&&skate.heading.x<.7);
 assert.ok(skate.heading.z>.5);
 const coast=stepTravel(from,{x:0,z:0},.05,"skate",[],false,null,0,()=>0);
 const run=stepTravel(from,{x:0,z:0},.05,"run",[],false,null,0,()=>0);
 assert.ok(coast.speed>run.speed,"skate coasting should preserve momentum");
});
test("flicks animate through completion; clean landings chain and short flips bail",()=>{
 assert.equal(flickTrick("up",.1),"Ollie");
 assert.equal(flickTrick("left",.15),"Kickflip");
 assert.equal(flickTrick("right",.55),"360 Shuvit");
 let s=startSkateTrick(idleSkateTrick(),"Kickflip",2,7);
 assert.equal(s.phase,"air");
 assert.equal(startSkateTrick(s,"Ollie",2.1,7),s,"no airborne spam");
 assert.ok(Math.abs(skateTrickPose(s,2.33).roll)>0.1);
 const landed=finishSkateTrick(s,2.8,7);
 assert.equal(landed.phase,"ground");
 assert.equal(landed.combo,1);
 assert.ok(landed.points>0);
 s=startSkateTrick(landed,"Heelflip",3.1,8);
 const combo=finishSkateTrick(s,3.8,8);
 assert.equal(combo.combo,2);
 assert.ok(combo.points>landed.points);
 const bail=finishSkateTrick(startSkateTrick(combo,"Tre Flip",5,8),5.21,8);
 assert.equal(bail.lastLabel,"Bail");
 assert.equal(bail.combo,0);
 assert.equal(bail.bails,1);
 const grind=scoreSkateGrind(combo,5,"boardslide",4);
 assert.equal(grind.combo,3);
 assert.ok(grind.best>=combo.best);
});
