import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/hidden-gallery";
fs.mkdirSync(out,{recursive:true});
const errors=[];
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const report={routes:[],screenshots:[],errors};
try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  page.on("pageerror",e=>{
    errors.push(e.message);
    console.error("GALLERY PAGE ERROR",e.stack??e.message);
  });
  page.on("console",message=>{
    if(message.type()==="error"||/WebGL.*context lost/i.test(message.text()))
      console.error("GALLERY BROWSER",message.type(),message.text());
  });
  await page.goto(base+"/?gallery=photos",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>{
    const canvas=document.querySelector("canvas[data-hidden-gallery-phase='inside']");
    return !!canvas && canvas.dataset.hiddenGalleryLocomotion==="walking" &&
      canvas.dataset.hiddenGalleryInBounds==="true";
  },null,{timeout:90000});
  // Pin the canvas element, not a selector whose attribute changes during
  // React initialization or recovery. The latter can vanish between two
  // Playwright commands even when the same WebGL canvas is still present.
  const scene=page.locator("canvas").first();
  await page.waitForTimeout(900);
  const boot=await page.evaluate(()=>{
    const canvas=document.querySelector("canvas");
    return {phase:canvas?.dataset.hiddenGalleryPhase??null,
      locomotion:canvas?.dataset.hiddenGalleryLocomotion??null,
      worldState:document.querySelector("[data-world-state]")?.getAttribute("data-world-state"),
      canvases:document.querySelectorAll("canvas").length};
  });
  console.log("GALLERY BOOT",JSON.stringify(boot));
  if(boot.phase!=="inside"){
    console.error("GALLERY FAIL SNAPSHOT",JSON.stringify({
      url:page.url(),boot,errors}));
    await page.screenshot({path:path.join(out,"gallery-startup-fallback.png")});
  }
  assert.equal(boot.phase,"inside","The gallery should remain entered after initialization");
  assert.equal(await scene.getAttribute("data-hidden-gallery-photos"),"49");
  assert.equal(await scene.getAttribute("data-shrine-coral-arrows"),"4",
    "all four decorative underwater arrows must be assembled");
  assert.equal(await scene.getAttribute("data-shrine-coral-colonies"),"36");
  assert.equal(await scene.getAttribute("data-shrine-dive-cue"),"DIVE",
    "underwater visitors have an in-world depth instruction");
  assert.ok(Number(await scene.getAttribute("data-shrine-dive-cue-segments"))>=18,
    "DIVE lettering and the downward chevron use real geometry");
  assert.equal(await scene.getAttribute("data-western-trident-relocated"),"true");
  assert.equal(await scene.getAttribute("data-moss-canyon-rocks"),"16");
  assert.equal(await scene.getAttribute("data-moss-canyon-corals"),"64");
  assert.equal(await scene.getAttribute("data-moss-canyon-anemones"),"32");
  assert.equal(await scene.getAttribute("data-hidden-gallery-locomotion"),"walking");
  const initial=await scene.getAttribute("data-player");
  assert.equal(await scene.getAttribute("data-hidden-gallery-camera"),"eye-level");
  assert.equal(await scene.getAttribute("data-hidden-gallery-fov"),"68.0");
  await page.screenshot({path:path.join(out,"gallery-start.png")});
  // The same accessible F interaction aligns each photograph to its 2.45m
  // standing position. Escape restores uninterrupted gallery walking.
  await scene.focus();
  await page.keyboard.press("f");
  await page.waitForFunction(()=>{
    const c=document.querySelector("canvas");
    return !!c?.dataset.hiddenGalleryPhotoFocus;
  },null,{timeout:10000});
  const focused=await scene.getAttribute("data-hidden-gallery-photo-focus");
  assert.equal(await scene.getAttribute("data-hidden-gallery-fov"),"74.0");
  assert.match(focused,/^photo-\d{3}$/);
  await page.screenshot({path:path.join(out,"gallery-photo-focus.png")});
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>{
    const c=document.querySelector("canvas");
    return c?.dataset.hiddenGalleryPhotoFocus===""&&
      c?.dataset.hiddenGalleryFov==="68.0";
  },null,{timeout:10000});
  await page.keyboard.down("w");
  await page.waitForTimeout(850);
  await page.keyboard.up("w");
  await page.waitForTimeout(600);
  assert.equal(await scene.getAttribute("data-hidden-gallery-phase"),"inside");
  assert.equal(await scene.getAttribute("data-hidden-gallery-in-bounds"),"true");
  const moved=await scene.getAttribute("data-player");
  assert.notEqual(moved,initial,"Walking must move the actual player");
  await page.screenshot({path:path.join(out,"gallery-walking.png")});
  // Continue through the real first doorway. A movement-only test within the
  // starting room cannot detect wall popping and interior visibility glitches.
  // SwiftShader can render at 1-3 FPS on hosted runners. Check actual
  // passage through the doorway, not a fixed number of wall-clock seconds.
  const entranceX=Number(initial.split(",")[0]);
  assert.ok(Number.isFinite(entranceX),"Gallery exposes numeric position");
  await page.keyboard.down("w");
  try{
    await page.waitForFunction(x=>{
      const canvas=document.querySelector("canvas[data-hidden-gallery-phase='inside']");
      const movedX=Number(canvas?.dataset.player?.split(",")[0]);
      return Number.isFinite(movedX)&&movedX<x-6;
    },entranceX,{timeout:60000,polling:250});
  }catch(error){
    const trace=await page.evaluate(()=>({
      phase:document.querySelector("canvas")?.dataset.hiddenGalleryPhase??null,
      position:document.querySelector("canvas")?.dataset.player??null,
      worldState:document.querySelector("[data-world-state]")?.getAttribute("data-world-state"),
    }));
    console.error("GALLERY DOOR TRACE",JSON.stringify({entranceX,trace}));
    await page.screenshot({path:path.join(out,"gallery-door-blocked.png")});
    throw error;
  }finally{
    await page.keyboard.up("w");
  }
  await page.waitForTimeout(1100);
  const nextRoom=await scene.getAttribute("data-player");
  console.log("GALLERY DOOR PASS",JSON.stringify({initial,nextRoom}));
  assert.equal(await scene.getAttribute("data-hidden-gallery-in-bounds"),"true");
  await page.waitForFunction(()=>{
    const c=document.querySelector("canvas[data-hidden-gallery-phase='inside']");
    return !!c && Number(c.dataset.hiddenGalleryHD)>=2;
  },null,{timeout:30000});
  // On hosted SwiftShader, settling a follow camera can take several seconds
  // of real time. Wait for its arrival and give the async HD atlas time to
  // settle before checking the STONE FLOOR rather than moving hero artwork.
  await page.waitForTimeout(5500);
  await page.screenshot({path:path.join(out,"gallery-next-room.png")});
  const stills=[];
  for(let i=0;i<3;i++){
    await page.waitForTimeout(500);
    const name="gallery-still-"+(i+1)+".png";
    const screenshot=await page.screenshot({path:path.join(out,name)});
    stills.push(screenshot.toString("base64"));
  }
  const stability=await page.evaluate(async frames=>{
    const samples=[];
    for(const encoded of frames){
      const img=new Image();
      img.src="data:image/png;base64,"+encoded;
      await img.decode();
      const canvas=document.createElement("canvas");
      canvas.width=240;canvas.height=160;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(img,0,0,240,160);
      samples.push(ctx.getImageData(0,0,240,160).data);
    }
    // The floor remains invariant even if distant scenery, the avatar,
    // or a just-decoded photo outside this region animates.
    const meanDelta=(a,b,area)=>{
      const [x0,y0,x1,y1]=area;
      let total=0,n=0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
        const i=(y*240+x)*4;
        total+=Math.abs(a[i]-b[i])+
          Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
        n++;
      }
      return total/(n*3);
    };
    const frameArea=[0,0,240,160];
    const floorArea=[60,105,180,133]; // open stone floor, clear of avatar/HUD
    return {
      full:Math.max(meanDelta(samples[0],samples[1],frameArea),
        meanDelta(samples[1],samples[2],frameArea)),
      floor:Math.max(meanDelta(samples[0],samples[1],floorArea),
        meanDelta(samples[1],samples[2],floorArea)),
    };
  },stills);
  console.log("GALLERY STATIC IMAGE METRICS",JSON.stringify(stability));
  assert.ok(stability.floor<12,
    `Continuous stone floor must not visibly flicker while still (floor pixel change ${stability.floor.toFixed(2)})`);
  report.routes.push({route:"/?gallery=photos",phase:"inside",
    locomotion:"walking",moved:true,throughDoor:true,
    floorPixelDifference:stability.floor,wholeFrameDifference:stability.full});
  await page.goto(base+"/photography?photo=photo-021",{waitUntil:"domcontentloaded"});
  const viewer=page.getByRole("dialog",{name:"Visual Cortex image viewer"});
  await viewer.waitFor({state:"visible",timeout:60000});
  assert.ok(await viewer.locator("img[src*='photo-021']").count()>0);
  await page.screenshot({path:path.join(out,"photo-deep-link.png")});
  await viewer.getByRole("button",{name:"Close image viewer"}).click();
  const worldPhotoLink=page.getByRole("link",{name:/Walk through the hidden photography gallery/});
  assert.equal(await worldPhotoLink.getAttribute("href"),"/?gallery=photos");
  report.routes.push({route:"/photography?photo=photo-021",viewer:true,worldBacklink:true});
  await page.goto(base+"/publications",{waitUntil:"domcontentloaded"});
  const worldPaperLink=page.getByRole("link",{name:/Enter the hidden waterfall research museum/});
  await worldPaperLink.waitFor({state:"visible",timeout:90000});
  assert.equal(await worldPaperLink.getAttribute("href"),"/?gallery=papers");
  await worldPaperLink.click();
  await page.waitForFunction(()=>{
    const c=document.querySelector("canvas[data-cave-layer='paper']");
    return !!c&&c.dataset.paperGalleryCount==="8";
  },null,{timeout:90000});
  assert.equal(await scene.getAttribute("data-paper-gallery-rooms"),"3");
  assert.equal(await scene.getAttribute("data-paper-museum-room"),"0");
  await page.screenshot({path:path.join(out,"paper-gallery.png")});
  await scene.focus();
  await page.keyboard.down("w");
  try{
    await page.waitForFunction(()=>{
      const c=document.querySelector("canvas");
      return c?.dataset.paperMuseumRoom==="1";
    },null,{timeout:110000,polling:350});
    await page.screenshot({path:path.join(out,"paper-gallery-room2.png")});
    await page.waitForFunction(()=>{
      const c=document.querySelector("canvas");
      return c?.dataset.paperMuseumRoom==="2";
    },null,{timeout:120000,polling:350});
    await page.screenshot({path:path.join(out,"paper-gallery-room3.png")});
  }catch(error){
    const trace=await page.evaluate(()=>({
      room:document.querySelector("canvas")?.dataset.paperMuseumRoom,
      position:document.querySelector("canvas")?.dataset.player,
      caveLayer:document.querySelector("canvas")?.dataset.caveLayer,
    }));
    console.error("PAPER MUSEUM ROOM TRACE",JSON.stringify(trace));
    await page.screenshot({path:path.join(out,"paper-museum-traversal-failed.png")});
    throw error;
  }finally{
    await page.keyboard.up("w");
  }
  report.routes.push({
    route:"/?gallery=papers",museum:"paper",papers:8,roomsTraversed:3,
  });
  report.screenshots=["gallery-start.png","gallery-photo-focus.png","gallery-walking.png",
    "gallery-next-room.png","gallery-still-1.png","gallery-still-2.png",
    "gallery-still-3.png","photo-deep-link.png","paper-gallery.png",
    "paper-gallery-room2.png","paper-gallery-room3.png"];
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
  console.log("GALLERY WALK / PHOTO DEEP LINK / PAPER MUSEUM BROWSER QA PASS");
  await page.close();
}finally{await browser.close();}
