import test from "node:test";
import assert from "node:assert/strict";
import {terrainMeshHeight} from "../lib/world/rideMeshContact";
test("rider contact exactly matches both displayed triangles, not a bilinear patch",()=>{
 // a=0,d=2,b=3,c=10, front slope differs along the split diagonal.
 const heights=new Float32Array([0,2,3,10]);
 const bounds={minX:0,maxX:1,minZ:0,maxZ:1};
 const at=(x:number,z:number)=>terrainMeshHeight({x,z},heights,bounds,1,1);
 assert.equal(at(0,0),0);assert.equal(at(1,0),2);
 assert.equal(at(0,1),3);assert.equal(at(1,1),10);
 assert.ok(Math.abs(at(.25,.25)-1.25)<1e-6);
 assert.ok(Math.abs(at(.75,.75)-6.25)<1e-6);
 assert.ok(Number.isFinite(at(-1,2)));
});
