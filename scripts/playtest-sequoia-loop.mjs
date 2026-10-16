import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/sequoia-loop-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const evidence=[],errors=[];
let stage="loading";
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",error=>errors.push(error.message));
 const canvas=page.locator("canvas");
 const sample=async()=>{
  const d=await canvas.evaluate(el=>({...el.dataset}));
  const point=(d.player??"").split(",").map(Number);
  const s={stage,point,speed:Number(d.speed),activity:d.activity,
   phase:d.skateLoopPhase,angle:Number(d.skateLoopAngle),
   entries:Number(d.skateLoopEntries),completions:Number(d.skateLoopCompletions),
   art:d.skateGroveArt,result:d.skateLastResult,zone:d.skateGroveZone,
   cam:d.skateTunnelCamera};
  evidence.push(s);return s;
 };
 try{
  await page.goto(base);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
  await page.getByRole("button",{name:"Skateboarding",exact:true}).click();
  await page.getByRole("button",{name:"Skatepark · south meadow",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.skatePark==="true",
   null,{timeout:15000});
  await canvas.focus();
  const start=await sample();
  assert.equal(start.activity,"skate");
  assert.equal(start.art,"old-growth-stump-v2");
  stage="south-alignment";
  // Arrival faces WEST. A is south (positive z) in this exact camera frame.
  // Turn across the open street, then accelerate toward the loop's east seam.
  await page.keyboard.down("a");
  try{
   await page.waitForFunction(()=>{
    const p=document.querySelector("canvas")?.dataset.player?.split(",").map(Number);
    return p&&p[1]>=42.90;
   },null,{timeout:60000});
  }finally{await page.keyboard.up("a");}
  const aligned=await sample();
  assert.ok(aligned.point[0]>-1.65,"alignment must finish east of loop seam");
  assert.ok(aligned.point[1]<45,"alignment must stay out of south quarter");
  stage="loop-approach";
  await page.keyboard.down("w");
  try{
   await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.skateLoopEntries)>0,
    null,{timeout:60000});
   const captured=await sample();
   assert.equal(captured.entries,1);
   stage="inverted";
   await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    const a=Number(d?.skateLoopAngle);
    return d?.skateLoopPhase==="inverting"&&a>2.45&&a<4.05;
   },null,{timeout:150000});
   const inverted=await sample();
   assert.ok(inverted.angle>2.45&&inverted.angle<4.05);
   await page.screenshot({path:path.join(out,"01-giant-timber-loop-inverted.png")});
   stage="loop-exit";
   await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.skateLoopCompletions)>0,
    null,{timeout:150000});
   const exit=await sample();
   assert.equal(exit.phase,"free","inversion must return to ordinary skating");
   assert.equal(exit.completions,1);
   assert.match(exit.result,/Sequoia Loop 360/);
   const origin=exit.point;
   stage="free-roam";
   await page.waitForFunction(previous=>{
    const d=document.querySelector("canvas")?.dataset;
    const p=d?.player?.split(",").map(Number);
    return d?.skateLoopPhase==="free"&&d?.activity==="skate"&&p&&
     Math.hypot(p[0]-previous[0],p[1]-previous[1])>1.1;
   },origin,{timeout:18000});
  }finally{await page.keyboard.up("w");}
  const resumed=await sample();
  assert.ok(resumed.speed>0.5,"controls and momentum must survive the loop");
  assert.deepEqual(errors,[],"no browser renderer exceptions");
  await page.screenshot({path:path.join(out,"02-free-roaming-after-loop.png")});
  console.log("SEQUOIA LOOP RIDE PASS",JSON.stringify({start,aligned,resumed,evidence,errors}));
 }catch(error){
  console.error("SEQUOIA LOOP RIDE FAILURE",String(error),JSON.stringify({evidence,errors}));
  throw error;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({evidence,errors},null,2)+"\n");
 }
}finally{await browser.close();}
