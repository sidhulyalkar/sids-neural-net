import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ringSurface} from '../components/world/worldGeometry';
import {settleSurfaceHeight} from '../lib/world/surfaceSupport';
import {waterfallCrownRings,waterfallRockHeight,paperCaveShellRings,paperCaveRoofHeight,mountainTributaries,COAST_BENCH,COAST_WHALE} from '../lib/world/hydrology';
import {groundHeight} from '../lib/world/activities';
import {terrainHeight,nextCaveLayer,paperCaveFloorHeight} from '../lib/world/model';
import {idleOceanObservation,advanceOceanObservation} from '../lib/world/coastalObservation';
test('waterfall crown support matches rendered triangles on both shoulders',()=>{
 const geometry=ringSurface(waterfallCrownRings().map(r=>r.map(p=>new THREE.Vector3(p.x,p.y,p.z)))),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld();const ray=new THREE.Raycaster();let raised=0;
 for(let z=-41.7;z<-30.1;z+=.53)for(let x=-27;x<-13;x+=.65){
  ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0],support=waterfallRockHeight({x,z});
  if(hit){assert.ok(support!==null);assert.ok(Math.abs(support!-hit.point.y)<.0001);assert.ok(groundHeight({x,z})>=hit.point.y-.0001);if(support!>terrainHeight(x,z)+.2)raised++;}else assert.equal(support,null);
 }
 assert.ok(raised>30);geometry.dispose();material.dispose();
});
test('Shasta settling cannot pass below rising terrain',()=>{assert.equal(settleSurfaceHeight(2,6,.016),6);let y=8;for(let i=0;i<300;i++){y=settleSurfaceHeight(y,3,.016);assert.ok(y>=3);}assert.ok(y<3.001);});
test('new mountain streams descend continuously above natural terrain',()=>{
 for(const path of mountainTributaries()){assert.ok(path[0].y>20);for(let i=0;i<path.length;i++){const p=path[i];assert.ok(p.y>=terrainHeight(p.x,p.z)+.09);if(i)assert.ok(p.y<=path[i-1].y+1e-8);}}
});
test('paper cave entry needs a real portal crossing, never a sideways roof teleport',()=>{
 const p={x:-20,z:-31};assert.equal(nextCaveLayer('surface',{x:-20,z:-29},p,paperCaveFloorHeight(p)),'paper');assert.equal(nextCaveLayer('surface',{x:-27,z:-31},p,paperCaveFloorHeight(p)),'surface');assert.equal(nextCaveLayer('surface',{x:-20,z:-29},p,groundHeight(p)),'surface');assert.equal(nextCaveLayer('paper',p,{x:-20,z:-29},paperCaveFloorHeight(p)),'surface');
});
test('ocean encounter respects stillness, gaze, pause and cooldown',()=>{
 const input={point:COAST_BENCH,speed:0,look:{x:COAST_WHALE.x-COAST_BENCH.x,z:COAST_WHALE.z-COAST_BENCH.z},eligible:true};let s=idleOceanObservation();
 for(let i=0;i<20;i++)s=advanceOceanObservation(s,.5,{...input,look:{x:1,z:0}});assert.equal(s.sightings,0);
 for(let i=0;i<15;i++)s=advanceOceanObservation(s,.5,input);assert.equal(s.sightings,0);s=advanceOceanObservation(s,.5,input);assert.equal(s.phase,'spout');
 const phases=new Set<string>([s.phase]);for(let i=0;i<22;i++){s=advanceOceanObservation(s,.5,input);phases.add(s.phase);}assert.ok(phases.has('breach')&&phases.has('splash'));assert.equal(s.sightings,1);
 for(let i=0;i<30;i++)s=advanceOceanObservation(s,.5,input);assert.equal(s.sightings,1);s=advanceOceanObservation(s,.5,{...input,speed:3});assert.equal(s.stillFor,0);assert.deepEqual(advanceOceanObservation(s,0,input),s);
});

test('expanded cave roof remains a solid exterior support matching the rendered shell',()=>{
 const geometry=ringSurface(paperCaveShellRings().map(r=>r.map(p=>new THREE.Vector3(p.x,p.y,p.z))));
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster();mesh.updateMatrixWorld();let checked=0;
 for(let z=-43.8;z<-30.1;z+=.47)for(let x=-26.4;x<-13.5;x+=.39){
  ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];
  if(!hit)continue;
  assert.ok(Math.abs(paperCaveRoofHeight({x,z})!-hit.point.y)<.0001);
  assert.ok(groundHeight({x,z})>=hit.point.y-.0001);checked++;
 }
 assert.ok(checked>500);geometry.dispose();material.dispose();
});

test('coastal scenery participates in camera cutaways using the renderer Three.js runtime',async()=>{
 const Core=await import('three/src/Three.Core.js');
 const {createCoastalNature}=await import('../components/world/worldCoastalNature');
 const {createWorldCameraOcclusion}=await import('../components/world/worldCameraOcclusion');
 const nature=createCoastalNature(groundHeight),occlusion=createWorldCameraOcclusion(nature.staticMesh);
 const camera=new Core.Vector3(-14.636,22.477,-34),focus=new Core.Vector3(-26.2,8.5457,-34);
 const ray=new Core.Raycaster(camera,focus.clone().sub(camera).normalize(),0,camera.distanceTo(focus));
 assert.ok(occlusion.count>700);
 assert.ok(ray.intersectObject(nature.staticMesh).length>0);
 assert.ok(occlusion.cutaway(camera,focus)>0);
 assert.equal(ray.intersectObject(nature.staticMesh).length,0);
 occlusion.restore();assert.ok(ray.intersectObject(nature.staticMesh).length>0);nature.dispose();
});
