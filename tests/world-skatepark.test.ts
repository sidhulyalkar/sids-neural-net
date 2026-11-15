import test from "node:test";
import assert from "node:assert/strict";
import {terrainHeight,isWater} from "../lib/world/model";
import {skateRollingSpeed,skateLean} from "../lib/world/skateDynamics";
import {groundHeight,nearestGrind,rampImpulseCrossing,stepTravel,type Travel} from "../lib/world/activities";
import {SKATE_PARK,SKATE_PARK_RAILS,insideSkatePark,skateParkSurface,skateParkLipCrossing} from "../lib/world/skatepark";
import {idleSkateTrick,startSkateTrick,finishSkateTrick,flickTrick,skateTrickPose,scoreSkateGrind,queueSkateSpin,startSkateManual,stepSkateManual,finishSkateManual} from "../lib/world/skateTricks";

test("south-meadow plaza is land, continuous at its boundary and under the actual rider",()=>{
 assert.equal(SKATE_PARK_RAILS.filter(rail=>!rail.chainId).length,3,
  "retain original rails as additions expand the park");
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

test("manuals are speed-gated, distance-scored, release-gated and never double-credit",()=>{
 const idle=idleSkateTrick();
 assert.equal(startSkateManual(idle,"manual",1),idle,"standing still cannot score a manual");
 let state=startSkateManual(idle,"manual",6);
 assert.equal(state.manual,"manual");
 for(let i=1;i<=18;i++)state=stepSkateManual(state,.05,6,i*.05);
 assert.ok(state.manualDistance>5);
 const completed=finishSkateManual(state,1);
 assert.equal(completed.manual,"none");
 assert.ok(completed.points>0);
 assert.equal(completed.combo,1);
 assert.equal(finishSkateManual(completed,1.1),completed,
  "releasing twice must not credit another trick");
 assert.equal(startSkateManual(completed,"nose-manual",6).manual,"nose-manual");
 let under=startSkateManual(idle,"nose-manual",3);
 under=stepSkateManual(under,.1,3,.1);
 assert.equal(finishSkateManual(under,.15).points,0,
  "a tiny accidental weight shift is not a scored line");
});
test("180 spin changes stance only on clean landings; 360 holds stance",()=>{
 const original=idleSkateTrick();
 let state=startSkateTrick(original,"Ollie",1,8);
 state=queueSkateSpin(state,1,1.12);
 assert.equal(state.spinDegrees,180);
 assert.ok(skateTrickPose(state,1.33).bodyYaw>0);
 let landed=finishSkateTrick(state,1.8,8);
 assert.equal(landed.stance,"fakie");
 assert.match(landed.lastLabel,/180/);
 assert.match(landed.lastLabel,/fakie/);
 state=startSkateTrick(landed,"Kickflip",2,8);
 state=queueSkateSpin(state,-1,2.12);
 state=queueSkateSpin(state,-1,2.14);
 assert.equal(state.spinDegrees,-360);
 assert.equal(queueSkateSpin(state,-1,2.17),state,"spin angle is bounded");
 assert.equal(skateTrickPose(state,2.2).progress<1,true);
 landed=finishSkateTrick(state,2.83,9);
 assert.equal(landed.stance,"fakie","360 should not toggle stance");
 assert.ok(landed.combo>=2);
 const late=queueSkateSpin(startSkateTrick(landed,"Ollie",3,8),1,3.5);
 assert.equal(late.spinDegrees,0,"late stick input cannot snap the body around");
});
test("bailing clears spins and manuals while retaining the prior stance",()=>{
 let s=startSkateTrick(idleSkateTrick(),"Kickflip",2,6);
 s=queueSkateSpin(s,-1,2.1);
 s=finishSkateTrick(s,2.2,5);
 assert.equal(s.stance,"regular");
 assert.equal(s.spinDegrees,0);
 assert.equal(s.combo,0);
 assert.equal(s.points,0);
 assert.equal(s.lastLabel,"Bail");
 assert.ok(s.bails>=1);
});

test("rolling speed respects gravity, friction, coast-down and bounded FPS",()=>{
 const base={speed:6,dt:.05,pushing:false,maxSpeed:11,boosted:false};
 const flat=skateRollingSpeed({...base,riseAhead:0});
 const downhill=skateRollingSpeed({...base,riseAhead:-.55});
 const uphill=skateRollingSpeed({...base,riseAhead:.55});
 assert.ok(downhill>flat&&flat>uphill,
  "slope should add/subtract momentum in the direction of riding");
 assert.ok(flat<6&&flat>5.8,"coasting should slow without snapping to zero");
 const pushed=skateRollingSpeed({...base,pushing:true,riseAhead:0});
 assert.ok(pushed>6,"push should accelerate on flat");
 const boosted=skateRollingSpeed({...base,pushing:true,boosted:true,riseAhead:0});
 assert.ok(boosted>pushed);
 const coastBoost=skateRollingSpeed({...base,speed:17,riseAhead:0});
 assert.ok(coastBoost<17&&coastBoost>11,
  "boost expiry must retain momentum, then converge smoothly");
 assert.equal(skateRollingSpeed({...base,speed:6,dt:Infinity,riseAhead:0}),6,
  "undefined frame duration must never explode physics");
 assert.ok(skateLean(9,.2)>0);
 assert.ok(skateLean(9,-.2)<0);
 assert.ok(Math.abs(skateLean(30,10))<=.19);
});
