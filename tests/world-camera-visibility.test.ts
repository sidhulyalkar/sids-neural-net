import assert from "node:assert/strict";
import test from "node:test";
import {CameraVisibilityField,cameraSegmentHitsVolume} from
 "../lib/world/cameraVisibility";

const floor=()=>0;
const look={x:0,y:1.65,z:0};

test("full 3D swept view intersects leaf volumes and ignores different heights",()=>{
 const leaf={x:0,y:8,z:9,rx:5,ry:6,rz:3};
 assert.ok(cameraSegmentHitsVolume({x:0,y:9,z:18},{x:0,y:1,z:0},leaf));
 assert.equal(cameraSegmentHitsVolume({x:0,y:22,z:18},
  {x:0,y:22,z:0},leaf),false);
 assert.ok(cameraSegmentHitsVolume({x:0,y:8,z:9},{x:0,y:8,z:9},leaf));
 assert.equal(cameraSegmentHitsVolume({x:22,y:8,z:9},
  {x:22,y:8,z:9},leaf),false);
});

test("disc hole-1 rethrow repositions out of a wide canopy facing the avatar",()=>{
 // A giant canopy occupies the requested view, similar to the user's
 // screenshot in which the camera is engulfed by teal leaf geometry.
 const field=new CameraVisibilityField([
  {x:0,y:10,z:14,rx:8,ry:10,rz:7},
  {x:7,y:15,z:4,rx:2.2,ry:5,rz:2.4},
 ]);
 const desired={x:0,y:13,z:19};
 assert.ok(field.blockers(desired,look)>0);
 const result=field.resolve(desired,look,floor);
 assert.equal(result.clear,true,"must find another camera outside the foliage");
 assert.equal(result.adjusted,true);
 assert.equal(field.blockers(result.point,look),0);
 assert.ok(result.point.y>=3.2);
 assert.ok(Math.hypot(result.point.x, result.point.z)>2,
  "do not place the lens inside the player");
 assert.deepEqual(field.resolve(desired,look,floor),result,
  "search must be deterministic with no random camera whiplash");
});

test("maintain an already-visible framed shot without moving its position",()=>{
 const field=new CameraVisibilityField([{x:50,y:15,z:50,rx:5,ry:9,rz:6}]);
 const desired={x:4,y:13,z:18};
 const actual=field.resolve(desired,look,floor);
 assert.equal(actual.clear,true);
 assert.equal(actual.adjusted,false);
 assert.deepEqual(actual.point,desired);
});

test("use three-dimensional terrain clearance and avoid camera inside rock",()=>{
 const field=new CameraVisibilityField([{x:0,y:13,z:18,rx:3,ry:6,rz:3}]);
 const terrain=(x:number,z:number)=>x>0&&z>0?17:0;
 const result=field.resolve({x:0,y:13,z:18},look,terrain);
 assert.equal(result.clear,true);
 assert.ok(result.point.y>=terrain(result.point.x,result.point.z)+3.2);
});

test("spatial field checks lower torso, not just the visible head",()=>{
 const field=new CameraVisibilityField([{x:0,y:.65,z:7,rx:2,ry:.5,rz:2}]);
 const pose={x:0,y:1.65,z:16};
 // Head-only tests can miss this obstructing chest/torso leaf cluster.
 assert.ok(field.blockers(pose,look)>0);
});

 test("camera boom clears an intervening terrain ridge, not just the lens floor",()=>{
  const field=new CameraVisibilityField([]);
  const floor=(x:number,z:number)=>Math.abs(x)<3&&z>6&&z<10?7:0;
  const result=field.resolve({x:0,y:5,z:16},look,floor);
  assert.equal(result.clear,true);assert.equal(result.adjusted,true);
  for(let i=1;i<30;i++){
   const t=i/30,p=result.point;
   assert.ok(p.y+(look.y-p.y)*t>=floor(p.x*(1-t),p.z*(1-t))+.2);
  }
 });
