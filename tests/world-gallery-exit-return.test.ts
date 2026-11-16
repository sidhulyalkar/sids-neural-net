import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {maxDiveDepth,isWater,SEA_SURFACE} from "../lib/world/model";
import {SHRINE_GALLERY} from "../lib/world/hiddenShrineGallery";
import {restoreGallerySwimPose,type GallerySwimPose} from "../lib/world/galleryReturn";

const original:GallerySwimPose={
  point:{x:SHRINE_GALLERY.entrance.x+.25,z:SHRINE_GALLERY.entrance.z+.3},
  swimDepth:1.9,targetDepth:2.2,
  heading:{x:0,z:-1},yaw:1.14,pitch:.43,zoom:18,
};

test("leaving a naturally entered gallery restores snorkeling point, depth, heading and camera",()=>{
  assert.ok(isWater(original.point));
  assert.ok(maxDiveDepth(original.point)>original.targetDepth);
  const restored=restoreGallerySwimPose(original);
  assert.deepEqual(restored,original);
  assert.notStrictEqual(restored.point,original.point);
  assert.notStrictEqual(restored.heading,original.heading);
  restored.point.x+=1;
  assert.equal(original.point.x,SHRINE_GALLERY.entrance.x+.25);
  assert.equal(SEA_SURFACE-original.swimDepth,SEA_SURFACE-restored.swimDepth);
});

test("a direct-linked museum has a valid underwater exit rather than returning to its buried floor",()=>{
  const returned=restoreGallerySwimPose(null);
  assert.deepEqual(returned.point,SHRINE_GALLERY.entrance);
  assert.ok(isWater(returned.point));
  assert.ok(returned.swimDepth>=.52);
  assert.ok(returned.swimDepth<=maxDiveDepth(returned.point));
  assert.ok(SEA_SURFACE-returned.swimDepth>SHRINE_GALLERY.roofY);
  assert.ok(returned.zoom>10);
});

test("restore uses safe water fallback for unusable positions and constrains depth to seafloor",()=>{
  const invalid=restoreGallerySwimPose({...original,point:{x:Infinity,z:0}});
  assert.deepEqual(invalid.point,SHRINE_GALLERY.entrance);
  const capped=restoreGallerySwimPose({
    ...original,swimDepth:1e5,targetDepth:1e6,
  });
  assert.ok(capped.swimDepth<=maxDiveDepth(original.point));
  assert.ok(capped.targetDepth<=maxDiveDepth(original.point));
  assert.ok(capped.swimDepth>=.52);
});

test("world renderer prioritizes gallery E before swimming, skate and ski bindings",()=>{
  const s=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  assert.match(s,/if\(galleryPhase==="inside"\)\{\s*if\(key==="e"\)/);
  assert.match(s,/if\(!e\.repeat\)exitGalleryToSnorkeling\(\)/);
  assert.match(s,/galleryReturn=\{\s*point:\{\.\.\.player\},swimDepth,targetDepth/);
  assert.match(s,/if\(action==="surface"\|\|action==="shallower"\)exitGalleryToSnorkeling\(\)/);
  assert.match(s,/galleryPhase="outside";\s*galleryFocusIndex=null;/);
});
