import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const moduleRoot=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!moduleRoot)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(moduleRoot,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/redwood-skate-flow";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const samples=[];
let stage="entry";
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 const sample=async()=>{
  const s=await page.locator("canvas").evaluate(el=>({...el.dataset}));
  const result={stage,point:s.player,heading:s.skateHeading,
   speed:Number(s.speed),zone:s.skateGroveZone,
   exits:Number(s.skateBowlExits),takeoff:s.skateLastTakeoff,
   landings:Number(s.skateBowlLandings),failedLandings:Number(s.skateBowlFailedLandings),
   landingPoint:s.skateBowlLastLanding,landingSpeed:Number(s.skateBowlLandingSpeed),
   resultSerial:Number(s.skateResultSerial),lastResult:s.skateLastResult,
   score:Number(s.skateScore),airborne:s.airborne,activity:s.activity};
  samples.push(result);return result;
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
  const canvas=page.locator("canvas");
  await canvas.focus();
  await sample();
  await page.keyboard.down("w");
  try{
   await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    const p=d?.player?.split(",").map(Number);
    return p&&d?.skateGroveZone==="redwood-bowl"&&p[0]<-10.5&&p[0]>-13.5;
   },null,{timeout:25000});
  }finally{await page.keyboard.up("w");}
  stage="carve";
  const entry=await sample();
  assert.equal(entry.zone,"redwood-bowl");
  await page.keyboard.down("a");
  try{
   for(let i=0;i<36;i++){
    await page.waitForTimeout(280);
    const samplePoint=await sample();
    if(samplePoint.exits>0||samplePoint.zone===""||samplePoint.speed<.5)break;
   }
  }finally{
   await page.keyboard.up("a");
  }
  const latest=samples.at(-1);
  await page.screenshot({path:path.join(out,"bowl-carve-after-run.png")});
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({samples,errors},null,2)+"\n");
  console.log("REDWOOD BOWL CARVE TRACE",JSON.stringify({entry,latest,samples,errors}));
  assert.deepEqual(errors,[],"no renderer exceptions");
  assert.ok(latest?.exits===1&&latest?.zone!==""&&latest?.takeoff==="redwood-bowl-exit",
   "carve should reach exactly one meadow-safe bowl launch without leaving park");

  // The earlier QA stopped at takeoff. A safe-looking prediction is not
  // evidence of an actual landing, nor of a line a visitor can continue.
  stage="touchdown";
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return Number(d?.skateBowlLandings)+Number(d?.skateBowlFailedLandings)>0;
  },null,{timeout:20000});
  const touchdown=await sample();
  assert.equal(touchdown.landings,1,"the carved rim must lead to one real grounded landing");
  assert.equal(touchdown.failedLandings,0,"the touchdown must avoid water and park boundaries");
  assert.ok(touchdown.landingSpeed>2,"the rider must carry usable momentum into the runout");
  assert.ok(touchdown.resultSerial>0&&touchdown.lastResult!=="Bail",
   "the automatic rim trick should complete and land, not leave an unfinished board spin");
  await page.screenshot({path:path.join(out,"bowl-touchdown.png")});

  // Camera-relative S now points back toward the eastern timber meadow.
  // This is an ordinary input, not a scripted teleport/ghost path.
  stage="return";
  await page.keyboard.down("s");
  let returnSample;
  try{
   for(let i=0;i<42;i++){
    await page.waitForTimeout(250);
    returnSample=await sample();
    const point=returnSample.point?.split(",").map(Number);
    if(returnSample.zone===""||returnSample.failedLandings>0||returnSample.speed<.6)break;
    if(point?.length===2&&point[0]>-7.5)break;
   }
  }finally{await page.keyboard.up("s");}
  assert.ok(returnSample,"return path must produce samples");
  const back=returnSample.point.split(",").map(Number);
  assert.ok(returnSample.zone!==""&&back[0]>-7.5&&returnSample.speed>1.5,
   "one easy reverse-camera turn should bring the skater back to the timber approach");
  assert.equal(returnSample.landings,1,"the return path must not fabricate a second landing");
  await page.screenshot({path:path.join(out,"redwood-return-line.png")});
  console.log("REDWOOD GROVE RETURN PASS",JSON.stringify({entry,latest,touchdown,returnSample}));
 }catch(error){
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({samples,errors,failed:String(error)},null,2)+"\n");
  console.error("REDWOOD BOWL FLOW FAILURE",JSON.stringify({samples,errors}));
  throw error;
 }
}finally{await browser.close();}
