import assert from "node:assert/strict";
import test from "node:test";
import {GROVE_TUNNEL} from "../lib/world/skatepark";
import {terrainHeight} from "../lib/world/model";
import {northShoreLogBlocksView,resolveNorthShoreCamera} from "../lib/world/northShoreCamera";

test("north beach inland boom cannot look through the real fallen sequoia",()=>{
 const c=GROVE_TUNNEL.center;
 const y=terrainHeight(c.x,c.z)+GROVE_TUNNEL.archCenterLift;
 const lens={x:c.x,y:y+1,z:c.z-12};
 const focus={x:c.x,y:y+1,z:c.z+9};
 assert.equal(northShoreLogBlocksView(lens,focus),true);
 const shot=resolveNorthShoreCamera(lens,focus,()=>y-1);
 assert.equal(shot.adjusted,true);
 assert.equal(shot.clear,true);
 assert.ok(Math.abs(shot.point.x-focus.x)>=13,
   "move lens outside the giant log's lateral extent");
 assert.equal(northShoreLogBlocksView(shot.point,focus),false);
 assert.deepEqual(resolveNorthShoreCamera(lens,focus,()=>y-1),shot);
});
test("already unobstructed coast views remain exactly unchanged",()=>{
 const c=GROVE_TUNNEL.center;
 const lens={x:c.x+25,y:9,z:c.z+9};
 const focus={x:c.x+17,y:4,z:c.z+7};
 const result=resolveNorthShoreCamera(lens,focus,()=>2);
 assert.deepEqual(result,{point:lens,clear:true,adjusted:false});
});
test("camera correction never changes the log or the player's position",()=>{
 const c=GROVE_TUNNEL.center;
 const y=terrainHeight(c.x,c.z)+GROVE_TUNNEL.archCenterLift;
 const focus={x:c.x,y:y+1,z:c.z+9},before={...focus};
 resolveNorthShoreCamera({x:c.x,y:y+2,z:c.z-14},focus,()=>0);
 assert.deepEqual(focus,before);
 assert.equal(GROVE_TUNNEL.innerRadius,2.85);
});
