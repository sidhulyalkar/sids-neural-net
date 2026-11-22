import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT must point to Playwright");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world-master-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const report={requestedSkiV3:process.env.NEXT_PUBLIC_SKI_V3??"unset",runs:[],errors:[]};
const state=page=>page.locator('canvas[role="application"]').first().evaluate(c=>({
 activity:c.dataset.activity,
 x:Number(c.dataset.player?.split(",")[0]),
 z:Number(c.dataset.player?.split(",")[1]),
 drawCalls:Number(c.dataset.drawCalls),
 halfpipe:c.dataset.mountainHalfpipe,
 triangles:Number(c.dataset.mountainHalfpipeTriangles),
 skiRidePhase:c.dataset.skiRidePhase,
 bigAir:c.dataset.bigAirPhase,
 authorized:c.dataset.mountainSkiJumpAuthorized,
 snow:c.dataset.snowing,
}));
try{
 for(const spec of [
  {name:"desktop",viewport:{width:1440,height:900},touch:false},
  {name:"mobile",viewport:{width:390,height:844},touch:true},
 ]){
  const page=await browser.newPage({viewport:spec.viewport,isMobile:spec.touch,hasTouch:spec.touch});
  page.on("pageerror",e=>report.errors.push(spec.name+": "+e.message));
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>{
   const c=document.querySelector('canvas[role="application"]');
   return Number(c?.dataset.drawCalls)>0 && [...document.querySelectorAll("button")]
     .some(b=>b.getAttribute("aria-label")==="Skiing"&&!b.disabled);
  },null,{timeout:110000,polling:"raf"});
  const ski=page.getByRole("navigation",{name:"World movement and sports"})
    .getByRole("button",{name:"Skiing",exact:true});
  if(spec.touch)await ski.tap();else await ski.click();
  await page.waitForFunction(()=>{
   const d=document.querySelector('canvas[role="application"]')?.dataset;
   return d?.activity==="ski"&&d?.bigAirPhase==="idle"&&Number(d.drawCalls)>0;
  },null,{timeout:70000,polling:"raf"});
  await page.locator('canvas[role="application"]').first().focus();
  const start=await state(page);
  assert.equal(start.halfpipe,"absent","the original mountain must be visible");
  assert.equal(start.triangles,0,"halfpipe subdivision must be absent");
  assert.equal(start.skiRidePhase,"","V3 physics must not start under either flag");
  assert.equal(start.bigAir,"idle","normal skiing must not arm Ski Jump");
  assert.equal(start.authorized,"false");
  assert.ok(start.drawCalls>0);
  await page.screenshot({path:path.join(out,`classic-${spec.name}-entry.png`)});
  if(!spec.touch){
   await page.keyboard.down("w");
   await page.waitForTimeout(1100);
   await page.keyboard.up("w");
   const moving=await state(page);
   assert.ok(Math.hypot(moving.x-start.x,moving.z-start.z)>.25,
     `classic skis must move from Granite Ridge: ${JSON.stringify({start,moving})}`);
   assert.equal(moving.skiRidePhase,"");
   assert.equal(moving.bigAir,"idle");
   await page.screenshot({path:path.join(out,"classic-desktop-moving.png")});
   await page.getByRole("button",{name:"Show sport shortcuts"}).click();
   await page.getByRole("button",{name:"Ski jump",exact:true}).click();
   await page.waitForFunction(()=>{
    const d=document.querySelector('canvas[role="application"]')?.dataset;
    return d?.bigAirPhase==="armed"&&d?.activity==="ski";
   },null,{timeout:30000});
   const armed=await state(page);
   assert.equal(armed.authorized,"true");
   await page.screenshot({path:path.join(out,"classic-menu-authorized-ski-jump.png")});
   report.runs.push({name:spec.name,start,moving,armed});
  }else report.runs.push({name:spec.name,start});
  await page.close();
 }
 assert.deepEqual(report.errors,[]);
 console.log("CLASSIC SKI BROWSER QA PASS",JSON.stringify(report));
}catch(e){report.failure=String(e);console.error("CLASSIC SKI BROWSER QA FAILURE",e);throw e;}
finally{
 fs.writeFileSync(path.join(out,"classic-ski-evidence.json"),JSON.stringify(report,null,2));
 await browser.close();
}
