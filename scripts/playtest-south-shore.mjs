import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/south-shore";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const traces=[];
let failed=false;
try{
 for(const vp of [{name:"desktop",width:1440,height:900},
                  {name:"mobile",width:390,height:844}]){
  const page=await browser.newPage({viewport:{width:vp.width,height:vp.height}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const trace={viewport:vp.name};
  try{
   await page.goto(base);
   await page.getByRole("button",{name:"Explore world",exact:true}).click();
   const canvas=page.locator("canvas");
   await page.waitForFunction(()=>
    Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
    null,{timeout:45000});
   await page.getByRole("button",{name:"Open navigation menu"}).click();
   await page.getByRole("button",{name:/South shore/}).click();
   await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    const z=Number(d?.player?.split(",")[1]);
    return d?.aquatic==="surface"&&z< -107&&z> -114;
   },null,{timeout:25000});
   trace.arrival=await canvas.evaluate(el=>({
    pos:el.dataset.player,aquatic:el.dataset.aquatic,
    zone:el.dataset.reefZone,region:el.dataset.currentRegion,
    south:el.dataset.southPassage,
    rayCount:el.dataset.eagleFever,visibleRays:el.dataset.eagleFeverVisible,
    fish:el.dataset.southReefFish,draws:el.dataset.southCoastalDrawCalls,
   }));
   assert.equal(trace.arrival.zone,"south-channel");
   assert.ok(Number(await canvas.getAttribute("data-south-rock-clearance"))>=.74);
   assert.equal(trace.arrival.region,"south-shore",
    "South Shore must not be mislabeled Wild coast");
   assert.equal(trace.arrival.south,"true");
   assert.equal(Number(trace.arrival.rayCount),96);
   assert.ok(Number(trace.arrival.fish)>=72);
   await page.waitForTimeout(900);
   await page.screenshot({path:path.join(out,vp.name+"-01-south-shore-arrival.png")});
   await canvas.focus();
   await page.keyboard.press("v");
   await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.aquatic==="dive",
    null,{timeout:24000});
   trace.dive=await canvas.evaluate(el=>({aquatic:el.dataset.aquatic,
    depth:el.dataset.depth,maxDepth:el.dataset.maxDepth,
    zone:el.dataset.reefZone}));
   assert.equal(trace.dive.zone,"south-channel");
   await page.screenshot({path:path.join(out,vp.name+"-02-south-dive.png")});
   await page.keyboard.down("w");
   try{
    await page.waitForFunction(()=>{
     const z=Number(document.querySelector("canvas")?.dataset.player?.split(",")[1]);
     return z< -115;
    },null,{timeout:90000});
   }finally{await page.keyboard.up("w");}
   trace.swam=await canvas.getAttribute("data-player");
   await page.screenshot({path:path.join(out,vp.name+"-03-offshore.png")});
   assert.deepEqual(errors,[]);
   console.log("SOUTH SHORE BROWSER PASS",JSON.stringify(trace));
  }catch(e){
   failed=true;
   trace.error=String(e);trace.errors=errors;
   try{await page.keyboard.up("w");await page.screenshot({
    path:path.join(out,vp.name+"-failure.png")});}catch{/*closing*/}
   console.error("SOUTH SHORE BROWSER FAIL",JSON.stringify(trace));
  }finally{
   traces.push(trace);await page.close();
  }
 }
}finally{
 fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify(traces,null,2)+"\n");
 await browser.close();
}
if(failed)process.exitCode=1;
