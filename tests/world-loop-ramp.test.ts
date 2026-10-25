import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginSkateLoop,skateLoopSample,contactSkateLoop,advanceSkateLoop,LOOP_TAU} from '../lib/world/skateLoop';
import {SKATE_LOOP} from '../lib/world/skatepark';
type V=[number,number,number];
function land(angle:number,speed:number,lateral=0){
 const p=skateLoopSample({...beginSkateLoop(0,0,SKATE_LOOP.center.z),angle});
 const point=[p.point.x,p.y,p.point.z];
 const from=point.map((v,i)=>v+p.up[i]*.2) as V,to=point.map((v,i)=>v-p.up[i]*.2) as V;
 const velocity=p.trackForward.map((v,i)=>v*speed+p.trackRight[i]*lateral-p.up[i]) as V;
 return {ride:contactSkateLoop(from,to,velocity,0,0),from,to,velocity,p};
}
test('jump landings preserve tangential momentum and roll back in both directions at varied frame rates',()=>{
 for(const fps of [10,30,60])for(const direction of [1,-1]){
  const hit=land(direction===1?.45:LOOP_TAU-.45,direction*.7);assert.ok(hit.ride);
  let ride=hit.ride;const start=ride.angle;let climbed=false,reversed=false,exited=false;
  assert.ok(Math.abs(ride.speed-direction*.7)<.02);
  for(let i=0;i<fps*20;i++){
   const next=advanceSkateLoop(ride,1/fps);ride=next.ride;
   climbed ||= (ride.angle-start)*direction>.001;reversed ||= ride.speed*direction<0;
   assert.equal(next.completed,false);assert.ok(Number.isFinite(ride.speed));
   if(next.returned||next.released){exited=true;break;}
  }
  assert.ok(climbed&&reversed&&exited);
 }
});
test('angled landings carry across the ramp and release at its finite edge',()=>{
 const hit=land(.3,1,5);assert.ok(hit.ride);let ride=hit.ride,released=false;
 for(let i=0;i<120;i++){const n=advanceSkateLoop(ride,1/60);ride=n.ride;assert.equal(n.completed,false);if(n.released){released=true;break;}}
 assert.ok(released);assert.ok((ride.entryLateralSpeed??0)>4);
});
test('separating wheels and flight beyond the track cannot snap to it',()=>{
 const h=land(.5,1);assert.equal(contactSkateLoop(h.to,h.from,h.velocity.map(v=>-v) as V,0,0),null);
 const shift=(v:V)=>[v[0],v[1],v[2]+20] as V;
 assert.equal(contactSkateLoop(shift(h.from),shift(h.to),h.velocity,0,0),null);
});
test('slow inverted landing loses contact instead of sticking to ceiling',()=>{
 const hit=land(Math.PI,.2);assert.ok(hit.ride);assert.equal(advanceSkateLoop(hit.ride,.016).released,true);
});

test('both open mouths reject departing wheels during terrain handoff',()=>{
 for(const direction of [1,-1] as const){
  const p=skateLoopSample(beginSkateLoop(8,0,SKATE_LOOP.center.z,0,direction));
  const from:V=[p.point.x,p.y,p.point.z];
  const v=p.trackForward.map(n=>n*-direction*8) as V;
  const to=from.map((n,i)=>n+v[i]*.016-(i===1?.035:0)) as V;
  assert.equal(contactSkateLoop(from,to,v,0,0),null);
 }
});
