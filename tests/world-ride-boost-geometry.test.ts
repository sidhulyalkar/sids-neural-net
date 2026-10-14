import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/src/Three.Core.js";
import {createRideChallengeGeometry} from "../components/world/worldRideChallengeGeometry";
import {initialRideBoost,RIDE_BOOST_TARGETS} from "../lib/world/rideBoost";
import {groundHeight} from "../lib/world/activities";

test("a moving player's projected visible ring admits a near click but never blank space",()=>{
 const scene=new THREE.Scene();
 const visuals=createRideChallengeGeometry(scene);
 const t=RIDE_BOOST_TARGETS.find(x=>x.activity==="bike")!;
 const camera=new THREE.PerspectiveCamera(47,16/9,.1,150);
 camera.position.set(t.point.x,groundHeight(t.point)+5,t.point.z+10);
 camera.lookAt(t.point.x,groundHeight(t.point)+2.9,t.point.z);
 camera.updateMatrixWorld(true);
 const clear=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshBasicMaterial());
 clear.rotation.x=-Math.PI/2;clear.position.y=-100;
 clear.updateMatrixWorld(true);
 const player={...t.point},state=initialRideBoost(),now=9,speed=7;
 visuals.updateTargets("bike",player,speed,now,state,camera,true);
 const aim=visuals.visibleAimTarget("bike",player,speed,now,state,camera,clear);
 assert.ok(aim,"A charged, visible ring must project into the game camera");
 const pointer=new THREE.Vector2(aim.x+.025,aim.y-.02);
 const near=visuals.nearAimTarget("bike",player,speed,now,state,camera,pointer,clear);
 assert.equal(near?.id,aim.id,"A small camera-motion offset still hits the aimed ring");
 assert.equal(visuals.nearAimTarget("bike",player,speed,now,state,camera,
  new THREE.Vector2(.96,-.91),clear),null,"Blank space cannot collect a boost");
 assert.equal(visuals.nearAimTarget("bike",player,0,now,state,camera,pointer,clear),
  null,"Standing still cannot fire");
 assert.equal(visuals.nearAimTarget("bike",player,speed,now,
  {until:0,hitId:null,cooldowns:Object.fromEntries(RIDE_BOOST_TARGETS.map(x=>[x.id,99]))},
  camera,pointer,clear),null,"Cooling-down rings cannot be collected");
 visuals.dispose();
 clear.geometry.dispose();(clear.material as THREE.Material).dispose();
});

test("projected ring cannot advertise or grant a shot through terrain",()=>{
 const scene=new THREE.Scene(),visuals=createRideChallengeGeometry(scene);
 const t=RIDE_BOOST_TARGETS[0],player={...t.point};
 const camera=new THREE.PerspectiveCamera(47,16/9,.1,150);
 camera.position.set(t.point.x,groundHeight(t.point)+5,t.point.z+10);
 camera.lookAt(t.point.x,groundHeight(t.point)+2.9,t.point.z);
 camera.updateMatrixWorld(true);
 // A mock near-field terrain wall intersects the camera-to-target sightline.
 const blocked=new THREE.Mesh(new THREE.BoxGeometry(300,100,1),
  new THREE.MeshBasicMaterial());
 blocked.position.set(t.point.x,groundHeight(t.point)+2.5,t.point.z+5);
 blocked.updateMatrixWorld(true);
 const state=initialRideBoost();visuals.updateTargets("bike",player,7,5,state,camera,true);
 const clearAim=visuals.visibleAimTarget("bike",player,7,5,state,camera,blocked);
 assert.equal(clearAim,null,"Occluded targets must not be advertised as aimable");
 assert.equal(visuals.nearAimTarget("bike",player,7,5,state,camera,
  new THREE.Vector2(0,0),blocked),null,"Aim assist must respect terrain occlusion");
 visuals.dispose();blocked.geometry.dispose();(blocked.material as THREE.Material).dispose();
});
