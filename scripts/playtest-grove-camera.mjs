import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const runner=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!runner)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(runner,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world/grove-camera";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const errors=[],report=[];
async function arrive(page,region="grove"){
 const button=region==="grove"?"01 Redwood grove A little about me":
  "06 Fern falls Follow the water";
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:button,exact:true}).click();
 try{
  await page.waitForFunction(region=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.currentRegion===region&&d.forestPlayerFramed==="true"&&
     d.forestRenderedCameraClear==="true";
  },region,{timeout:40000,polling:"raf"});
 }catch(error){
  const state=await page.locator("canvas").evaluate(c=>({
   currentRegion:c.dataset.currentRegion,
   player:c.dataset.player,activity:c.dataset.activity,
   forestCandidate:c.dataset.forestCameraCandidateClear,
   forestRendered:c.dataset.forestRenderedCameraClear,
   forestFramed:c.dataset.forestPlayerFramed,
   forestScreen:c.dataset.forestPlayerScreen,
   forestBlocks:c.dataset.forestCameraBlockers,
   forestCutaways:c.dataset.forestCameraCutaways,
   forestAdjusted:c.dataset.forestCameraAdjusted,
   cameraDistance:c.dataset.cameraDistance,
   cameraTargetError:c.dataset.cameraTargetError,
   cameraPosition:c.dataset.skiCameraPosition,
   look:c.dataset.skiCameraLook,
   drawCalls:c.dataset.drawCalls,
   regionHint:c.dataset.currentRegion,
  }));
  const name="failure-"+region+"-"+page.viewportSize().width;
  fs.writeFileSync(path.join(output,name+".json"),
   JSON.stringify({state,error:String(error)},null,2)+"\n");
  await page.screenshot({path:path.join(output,name+".png")});
  console.error("FOREST ARRIVAL DIAGNOSTIC",JSON.stringify({region,state,error:String(error)}));
  throw error;
 }
 // The camera must remain safe after moving toward the resolved shot.
 await page.waitForTimeout(1100);
 const state=await page.locator("canvas").evaluate(c=>({
  region:c.dataset.currentRegion,player:c.dataset.player,
  candidateClear:c.dataset.forestCameraCandidateClear,
  actualClear:c.dataset.forestRenderedCameraClear,
  framed:c.dataset.forestPlayerFramed,
  screen:c.dataset.forestPlayerScreen,
  cutaways:c.dataset.forestCameraCutaways,
  adjusted:c.dataset.forestCameraAdjusted,
  blockers:c.dataset.forestCameraBlockers,
 }));
 assert.equal(state.actualClear,"true",JSON.stringify(state));
 assert.equal(state.framed,"true",JSON.stringify(state));
 return state;
}
try{
 for(const size of [{w:1440,h:900,mobile:false},{w:390,h:844,mobile:true}]){
  const page=await browser.newPage({viewport:{width:size.w,height:size.h},
   isMobile:size.mobile,hasTouch:size.mobile,deviceScaleFactor:1});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:90000});
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:90000});
  const initial=await arrive(page);
  await page.screenshot({path:path.join(output,size.w+"-grove-arrival.png")});
  report.push({size:size.w,scenario:"grove-arrival",...initial});
  const falls=await arrive(page,"waterfall");
  await page.screenshot({path:path.join(output,size.w+"-falls-arrival.png")});
  report.push({size:size.w,scenario:"falls-arrival",...falls});
  if(!size.mobile){
   // Reenter from a distant biome to exercise actual camera interpolation.
   await page.getByRole("button",{name:"Open navigation menu"}).click();
   await page.getByRole("button",{name:"02 Granite ridge Things I build",exact:true}).click();
   await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.currentRegion==="mountain",
    null,{timeout:20000});
   const returnState=await arrive(page,"grove");
   await page.screenshot({path:path.join(output,"1440-grove-return.png")});
   report.push({size:size.w,scenario:"return",...returnState});
  }
  await page.close();
 }
 assert.deepEqual(errors,[],"No uncaught errors during Redwood camera traversal");
 fs.writeFileSync(path.join(output,"report.json"),JSON.stringify({report,errors},null,2)+"\n");
 console.log("FOREST LANDMARK CAMERA QA PASS",JSON.stringify({report,errors}));
}finally{await browser.close();}
