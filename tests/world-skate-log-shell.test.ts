import test from 'node:test';
import assert from 'node:assert/strict';
import {GROVE_TUNNEL as g,SKATE_LOOP} from '../lib/world/skatepark';
import {advanceSkateTunnelRide,beginSkateTunnelRide,contactSkateLog,jumpSkateTunnel,resolveSkateLogMotion,sequoiaTubePoint,skateLogShellDistance,skateTunnelSample,sweepSkateLog,type V} from '../lib/world/skateTunnel';
import {advanceSkateLoop,beginSkateLoop,enterSkateLoop,skateLoopSample} from '../lib/world/skateLoop';
const floor=()=>2;
const vector=(p:{x:number;y:number;z:number}):V=>[p.x,p.y,p.z];
const base=()=>({...beginSkateTunnelRide(g.center,{x:1,z:0},1)!,vx:0,vt:0,speed:0});

test('fast segments hit either bark side before reaching the bore or far side',()=>{
 for(const side of [-1,1])for(const distance of [1,8,40]){
  const from:V=[0,2+g.innerRadius,g.center.z+side*(g.outerHalfWidth+distance)],to:V=[0,from[1],g.center.z-side*4];
  const hit=sweepSkateLog(from,to,floor);
  assert.ok(hit);assert.equal(hit.surface,'outer');
  assert.ok(Math.abs(hit.point[2]-(g.center.z+side*g.outerHalfWidth))<.0001);
 }
});
test('both open mouths remain hollow while annular end grain stops approach',()=>{
 for(const side of [-1,1]){
  assert.equal(sweepSkateLog([side*(g.halfLength+1),4,g.center.z],[side*(g.halfLength-1),4,g.center.z],floor),null);
  const rim=sequoiaTubePoint(side*g.halfLength,Math.PI,2);
  rim.y+=(g.outerRadius-g.innerRadius)*(1-g.taper*side)*.5;
  const r=contactSkateLog([side*(g.halfLength+1),rim.y,rim.z],[side*(g.halfLength-1),rim.y,rim.z],[-side*8,2,0],floor);
  assert.ok(r);assert.equal(r.surface,'rim');assert.ok(Math.abs((r.rimT??0)-.5)<.0001);
  const p=skateTunnelSample(r,floor);assert.ok(Math.abs(p.point.x-side*g.halfLength)<1e-8);
  assert.ok(Math.abs(p.y-rim.y)<.0001);assert.equal(p.up[0],side);
 }
});
test('landings acquire the outer crown and remain supported when stopped',()=>{
 const top=sequoiaTubePoint(0,Math.PI,2,true);
 let r=contactSkateLog([0,top.y+2,g.center.z],[0,top.y-2,g.center.z],[0,-12,0],floor)!;
 assert.equal(r.surface,'outer');
 for(let i=0;i<240;i++){
  const n=advanceSkateTunnelRide(r,1/60,undefined,floor);r=n.ride;
  assert.equal(n.completed,false);assert.ok(!r.air);
  const p=skateTunnelSample(r,floor);assert.ok(Math.abs(p.y-sequoiaTubePoint(r.x,Math.PI,2,true).y)<.0001);assert.ok(p.up[1]>.999);
 }
});
test('exterior jumps leave the bark, land on it again, and preserve finite contact frames',()=>{
 for(const fps of [10,30,60]){
  let r=jumpSkateTunnel({...base(),surface:'outer',angle:Math.PI,vx:0,vt:0,speed:0},floor),peak=0;
  for(let i=0;i<4*fps;i++){
   const n=advanceSkateTunnelRide(r,1/fps,undefined,floor);assert.ok(!n.completed);r=n.ride;
   const p=skateTunnelSample(r,floor);peak=Math.max(peak,p.y);
   assert.ok([...p.up,...p.right,...p.forward,p.y].every(Number.isFinite));
   if(!r.air)assert.equal(r.surface,'outer');
  }
  assert.ok(peak>2+g.innerRadius+g.outerRadius+.8);assert.ok(!r.air);
 }
});
test('a fast crown carve releases naturally and remains outside solid wood',()=>{
 let r={...base(),surface:'outer' as const,angle:Math.PI,vx:0,vt:8,speed:8};
 const n=advanceSkateTunnelRide(r,.02,undefined,floor);assert.ok(n.ride.air);
 for(let i=0;i<100;i++){
  const next=advanceSkateTunnelRide(r,.01,undefined,floor);r=next.ride as typeof r;
  const p=skateTunnelSample(r,floor);
  assert.ok(skateLogShellDistance([p.point.x,p.y,p.point.z],floor).distance>-.0001);
  if(next.completed)break;
 }
});
test('rims transfer onto either skin at a shared edge without a position jump',()=>{
 for(const side of [-1,1] as const)for(const outward of [true,false]){
  const r={...base(),surface:'rim' as const,rimSide:side,rimT:outward?.99:.01,x:side*g.halfLength,angle:Math.PI,vx:outward?1:-1,vt:0,speed:1};
  const before=skateTunnelSample(r,floor),n=advanceSkateTunnelRide(r,.01,undefined,floor),after=skateTunnelSample(n.ride,floor);
  assert.equal(n.ride.surface,outward?'outer':'inner');
  assert.ok(Math.hypot(after.point.x-before.point.x,after.y-before.y,after.point.z-before.point.z)<.04);
 }
});
test('a rider body clips neither the bark nor the mouth header ahead of the wheels',()=>{
 const from:V=[0,2,g.center.z-5],to:V=[0,2,g.center.z];
 const m=resolveSkateLogMotion(from,to,[0,0,10],floor);
 assert.ok(m.blocked);assert.equal(m.ride,null);
 for(const h of [.45,.95,1.45])assert.ok(skateLogShellDistance([m.position[0],m.position[1]+h,m.position[2]],floor).distance>.18);
 for(const side of [-1,1]){
  const m=resolveSkateLogMotion([side*(g.halfLength+2),6.2,g.center.z],[side*(g.halfLength-1),6.2,g.center.z],[-side*8,0,0],floor);
  assert.ok(m.blocked);assert.ok(side*m.position[0]>=g.halfLength);
 }
});
test('all three surface frames stay orthonormal and match their rendered skin on sloped ground',()=>{
 const slope=(p:{x:number})=>2+p.x*.15;
 for(const surface of ['inner','outer','rim'] as const)for(const angle of [.2,1.5,Math.PI,5.8]){
  const r={...base(),surface,x:surface==='rim'?g.halfLength:1.7,rimSide:1 as const,rimT:.4,angle,vx:2,vt:3,speed:Math.hypot(2,3)};
  const p=skateTunnelSample(r,slope);
  for(const v of [p.up,p.right,p.forward])assert.ok(Math.abs(Math.hypot(...v)-1)<1e-8);
  assert.ok(Math.abs(p.up.reduce((s,v,i)=>s+v*p.forward[i],0))<1e-8);
  if(surface!=='rim'){
   const skin=sequoiaTubePoint(r.x,angle,slope({x:r.x}),surface==='outer');
   assert.ok(Math.hypot(...vector(skin).map((v,i)=>v-[p.point.x,p.y,p.point.z][i]))<1e-8);
  }
 }
});
test('loop accepts approaches through sixty degrees at either mouth, preserving initial heading and energy',()=>{
 for(const direction of [-1,1] as const)for(const degrees of [-60,-45,-25,0,25,45,60]){
  const mouth=skateLoopSample(beginSkateLoop(10,2,SKATE_LOOP.center.z,2,direction));
  const a=degrees*Math.PI/180,heading={x:mouth.forward[0]*Math.cos(a)+mouth.right[0]*Math.sin(a),z:mouth.forward[2]*Math.cos(a)+mouth.right[2]*Math.sin(a)};
  const before={x:mouth.point.x-heading.x*.1,z:mouth.point.z-heading.z*.1},after={x:mouth.point.x+heading.x*.1,z:mouth.point.z+heading.z*.1};
  let r=enterSkateLoop(before,after,heading,10,2.035,2,2)!;assert.ok(r,`${direction}/${degrees}`);
  const p=skateLoopSample(r);
  assert.ok(p.heading.x*heading.x+p.heading.z*heading.z>.999);
  assert.ok(Math.abs(Math.hypot(r.speed,r.entryLateralSpeed??0)-10)<1e-8);
  for(let i=0;i<30;i++){
   r=advanceSkateLoop(r,1/60).ride;
   assert.ok(Math.abs(r.laneZ-SKATE_LOOP.center.z)<=SKATE_LOOP.width/2-.22+.0001);
  }
  assert.ok(Math.abs(r.entryLateralSpeed??0)<.17);
 }
});

test('ground-level mouth seams retain inward momentum instead of catching the cut rim',()=>{
 for(const side of [-1,1]){
  const m=resolveSkateLogMotion([side*(g.halfLength+.35),2,g.center.z],
   [side*(g.halfLength-.15),2,g.center.z],[-side*8,0,0],floor);
  assert.ok(m.ride);assert.equal(m.ride.surface,'inner');
  assert.ok(Math.abs(m.ride.vx+side*8)<.001);assert.ok(m.ride.speed>7.99);
 }
});
