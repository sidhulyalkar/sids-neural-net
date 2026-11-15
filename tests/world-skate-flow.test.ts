import test from "node:test";
import assert from "node:assert/strict";
import {activityLanding,groundHeight,rampImpulseCrossing,stepTravel,type Travel} from "../lib/world/activities";
import {
  REDWOOD_BOWL,SKATE_GROVE_FLOW,SKATE_PARK,insideSkatePark,
  skateGroveStartHeading,skateParkLipCrossing,redwoodBowlExitCrossing,redwoodBowlCarveHeading,
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
 assert.equal(exits,0,"holding forward toward the western coast must never auto-launch into water");
 assert.ok(minSpeed>2.5,"the carve should keep enough momentum to feel natural");
 assert.ok(startY>0&&zones.length>40,"meaningful ride distance must have been covered");
});

test("the bowl assists a safe south-facing carve but rejects unsafe cliff launch",()=>{
 const westInside={x:-17.13,z:40.8},westOutside={x:-17.52,z:40.8};
 const west={x:-1,z:0};
 assert.equal(redwoodBowlExitCrossing(westInside,westOutside,west,8),null,
  "west rim should not launch a visitor off the island");
 assert.equal(skateParkLipCrossing(westInside,westOutside,west,8),null);
 // Steep descents can double measured airtime, so even a south-facing
 // exit is rejected when its complete downhill touchdown would leave the park.
 const southInside={x:-12,z:45.13},southOutside={x:-12,z:45.51};
 const south={x:0,z:1};
 assert.equal(redwoodBowlExitCrossing(southInside,southOutside,south,8),null);
 // A southeast exit at *moderate* speed has a meadow landing corridor.
 const p={x:-7.84,z:43.08},q={x:-7.60,z:43.40},se={x:.6,z:.8};
 const hit=redwoodBowlExitCrossing(p,q,se,8);
 assert.equal(hit?.id,"redwood-bowl-exit");
 assert.ok(hit!.impulse>2.8&&hit!.impulse<3.3);
 assert.equal(skateParkLipCrossing(p,q,se,8)?.id,hit?.id);
 assert.equal(rampImpulseCrossing(p,q,se,"skate",8)?.id,hit?.id);
 assert.equal(rampImpulseCrossing(p,q,se,"bike",8)?.id,undefined);
 assert.equal(redwoodBowlExitCrossing(p,q,se,2),null);
 assert.equal(redwoodBowlExitCrossing(q,p,{x:-.6,z:-.8},8),null);
 assert.equal(redwoodBowlExitCrossing(p,q,west,8),null);
 assert.equal(redwoodBowlExitCrossing(p,q,se,18),null,
  "very fast riders should not launch beyond the protected meadow");
 const eastIn={x:-6.83,z:40.8},eastOut={x:-6.51,z:40.8};
 assert.equal(redwoodBowlExitCrossing(eastIn,eastOut,{x:1,z:0},9),null,
  "the east split stays an unobstructed entrance and exit");
 assert.ok(SKATE_PARK.halfWidth>REDWOOD_BOWL.barkRadius);
});

test("unsafe westward edge becomes a smooth wood-bank carve, not a forced teleport",()=>{
 const point={x:-16.5,z:42.5},heading={x:-.45,z:.89};
 const adjusted=redwoodBowlCarveHeading(point,heading,8,.05);
 assert.ok(adjusted.x>heading.x&&adjusted.z>0,
  "bowl lip must steer away from cliff toward its natural tangent");
 assert.ok(Math.abs(Math.hypot(adjusted.x,adjusted.z)-1)<1e-5);
 const untouched=redwoodBowlCarveHeading({x:-8,z:43},{x:.8,z:.6},5,.05);
 assert.deepEqual(untouched,{x:.8,z:.6},
  "a safe rider-directed southeast exit must retain ordinary controls");
 assert.deepEqual(redwoodBowlCarveHeading(point,heading,0,.05),heading,
  "no unexplained steering when the board is stationary");
});
