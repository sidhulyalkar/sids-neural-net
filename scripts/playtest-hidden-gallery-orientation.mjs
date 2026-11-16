import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world?gallery=photos";
const out=process.env.GALLERY_AUDIT_DIR??"artifacts/world/orientation-gallery";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
const results=[];
try{
 for(const vp of [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}]){
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:vp.name==="mobile"?1:.75});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const result={viewport:vp.name,passed:false};
  try{
   await page.goto(base,{timeout:120000});
   const canvas=page.locator('canvas[role="application"]').first();
   await page.waitForFunction(()=>{
    const d=document.querySelector('canvas[role="application"]')?.dataset;
    return d?.hiddenGalleryPhase==="inside"&&d?.hiddenGalleryInBounds==="true"&&Number(d?.drawCalls)>0;
   },null,{timeout:120000});
   await page.waitForFunction(()=>Number(document.querySelector('canvas[role="application"]')?.dataset.hiddenGalleryPhotosReady)>=20,
    null,{timeout:90000});
   result.arrival=await canvas.evaluate(el=>({
    phase:el.dataset.hiddenGalleryPhase,count:el.dataset.hiddenGalleryPhotos,
    loaded:el.dataset.hiddenGalleryPhotosReady,hd:el.dataset.hiddenGalleryHD,
    motion:el.dataset.hiddenGalleryLocomotion,camera:el.dataset.hiddenGalleryCamera,
    inBounds:el.dataset.hiddenGalleryInBounds,drawCalls:el.dataset.drawCalls,
    atlasEdge:el.dataset.hiddenGalleryAtlasEdge
   }));
   assert.equal(result.arrival.phase,"inside");
   assert.equal(Number(result.arrival.count),49);
   assert.equal(result.arrival.motion,"walking");
   assert.equal(result.arrival.camera,"eye-level");
   assert.equal(Number(result.arrival.atlasEdge),vp.name==="mobile"?1792:2688);
   assert.ok(Number(result.arrival.hd)<= (vp.name==="mobile"?2:4));
   await page.screenshot({path:path.join(out,vp.name+"-01-gallery-arrival.png")});
   await canvas.focus();
   await page.keyboard.press("f");
   await page.waitForFunction(()=>/^photo-\d{3}$/.test(
    document.querySelector('canvas[role="application"]')?.dataset.hiddenGalleryPhotoFocus??""),
    null,{timeout:15000});
   result.focus=await canvas.getAttribute("data-hidden-gallery-photo-focus");
   assert.ok(["photo-001","photo-003"].includes(result.focus),
    "gallery focus must select a wide landscape on the first room\u0027s full walls");
   await page.waitForFunction(()=>
    document.querySelector('canvas[role="application"]')?.dataset.hiddenGalleryFocusedHd==="true",
    null,{timeout:30000});
   result.highResFocus=await canvas.getAttribute("data-hidden-gallery-focused-hd");
   assert.equal(result.highResFocus,"true");
   await page.waitForTimeout(500);
   result.fov=await canvas.getAttribute("data-hidden-gallery-fov");
   assert.equal(result.fov,vp.name==="mobile"?"92.0":"74.0");
   await page.screenshot({path:path.join(out,vp.name+"-02-landscape-focus.png")});
   await page.keyboard.press("Escape");
   result.highResAfterFocus=await canvas.getAttribute("data-hidden-gallery-hd");
   assert.ok(Number(result.highResAfterFocus)<= (vp.name==="mobile"?2:4));
   await page.waitForFunction(()=>
    document.querySelector('canvas[role="application"]')?.dataset.hiddenGalleryPhotoFocus==="",null,{timeout:15000});
   assert.deepEqual(errors,[]);
   result.passed=true;
   console.log("GALLERY-WALL-ORIENTATION-PASS",JSON.stringify(result));
  }catch(e){
   result.error=String(e);
   try{await page.screenshot({path:path.join(out,vp.name+"-failure.png")});}catch{}
   console.error("GALLERY-WALL-ORIENTATION-FAIL",JSON.stringify(result));
  }finally{
   result.errors=errors;results.push(result);await page.close();
  }
 }
}finally{
 fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify(results,null,2)+"\n");
 await browser.close();
}
assert.ok(results.length===2&&results.every(r=>r.passed));
