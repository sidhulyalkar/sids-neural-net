import test from "node:test";
import assert from "node:assert/strict";
import {resolveBikeTerrainSightline,terrainSightlineClear} from "../lib/world/terrainCameraSightline";

test("open bike camera sightlines are stable without unnecessary reframing",()=>{
 const shot={x:0,y:8,z:16},focus={x:0,y:2,z:0};
 const result=resolveBikeTerrainSightline(shot,focus,()=>0);
 assert.deepEqual(result.point,shot);
 assert.equal(result.adjusted,false);
 assert.equal(result.clear,true);
 assert.equal(result.boomRatio,1);
});

test("a camera looking through a steep ridge becomes terrain-clear",()=>{
 const floor=(x:number,z:number)=>Math.abs(x)<4&&z>7&&z<11?15:0;
 const lens={x:0,y:7,z:17},focus={x:0,y:2,z:0};
 assert.equal(terrainSightlineClear(lens,focus,floor),false);
 const result=resolveBikeTerrainSightline(lens,focus,floor);
 assert.equal(result.clear,true);
 assert.equal(terrainSightlineClear(result.point,focus,floor),true);
 assert.ok(result.point.y>=floor(result.point.x,result.point.z)+.4);
 assert.ok(result.lift>0||result.boomRatio<1);
 assert.ok(result.point.z>0,"do not place lens beyond rider");
 assert.deepEqual(resolveBikeTerrainSightline(lens,focus,floor),result,
  "a stable ride must not jitter between random camera poses");
});

test("terrain-blocked lens inside a high bank recovers without moving the player",()=>{
 const floor=(x:number,z:number)=>z>8?12:2;
 const focus={x:3,y:5,z:0},lens={x:3,y:4,z:18};
 const result=resolveBikeTerrainSightline(lens,focus,floor);
 assert.equal(result.clear,true);
 assert.equal(terrainSightlineClear(result.point,focus,floor),true);
 assert.deepEqual(focus,{x:3,y:5,z:0});
 assert.ok(result.point.y>lens.y||result.boomRatio<1);
});

test("camera qualification fails safely for nonfinite inputs",()=>{
 const result=resolveBikeTerrainSightline({x:NaN,y:1,z:0},
  {x:0,y:2,z:0},()=>0);
 assert.equal(result.clear,false);
});
