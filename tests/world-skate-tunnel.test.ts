import test from 'node:test';
import assert from 'node:assert/strict';
import {GROVE_TUNNEL as g,insideMeadowConnector} from '../lib/world/skatepark';
import {beginSkateTunnelRide,skateTunnelSample,sequoiaTubePoint,advanceSkateTunnelRide,jumpSkateTunnel,skateLogShellDistance,TUBE_TAU} from '../lib/world/skateTunnel';
const floor=()=>2;
const start=()=>beginSkateTunnelRide(g.center,{x:1,z:0},8)!;
test('relocated log has consistent contact and orthogonal surface frames',()=>{
 for(let angle=0;angle<TUBE_TAU;angle+=.13){
  const r={...start(),angle};const p=skateTunnelSample(r,floor),skin=sequoiaTubePoint(r.x,angle,2);
  assert.ok(insideMeadowConnector(p.point));
  assert.ok(Math.hypot(p.y-skin.y,p.point.z-skin.z)<1e-8);
  for(const v of [p.up,p.right,p.forward])assert.ok(Math.abs(Math.hypot(...v)-1)<1e-8);
  assert.ok(Math.abs(p.up.reduce((s,v,i)=>s+v*p.forward[i],0))<1e-8);
 }
});
test('low momentum rocks back down the wall naturally',()=>{
 let r={...start(),vx:0,vt:2,speed:2},maximum=0,reversed=false;
 for(let i=0;i<240;i++){r=advanceSkateTunnelRide(r,1/60,undefined,floor).ride;maximum=Math.max(maximum,r.angle);reversed ||= r.vt<0;assert.ok(!r.air);}
 assert.ok(maximum>.1&&maximum<Math.PI/2);assert.ok(reversed);
});
test('sufficient momentum completes full tube revolutions across frame rates',()=>{
 for(const fps of [10,30,60]){
  let r={...start(),vx:0,vt:9,speed:9};
  for(let i=0;i<5*fps&&r.angle<TUBE_TAU;i++){r=advanceSkateTunnelRide(r,1/fps,undefined,floor).ride;assert.ok(!r.air);}
  assert.ok(r.angle>=TUBE_TAU,`${fps} FPS`);
 }
});
test('insufficient ceiling speed releases into free flight',()=>{
 const r=advanceSkateTunnelRide({...start(),angle:Math.PI,vx:0,vt:1,speed:1},.02,undefined,floor).ride;
 assert.ok(r.air);assert.ok(r.air.velocity[1]<0);
});
test('tube jump rises and lands back on the shared wood surface',()=>{
 let r=jumpSkateTunnel({...start(),vx:0,vt:0,speed:0},floor),peak=2;
 for(let i=0;i<240;i++){r=advanceSkateTunnelRide(r,1/60,undefined,floor).ride;peak=Math.max(peak,skateTunnelSample(r,floor).y);}
 assert.ok(peak>2.5);assert.ok(!r.air);assert.ok(Math.abs(skateTunnelSample(r,floor).y-2)<.01);
});
test('both mouths allow straight passage and steering changes the surface path',()=>{
 for(const direction of [-1,1]){
  let r=beginSkateTunnelRide({x:g.center.x-direction*(g.halfLength-.1),z:g.center.z},{x:direction,z:0},8)!;let done=false;
  for(let i=0;i<240&&!done;i++){const next=advanceSkateTunnelRide(r,1/60,undefined,floor);r=next.ride;done=next.completed;}
  assert.ok(done);assert.ok(Math.abs(r.angle)<.01);
 }
 const r=advanceSkateTunnelRide(start(),.5,{steer:.25,push:false,brake:false},floor).ride;
 assert.ok(r.angle>.02);
});

test('tube flips catch within the physical airtime at multiple frame rates',async()=>{
 const {skateTunnelJumpDuration}=await import('../lib/world/skateTunnel');
 const {idleSkateTrick,startSkateTrick,finishSkateTrick,skateTrickPose}=await import('../lib/world/skateTricks');
 for(const fps of [10,30,60]){
  const surface={...start(),vx:0,vt:10,speed:10};
  let ride=jumpSkateTunnel(surface,floor),seconds=0;
  const trick={...startSkateTrick(idleSkateTrick(),'Kickflip',0,10,true),durationSeconds:skateTunnelJumpDuration(surface,floor)};
  while(ride.air&&seconds<2){ride=advanceSkateTunnelRide(ride,1/fps,undefined,floor).ride;seconds+=1/fps;}
  assert.ok(!ride.air);assert.equal(skateTrickPose(trick,seconds).progress,1);
  const landed=finishSkateTrick(trick,seconds,ride.speed);
  assert.equal(landed.bails,0);assert.ok(landed.points>0);assert.equal(landed.durationSeconds,undefined);
 }
});

test('mouth entry ignores low floor contacts while preserving flying contact and rejection gates',async()=>{
 const {enterSkateTunnel}=await import('../lib/world/skateTunnel');
 for(const side of [-1,1]){
  const before={x:side*(g.halfLength+.1),z:g.center.z},p={x:side*(g.halfLength-.1),z:g.center.z};
  const r=enterSkateTunnel(before,p,2,[-side*6,0,0],floor);
  assert.ok(r,'the low center must roll smoothly onto the inside wood');
  assert.equal(r.surface,'inner');
  assert.ok(!r.air,'ground-level entry must never get flung into free flight');
  const pose=skateTunnelSample(r,floor);
  assert.ok(Math.abs(pose.y-2)<.02,'inside contact must match the ground-level floor');
  assert.ok(Math.abs(r.vx+side*6)<.1,'preserve forward wheel momentum');
  const flying=enterSkateTunnel(before,p,3,[-side*6,-1,0],floor);
  assert.ok(flying?.air);assert.deepEqual(flying.air.position,[p.x,3,p.z]);
  assert.equal(enterSkateTunnel(before,p,10,[-side*6,0,0],floor),null);
  assert.equal(enterSkateTunnel({...p,z:p.z+.3},p,2,[0,0,-6],floor),null);
 }
});
test('stationary and reversing tube frames remain perpendicular on sloped terrain',()=>{
 for(const angle of [0,.5,1.5,3,5])for(const vx of [0,-.001,.001,-3,3]){
  const p=skateTunnelSample({...start(),angle,vx,vt:0,speed:Math.abs(vx)},p=>2+p.x*.3);
  assert.ok(Math.abs(p.up.reduce((s,v,i)=>s+v*p.forward[i],0))<1e-8);
  assert.ok(Math.abs(p.axis.reduce((s,v,i)=>s+v*p.tangent[i],0))<1e-8);
 }
});
test('airborne mouth exits keep their world trajectory',()=>{
 const r={...start(),x:g.halfLength-.01,air:{position:[g.halfLength-.01,3,g.center.z] as [number,number,number],velocity:[8,1,0] as [number,number,number]}};
 const n=advanceSkateTunnelRide(r,.05,undefined,floor);
 assert.ok(n.completed&&n.ride.air);assert.ok(skateTunnelSample(n.ride,floor).y>3);
});


test('four skateboard wheels clear the analytic inside wood across steering angles and both directions',()=>{
 for(const x of [-g.halfLength+.8,0,g.halfLength-.8])
  for(const angle of [0,.22,.7,1.25,Math.PI/2,2.35,Math.PI,4.6,5.7])
   for(const [vx,vt] of [[8,0],[0,8],[5,6],[-7,-3]]){
    const r={...start(),x,angle,vx,vt,speed:Math.hypot(vx,vt),surface:'inner' as const};
    const p=skateTunnelSample(r,floor);
    assert.ok(p.wheelLift>=0&&p.wheelLift<=.30,'bounded wood-following lift');
    for(const track of [-.33,.33])for(const axle of [-.63,.63]){
      const point=[
       p.point.x+p.right[0]*track+p.forward[0]*axle+p.up[0]*p.wheelLift,
       p.y+p.right[1]*track+p.forward[1]*axle+p.up[1]*p.wheelLift,
       p.point.z+p.right[2]*track+p.forward[2]*axle+p.up[2]*p.wheelLift,
      ] as [number,number,number];
      if(Math.abs(point[0]-g.center.x)>g.halfLength)continue;
      assert.ok(skateLogShellDistance(point,floor).distance>=-.002,
       'visible wheel must not penetrate inner surface at '+JSON.stringify({x,angle,vx,vt,track,axle,point}));
    }
   }
});
test('low entrance can be crossed from both ends without grinding, snapping or speed loss',async()=>{
 const {enterSkateTunnel,contactSkateLog,resolveSkateLogMotion}=await import('../lib/world/skateTunnel');
 for(const side of [-1,1]){
  const startX=side*(g.halfLength+.2),endX=side*(g.halfLength-.12);
  for(const lateral of [-.45,0,.45]){
   const z=g.center.z+lateral;
   const before={x:startX,z},after={x:endX,z};
   const velocity:[number,number,number]=[-side*7,0,0];
   const collision=resolveSkateLogMotion([startX,2,z],[endX,2,z],velocity,floor);
   assert.equal(collision.ride,null,'no auto-grind before crossing mouth');
   assert.equal(collision.blocked,false,'unobstructed open center');
   assert.equal(contactSkateLog([startX,2,z],[endX,2,z],velocity,floor),null);
   const rolled=enterSkateTunnel(before,after,2,velocity,floor);
   assert.ok(rolled,'smooth low entrance at offset '+lateral);
   assert.equal(rolled.surface,'inner');
   assert.equal(rolled.air,undefined);
   const pose=skateTunnelSample(rolled,floor);
   assert.ok(Math.abs(pose.y-2)<.20,'no sudden vertical snap at mouth');
   assert.ok(Math.abs(rolled.vx)>6.9,'no speed loss');
   let r=rolled;
   for(let i=0;i<10;i++)r=advanceSkateTunnelRide(r,1/60,undefined,floor).ride;
   assert.ok(Math.abs(r.vx)>5&&Number.isFinite(r.angle));
  }
 }
});

test('reversing on the wall retains a continuous board frame while motion reverses',()=>{
 let r={...start(),angle:.35,vx:0,vt:.3,speed:.3,facing:Math.PI/2};
 let previous=skateTunnelSample(r,floor).forward,reversed=false;
 for(let i=0;i<60;i++){
  r=advanceSkateTunnelRide(r,1/60,undefined,floor).ride as typeof r;
  const p=skateTunnelSample(r,floor);
  const dot=p.forward.reduce((n,v,k)=>n+v*previous[k],0);
  assert.ok(dot>.98,'no instantaneous 180-degree board flip');
  if(r.vt<-.2){reversed=true;assert.ok(p.forward.reduce((n,v,k)=>n+v*p.motionForward[k],0)<-.9);}
  previous=p.forward;
 }
 assert.ok(reversed);
});
