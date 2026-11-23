import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const moduleRoot=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!moduleRoot)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(moduleRoot,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world/classic-ski-aerial";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const report=[],errors=[];
async function read(page){
 return page.locator("canvas").evaluate(c=>({
  mode:c.dataset.activity,player:c.dataset.player,
  airborne:c.dataset.classicSkiSpinAir,
  target:c.dataset.classicSkiSpinTarget,
  angle:c.dataset.classicSkiSpinAngle,
  stance:c.dataset.classicSkiSpinStance,
  landing:c.dataset.classicSkiSpinLanding,
  name:c.dataset.classicSkiSpinName,
  serial:c.dataset.classicSkiSpinSerial,
  clean:c.dataset.classicSkiSpinClean,
  failed:c.dataset.classicSkiSpinFailed,
  yaw:c.dataset.classicSkiSpinBodyYaw,
  height:c.dataset.rideAirHeight,
  speed:c.dataset.speed,
  halfpipe:c.dataset.mountainHalfpipe,
  skiRide:c.dataset.skiRidePhase,
  frameP95:c.dataset.frameP95,
 }));
}
async function shot(page,serial,name,expectedStance,trigger){
 const canvas=page.locator("canvas");
 // MutationObserver is created BEFORE pressing the key. It observes live
 // rotation in the page's own RAF, not slow remote Playwright polling.
 await canvas.evaluate(c=>{
  c.__classicTrace={seen:false,maxAbsRotation:0,targets:[],frames:0};
  const observer=new MutationObserver(()=>{
   const t=c.__classicTrace;
   const angle=Math.abs(Number(c.dataset.classicSkiSpinAngle??0));
   t.frames++;t.maxAbsRotation=Math.max(t.maxAbsRotation,angle);
   const target=c.dataset.classicSkiSpinTarget;
   if(target&&target!=="0"&&!t.targets.includes(target))t.targets.push(target);
  });
  c.__classicSpinObserver=observer;
  observer.observe(c,{attributes:true,attributeFilter:[
   "data-classic-ski-spin-target","data-classic-ski-spin-angle",
  ]});
 });
 await trigger();
 try{
  await page.waitForFunction(serial=>{
   const d=document.querySelector("canvas")?.dataset;
   return Number(d?.classicSkiSpinSerial)>=serial;
  },serial,{timeout:90000,polling:"raf"});
  const state=await read(page);
  const trace=await canvas.evaluate(c=>c.__classicTrace);
  assert.equal(state.serial,String(serial),name+": expected exactly one landing");
  assert.equal(state.landing,"clean",name+" must be actually completed: "+JSON.stringify({state,trace}));
  assert.equal(state.stance,String(expectedStance),name+" stance: "+JSON.stringify(state));
  assert.equal(state.mode,"ski",name+" must stay in classic ski activity");
  assert.ok(trace.maxAbsRotation>=170,name+" must visibly rotate: "+JSON.stringify(trace));
  report.push({name,...state,trace});
  await page.screenshot({path:path.join(output,name+".png")});
 }catch(error){
  const state=await read(page),trace=await canvas.evaluate(c=>c.__classicTrace);
  fs.writeFileSync(path.join(output,name+"-failure.json"),
   JSON.stringify({name,error:String(error),state,trace},null,2)+"\n");
  await page.screenshot({path:path.join(output,name+"-failure.png")});
  throw error;
 }finally{
  await canvas.evaluate(c=>c.__classicSpinObserver?.disconnect()).catch(()=>{});
 }
}
try{
 for(const viewport of [
  {width:1280,height:800,mobile:false},
  {width:390,height:844,mobile:true},
 ]){
  const page=await browser.newPage({
   viewport:{width:viewport.width,height:viewport.height},
   isMobile:viewport.mobile,hasTouch:viewport.mobile,deviceScaleFactor:1,
  });
  page.on("pageerror",e=>errors.push(viewport.width+": "+e.message));
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:90000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:90000});
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:90000,polling:"raf"});
  await page.getByRole("button",{name:"Skiing",exact:true}).click({timeout:90000});
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.activity==="ski",
   null,{timeout:60000,polling:"raf"});
  const mode=await read(page);
  assert.equal(mode.skiRide,"","Experimental Ski V3 must stay disabled");
  await page.getByRole("group",{name:"Ski aerial tricks"}).waitFor({state:"visible"});
  if(!viewport.mobile){
   // Space launches the normal hop. Hold A until a half-turn is observed.
   await page.locator("canvas").focus();
   await shot(page,1,"desktop-keyboard-left-180",180,async()=>{
    await page.locator("canvas").evaluate(c=>{
     const observer=new MutationObserver(()=>{
      if(Number(c.dataset.classicSkiSpinAngle)<=-175){
       c.dispatchEvent(new KeyboardEvent("keyup",{key:"a",bubbles:true}));
       observer.disconnect();
      }
     });
     observer.observe(c,{attributes:true,attributeFilter:["data-classic-ski-spin-angle"]});
    });
    await page.keyboard.press("Space");
    await page.keyboard.down("a");
   });
   await page.keyboard.up("a");
   // Single button touch path on desktop, 360 preserving switch stance.
   await shot(page,2,"desktop-button-right-360",180,()=>
    page.getByRole("button",{name:"Spin 360 right"}).click());
  }else{
   // On phones, no keyboard is required. A button performs the same normal
   // hop and rotation; controls must remain clear of the movement joysticks.
   await shot(page,1,"mobile-button-left-180",180,()=>
    page.getByRole("button",{name:"Spin 180 left"}).tap());
  }
  await page.close();
 }
 assert.deepEqual(errors,[],"No browser exceptions across skiing inputs");
 fs.writeFileSync(path.join(output,"report.json"),
  JSON.stringify({report,errors},null,2)+"\n");
 console.log("CLASSIC SKI AERIAL QA PASS",JSON.stringify({report,errors}));
}finally{await browser.close();}
