import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visualArchive } from "../src/data/visualArchive";
import { SEA_SURFACE, isWater, maxDiveDepth, seaFloorHeight } from "../lib/world/model";
import {
  SHRINE_GALLERY, GALLERY_DOORS, GALLERY_ROOMS, GALLERY_ROUTE,
  galleryDoorSide, galleryPhotoSlots, galleryConstrainMove,
  galleryWalkable, galleryNearShaft, galleryShaftTopY, shrineReachable,
} from "../lib/world/hiddenShrineGallery";

test("the shrine is a discoverable WEST-coast underwater entrance near the UCSD trident",()=>{
  const p=SHRINE_GALLERY.entrance;
  assert.ok(isWater(p));
  assert.ok(Math.hypot(p.x+58,p.z-7)<8);
  assert.ok(maxDiveDepth(p)>2.5);
  assert.equal(galleryShaftTopY(),seaFloorHeight(p.x,p.z));
  assert.equal(shrineReachable(p,maxDiveDepth(p)),true);
  assert.equal(shrineReachable(p,0),false);
  assert.equal(shrineReachable({x:p.x+5,z:p.z},maxDiveDepth(p)),false);
  assert.equal(galleryNearShaft(p),true);
});

test("all twelve rooms are below both the sea surface and natural seabed",()=>{
  assert.equal(GALLERY_ROOMS.length,12);
  assert.equal(new Set(GALLERY_ROOMS.map(p=>p.x+","+p.z)).size,12);
  for(const p of GALLERY_ROOMS){
    assert.ok(isWater(p),"room stays offshore");
    assert.ok(SHRINE_GALLERY.roofY<seaFloorHeight(p.x,p.z)-.5,
      "gallery roof must remain buried beneath seabed");
    assert.ok(SHRINE_GALLERY.roofY<SEA_SURFACE-8);
    assert.ok(SHRINE_GALLERY.roofY-SHRINE_GALLERY.floorY>3.5);
  }
});

test("one shared authored door graph connects every gallery room in both directions",()=>{
  assert.equal(GALLERY_ROUTE.length,GALLERY_ROOMS.length);
  assert.equal(new Set(GALLERY_ROUTE).size,GALLERY_ROOMS.length);
  assert.equal(GALLERY_DOORS.length,GALLERY_ROOMS.length-1);
  for(const d of GALLERY_DOORS){
    const a=GALLERY_ROOMS[d.from],b=GALLERY_ROOMS[d.to];
    assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-SHRINE_GALLERY.roomStep)<1e-7);
    const horizontal=Math.abs(a.x-b.x)>1;
    const side=horizontal?(b.x>a.x?"east":"west"):(b.z>a.z?"south":"north");
    const reverse=horizontal?(b.x>a.x?"west":"east"):(b.z>a.z?"north":"south");
    assert.ok(galleryDoorSide(d.from,side));
    assert.ok(galleryDoorSide(d.to,reverse));
    for(let i=0;i<=100;i++){
      const to={x:a.x+(b.x-a.x)*i/100,z:a.z+(b.z-a.z)*i/100};
      assert.ok(galleryWalkable(to),`door blocked: ${d.from}→${d.to} at ${i}`);
    }
    assert.deepEqual(galleryConstrainMove(a,b),b);
    assert.deepEqual(galleryConstrainMove(b,a),a);
  }
});

test("solid walls stop a diver from crossing between disconnected neighboring rooms",()=>{
  const from=GALLERY_ROOMS[0],other=GALLERY_ROOMS[4];
  assert.ok(!galleryDoorSide(0,"south"));
  const attempted=galleryConstrainMove(from,other);
  assert.ok(attempted.z<from.z+SHRINE_GALLERY.halfRoom,
    "no through-wall movement even on long time steps");
  assert.ok(attempted.z>from.z);
  assert.ok(!galleryWalkable({x:from.x+SHRINE_GALLERY.halfRoom+1,z:from.z}));
});

test("all actual archive photographs appear exactly once in the hidden cave",()=>{
  const slots=galleryPhotoSlots();
  assert.equal(slots.length,SHRINE_GALLERY.photoCount);
  assert.equal(new Set(slots.map(p=>p.id)).size,49);
  assert.deepEqual(slots.map(p=>p.id).sort(),visualArchive.map(p=>p.id).sort());
  for(const photo of slots){
    assert.ok(photo.roomIndex>=0&&photo.roomIndex<GALLERY_ROOMS.length);
    assert.ok(photo.width>=1.5);
    assert.ok(photo.y<SHRINE_GALLERY.roofY);
    assert.ok(photo.y>SHRINE_GALLERY.floorY);
  }
});

test("render integration keeps opaque wall architecture and cavern-specific dive logic",()=>{
  const scene=readFileSync(new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
  const runtime=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  assert.match(scene,/sealed-stone-photo-gallery/);
  assert.match(scene,/opaque-gallery-stone-shell/);
  assert.match(scene,/CanvasTexture/);
  assert.doesNotMatch(scene,/glass|transparent:\s*true|opacity:\s*0\.\d/i);
  assert.match(runtime,/galleryPhase==="descending"/);
  assert.match(runtime,/galleryConstrainMove/);
  assert.match(runtime,/hiddenShrineGallery\.interior\.visible=galleryPhase!=="outside"/);
  assert.match(runtime,/terrain\.setIndex\(keep\)/);
  assert.match(runtime,/hiddenShrineGallery\.dispose\(\)/);
});
