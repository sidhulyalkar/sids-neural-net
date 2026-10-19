import assert from "node:assert/strict";
import test from "node:test";
import {JET_SKI_PIER,jetSkiPierHeight,nearJetSkiBoarding} from "../lib/world/jetSkiPier";
import type {WorldCommand} from "../lib/world/model";

test("jet ski shortcut lands on the real pier's boardable deck",()=>{
  const point={x:JET_SKI_PIER.rampEndX+1.3,z:JET_SKI_PIER.centerZ};
  assert.ok(nearJetSkiBoarding(point));
  assert.ok(Math.abs((jetSkiPierHeight(point)??Infinity)-JET_SKI_PIER.deckHeight)<.08);
  assert.ok(!nearJetSkiBoarding({x:JET_SKI_PIER.landX,z:JET_SKI_PIER.centerZ}),
    "the shortcut must never open a selector from the start of the ramp");
});
test("sport jump is distinct from legacy skate destinations and retains valid region IDs",()=>{
  const command:WorldCommand={region:"lagoon",serial:1,sportDestination:"jet-pier"};
  assert.equal(command.sportDestination,"jet-pier");
  assert.equal(command.skateDestination,undefined);
});
