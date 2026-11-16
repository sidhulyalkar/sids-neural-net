import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {galleryFadeAlpha} from "../lib/world/galleryPhotoStreaming";

test("native museum photos fade over their atlas in bounded, time-based steps",()=>{
  assert.equal(galleryFadeAlpha(0,0),0);
  assert.equal(galleryFadeAlpha(0,-1),0);
  assert.equal(galleryFadeAlpha(Number.NaN,Number.NaN),0);
  assert.equal(galleryFadeAlpha(.9,1),1);
  assert.equal(galleryFadeAlpha(1,.02),1);
  for(const fps of [5,20,60,120]){
    let opacity=0;
    for(let tick=0;tick<Math.ceil(.6*fps);tick++){
      const next=galleryFadeAlpha(opacity,1/fps);
      assert.ok(next>=opacity&&next<=1);
      opacity=next;
    }
    assert.equal(opacity,1,`photo must complete fade at ${fps}fps`);
  }
});

test("progressively decoded atlas remains underneath the native high-resolution artwork",()=>{
  const s=readFileSync(new URL("../components/world/worldHiddenShrineGallery.ts",import.meta.url),"utf8");
  assert.match(s,/settled<=4\|\|settled%8===0/);
  assert.match(s,/new THREE\.Texture\(uploadSource\)/);
  assert.match(s,/toneMapped:false/);
  assert.match(s,/transparent:true,opacity:0,depthWrite:false/);
  assert.match(s,/galleryFadeAlpha\(material\.opacity,deltaSeconds\)/);
  assert.doesNotMatch(s,/photoTargets\[i\]\.visible=false/);
  assert.match(s,/hdMeshes\[i\]\.visible=true/);
  assert.match(s,/transitionOpacity:\(id:string\|null\)/);
});

test("museum focus, touch inspection, accessible lightbox and ocean exit stay connected",()=>{
  const runtime=readFileSync(new URL("../components/world/worldRenderer.ts",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../components/world/WorldHome.tsx",import.meta.url),"utf8");
  assert.match(runtime,/function toggleGalleryPhotoFocus\(\)/);
  assert.match(runtime,/const gazedId=discovery\?\.startsWith\("gallery-photo:"\)/);
  assert.match(runtime,/e\.pointerType!=="mouse"/);
  assert.match(runtime,/galleryFocusIndex!==photoIndex/);
  assert.match(runtime,/galleryReturnVeil\.style\.opacity="0\.93"/);
  assert.match(runtime,/prefers-reduced-motion: reduce/);
  assert.match(runtime,/galleryReturnVeil\.remove\(\)/);
  assert.match(ui,/open\("museum-photo:"\+photoId\)/);
  assert.match(ui,/Museum photograph inspection/);
  assert.match(ui,/Return to the gallery/);
  assert.match(ui,/photoArchiveHref\(museumPhoto\.id\)/);
});
