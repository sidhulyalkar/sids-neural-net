import assert from "node:assert/strict";
import test from "node:test";
import {BufferGeometry,Float32BufferAttribute} from "three/src/Three.Core.js";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
function triangle(weights?:number[]){
  const mesh=new BufferGeometry();
  mesh.setAttribute("position",new Float32BufferAttribute([0,1,0, 1,2,0, 0,3,1],3));
  mesh.setIndex([0,1,2]);
  if(weights)mesh.setAttribute("snowCoverage",new Float32BufferAttribute(weights,1));
  return mesh;
}
test("snow material and height use the same barycentric triangle",()=>{
  const sample=renderedSnowHeight(triangle([1,0,0]),()=>-1);
  assert.ok(Math.abs(sample(.25,.25)-1.75)<1e-6);
  assert.ok(Math.abs(sample.snowCoverage(.25,.25)-.5)<1e-6);
  assert.ok(Math.abs(sample.snowCoverage(.1,.1)-.8)<1e-6);
  assert.equal(sample.snowCoverage(0,0),1);
  assert.equal(sample.snowCoverage(1,0),0);
  assert.equal(sample.snowCoverage(300,300),0);
});
test("a terrain mesh with no snow channel is non-snow, even if high",()=>{
  const sample=renderedSnowHeight(triangle(),()=>-1);
  assert.ok(sample(.2,.2)>0);
  assert.equal(sample.snowCoverage(.2,.2),0);
});
