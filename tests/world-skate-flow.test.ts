import test from "node:test";
import assert from "node:assert/strict";
import {activityLanding,groundHeight,rampImpulseCrossing,stepTravel,type Travel} from "../lib/world/activities";
import {
  REDWOOD_BOWL,SKATE_GROVE_FLOW,SKATE_PARK,insideSkatePark,
  skateGroveStartHeading,skateParkLipCrossing,redwoodBowlExitCrossing,
} from "../lib/world/skatepark";

const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

test("Grove arrival faces the carved east roll-in, not an unrelated compass direction",()=>{
 const landing=activityLanding("skate");
 assert.deepEqual(landing,SKATE_GROVE_FLOW.approach);
 const heading=skateGroveStartHeading();
 assert.ok(Math.abs(Math.hypot(heading.x,heading.z)-1)<1e-6);
 assert.ok(heading.x<-.94&&Math.abs(heading.z)<.12,
  "one forward push should point toward the tree opening");
 const target=SKATE_GROVE_FLOW.splitEntry;
 assert.ok((target.x-landing!.x)*heading.x+
  (target.z-landing!.z)*heading.z>9);
 for(const p of Object.values(SKATE_GROVE_FLOW))
  assert.equal(insideSkatePark(p),true);
});

test("rolling from the wood approach traverses the entrance and bowl floor without phantom ledges",()=>{
 const heading=skateGroveStartHeading();
 let travel:Travel={point:{...SKATE_GROVE_FLOW.approach},heading,speed:0};
 const zones:string[]=[];
 const startY=groundHeight(travel.point);
 let minSpeed=Infinity,seenOpening=false,seenFloor=false,stalls=0,exits=0;
 for(let step=0;step<170;step++){
  const before=travel;
  travel=stepTravel(travel,heading,.05,"skate",[],false,null,0);
  assert.ok(Number.isFinite(travel.speed));
  assert.ok(Number.isFinite(groundHeight(travel.point)));
  assert.ok(insideSkatePark(travel.point,2),"test flow should not leave grove before first outer rim");
  const rise=groundHeight(travel.point)-groundHeight(before.point);
  assert.ok(rise<.60,"board must never be stopped by a hidden terrain step");
  if(step>10&&travel.speed<.5)stalls++;
  if(distance(travel.point,SKATE_GROVE_FLOW.splitEntry)<.7)seenOpening=true;
  if(distance(travel.point,REDWOOD_BOWL.center)<1.25)seenFloor=true;
  if(distance(travel.point,REDWOOD_BOWL.center)<REDWOOD_BOWL.rimRadius)
    minSpeed=Math.min(minSpeed,travel.speed);
  const exit=redwoodBowlExitCrossing(before.point,travel.point,travel.heading,travel.speed);
  if(exit){exits++;assert.equal(exit.id,"redwood-bowl-exit");}
  zones.push(travel.point.x.toFixed(2));
  if(travel.point.x < REDWOOD_BOWL.center.x-REDWOOD_BOWL.rimRadius-.3)break;
 }
 assert.ok(seenOpening&&seenFloor,"the straight opening route must reach the carved tree floor");
 assert.ok(stalls===0,"continuous board ride must not require a recovery teleport");
 assert.ok(exits===1,"fast outward bowl exit should register exactly once");
 assert.ok(minSpeed>2.5,"the carve should keep enough momentum to feel natural");
 assert.ok(startY>0&&zones.length>40,"meaningful ride distance must have been covered");
});

test("the hollow-tree rim pops only on fast, genuinely outward crossings",()=>{
 const p={x:-17.13,z:40.8},q={x:-17.52,z:40.8},west={x:-1,z:0};
 const hit=redwoodBowlExitCrossing(p,q,west,8);
 assert.equal(hit?.id,"redwood-bowl-exit");
 assert.ok(hit!.impulse>4&&hit!.impulse<5.4);
 assert.equal(skateParkLipCrossing(p,q,west,8)?.id,hit?.id);
 assert.equal(rampImpulseCrossing(p,q,west,"skate",8)?.id,hit?.id);
 assert.equal(rampImpulseCrossing(p,q,west,"bike",8)?.id,undefined);
 assert.equal(redwoodBowlExitCrossing(p,q,west,2),null,"slow riders should roll out safely");
 assert.equal(redwoodBowlExitCrossing(q,p,{x:1,z:0},8),null,"drop-in should not auto-jump");
 assert.equal(redwoodBowlExitCrossing(p,q,{x:1,z:0},8),null,"incorrect heading cannot score a jump");
 assert.equal(redwoodBowlExitCrossing(p,q,{x:0,z:1},8),null,"sideways movement cannot trigger");
 const eastIn={x:-6.83,z:40.8},eastOut={x:-6.51,z:40.8};
 assert.equal(redwoodBowlExitCrossing(eastIn,eastOut,{x:1,z:0},9),null,
  "the east split is an unobstructed entrance/exit for everyone");
 assert.ok(SKATE_PARK.halfWidth>REDWOOD_BOWL.barkRadius);
});
