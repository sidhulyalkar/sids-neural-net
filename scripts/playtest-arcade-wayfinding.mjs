import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const url=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/arcade-wayfinding";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[],trace={};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(url);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  const canvas=page.locator("canvas");
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.arcadeWayfinding==="split-basalt-amber-v1",
   null,{timeout:10000});
  assert.equal(await canvas.getAttribute("data-arcade-trail-markers"),"4");
  assert.equal(await canvas.getAttribute("data-arcade-wayfinding-sign"),"ARCADE");
  assert.equal(await canvas.getAttribute("data-arcade-portal-visual"),"open-dark-arch");
  await page.getByRole("button",{name:"Open navigation menu"}).click();
  await page.getByRole("button",{name:/02 Granite ridge Things I build/}).click();
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.player?.startsWith("8.00,"),
   null,{timeout:12000});
  trace.ridge=await canvas.getAttribute("data-player");
  await page.screenshot({path:path.join(out,"01-granite-ridge-beacon-approach.png")});
  await page.getByRole("button",{name:"Open navigation menu"}).click();
  await page.getByRole("button",{name:/08 Arcade cavern Play my games/}).click();
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.arcadeTrailStage==="entrance"&&d.caveLayer==="surface";
  },null,{timeout:15000});
  trace.approach=await canvas.evaluate(el=>({
   pos:el.dataset.player,stage:el.dataset.arcadeTrailStage,
   text:el.dataset.arcadeTrailHint,layer:el.dataset.caveLayer,
   distance:el.dataset.cameraDistance,
  }));
  assert.match(trace.approach.text??"",/ENTER THE SPLIT STONE/);
  assert.equal(await page.getByRole("status",{name:"Arcade Cavern trail guidance"}).isVisible(),true);
  // Give the intentionally throttled software WebGL at least another frame
  // to finish drawing the *actual* exterior camera pose before signoff.
  await page.waitForTimeout(900);
  await page.screenshot({path:path.join(out,"02-amber-portal-and-arcade-sign.png")});
  await canvas.focus();
  await page.keyboard.down("w");
  try{
   await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.caveLayer==="arcade",
    null,{timeout:35000});
  }finally{await page.keyboard.up("w");}
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.arcadeTrailStage==="inside",
   null,{timeout:10000});
  trace.entered=await canvas.evaluate(el=>({
   pos:el.dataset.player,layer:el.dataset.caveLayer,
   stage:el.dataset.arcadeTrailStage,hint:el.dataset.arcadeTrailHint,
  }));
  assert.equal(trace.entered.hint,"");
  await page.waitForTimeout(1100);
  await page.screenshot({path:path.join(out,"03-walk-inside-mountain.png")});
  assert.deepEqual(errors,[]);
  console.log("ARCADE CAVERN LANDMARK QA PASS",JSON.stringify({trace,errors}));
 }catch(error){
  try{await page.keyboard.up("w");}catch{/* browser disposed */}
  try{await page.screenshot({path:path.join(out,"failure-frame.png")});}
  catch{/* browser disposed */}
  console.error("ARCADE CAVERN LANDMARK QA FAILURE",String(error),JSON.stringify({trace,errors}));
  throw error;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors},null,2)+"\n");
 }
}finally{await browser.close();}
