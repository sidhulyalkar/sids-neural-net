import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/alpine-terrain-park";
fs.mkdirSync(out,{recursive:true});
const failures=[],errors=[],evidence={};
const browser=await chromium.launch({headless:true,
  args:["--no-sandbox","--enable-unsafe-swiftshader"]});
try{
 // Different route starts must be independent WebGL sessions. Reusing one
 // GPU-heavy page across three full-world mounts can leave stale renderer
 // state; fresh pages make each portal independently reproducible.
 let page,canvas;
 const enter=async route=>{
  if(page)await page.close();
  page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on("pageerror",e=>{errors.push(route+": "+e.message);
    console.error("ALPINE PAGE ERROR",route,e.message);});
  page.on("response",response=>{
   if(response.status()<400)return;
   const u=new URL(response.url());
   if(u.origin===new URL(base).origin&&response.request().resourceType()==="image")
     failures.push({route,status:response.status(),url:u.pathname});
  });
  canvas=page.locator("canvas").first();
  await page.goto(base+"/?ski-start="+route,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  try{
   await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.activity==="ski"&&
    Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
    null,{timeout:90000});
  }catch(error){
   const diagnostics=await page.evaluate(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return {hasCanvas:!!d,activity:d?.activity,entered:d?.worldState,
      drawCalls:d?.drawCalls,player:d?.player,alpineZone:d?.alpineZone,
      ready:document.readyState,
      displayedText:document.body.innerText.slice(0,450)};
   }).catch(e=>({diagnosticError:String(e)}));
   console.error("ALPINE ROUTE ENTRY FAILED",route,JSON.stringify(diagnostics));
   throw error;
  }
  await canvas.focus();
  assert.ok(Number(await canvas.getAttribute("data-alpine-feature-count"))>=15);
  assert.equal(await canvas.getAttribute("data-alpine-detail-batch"),"true");
  assert.ok(Number(await canvas.getAttribute("data-alpine-ice-strata"))>150,
    "ice vault must contain actual layered compression bands");
  assert.ok(Number(await canvas.getAttribute("data-alpine-snow-grooming"))>250,
    "halfpipe snow must have terrain-following groom lines");
 };
 const ride=async ({axis,direction,exit,zone,maximumMs=135000})=>{
  const start=Date.now(),trace=[],expected={glacier:"glacier",pipe:"halfpipe"}[zone];
  let observed=0,last=null,previous=null;
  await page.keyboard.down("w");
  try{
   for(;;){
    last=await canvas.evaluate(el=>({
      sampleSeconds:performance.now()/1000,
      x:Number(el.dataset.player?.split(",")[0]),
      z:Number(el.dataset.player?.split(",")[1]),
      speed:Number(el.dataset.speed),
      activity:el.dataset.activity,zone:el.dataset.alpineZone,
      glacier:el.dataset.glacierInside,
      airborne:el.dataset.airborne,
      clearance:el.dataset.gearClearance,
      recovery:el.dataset.rideRecoveryCount,
      cameraError:el.dataset.cameraTargetError,
    }));
    if(!Number.isFinite(last.x)||!Number.isFinite(last.z))
      throw Error("Invalid alpine rider coordinate");
    if(previous){
      const jump=Math.hypot(last.x-previous.x,last.z-previous.z);
      // Host-side polling may span several WebGL frames at full ski speed.
      // Bound displacement by actual elapsed time and observed velocity,
      // not an arbitrary fixed 5-unit threshold.
      const elapsed=Math.max(.01,last.sampleSeconds-previous.sampleSeconds);
      const cap=Math.max(previous.speed,last.speed,1)*elapsed*1.35+.75;
      if(jump>cap)throw Error("Nonphysical alpine teleport "+JSON.stringify({jump,cap,elapsed,previous,last}));
    }
    if(last.zone===expected)observed++;
    if(trace.length>=70)trace.shift();
    trace.push(last);
    if(direction*(last[axis]-exit)>=0)break;
    if(Date.now()-start>maximumMs)
      throw Error("Alpine ride did not reach exit "+JSON.stringify({axis,exit,observed,tail:trace.slice(-16)}));
    previous=last;
    await page.waitForTimeout(450);
   }
  }catch(error){
   console.error("ALPINE RIDE FAILURE",error.message,JSON.stringify({zone,trace:trace.slice(-18)}));
   throw error;
  }finally{await page.keyboard.up("w");}
  assert.ok(observed>=2,"Must actually ride inside the feature, not jump over it");
  assert.equal(last.activity,"ski");
  return {durationMs:Date.now()-start,observed,last,tail:trace.slice(-12)};
 };

 await enter("halfpipe");
 assert.ok(await page.getByRole("button",{name:"Show sport shortcuts"}).count()>0,
   "Halfpipe and glacier must be reachable from sport shortcuts");
 await page.screenshot({path:path.join(out,"01-halfpipe-entry.png")});
 evidence.halfpipe=await ride({zone:"pipe",axis:"z",direction:-1,exit:-77});
 await page.screenshot({path:path.join(out,"02-halfpipe-ride.png")});

 await enter("glacier-west");
 await page.screenshot({path:path.join(out,"03-glacier-west-mouth.png")});
 evidence.west=await ride({zone:"glacier",axis:"x",direction:1,exit:9});
 await page.screenshot({path:path.join(out,"04-glacier-east-exit.png")});
 assert.equal(evidence.west.last.x>=9,true);

 await enter("glacier-east");
 await page.screenshot({path:path.join(out,"05-glacier-east-mouth.png")});
 evidence.east=await ride({zone:"glacier",axis:"x",direction:-1,exit:-17});
 await page.screenshot({path:path.join(out,"06-glacier-west-exit.png")});
 assert.equal(evidence.east.last.x<=-17,true);
 assert.deepEqual(errors,[],"No uncaught WebGL/world exceptions");
 assert.deepEqual(failures,[],"No missing first-party images");
 console.log("ALPINE HALFPIPE + TWO-WAY GLACIER QA PASS",JSON.stringify(evidence));
}catch(e){
 console.error("ALPINE FAILURE",e.stack??String(e));
 fs.writeFileSync(path.join(out,"evidence.json"),JSON.stringify({evidence,errors,failures,error:String(e)},null,2));
 throw e;
}finally{await browser.close();}
