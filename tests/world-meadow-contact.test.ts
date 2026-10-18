import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelTerrainPose,bikeTerrainPose,BIKE_CONTACT} from '../lib/world/bikeContact';
import {beginSkateLoop,advanceSkateLoop,skateLoopSample,LOOP_TAU} from '../lib/world/skateLoop';
import {SKATE_LOOP,insideMeadowConnector,meadowConnectorRise} from '../lib/world/skatepark';
import {MOSS_CANYON,REGIONS,isWater,terrainHeight} from '../lib/world/model';
import {groundHeight,stepTravel,type Travel} from '../lib/world/activities';
test('both bike tire envelopes meet planes at every compass heading',()=>{
 for(const grade of [-1,-.5,0,.5,1])for(let yaw=0;yaw<6.28;yaw+=.4){
  const heading={x:Math.sin(yaw),z:Math.cos(yaw)};
  const height=(p:{x:number;z:number})=>grade*(p.x*heading.x+p.z*heading.z);
  const pose=bikeTerrainPose({x:0,z:0},heading,height);
  assert.ok(Math.abs(pose.pitch+Math.atan(grade))<.002);
  assert.ok(pose.error<.001);
  const expected=BIKE_CONTACT.radius*Math.sqrt(1+grade*grade)-BIKE_CONTACT.axleY/Math.cos(pose.pitch);
  assert.ok(Math.abs(pose.y-expected)<.006);
 }
});
test('bike wheels fit real mountain terrain uphill, downhill and cross-slope',()=>{
 for(let z=-80;z<-25;z+=3)for(const heading of [{x:0,z:1},{x:0,z:-1},{x:1,z:0}]){
  const pose=bikeTerrainPose({x:8,z},heading,groundHeight);
  assert.ok(Number.isFinite(pose.y)&&pose.error<.002);
 }
});
test('moss canyon is dry, remote from skating, and navigation follows it',()=>{
 assert.deepEqual(REGIONS.find(r=>r.id==='canyon')!.point,MOSS_CANYON.center);
 for(let i=0;i<MOSS_CANYON.segments;i++)for(const side of [-1,1]){
  const p={x:MOSS_CANYON.center.x+side*(4.6+Math.sin(i)*.5),z:MOSS_CANYON.startZ+i*MOSS_CANYON.spacing};
  assert.equal(isWater(p),false);
  assert.ok(Math.hypot(p.x-SKATE_LOOP.center.x,p.z-SKATE_LOOP.center.z)>100);
 }
});
test('spiral separates mouths and has an orthonormal continuous contact frame',()=>{
 const ride=beginSkateLoop(9,1,SKATE_LOOP.center.z,.6);
 for(let angle=0;angle<=LOOP_TAU;angle+=.02){
  const p=skateLoopSample({...ride,angle});
  for(const axis of [p.right,p.up,p.forward])assert.ok(Math.abs(Math.hypot(...axis)-1)<1e-9);
  assert.ok(Math.abs(p.right.reduce((v,x,i)=>v+x*p.forward[i],0))<1e-9);
  assert.equal(isWater(p.point),false);
 }
 const finish=skateLoopSample({...ride,angle:LOOP_TAU});
 assert.equal(finish.point.z-SKATE_LOOP.center.z,6);
 assert.ok(finish.heading.z>.15&&finish.heading.x<-.9);
});
test('low momentum rolls back, sufficient momentum completes without speed floor',()=>{
 for(const fps of [10,20,60])for(const speed of [3,8.4,12]){
  let ride=beginSkateLoop(speed,1,51,1),result;
  let minimum=speed;
  for(let frame=0;frame<fps*20;frame++){
   result=advanceSkateLoop(ride,1/fps);ride=result.ride;minimum=Math.min(minimum,ride.speed);
   if(result.completed||result.returned)break;
  }
  assert.equal(result!.completed,speed>=8.4);
  assert.equal(result!.returned,speed<8.4);
  if(speed<8.4)assert.ok(minimum<0);
 }
});
test('bridge downhill roll-in reaches gate with ordinary pushing and remains on dry ground',()=>{
 let ride:Travel={point:{x:29,z:51},heading:{x:-1,z:0},speed:0};
 for(let i=0;i<180&&ride.point.x>19;i++){
  ride=stepTravel(ride,{x:-1,z:0},1/60,'skate',[]);
  assert.equal(isWater(ride.point),false);
 }
 assert.ok(ride.point.x<=19&&ride.speed>=SKATE_LOOP.recommendedSpeed);
 assert.ok(meadowConnectorRise({x:29,z:51})>1.5);
 for(const p of [{x:35,z:51},{x:31,z:60},{x:7.4,z:58}]){
  assert.ok(insideMeadowConnector(p));
  assert.ok(Math.abs(groundHeight(p)-terrainHeight(p.x,p.z))<.001);
 }
});

test('skateboard contact follows a downhill crest without highest-sample hovering',()=>{
 const dims={radius:.1111,axleY:-.02,halfWheelbase:.63,halfTrack:.33};
 for(const grade of [-.7,0,.7]){
  const pose=wheelTerrainPose({x:0,z:0},{x:0,z:1},p=>p.z*grade,dims);
  assert.ok(Math.abs(pose.pitch+Math.atan(grade))<.002);
  assert.ok(pose.error<.001);
  const expected=(dims.radius-dims.axleY)*Math.sqrt(1+grade*grade);
  assert.ok(Math.abs(pose.y-expected)<.002);
 }
});
