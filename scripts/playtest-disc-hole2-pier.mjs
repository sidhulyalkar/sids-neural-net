import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT to installed Playwright");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/disc-hole2-pier";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:820}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 await page.getByRole("button",{name:/^Disc golf · (play|resume|scorecard)$/}).click();
 await page.getByRole("button",{name:"Course",exact:true}).click();
 await page.getByRole("button",{name:/^Play hole 2:/}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.discGolfHole==="scrub-crosswind"&&
   d?.discGolfPhase==="ready"&&d?.discGolfTeeSite==="pier";
 },null,{timeout:15000});
 // Unlike Hole 1, the Hole 2 intro never flies through a forest: the
 // camera begins directly on the open, elevated pier with a fairway view.
 const start=await canvas.evaluate(c=>({
  hole:c.dataset.discGolfHole,
  tee:c.dataset.discGolfTeeSite,
  intro:c.dataset.discGolfIntro,
  height:Number(c.dataset.discGolfTeeHeight),
  avatarX:Number(c.dataset.discGolfAvatarX),
  avatarZ:Number(c.dataset.discGolfAvatarZ),
  phase:c.dataset.discGolfPhase,
  cameraClear:c.dataset.discGolfCameraClear,
 }));
 assert.equal(start.hole,"scrub-crosswind");
 assert.equal(start.tee,"pier");
 assert.equal(start.intro,"off");
 assert.ok(start.height>-2&&Number.isFinite(start.height));
 assert.ok(Math.abs(start.avatarX-62.5)<.15);
 assert.ok(Math.abs(start.avatarZ-14)<.15);
 assert.equal(start.phase,"ready");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfRenderedCameraClear==="true",
  null,{timeout:10000});
 await page.screenshot({path:path.join(out,"01-hole2-pier-tee.png")});
 // Actual player throw, not only a simulated launch contract.
 await page.getByRole("button",{name:"Space · Throw"}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfStrokes==="1",
  null,{timeout:5000});
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfPhase==="flying",
  null,{timeout:5000});
 await page.screenshot({path:path.join(out,"02-hole2-flight.png")});
 assert.deepEqual(errors,[],"No rendering/runtime exceptions at Hole 2 pier");
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({start,errors},null,2)+"\n");
 console.log("Hole 2 pier tee accepted",JSON.stringify(start));
}finally{await browser.close();}
