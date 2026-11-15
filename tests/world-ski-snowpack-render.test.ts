import assert from "node:assert/strict";
import test from "node:test";
import {BufferGeometry,Float32BufferAttribute} from "three/src/Three.Core.js";
import {renderedSnowHeight} from "../lib/world/ski/renderedSnow";
function mesh(){
  const g=new BufferGeometry();
  g.setAttribute("position",new Float32BufferAttribute([
    0,0,0, 1,0,0, 0,0,1
  ],3));
  g.setAttribute("snowCoverage",new Float32BufferAttribute([1,1,0],1));
  g.setAttribute("snowLayers",new Float32BufferAttribute([
    .60,.30,.1,.03,
    .10,.75,.9,.15,
    0,0,0,0
  ],4));
  g.setIndex([0,1,2]);
  return g;
}
test("all four layers interpolate from the exact triangle used by snow height",()=>{
  const snow=renderedSnowHeight(mesh(),()=>0);
  const p=snow.snowpack(.25,.25);
  assert.ok(Math.abs(p.coverage-.75)<1e-6);
  assert.ok(Math.abs(p.powderDepth-(.6*.5+.1*.25))<1e-6);
  assert.ok(Math.abs(p.packedDepth-(.3*.5+.75*.25))<1e-6);
  assert.ok(Math.abs(p.crust-(.1*.5+.9*.25))<1e-6);
  assert.ok(Math.abs(p.ice-(.03*.5+.15*.25))<1e-6);
  assert.ok(Math.abs(p.totalDepth-p.powderDepth-p.packedDepth)<1e-8);
  const p2=snow.snowpack(.25,.25);
  assert.deepEqual(p2,p,"cache must not drift across repeat samples");
});
test("without explicit snowLayers, do not create fictitious powder",()=>{
  const terrain=mesh();terrain.deleteAttribute("snowLayers");
  const sample=renderedSnowHeight(terrain,()=>8);
  assert.equal(sample.snowpack(.2,.2).totalDepth,0);
  assert.equal(sample.snowpack(1e4,1e4).coverage,0);
});
