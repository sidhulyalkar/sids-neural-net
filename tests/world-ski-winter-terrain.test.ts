import assert from "node:assert/strict";
import test from "node:test";
import {Float32BufferAttribute,PlaneGeometry} from "three/src/Three.Core.js";
import {refineMountainSnow} from "../components/world/worldMountainHalfpipe";
import {worldFloorHeight,winterWorldFloorHeight} from "../lib/world/model";
import {MOUNTAIN_HALFPIPE} from "../lib/world/mountainHalfpipe";

function makeBaseTerrain(){
  const h=MOUNTAIN_HALFPIPE;
  const mesh=new PlaneGeometry(34,40,18,18);
  mesh.rotateX(-Math.PI/2);
  mesh.translate(h.centerX,0,(h.startZ+h.endZ)/2);
  const points=mesh.getAttribute("position");
  for(let i=0;i<points.count;i++)
    points.setY(i,worldFloorHeight(points.getX(i),points.getZ(i)));
  const colors=new Float32Array(points.count*3).fill(.32);
  mesh.setAttribute("color",new Float32BufferAttribute(colors,3));
  mesh.setAttribute("snowCoverage",new Float32BufferAttribute(new Float32Array(points.count),1));
  return mesh;
}

function makeWinterTerrain(ordinary:ReturnType<typeof makeBaseTerrain>){
  const winter=ordinary.clone();
  const points=winter.getAttribute("position");
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),z=points.getZ(i);
    points.setY(i,winterWorldFloorHeight(x,z));
  }
  refineMountainSnow(winter);
  return winter;
}

test("ordinary mountain mesh remains byte-identical when winter is prepared from a clone",()=>{
  const ordinary=makeBaseTerrain();
  const count=ordinary.getAttribute("position").count;
  const source=Array.from(ordinary.getAttribute("position").array);
  const sourceColor=Array.from(ordinary.getAttribute("color").array);
  const indices=Array.from(ordinary.getIndex()!.array);
  const winter=makeWinterTerrain(ordinary);
  assert.ok(winter.getIndex()!.count>ordinary.getIndex()!.count);
  assert.ok(winter.getAttribute("position").count>count,"winter should refine only the playable patch");
  assert.equal(ordinary.getAttribute("position").count,count);
  assert.deepEqual(Array.from(ordinary.getAttribute("position").array),source);
  assert.deepEqual(Array.from(ordinary.getAttribute("color").array),sourceColor);
  assert.deepEqual(Array.from(ordinary.getIndex()!.array),indices);
  assert.equal(ordinary.getAttribute("baseColor"),undefined);
  assert.ok(winter.getAttribute("baseColor"));
  // The original pigment survives the refinement so winter can be faded
  // using a material uniform without changing the physical surface.
  const baseColors=winter.getAttribute("baseColor");
  for(let i=0;i<count*3;i++)assert.equal(baseColors.array[i],sourceColor[i]);
  assert.equal(baseColors.count,winter.getAttribute("position").count);
  ordinary.dispose();winter.dispose();
});

test("winter mesh exposes snow contact attributes on the same triangle surface",()=>{
  const base=makeBaseTerrain();
  const winter=makeWinterTerrain(base);
  const snow=winter.getAttribute("snowCoverage");
  const strata=winter.getAttribute("snowLayers");
  assert.equal(snow.count,winter.getAttribute("position").count);
  assert.equal(strata.count,snow.count);
  assert.equal(strata.itemSize,4);
  assert.ok(Array.from(snow.array).some(value=>value>.5),"halfpipe must visibly receive snow");
  assert.ok(Array.from(snow.array).every(value=>value>=0&&value<=1));
  base.dispose();winter.dispose();
});
