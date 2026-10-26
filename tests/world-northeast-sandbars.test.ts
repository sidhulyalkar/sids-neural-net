import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/src/Three.Core.js';
import {NORTHEAST_SANDBARS,northeastSandFloor} from '../lib/world/northeastSandbars';
import {seaFloorHeight,waterZone,SEA_SURFACE} from '../lib/world/model';
import {MARINE_HABITAT_PATCHES,marineHabitatPoint} from '../lib/world/marineHabitatPatches';
import {createMarineHabitatPatches} from '../components/world/worldMarineHabitatPatches';
import {applyLagoonSand} from '../components/world/worldLagoonSand';
test('four northeast banks stay submerged with smooth edges and unchanged distant floor',()=>{
 assert.equal(NORTHEAST_SANDBARS.length,4);
 for(const b of NORTHEAST_SANDBARS){
  assert.equal(waterZone(b),'lagoon');
  assert.ok(Math.abs(SEA_SURFACE-seaFloorHeight(b.x,b.z)-b.depth)<.04);
  for(let x=b.x-b.radius-1;x<b.x+b.radius+1;x+=.05){
   const y=seaFloorHeight(x,b.z),next=seaFloorHeight(x+.05,b.z);
   assert.ok(y<SEA_SURFACE-1.4);assert.ok(Math.abs(next-y)<.13);
  }
 }
 assert.equal(northeastSandFloor(0,0,-7,SEA_SURFACE),-7);
});
test('rare pearls require close underwater discovery and cannot be counted twice',()=>{
 const h=createMarineHabitatPatches(new THREE.Group(),new THREE.Group());
 const patch=MARINE_HABITAT_PATCHES.find(p=>p.population['pearl-clam'])!;
 assert.equal(h.discoverPearls({x:0,y:0,z:0}).found,0);
 for(let i=0;i<3;i++){
  const p=marineHabitatPoint(patch,'pearl-clam',i);
  assert.equal(h.discoverPearls({...p,y:SEA_SURFACE+4}).fresh,false);
  h.discoverPearls({...p,y:p.y+.53*p.scale});
  assert.equal(h.discoverPearls({...p,y:p.y+.53*p.scale}).fresh,false);
 }
 assert.equal(h.discoverPearls({x:0,y:0,z:0}).found,3);h.dispose();
});
test('sand ripple shader is bound to actual ground and has a dedicated program key',()=>{
 const m=applyLagoonSand(new THREE.MeshStandardMaterial());
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};
 m.onBeforeCompile(shader as never,{} as never);
 assert.ok(shader.vertexShader.includes('modelMatrix'));
 assert.ok(shader.fragmentShader.includes('fwidth'));
 assert.ok(shader.fragmentShader.includes('sandBanks[4]'));
 assert.equal(m.customProgramCacheKey(),'lagoon-sand-v1');m.dispose();
});
