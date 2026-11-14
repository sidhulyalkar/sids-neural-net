import assert from "node:assert/strict";
import test from "node:test";
import {createSkiContact,fitSkiContact} from "../components/world/worldSkiContact";
import {SkiVisualSole,SKI_VISUAL_BEND_LIMIT}
  from "../components/world/skiVisualSole";
import {Vector3} from "three/src/Three.Core.js";

const surfaces=[
  (_x:number,z:number)=>-.18*z*z,
  (x:number,z:number)=>.13*x*x+.18*z*z,
  (x:number,z:number)=>.4*Math.sin(z*2)+.15*x,
];
for(const [index,height] of surfaces.entries()){
  test(`visual sole ${index}: bounded, nonpenetrating and deterministic`,()=>{
    const pose=fitSkiContact({x:0,z:0},{x:0,z:1},-1,
      p=>height(p.x,p.z),createSkiContact(),true);
    const ribbon=new SkiVisualSole();
    const first=ribbon.update(pose,height,.9,true);
    const buffer=ribbon.geometry.getAttribute("position");
    assert.equal(buffer.count,33*4);
    assert.equal(ribbon.geometry.getIndex()?.count,32*4*6+12);
    assert.ok(first.maxBend<=SKI_VISUAL_BEND_LIMIT+1e-6);
    assert.ok(first.min>=.007,"sole cannot penetrate sampled snow");
    assert.ok(first.max<=first.rigidMax+.11,
      "tip shape must not hide exaggerated rigid clearance");
    const snapshot=Array.from(buffer.array as Float32Array);
    const second=ribbon.update(pose,height,.9,true);
    assert.deepEqual(first,second);
    assert.deepEqual(Array.from(buffer.array as Float32Array),snapshot);
    // Both edges of every mesh section are checked in the same pose that
    // production uses to transform the mesh into world coordinates.
    const p=new Vector3();
    for(let j=0;j<=32;j++)for(let w=0;w<2;w++){
      const k=j*4+w;
      p.fromBufferAttribute(buffer,k).applyQuaternion(pose.rotation).add(pose.position);
      assert.ok(p.y-height(p.x,p.z)>-.002,"mesh sole clips terrain");
    }
    ribbon.dispose();
  });
}
test("visual bend is disabled without load and never changes solver pose",()=>{
  const h=(_x:number,z:number)=>-.2*z*z;
  const pose=fitSkiContact({x:0,z:0},{x:0,z:1},1,
    p=>h(p.x,p.z),createSkiContact(),true);
  const beforePosition=pose.position.clone();
  const beforeRotation=pose.rotation.clone();
  const beforeInterval=[pose.supportStart,pose.supportEnd];
  const ribbon=new SkiVisualSole();
  const metric=ribbon.update(pose,h,0,false);
  assert.equal(metric.active,false);
  assert.equal(metric.maxBend,0);
  assert.ok(pose.position.equals(beforePosition));
  assert.ok(pose.rotation.equals(beforeRotation));
  assert.deepEqual([pose.supportStart,pose.supportEnd],beforeInterval);
  ribbon.dispose();
});
