import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT to installed Playwright");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/ride-ghost-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[],results=[],shotAttempts=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>
  Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 await page.getByRole("button",{name:"Mountain biking",exact:true}).click();
 await page.getByRole("button",{name:"Show sport shortcuts",exact:true}).click();
 await page.getByRole("button",{name:"Bike race",exact:true}).click();
 await page.waitForFunction(()=>{
  const data=document.querySelector("canvas")?.dataset;
  return data?.trialPhase==="armed"&&data?.joshuaGhosts==="2";
 },null,{timeout:15000});
 const hud=page.getByLabel("Joshua dirt-bike ghost race");
 assert.match(await hud.textContent(),/GHOST RACE/);
 assert.match(await hud.textContent(),/Lucas/);
 assert.match(await hud.textContent(),/Ness/);
 await page.screenshot({path:path.join(out,"01-ghost-grid.png")});
 await canvas.focus();
 await page.keyboard.down("w");
 try{
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.trialPhase==="running"&&Number(d.speed)>2.25;
  },null,{timeout:20000});
  assert.ok(Number(await canvas.getAttribute("data-joshua-place"))>=1);
  assert.equal(await canvas.getAttribute("data-ride-boost"),"false");
  // Clicking away from visible floating rings does not count as a hit.
  const box=await canvas.boundingBox();
  if(!box)throw Error("No canvas bounds");
  await page.mouse.click(box.x+12,box.y+box.height*.3);
  await page.waitForFunction(()=>
   document.querySelector("canvas")?.dataset.rideBoostLastShot==="miss",
   null,{timeout:8000});
  assert.equal(await canvas.getAttribute("data-ride-boost"),"false");
  // Aim at the real ray-intersectable target, using its read-only screen
  // projection. This does not bypass the click/raycast/cooldown path.
  await page.waitForFunction(()=>!!document.querySelector("canvas")?.dataset.rideBoostAim,
   null,{timeout:23000});
  let hit=false,attempts=0;
  while(!hit&&attempts<4){
   const data=await canvas.getAttribute("data-ride-boost-aim");
   if(!data){
    shotAttempts.push({index:attempts,aim:"none",speed:await canvas.getAttribute("data-speed")});
    await page.waitForTimeout(200);attempts++;continue;
   }
   const [nx,ny,id]=data.split(",");
   const rect=await canvas.boundingBox();
   if(!rect)throw Error("Canvas hidden during ride");
   await page.mouse.click(rect.x+(Number(nx)+1)*rect.width/2,
    rect.y+(1-Number(ny))*rect.height/2);
   const after=await canvas.getAttribute("data-ride-boost-aim");
   const result=await canvas.getAttribute("data-ride-boost-last-shot");
   shotAttempts.push({index:attempts,aimAtClick:{nx,ny,id},aimAfter:after,
    result,speed:await canvas.getAttribute("data-speed"),
    player:await canvas.getAttribute("data-player"),
    activity:await canvas.getAttribute("data-activity"),
    phase:await canvas.getAttribute("data-trial-phase"),
    assist:await canvas.getAttribute("data-ride-boost-aim-assist")});
   hit=result==="hit";
   attempts++;
  }
  fs.writeFileSync(path.join(out,"target-aim-trace.json"),
   JSON.stringify({shotAttempts,hit,errors},null,2)+"\n");
  if(!hit)await page.screenshot({path:path.join(out,"02-skill-shot-failed.png")});
  assert.equal(hit,true,
   "A visible, aimed, in-range skill shot must hit an actual 3D target");
  assert.equal(await canvas.getAttribute("data-ride-boost"),"true");
  await page.screenshot({path:path.join(out,"02-ride-boost-hit.png")});
  results.push({phase:await canvas.getAttribute("data-trial-phase"),
   position:await canvas.getAttribute("data-joshua-place"),
   targetHit:await canvas.getAttribute("data-ride-boost-last-shot"),
   remaining:await canvas.getAttribute("data-ride-boost-remaining")});
 }finally{await page.keyboard.up("w");}
 assert.deepEqual(errors,[],"No runtime or browser console errors");
 fs.writeFileSync(path.join(out,"report.json"),
  JSON.stringify({results,errors},null,2)+"\n");
 console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
