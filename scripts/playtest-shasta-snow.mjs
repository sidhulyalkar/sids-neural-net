import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/shasta-snow-play";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>
  Number(document.querySelector("canvas")?.dataset.drawCalls)>0,null,{timeout:45000});
 assert.equal(await canvas.getAttribute("data-dog-snow-stage"),"idle");
 assert.equal(await canvas.getAttribute("data-shasta-tail-tip"),"closed-white");
 assert.ok(Number(await canvas.getAttribute("data-shasta-paw-width"))>=.14);
 assert.equal(await canvas.getAttribute("data-shasta-joints-valid"),"true");
 await page.getByRole("button",{name:"Skiing",exact:true}).click();
 await page.waitForFunction(()=>{
  const stage=document.querySelector("canvas")?.dataset.dogSnowStage;
  return stage==="perk"||stage==="zoom";
 },null,{timeout:15000});
 await page.waitForFunction(()=>
  document.querySelector("canvas")?.dataset.dogSnowStage==="zoom",
  null,{timeout:9000});
 const frames=await page.evaluate(async ()=>{
  const out=[];
  for(let i=0;i<10;i++){
   const d=document.querySelector("canvas")?.dataset;
   out.push({gait:d?.dogGait,bodyBob:Number(d?.dogBodyBob),
    stage:d?.dogSnowStage,footLift:Number(d?.dogFootLiftMax)});
   await new Promise(resolve=>setTimeout(resolve,90));
  }
  return out;
 });
 assert.ok(frames.every(f=>Math.abs(f.bodyBob)<.03),
  "Snow sprint must run on planted legs, not whole-body hopping");
 assert.ok(frames.some(f=>f.gait==="trot"||f.gait==="canter"||f.gait==="walk"),
  "Shasta must move on articulated paws during excited zoomies");
 await page.screenshot({path:path.join(out,"01-shasta-snow-zoom.png")});
 // WebGL software screenshots may take longer than an animation phase.
 // Check the renderer's witnessed stage history instead of requiring a
 // transient roll frame to coincide exactly with a Playwright callback.
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.dogSnowHistory?.includes("roll")&&
    Number(d?.dogSnowMaxRoll)>1;
 },null,{timeout:15000});
 await page.screenshot({path:path.join(out,"02-shasta-snow-back-rub.png")});
 await page.waitForFunction(()=>
  document.querySelector("canvas")?.dataset.dogSnowHistory?.includes("shake"),
  null,{timeout:12000});
 await page.screenshot({path:path.join(out,"03-shasta-snow-shake.png")});
 await page.getByRole("button",{name:"Mountain biking",exact:true}).click();
 await page.waitForFunction(()=>
  document.querySelector("canvas")?.dataset.dogSnowStage==="idle",
  null,{timeout:6000});
 assert.equal(await canvas.getAttribute("data-dog-snow-queued"),"false");
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"report.json"),
  JSON.stringify({frames,errors},null,2)+"\n");
 console.log("Shasta snow play passed",JSON.stringify({frames:frames.length,errors}));
}finally{await browser.close();}
