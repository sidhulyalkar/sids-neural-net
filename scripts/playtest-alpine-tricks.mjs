import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/alpine";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const failures=[],results=[],browserErrors=[];
const screenshot=async(page,name)=>{
 try{await page.screenshot({path:path.join(out,name+".png"),timeout:12000});}catch{}
};
const snapshot=async page=>page.locator("canvas").first().evaluate(el=>{
 const d=el.dataset;
 return {player:d.player,speed:d.speed,activity:d.activity,
  phase:d.alpineTrickPhase,feature:d.alpineTrickFeature,
  kind:d.alpineTrickKind,attempts:d.alpineTrickAttempts,
  landings:d.alpineTrickLandings,bails:d.alpineTrickBails,
  spin:d.alpineTrickSpin,grab:d.alpineTrickGrab,
  grabSeconds:d.alpineTrickGrabSeconds,airtime:d.alpineTrickAirtime,
  peak:d.alpineTrickPeak,lastResult:d.alpineTrickLastResult,
  quality:d.alpineTrickLastQuality,score:d.alpineTrickScore,
  best:d.alpineTrickBest,airborne:d.airborne,
  height:d.rideAirHeight,grind:d.grinding,grindChain:d.grindChain,
  bigAir:d.bigAirPhase,zone:d.alpineZone,recovery:d.rideRecoveryCount,
  wall:d.glacierWallContact,
 };
});
const wait=async(page,predicate,timeout=55000)=>
 page.waitForFunction(predicate,null,{timeout,polling:"raf"});
async function enter(name){
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on("pageerror",e=>browserErrors.push(name+": "+e.message));
 page.on("console",m=>{if(m.type()==="error")browserErrors.push(name+": "+m.text())});
 await page.goto(base+"/?ski-start="+name,{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 await wait(page,()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.activity==="ski"&&d?.alpineFreestyleSelected==="true"&&
    Number(d.drawCalls)>0&&d.alpineTrickPhase==="idle";
 },90000);
 await page.locator("canvas").first().focus();
 return page;
}
async function check(name,fn){
 let page;
 try{
  page=await enter(name);
  await screenshot(page,"start-"+name);
  const data=await fn(page);
  const state=await snapshot(page);
  results.push({name,status:"pass",data,state});
  await screenshot(page,"landed-"+name);
  console.log("ALPINE TRICK CASE PASS",name,JSON.stringify({data,state}));
 }catch(error){
  const state=page?await snapshot(page).catch(()=>({})):{};
  failures.push({name,message:String(error),state});
  console.error("ALPINE TRICK CASE FAIL",name,String(error),JSON.stringify(state));
  if(page)await screenshot(page,"FAILED-"+name);
 }finally{await page?.close()}
}
const landed=async(page,feature,timeout=60000)=>{
 await wait(page,()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.alpineTrickPhase==="landed"||d?.alpineTrickPhase==="bailed";
 },timeout);
 const state=await snapshot(page);
 assert.equal(state.phase,"landed",
   "Actual supported landing required, no HUD-only points: "+JSON.stringify(state));
 assert.equal(state.feature,feature);
 assert.ok(Number(state.landings)>=1);
 assert.ok(Number(state.score)>0,"Score only after genuine touchdown");
 assert.ok(Number(state.peak)>=.15);
 assert.ok(Number(state.airtime)>=.18);
 assert.equal(state.bigAir,"idle","Freestyle air must not trigger unrelated Big Air");
 return state;
};
try{
 await check("halfpipe",async page=>{
  const canvas=page.locator("canvas").first();
  await page.keyboard.down("w");
  try{
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset,p=d?.player?.split(",").map(Number);
    return p?.length===2&&p[1]<-68&&p[1]>-76&&
      d?.alpineZone==="halfpipe"&&Number(d.speed)>=4.3;
   },60000);
   await page.keyboard.press("Space");
   await wait(page,()=>document.querySelector("canvas")?.dataset.alpineTrickPhase==="air",12000);
   assert.equal(await canvas.getAttribute("data-alpine-trick-feature"),"alpine-halfpipe-pop");
   await wait(page,()=>Number(document.querySelector("canvas")?.dataset.alpineTrickAirtime)>=.09,14000);
   await page.keyboard.down("q");
   await page.keyboard.press("j");
   await wait(page,()=>Number(document.querySelector("canvas")?.dataset.alpineTrickGrabSeconds)>=.12,14000);
   await page.keyboard.up("q");
   assert.equal(await canvas.getAttribute("data-alpine-trick-spin"),"-180");
   return await landed(page,"alpine-halfpipe-pop");
  }finally{await page.keyboard.up("q");await page.keyboard.up("w")}
 });
 await check("halfpipe-lip-right",async page=>{
  await page.keyboard.down("w");
  try{
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.alpineTrickPhase==="air"||Number(d?.alpineTrickAttempts)>0;
   },60000);
   const initial=await snapshot(page);
   assert.equal(initial.feature,"alpine-halfpipe-right",
     "Bank-wall launch must come from the right snow coping");
   return await landed(page,"alpine-halfpipe-right",50000);
  }finally{await page.keyboard.up("w")}
 });
 await check("alpine-kicker",async page=>{
  await page.keyboard.down("w");
  try{
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.alpineTrickPhase==="air"||Number(d?.alpineTrickAttempts)>0;
   },60000);
   const launch=await snapshot(page);
   assert.equal(launch.feature,"alpine-tabletop");
   assert.equal(launch.kind,"kicker");
   return await landed(page,"alpine-tabletop",60000);
  }finally{await page.keyboard.up("w")}
 });
 await check("alpine-box",async page=>{
  await page.keyboard.down("w");
  try{
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.alpineTrickPhase==="air"||Number(d?.alpineTrickAttempts)>0;
   },70000);
   const launch=await snapshot(page);
   assert.equal(launch.feature,"alpine-flat-box");
   assert.equal(launch.kind,"box");
   return await landed(page,"alpine-flat-box",60000);
  }finally{await page.keyboard.up("w")}
 });
 await check("alpine-rail",async page=>{
  await page.keyboard.down("w");
  try{
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.grindReady==="true"&&Number(d.speed)>=2.5;
   },60000);
   await page.keyboard.press("Space");
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.grinding==="true"&&d.grindChain==="alpine-serpent";
   },20000);
   await screenshot(page,"rail-actual-grind");
   await wait(page,()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.alpineTrickPhase==="air"&&d.alpineTrickKind==="rail";
   },65000);
   const launch=await snapshot(page);
   assert.match(launch.feature,/^alpine-serpent-/);
   return await landed(page,launch.feature,60000);
  }finally{await page.keyboard.up("w")}
 });
 // Real mobile touch buttons must invoke the same physics as keyboard
 // actions, without adding a permanent large control overlay.
 let mobile;
 try{
  mobile=await browser.newPage({viewport:{width:390,height:844},
    isMobile:true,hasTouch:true});
  mobile.on("pageerror",e=>browserErrors.push("mobile: "+e.message));
  await mobile.goto(base+"/?ski-start=halfpipe",{waitUntil:"domcontentloaded"});
  await mobile.getByRole("button",{name:"Explore world",exact:true}).click();
  await wait(mobile,()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.activity==="ski"&&d.alpineFreestyleSelected==="true"&&
     Number(d.drawCalls)>0;
  },90000);
  const controls=mobile.getByRole("group",{name:"Alpine ski trick controls"});
  await controls.waitFor({state:"visible",timeout:20000});
  assert.ok((await controls.boundingBox())?.x>=0);
  assert.equal(await controls.getByRole("button",{name:"Pop off the halfpipe"}).isDisabled(),true);
  await mobile.keyboard.down("w");
  try{
   await wait(mobile,()=>{
    const d=document.querySelector("canvas")?.dataset,p=d?.player?.split(",").map(Number);
    return d?.alpineZone==="halfpipe"&&
      p?.length===2&&p[1]<-68&&p[1]>-76&&Number(d.speed)>=4.3;
   },60000);
   const pop=controls.getByRole("button",{name:"Pop off the halfpipe"});
   assert.equal(await pop.isDisabled(),false);
   await pop.tap();
   await wait(mobile,()=>document.querySelector("canvas")?.dataset.alpineTrickPhase==="air",16000);
   const spin=controls.getByRole("button",{name:"Alpine trick spin left 180 degrees"});
   await wait(mobile,()=>Number(document.querySelector("canvas")?.dataset.alpineTrickAirtime)>=.09,14000);
   await spin.tap();
   await wait(mobile,()=>document.querySelector("canvas")?.dataset.alpineTrickSpin==="-180",11000);
   await landed(mobile,"alpine-halfpipe-pop");
   const state=await snapshot(mobile);
   results.push({name:"mobile-halfpipe-touch",status:"pass",state});
   await screenshot(mobile,"mobile-halfpipe-touch");
   console.log("ALPINE MOBILE TOUCH PASS",JSON.stringify(state));
  }finally{await mobile.keyboard.up("w")}
 }catch(error){
  const state=mobile?await snapshot(mobile).catch(()=>({})):{};
  failures.push({name:"mobile-halfpipe-touch",message:String(error),state});
  console.error("ALPINE MOBILE TOUCH FAILURE",String(error),JSON.stringify(state));
  if(mobile)await screenshot(mobile,"FAILED-mobile-halfpipe-touch");
 }finally{await mobile?.close()}
 if(browserErrors.length)failures.push({name:"renderer-exceptions",errors:browserErrors});
 const summary={results,failures,browserErrors};
 fs.writeFileSync(path.join(out,"alpine-tricks-report.json"),
   JSON.stringify(summary,null,2)+"\n");
 assert.deepEqual(failures,[],
   "A playable terrain park requires every real feature launch, trick and landing");
 console.log("ALPINE PHYSICAL TRICKS CHROMIUM PASS",results.length);
}finally{await browser.close();}
