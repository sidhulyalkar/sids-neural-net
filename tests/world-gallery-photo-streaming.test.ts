import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {galleryPhotoSlots} from "../lib/world/hiddenShrineGallery";
import {galleryAtlasGpuBytes,galleryAtlasTileSize,galleryHighResPriority}
 from "../lib/world/galleryPhotoStreaming";

const slots=galleryPhotoSlots();
test("gallery streaming preserves strict four desktop / two mobile resident caps",()=>{
 const point={x:slots[0].x,z:slots[0].z};
 const desktop=galleryHighResPriority(slots,point,4);
 const mobile=galleryHighResPriority(slots,point,2);
 assert.equal(desktop.length,4);
 assert.equal(mobile.length,2);
 assert.equal(new Set(desktop).size,4);
 assert.equal(new Set(mobile).size,2);
 assert.deepEqual(mobile,desktop.slice(0,2));
 assert.deepEqual(galleryHighResPriority(slots,point,0),[]);
 assert.deepEqual(galleryHighResPriority(slots,point,-4),[]);
});
test("gallery focus always gets first high-resolution residency, even with two closer walls",()=>{
 const focus=slots.findIndex(s=>s.id==="photo-048");
 assert.ok(focus>=0);
 const point={x:slots[0].x,z:slots[0].z};
 const nearest=galleryHighResPriority(slots,point,2);
 assert.ok(!nearest.includes(focus));
 const prioritized=galleryHighResPriority(slots,point,2,"photo-048");
 assert.equal(prioritized[0],focus);
 assert.equal(prioritized.length,2);
 assert.equal(new Set(prioritized).size,2);
 assert.deepEqual(galleryHighResPriority(slots,point,2,"photo-missing"),nearest);
});
test("same-room focus, movement and release can reselect image residency",()=>{
 const scene=readFileSync(
   new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
 const renderer=readFileSync(
   new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
 assert.match(scene,/focusedRoom===lastFocusedRoom&&focusedPhotoId===lastFocusedPhotoId/);
 assert.match(scene,/lastSelectionPosition=null/);
 assert.match(scene,/galleryHighResPriority\(/);
 assert.match(scene,/highResolutionHasPhoto/);
 assert.match(renderer,/updateNearPhotos\(player,focusedPhotoId\)/);
 assert.match(renderer,/hiddenGalleryFocusedHd/);
});
test("mobile gallery atlas saves memory without reducing native-image cap",()=>{
 assert.equal(galleryAtlasTileSize(false),384);
 assert.equal(galleryAtlasTileSize(true),256);
 const desktop=galleryAtlasGpuBytes(galleryAtlasTileSize(false));
 const mobile=galleryAtlasGpuBytes(galleryAtlasTileSize(true));
 assert.equal(desktop,Math.ceil(2688*2688*4*4/3));
 assert.equal(mobile,Math.ceil(1792*1792*4*4/3));
 assert.ok(mobile/desktop<.45);
 const scene=readFileSync(
   new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
 assert.match(scene,/const highResCap=window\.matchMedia.*\?2:4/);
 assert.match(scene,/galleryAtlasTileSize\(/);
});

test("thumbnail upload is progressive, bounded and survives a broken image",()=>{
 const scene=readFileSync(
   new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
 assert.match(scene,/let next=0,loaded=0,settled=0/);
 assert.match(scene,/settled%12===0\|\|settled===slots\.length/);
 assert.match(scene,/finally\{thumbnailSettled\(\);\}/);
 assert.match(scene,/if\(!entry\|\|!ctx\)\{thumbnailSettled\(\);continue;\}/);
 assert.match(scene,/if\(!disposed\)atlas\.needsUpdate=true/);
});
