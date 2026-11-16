import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {galleryPhotoSlots} from "../lib/world/hiddenShrineGallery";
import {galleryAtlasGpuBytes,galleryAtlasTileSize,galleryHighResPriority,galleryDecodeQueue,galleryNativeTextureSize}
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
  assert.match(scene,/settled<=4\|\|settled%8===0\|\|settled===slots\.length/);
 assert.match(scene,/finally\{thumbnailSettled\(\);\}/);
 assert.match(scene,/if\(!entry\|\|!ctx\)\{thumbnailSettled\(\);continue;\}/);
 assert.match(scene,/if\(!disposed\)atlas\.needsUpdate=true/);
});

test("native decoder queue never exceeds two concurrent image decodes",()=>{
 const selected=[5,6,7,8];
 const resident=new Set<number>();
 const loading=new Set<number>();
 const initial=galleryDecodeQueue(selected,resident,loading,2);
 assert.deepEqual(initial,[5,6]);
 loading.add(5);loading.add(6);
 assert.deepEqual(galleryDecodeQueue(selected,resident,loading,2),[]);
 loading.delete(5);resident.add(5);
 assert.deepEqual(galleryDecodeQueue(selected,resident,loading,2),[7]);
 loading.add(7);
 assert.deepEqual(galleryDecodeQueue(selected,resident,loading,2),[]);
 loading.delete(6);
 assert.deepEqual(galleryDecodeQueue([8,7,6],resident,loading,2),[8]);
});
test("rapid focus switches cannot bypass the decoder limit or enqueue stale photos",()=>{
 const resident=new Set<number>(),loading=new Set<number>([5,6]);
 const requested=[40,3];
 assert.deepEqual(galleryDecodeQueue(requested,resident,loading,2),[]);
 loading.delete(5);
 assert.deepEqual(galleryDecodeQueue(requested,resident,loading,2),[40]);
 loading.add(40);
 assert.deepEqual(galleryDecodeQueue([31,2],resident,loading,2),[]);
 loading.delete(6);
 assert.deepEqual(galleryDecodeQueue([31,2],resident,loading,2),[31]);
 assert.deepEqual(galleryDecodeQueue([31,31,-1,NaN,2],resident,new Set(),2),[31,2]);
 assert.deepEqual(galleryDecodeQueue([31,2],resident,new Set(),0),[]);
});
test("scene pumps the newest focus selection when one decoder settles",()=>{
 const scene=readFileSync(
  new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
 assert.match(scene,/galleryDecodeQueue\(\[\.\.\.selectedHighRes\]/);
 assert.match(scene,/if\(!disposed\)startHighResolutionRequests\(\)/);
 assert.match(scene,/loading\.delete\(i\)/);
 assert.match(scene,/hdResources\.has\(i\)/);
});

test("native GPU uploads preserve image orientation while respecting viewport budget",()=>{
 const portraitPhone=galleryNativeTextureSize(1800,2400,true);
 assert.deepEqual(portraitPhone,{width:1152,height:1536,needsResize:true});
 const landscapePhone=galleryNativeTextureSize(2400,1800,true);
 assert.deepEqual(landscapePhone,{width:1536,height:1152,needsResize:true});
 const desktop=galleryNativeTextureSize(1800,2400,false);
 assert.deepEqual(desktop,{width:1536,height:2048,needsResize:true});
 const small=galleryNativeTextureSize(1000,700,true);
 assert.deepEqual(small,{width:1000,height:700,needsResize:false});
 assert.deepEqual(galleryNativeTextureSize(1800,2400,false,1024),
  {width:768,height:1024,needsResize:true});
 assert.ok(Math.abs(portraitPhone.width/portraitPhone.height-1800/2400)<1e-10);
 assert.ok(Math.abs(landscapePhone.width/landscapePhone.height-2400/1800)<1e-10);
 const before=1800*2400*4*4/3;
 const after=portraitPhone.width*portraitPhone.height*4*4/3;
 assert.ok(after/before<.42,"native mobile frame should save >58% GPU pixels");
});
test("large archival photos are never cropped or replaced in the website gallery",()=>{
 const scene=readFileSync(
   new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
 assert.match(scene,/galleryNativeTextureSize\(/);
 assert.match(scene,/context\.drawImage\(image,0,0,surface\.width,surface\.height\)/);
 assert.match(scene,/new THREE\.Texture\(uploadSource\)/);
 assert.match(scene,/const entry=photoEntries\.get\(slots\[i\]\.id\)/);
});

test("failed HD decodes do not loop forever and atlas fallback remains available",()=>{
 const loading=new Set<number>();
 const failed=new Set<number>([5]);
 const resident=new Set<number>([...failed]);
 assert.deepEqual(galleryDecodeQueue([5,6],resident,loading,2),[6]);
 resident.add(6);
 assert.deepEqual(galleryDecodeQueue([5,6],resident,loading,2),[]);
 const scene=readFileSync(
  new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
 assert.match(scene,/const failedHighRes=new Set<number>\(\)/);
 assert.match(scene,/failedHighRes\.add\(i\)/);
 assert.match(scene,/new Set\(\[\.\.\.hdResources\.keys\(\),\.\.\.failedHighRes\]\)/);
 assert.match(scene,/if\(focusedRoom!==lastFocusedRoom\|\|focusedPhotoId!==lastFocusedPhotoId\)/);
 assert.match(scene,/failedHighRes\.clear\(\)/);
});
