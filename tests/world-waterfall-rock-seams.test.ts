import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ringSurface,indexedRingSurface} from '../components/world/worldGeometry';
import {waterfallCrownRings,waterfallRockWalls,paperCaveShellRings} from '../lib/world/hydrology';
import {terrainHeight,paperCaveFloorHeight} from '../lib/world/model';
function shell(){
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 const meshes=waterfallRockWalls().map(r=>new THREE.Mesh(ringSurface(r.map(s=>s.map(p=>new THREE.Vector3(p.x,p.y,p.z)))),material));
 meshes.forEach(m=>m.updateMatrixWorld());return {meshes,dispose(){meshes.forEach(m=>m.geometry.dispose());material.dispose();}};
}
test('front rock shoulders block normal and oblique sightlines below the shelf',()=>{
 const {meshes,dispose}=shell(),ray=new THREE.Raycaster();let checks=0;
 try{for(const side of [-1,1])for(let offset=3.35;offset<6.9;offset+=.17){
  const x=-20+side*offset,z=-30;
  const top=waterfallCrownRings().at(-1)!;
  const i=top.findIndex(p=>p.x>=x),a=top[i-1],b=top[i],roof=a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x),base=terrainHeight(x,z);
  for(const t of [.2,.5,.8])for(const angle of [-.2,0,.2]){
   const target=new THREE.Vector3(x,base+(roof-base)*t,z),origin=target.clone().add(new THREE.Vector3(angle*3,0,3));
   ray.set(origin,target.clone().sub(origin).normalize());ray.far=origin.distanceTo(target)+.01;
   assert.ok(ray.intersectObjects(meshes).length>0,JSON.stringify({x,t,angle}));checks++;
  }
 }assert.ok(checks>300);}finally{dispose();}
});
test('both longitudinal edges and rear edge are closed below terrain',()=>{
 const {meshes,dispose}=shell(),ray=new THREE.Raycaster(),crown=waterfallCrownRings();
 try{for(const index of [0,crown[0].length-1])for(let j=3;j<crown.length-3;j+=17){
  const p=crown[j][index],y=(p.y+terrainHeight(p.x,p.z))*.5,sign=index===0?-1:1;
  ray.set(new THREE.Vector3(p.x+sign*2,y,p.z),new THREE.Vector3(-sign,0,0));ray.far=2.01;
  assert.ok(ray.intersectObjects(meshes).length>0);
 }
 const rear=crown[0];for(let j=1;j<rear.length-1;j+=4){const p=rear[j];ray.set(new THREE.Vector3(p.x,(p.y+terrainHeight(p.x,p.z))*.5,p.z-2),new THREE.Vector3(0,0,1));ray.far=2.01;assert.ok(ray.intersectObjects(meshes).length>0);}
 }finally{dispose();}
});
test('front rock closure leaves a full-height passage into the research cave',()=>{
 const {meshes,dispose}=shell(),ray=new THREE.Raycaster(),arch=paperCaveShellRings()[0];
 try{for(let x=arch[0].x+.4;x<arch.at(-1)!.x-.4;x+=.4)for(const h of [.2,1,2.2]){
  ray.set(new THREE.Vector3(x,paperCaveFloorHeight({x,z:-30})+h,-27),new THREE.Vector3(0,0,-1));ray.far=3.1;
  assert.equal(ray.intersectObjects(meshes).length,0,`blocked entrance ${x}, ${h}`);
 }}finally{dispose();}
});

test('waterfall mountain crown has smooth shared normals without altering its cave-clearance shape',()=>{
 const crown=waterfallCrownRings();
 const geometry=indexedRingSurface(crown.map(row=>row.map(p=>new THREE.Vector3(p.x,p.y,p.z))));
 try{
  const positions=geometry.getAttribute('position');
  const normals=geometry.getAttribute('normal');
  const stride=crown[0].length;
  assert.equal(stride,57);
  assert.equal(positions.count,crown.length*stride);
  assert.equal(geometry.index!.count,(crown.length-1)*(stride-1)*6);
  for(let r=0;r<crown.length;r+=Math.max(1,Math.floor(crown.length/12))){
   for(let c=0;c<stride;c+=4){
    const i=r*stride+c,expected=crown[r][c];
    assert.ok(Math.hypot(positions.getX(i)-expected.x,
      positions.getY(i)-expected.y,positions.getZ(i)-expected.z)<.0001,
      'do not move physical cave roof vertices to conceal a visual gap');
    const n=new THREE.Vector3(normals.getX(i),normals.getY(i),normals.getZ(i));
    assert.ok(n.length()>.99&&n.length()<1.01,'finite smooth surface normal');
   }
  }
 }finally{geometry.dispose();}
});
