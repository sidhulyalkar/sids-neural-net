import test from 'node:test';
import assert from 'node:assert/strict';
import {BIKE_CONTACT,wheelTerrainPose} from '../lib/world/bikeContact';
import {rideLeavesSupport} from '../lib/world/rideSurface';

test('both vehicles clear terrain while rendered suspension is still catching up',()=>{
 for(const dimensions of [BIKE_CONTACT,{radius:.1111,axleY:-.02,halfWheelbase:.63,halfTrack:.33}]){
  for(const grade of [-1.6,-.6,.6,1.6]) for(const pitch of [-.4,0,.4]){
   const pose=wheelTerrainPose({x:0,z:0},{x:0,z:1},p=>grade*p.z,{...dimensions,fixedPitch:pitch});
   assert.ok(Number.isFinite(pose.y));
   for(const end of [-1,1]){
    const along=end*dimensions.halfWheelbase*Math.cos(pitch)+dimensions.axleY*Math.sin(pitch);
    const axle=pose.y+dimensions.axleY*Math.cos(pitch)-end*dimensions.halfWheelbase*Math.sin(pitch);
    for(let i=0;i<=12;i++){
     const angle=-Math.PI/2+i*Math.PI/12;
     assert.ok(axle-dimensions.radius*Math.cos(angle)>=grade*(along+dimensions.radius*Math.sin(angle))-1e-8);
    }
   }
  }
 }
});
test('rock and island ledges launch free flight while mountain descents retain contact',()=>{
 const from={x:0,z:.6},to={x:0,z:0},slope=(p:{z:number})=>p.z*1.6;
 assert.equal(rideLeavesSupport(from,to,slope(from),slope(to),slope,slope),false);
 const ledge=(p:{z:number})=>p.z>.3?2:0;
 assert.equal(rideLeavesSupport(from,to,2,0,ledge,()=>0),true);
 assert.equal(rideLeavesSupport(from,to,2,0,ledge,ledge),true);
 assert.equal(rideLeavesSupport(from,to,0,2,ledge,ledge),false);
});

test('both vehicle contact offsets remain finite throughout either loop direction',async()=>{
 const {beginSkateLoop,skateLoopSample,loopVehicleLift,LOOP_TAU}=await import('../lib/world/skateLoop');
 for(const direction of [-1,1] as const) for(let angle=0;angle<=LOOP_TAU;angle+=.04){
  const ride={...beginSkateLoop(12,0,0,0,direction),angle};
  const pose=skateLoopSample(ride);
  for(const mode of ['skate','bike'] as const){
   const lift=loopVehicleLift(ride,mode);
   assert.ok(Number.isFinite(lift)&&lift>0&&lift<.5);
   assert.ok(pose.up.every(Number.isFinite));
  }
 }
});
