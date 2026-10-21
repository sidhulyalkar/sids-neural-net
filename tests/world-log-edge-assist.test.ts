import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GROVE_TUNNEL as g,SKATE_LOOP} from '../lib/world/skatepark';
import {beginSkateTunnelRide,jumpSkateTunnel,advanceSkateTunnelRide,skateTunnelSample,canRideLogContact,resolveSkateLogMotion,skateLogShellDistance,type V} from '../lib/world/skateTunnel';
import {beginSkateLoop,jumpSkateLoop,advanceSkateLoop,skateLoopSample} from '../lib/world/skateLoop';
const floor=()=>2;
test('low cut edges remain solid but cannot attach the skateboard',()=>{
 for(const side of [-1,1] as const){
  const point:V=[side*g.halfLength,2.4,g.center.z+g.innerHalfWidth*.6];
  assert.equal(canRideLogContact({point,t:.5,surface:'rim'},floor),false);
  assert.equal(canRideLogContact({point:[point[0],3,point[2]],t:.5,surface:'rim'},floor),true);
  const result=resolveSkateLogMotion([point[0]+side,point[1],point[2]],[point[0]-side,point[1],point[2]],[-side*8,0,0],floor,[0,1,0],true);
  assert.equal(result.ride,null);assert.ok(result.blocked);assert.ok(result.position[1]>=2);
 }
});
test('interior jumps from floor, sides and ceiling settle onto center with forward motion',()=>{
 for(const fps of [10,30,60])for(const angle of [0,.6,Math.PI/2,Math.PI,-Math.PI/2])for(const direction of [1,-1]){
  let ride={...beginSkateTunnelRide(g.center,{x:direction,z:0},4)!,angle};
  ride=jumpSkateTunnel(ride,floor);assert.ok(ride.centerJump);
  for(let i=0;i<fps*2&&ride.air;i++){
   ride=advanceSkateTunnelRide(ride,1/fps,undefined,floor).ride;
   const p=skateTunnelSample(ride,floor);
   assert.ok([p.point.x,p.y,p.point.z,...p.up].every(Number.isFinite));
   assert.ok(skateLogShellDistance([p.point.x,p.y,p.point.z],floor).distance>-.015,'assisted path stays outside solid wood');
  }
  assert.ok(!ride.air);assert.ok(Math.abs(ride.angle)<.01);assert.equal(ride.vt,0);assert.ok(ride.vx*direction>0);
 }
});
test('loop hops work in both directions and center the landing without stopping traversal',()=>{
 for(const direction of [1,-1] as const)for(const angle of [.6,Math.PI,5.6]){
  let ride=jumpSkateLoop({...beginSkateLoop(5,0,SKATE_LOOP.center.z+.6,0,direction),angle});
  const initial=skateLoopSample(ride);let peak=0;
  for(let i=0;i<40;i++){
   ride=advanceSkateLoop(ride,1/60).ride;
   const p=skateLoopSample(ride),track=skateLoopSample({...ride,jump:undefined});
   peak=Math.max(peak,Math.hypot(p.point.x-track.point.x,p.y-track.y,p.point.z-track.point.z));
   assert.ok([...p.forward,...p.up,p.y].every(Number.isFinite));
  }
  assert.ok(peak>.5);assert.ok(!ride.jump);assert.ok(Math.abs(ride.laneZ-SKATE_LOOP.center.z)<.001);
  assert.ok(Math.hypot(skateLoopSample(ride).point.x-initial.point.x,skateLoopSample(ride).y-initial.y)>.1);
 }
});
