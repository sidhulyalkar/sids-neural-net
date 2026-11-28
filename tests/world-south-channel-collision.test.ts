import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {JET_SKI_ROCKS} from "../lib/world/jetSkiCourse";
import {constrainSouthRockMove,southRockClearance} from "../lib/world/southChannelCollision";

const eps=.0005;
test("South ocean swimmer and camera respect the same physical arch legs",()=>{
 const rocks=JET_SKI_ROCKS.filter(r=>r.point.z< -96);
 assert.ok(rocks.some(r=>r.id==="lava-window-north"));
 assert.ok(rocks.some(r=>r.id==="lava-window-south"));
 const margin=.75;
 // Crossing the cylindrical leg, even with a 40-unit tick, stops at the rock.
 const from={x:17,z:-110},to={x:17,z:-151};
 const stopped=constrainSouthRockMove(from,to,margin);
 assert.ok(stopped.z> -115 && stopped.z< -110);
 assert.ok(southRockClearance(stopped)>=margin-eps);
 // The original entrance now approaches along a clear parallel corridor.
 const clear=constrainSouthRockMove({x:7,z:-110},{x:7,z:-151},margin);
 assert.deepEqual(clear,{x:7,z:-151});
 assert.ok(southRockClearance(clear)>margin);
 // Moving tangentially stays feasible, even near the leg.
 const outside={x:12.5,z:-118};
 assert.deepEqual(constrainSouthRockMove(outside,{x:12.5,z:-125},margin),
  {x:12.5,z:-125});
});

test("No tunneling or stuck geometry at coarse timestep, even from legacy overlap",()=>{
 for(const rock of JET_SKI_ROCKS.filter(r=>r.point.z<-96)){
  const radius=rock.radius+.85;
  const from={x:rock.point.x+radius+2,z:rock.point.z};
  const to={x:rock.point.x-radius-2,z:rock.point.z};
  const stop=constrainSouthRockMove(from,to,.85);
  assert.ok(stop.x>rock.point.x+radius-.03);
  assert.ok(southRockClearance(stop)>=.85-.005);
  const inside={...rock.point};
  const restored=constrainSouthRockMove(inside,{x:inside.x+2,z:inside.z},.85);
  assert.ok(Number.isFinite(restored.x)&&Number.isFinite(restored.z));
  assert.ok(southRockClearance(restored)>=.85-eps);
 }
});

test("Rock constraint is narrow: outside the south channel it is not applied",()=>{
 // This function is only invoked for waterZone south-channel in the renderer.
 const source=readFileSync("components/world/worldRenderer.ts","utf8");
 assert.match(source,/waterZone\(player\)==="south-channel"\|\|/);
 assert.match(source,/constrainSouthRockMove\(player,canyonPoint,.75\)/);
 assert.match(source,/constrainSouthRockMove\(player,/);
 assert.match(source,/canvas\.dataset\.southCameraRockClearance/);
});
