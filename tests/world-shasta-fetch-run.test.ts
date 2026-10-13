import test from "node:test";
import assert from "node:assert/strict";
import {idleFetchRunRoute,stepFetchRunRoute,steerFetchRun} from
 "../lib/world/shastaFetchRun";

const d=(a:{x:number;z:number},b:{x:number;z:number})=>
 Math.hypot(a.x-b.x,a.z-b.z);
test("direct Shasta fetch route is reused instead of checking every frame",()=>{
 const dog={x:0,z:0},goal={x:45,z:20};
 let route=idleFetchRunRoute();
 for(let i=0;i<120;i++)
  route=stepFetchRunRoute(route,dog,goal,[],i/60);
 assert.equal(route.detouring,false);
 assert.ok(route.decisions<=4,"2000ms of frames should trigger only ~3 route checks");
 assert.deepEqual(route.waypoint,goal);
});

test("a tree produces a persistent detour and no flip-flopping sides",()=>{
 const goal={x:24,z:0};
 const obstacles=[{x:8,z:0,radius:1.4}];
 let route=idleFetchRunRoute(),dog={x:0,z:0};
 route=stepFetchRunRoute(route,dog,goal,obstacles,0);
 assert.equal(route.detouring,true);
 const waypoint={...route.waypoint!};
 for(let i=1;i<45;i++){
  route=stepFetchRunRoute(route,dog,goal,obstacles,i/60);
  assert.deepEqual(route.waypoint,waypoint);
 }
 assert.equal(route.decisions,1);
 assert.ok(d(waypoint,goal)>2);
 dog={...waypoint};
 route=stepFetchRunRoute(route,dog,goal,obstacles,.8);
 assert.ok(route.decisions>1);
});

test("Hole 2 pier fetch exits by the land ramp rather than sea",()=>{
 const dog={x:63,z:14},green={x:45,z:-9};
 let route=stepFetchRunRoute(idleFetchRunRoute(),dog,green,[],0);
 assert.deepEqual(route.waypoint,{x:48.1,z:14});
 assert.equal(route.detouring,true);
 assert.deepEqual(stepFetchRunRoute(route,dog,green,[],.1).waypoint,
  route.waypoint,"pier exit remains stable between frames");
 route=stepFetchRunRoute(route,{x:48.5,z:14},green,[],.9);
 assert.deepEqual(route.waypoint,green,
  "after reaching the pier ramp, resume mainland disc pursuit");
});
test("excited fetch accelerates smoothly, then brakes before reaching disc",()=>{
 let dog={x:0,z:0},velocity={x:0,z:0},maxStep=0;
 const goal={x:36,z:0},dt=1/60;
 let speedAtFirst=0;
 for(let i=0;i<420;i++){
  const oldSpeed=Math.hypot(velocity.x,velocity.z);
  velocity=steerFetchRun(velocity,dog,goal,goal,dt);
  const speed=Math.hypot(velocity.x,velocity.z);
  maxStep=Math.max(maxStep,Math.abs(speed-oldSpeed));
  assert.ok(speed<=11.500001);
  dog={x:dog.x+velocity.x*dt,z:dog.z+velocity.z*dt};
  if(i===5)speedAtFirst=speed;
 }
 assert.ok(speedAtFirst>1,"fetch must begin promptly");
 assert.ok(maxStep<.51,"velocity changes are acceleration-bounded");
 assert.ok(d(dog,goal)<1.6,"Shasta should arrive at the landed disc");
});

test("fetch steering stays finite and does not run beyond a near target",()=>{
 const goal={x:1,z:0};
 let dog={x:0,z:0},v={x:0,z:0};
 for(let i=0;i<120;i++){
  v=steerFetchRun(v,dog,goal,goal,1/60);
  dog={x:dog.x+v.x/60,z:dog.z+v.z/60};
  assert.ok(Number.isFinite(dog.x)&&Number.isFinite(v.x));
 }
 assert.ok(d(dog,goal)<1.6);
});
