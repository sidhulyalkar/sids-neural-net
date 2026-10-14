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
   speed:Number(s.speed),zone:s.skateGroveZone,park:s.skatePark,
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
  // A steers toward the southern bank. Its curvature should redirect an
  // unsafe westward exit into a rideable tangent instead of auto-launching
  // a trick out over the shore.
  await page.keyboard.down("a");
  let carved;
  try{
   for(let i=0;i<26;i++){
    await page.waitForTimeout(190);
    carved=await sample();
    const p=carved.point?.split(",").map(Number);
    const h=carved.heading?.split(",").map(Number);
    if(carved.zone===""||carved.failedLandings>0)break;
    if(p?.length===2&&h?.length===2&&p[1]>43.1&&h[0]>.10)break;
   }
  }finally{await page.keyboard.up("a");}
  assert.ok(carved,"the banked carve needs measurable travel");
  assert.ok(carved.zone!==""&&carved.failedLandings===0,
   "first carve must stay inside protected meadow and never splash down");
  await page.screenshot({path:path.join(out,"bowl-carve-after-run.png")});
  console.log("REDWOOD BOWL CARVE TRACE",JSON.stringify({entry,carved,samples,errors}));

  // S points back toward the eastern timber corridor in this camera
  // orientation. This is normal WASD steering, not scripted player motion.
  stage="return";
  let returned;
  await page.keyboard.down("s");
  try{
   for(let i=0;i<44;i++){
    await page.waitForTimeout(200);
    returned=await sample();
    const p=returned.point?.split(",").map(Number);
    if(returned.zone===""||returned.failedLandings>0||returned.speed<.6)break;
    if(p?.length===2&&p[0]>-10)break;
   }
  }finally{await page.keyboard.up("s");}
  assert.ok(returned,"timber return needs actual movement samples");
  const back=returned.point?.split(",").map(Number);
  assert.ok(returned.park==="true"&&returned.zone!==""&&back?.[0]>-10&&returned.speed>1.5,
   "the rider should be able to return toward timber on normal WASD controls");
  assert.equal(returned.failedLandings,0,
   "no bowl pop is allowed to land outside the safe meadow");
  await page.screenshot({path:path.join(out,"redwood-return-line.png")});

  // The next trick stays optional and easy: one Space press while rolling.
  // Require the real airborne-to-ground result rather than a transient toast.
  stage="return-trick";
  const previousSerial=returned.resultSerial;
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(serial=>{
   const d=document.querySelector("canvas")?.dataset;
   return Number(d?.skateResultSerial)>serial&&d?.skateTrick==="";
  },previousSerial,{timeout:26000});
  const landed=await sample();
  assert.ok(landed.score>0&&landed.lastResult!=="Bail",
   "a stylish assisted return-line trick must complete its actual landing");
  assert.equal(landed.failedLandings,0);
  assert.equal(landed.park,"true","return trick must actually land within the skatepark bounds");
  assert.ok(landed.zone!=="","the return-line trick must report an in-park zone");
  await page.screenshot({path:path.join(out,"timber-return-landed-trick.png")});
  assert.deepEqual(errors,[],"no browser renderer exceptions");
  console.log("REDWOOD GROVE RETURN PASS",JSON.stringify({entry,carved,returned,landed}));
  fs.writeFileSync(path.join(out,"trace.json"),
   JSON.stringify({samples,entry,carved,returned,landed,errors},null,2)+"\n");
 }catch(error){
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({samples,errors,failed:String(error)},null,2)+"\n");
  console.error("REDWOOD BOWL FLOW FAILURE",JSON.stringify({samples,errors}));
  throw error;
 }
}finally{await browser.close();}
