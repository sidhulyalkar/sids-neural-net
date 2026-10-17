import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {GeometryBatch} from "../components/world/worldGeometry";
import {createWorldCameraOcclusion} from "../components/world/worldCameraOcclusion";

test("render-authored branches are detected and cut away per instance with exact restoration",()=>{
 const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);
 group.position.set(3,0,0);
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,3,1),new THREE.MeshBasicMaterial(),2);
 group.add(mesh);
 const first=new THREE.Matrix4().makeTranslation(-3,2,5),second=new THREE.Matrix4().makeTranslation(30,2,5);
 mesh.setMatrixAt(0,first);mesh.setMatrixAt(1,second);
 const camera=createWorldCameraOcclusion(scene),lens={x:0,y:2,z:10},focus={x:0,y:2,z:0};
 assert.ok(camera.field.blockers(lens,focus)>0);
 assert.equal(camera.cutaway(lens,focus),1);
 const actual=new THREE.Matrix4();mesh.getMatrixAt(0,actual);assert.equal(actual.determinant(),0);
 mesh.getMatrixAt(1,actual);assert.deepEqual(actual.elements,second.elements);
 assert.equal(camera.cutaway(lens,focus),1,"stable shot reuses the cutaway");
 camera.restore();mesh.getMatrixAt(0,actual);assert.deepEqual(actual.elements,first.elements);
 assert.equal(mesh.visible,true);
 mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();mesh.dispose();
});

test("clear scenery keeps its visibility and hidden objects restore their original state",()=>{
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());
 mesh.position.set(0,2,4);mesh.visible=false;scene.add(mesh);
 const camera=createWorldCameraOcclusion(scene);
 camera.cutaway({x:0,y:2,z:8},{x:0,y:2,z:0});camera.restore();
 assert.equal(mesh.visible,false);
 assert.equal(camera.cutaway({x:10,y:2,z:8},{x:10,y:2,z:0}),0);
 mesh.geometry.dispose();mesh.material.dispose();
});

 test("a cutaway masks one merged branch without hiding the forest batch",()=>{
  const batch=new GeometryBatch(),g=new THREE.BoxGeometry(1,3,1);
  batch.add(g,"#ffffff",new THREE.Vector3(0,2,4),new THREE.Vector3(1,1,1));
  batch.add(g,"#ffffff",new THREE.Vector3(15,2,4),new THREE.Vector3(1,1,1));
  const geometry=batch.finish(),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  const scene=new THREE.Scene();scene.add(mesh);const camera=createWorldCameraOcclusion(scene);
  const count=geometry.userData.cameraParts[0].count;
  assert.equal(camera.cutaway({x:0,y:2,z:8},{x:0,y:2,z:0}),1);
  assert.equal(mesh.visible,true);
  for(let i=0;i<count;i++)assert.equal(geometry.index!.getX(i),0);
  for(let i=count;i<geometry.index!.count;i++)assert.equal(geometry.index!.getX(i),i);
  camera.restore();
  for(let i=0;i<geometry.index!.count;i++)assert.equal(geometry.index!.getX(i),i);
  geometry.dispose();g.dispose();mesh.material.dispose();
 });
