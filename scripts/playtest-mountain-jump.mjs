import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT to installed Playwright");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/mountain-jump-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push("page: "+e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text().slice(0,300));});
 await page.goto(process.env.WORLD_BASE_URL??"http://127.0.0.1:3000");
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 // Pick Skiing, which navigates to mountain terrain. Do not arm the
 // original fixed-lip big-air challenge.
 await page.getByRole("button",{name:"Skiing",exact:true}).click();
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.activity==="ski"&&Number(d.height)>5.5;
 },null,{timeout:30000});
 const canvas=page.locator("canvas");
 assert.equal(await canvas.getAttribute("data-big-air-phase"),"idle");
 await canvas.focus();
 await page.keyboard.press("Space");
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.bigAirPhase==="flying"&&d.bigAirBirdsFollowing==="true";
 },null,{timeout:30000});
 const flight=await canvas.evaluate(el=>({
  phase:el.dataset.bigAirPhase,
  distance:Number(el.dataset.bigAirDistance),
  altitude:Number(el.dataset.bigAirAltitude),
  birds:el.dataset.bigAirBirdsFollowing,
  mode:el.dataset.activity,
 }));
 assert.equal(flight.mode,"ski");
 assert.equal(flight.birds,"true");
 // Starting another minigame must be unavailable while a ski flight plays.
 // Hidden game-dock controls are deliberately absent from the accessible
 // tree. Include hidden only to assert their disabled/visibility contract.
 const disc=page.locator("button").filter({hasText:/^Disc golf/}).first();
 await page.waitForFunction(()=>
  Array.from(document.querySelectorAll("button")).some(
   button=>button.textContent?.startsWith("Disc golf")&&button.disabled),
  null,{timeout:15000});
 assert.equal(await disc.isDisabled(),true);
 await page.screenshot({path:path.join(out,"01-arbitrary-mountain-jump.png")});
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return Number(d?.bigAirDistance)>2||d?.bigAirPhase==="landed"||
    d?.bigAirPhase==="missed";
 },null,{timeout:35000});
 const progress=await canvas.evaluate(el=>({
  phase:el.dataset.bigAirPhase,
  distance:Number(el.dataset.bigAirDistance),
  birds:el.dataset.bigAirBirdsFollowing,
 }));
 assert.ok(progress.distance>2,"The skier must make real forward progress");
 await page.waitForFunction(()=>{
  const phase=document.querySelector("canvas")?.dataset.bigAirPhase;
  return phase==="landed"||phase==="missed";
 },null,{timeout:45000});
 assert.equal(await disc.isVisible(),false,
  "Exploration controls must stay hidden while jump results are displayed");
 await page.screenshot({path:path.join(out,"02-mountain-landing-result.png")});
 await page.getByRole("button",{name:"Explore",exact:true}).click();
 await disc.waitFor({state:"visible",timeout:15000});
 assert.deepEqual(errors,[],"No browser runtime errors during mountain flight");
 fs.writeFileSync(path.join(out,"mountain-jump-report.json"),
  JSON.stringify({flight,progress,errors},null,2)+"\n");
 console.log(JSON.stringify({flight,progress,errors},null,2));
}finally{await browser.close();}
