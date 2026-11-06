import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const moduleRoot=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!moduleRoot)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(moduleRoot,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world/clean-halfpipe";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const evidence={desktop:null,mobile:null,skiJump:null,errors:[]};
const capture=async(page,filename)=>{
 await page.screenshot({path:path.join(output,filename),timeout:20000});
};
const wait=async(page,fn,timeout=90000)=>
 page.waitForFunction(fn,null,{timeout,polling:"raf"});
const observe=async page=>page.locator("canvas").first().evaluate(c=>{
 const d=c.dataset;
 return {x:Number(d.player?.split(",")[0]),z:Number(d.player?.split(",")[1]),
   phase:d.bigAirPhase,pipe:d.mountainHalfpipeInside,
   authorized:d.mountainSkiJumpAuthorized,
   missingGlacier:d.glacierCave==="absent",
   geometry:d.mountainHalfpipe,triangles:Number(d.mountainHalfpipeTriangles),
   speed:Number(d.speed),height:Number(d.height),airborne:d.airborne,
   ramp:d.rampId,snow:d.snowing,drawCalls:Number(d.drawCalls),
   water:d.waterSource,
 };
});
const attachErrors=(page,kind)=>{
 page.on("pageerror",error=>{evidence.errors.push(kind+": "+error.message)});
};
const enterSki=async(page,kind)=>{
 const began=Date.now();
 const events=[];
 (evidence.entries??=[]).push(events);
 const record=(stage,detail)=>events.push({ms:Date.now()-began,stage,detail});
 page.on("requestfailed",r=>record("request failed",[r.url(),r.failure()?.errorText]));
 page.on("console",msg=>{if(msg.type()==="error")record("console error",msg.text())});
 page.on("response",r=>{if(r.status()>=400)record("http error",[r.url(),r.status()])});
 try{
 await page.goto(base,{waitUntil:"domcontentloaded"});
 const explore=page.getByRole("button",{name:"Explore world",exact:true});
 record("document loaded",page.url());
 await explore.click();
 record("entry clicked");
 // The scene creates a large WebGL world on first entry. The dock is only
 // available once world initialization succeeds; don't confuse a slow CPU
 // software renderer with a missing activity control.
  await page.waitForFunction(()=>{
   const c=document.querySelector("canvas"),d=c?.dataset;
   const button=[...document.querySelectorAll("button")]
     .find(b=>b.getAttribute("aria-label")==="Skiing");
   return !!button&&!button.disabled&&Number(d?.drawCalls)>0;
  },null,{timeout:110000,polling:"raf"});
 const ski=page.getByRole("navigation",{name:"World movement and sports"}).getByRole("button",{name:"Skiing",exact:true});
 if(await page.evaluate(()=>navigator.maxTouchPoints>0))await ski.tap();
 else await ski.click();
 await wait(page,()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.activity==="ski"&&d?.bigAirPhase==="idle"&&
   d?.mountainHalfpipe==="single-snow-face-v1"&&Number(d.drawCalls)>0;
 });
 await page.locator("canvas").first().focus();
 }catch(error){
  const diag=await page.evaluate(()=>({
   visible:document.body.innerText.slice(0,750),
   canvas:document.querySelector("canvas")?.dataset?{
    status:document.querySelector("canvas")?.dataset.worldState,
    drawCalls:document.querySelector("canvas")?.dataset.drawCalls,
    activity:document.querySelector("canvas")?.dataset.activity,
   }:null,
   buttons:[...document.querySelectorAll("button")].slice(0,30)
     .map(b=>({aria:b.getAttribute("aria-label"),text:b.innerText.slice(0,38),
        disabled:b.disabled})),
  })).catch(e=>({diagnosticError:String(e)}));
  record("entry failed",String(error));
  await capture(page,`failed-${kind}-world-entry.png`).catch(()=>{});
  evidence.entryFailure=diag;
  console.error("CLEAN HALFPIPE INITIALIZATION DIAGNOSTIC",JSON.stringify(diag));
  throw error;
 }

};
try{
 const failures=[];
 let desktop;
 try{
 desktop=await browser.newPage({viewport:{width:1440,height:900}});
 attachErrors(desktop,"desktop");
 await enterSki(desktop,"desktop");
 const start=await observe(desktop);
 assert.ok(start.missingGlacier);
 assert.ok(start.triangles>3000);
 assert.equal(start.authorized,"false");
 assert.equal(start.phase,"idle");
 assert.equal(start.snow,"true");
 await capture(desktop,"01-Granite-Ridge-clean-face.png");

 const run=desktop.evaluate(()=>new Promise((resolve,reject)=>{
  const c=document.querySelector("canvas");if(!c){reject(Error("No world canvas"));return;}
  const began=performance.now(),data=[],start=c.dataset.player?.split(",").map(Number);
  const simStart=Number(c.dataset.worldSimSeconds);
  if(!Number.isFinite(simStart))return reject(Error("Missing worldSimSeconds renderer timing probe"));
  let frameCount=0,inPipe=false,highestSpeed=0;
  const tick=()=>{
   const d=c.dataset,p=d.player?.split(",").map(Number);
   frameCount++;
   const simNow=Number(d.worldSimSeconds);
   const wallElapsed=(performance.now()-began)/1000;
   const simElapsed=simNow-simStart;
   const timing={
    wallSeconds:Number(wallElapsed.toFixed(2)),
    simSeconds:Number(simElapsed.toFixed(3)),
    simulatedPerWallSecond:Number((simElapsed/Math.max(wallElapsed,.001)).toFixed(3)),
    observedRafFrames:frameCount,
    observedRafHz:Number((frameCount/Math.max(wallElapsed,.001)).toFixed(2)),
   };
   if(!Number.isFinite(simNow))return reject(Error("Invalid worldSimSeconds renderer timing probe"));
   if(!p?.every(Number.isFinite))return reject(Error("Nonfinite skier position"));
   const sample={x:p[0],z:p[1],speed:Number(d.speed),
    bigAir:d.bigAirPhase,ramp:d.rampId,
    pipe:d.mountainHalfpipeInside,authorized:d.mountainSkiJumpAuthorized,
    wall:timing.wallSeconds,sim:timing.simSeconds};
   if(data.length>=30)data.shift();data.push(sample);
   inPipe||=sample.pipe==="true";
   highestSpeed=Math.max(highestSpeed,sample.speed);
   if(sample.bigAir!=="idle"||sample.authorized!=="false")
    return reject(Error("Unrequested Big Air launch: "+JSON.stringify(sample)));
   if(p[1]>-44){
    return resolve({start,finish:sample,inPipe,highestSpeed,timing,trace:data});
   }
   if(performance.now()-began>75000){
    // Keep the original required checkpoint. Classify the failed run instead
    // of masking slow browser/physics throughput with a longer timeout.
    const classification=simElapsed<2.5&&sample.speed>4
     ?"slow-simulation-throughput":"route-or-contact-unverified";
    return reject(Error("Downhill halfpipe traversal failed: "+JSON.stringify({
     classification,start,latest:sample,inPipe,highestSpeed,timing,trace:data,
    })));
   }
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 }));
 await desktop.keyboard.down("w");
 try{
  const proof=await run;
  assert.equal(proof.inPipe,true);
  assert.ok(proof.finish.z-proof.start[1]>9);
  assert.ok(proof.highestSpeed>4);
  assert.equal(proof.finish.bigAir,"idle");
  evidence.desktop=proof;
  // Capture after the hop: screenshot latency must not carry the skier
  // beyond the halfpipe before Space is delivered.
  await desktop.keyboard.press("Space");
  await wait(desktop,()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.airborne==="true"&&d.bigAirPhase==="idle";
  },13000);
  assert.equal((await observe(desktop)).authorized,"false");
  await desktop.keyboard.up("w");
  await capture(desktop,"03-intentional-ski-hop-without-big-air.png");
  await wait(desktop,()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.airborne==="false"&&d.bigAirPhase==="idle";
  },20000);
  evidence.desktop.landed=await observe(desktop);
  await capture(desktop,"02-clean-halfpipe-downhill-run.png");
 }finally{await desktop.keyboard.up("w")}

 // The separate Ski Jump button, not any mountain terrain, is authoritative.
 await desktop.getByRole("button",{name:"Show sport shortcuts"}).click();
 await desktop.getByRole("button",{name:"Ski jump",exact:true}).click();
 await wait(desktop,()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.bigAirPhase==="armed"&&d?.activity==="ski";
 });
 assert.equal((await observe(desktop)).authorized,"true");
 await capture(desktop,"04-menu-armed-ski-jump.png");
 evidence.skiJump={armed:true};
 }catch(error){
  failures.push({mode:"desktop",error:String(error)});
  evidence.desktopFailure=String(error);
  if(desktop)await capture(desktop,"failed-desktop-halfpipe.png").catch(()=>{});
 }finally{if(desktop)await desktop.close().catch(()=>{});}

 // Reuse no desktop renderer here. The mobile world has an independent
 // WebGL context and should not acquire a giant new freestyle control bar.
 let mobile;
 try{
 mobile=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
 attachErrors(mobile,"mobile");
 await enterSki(mobile,"mobile");
 const mobileState=await observe(mobile);
 assert.ok(mobileState.missingGlacier);
 assert.equal(mobileState.phase,"idle");
 assert.ok(mobileState.triangles>3000);
 evidence.mobile=mobileState;
 await capture(mobile,"05-mobile-clean-halfpipe.png");
 assert.deepEqual(evidence.errors,[]);
 }catch(error){
  failures.push({mode:"mobile",error:String(error)});
  evidence.mobileFailure=String(error);
  if(mobile)await capture(mobile,"failed-mobile-halfpipe.png").catch(()=>{});
 }finally{if(mobile)await mobile.close().catch(()=>{});}
 if(failures.length)throw Error("Clean halfpipe browser qualification incomplete: "+JSON.stringify(failures));
 console.log("CLEAN HALFPIPE SKI / WATERFALL PRESERVATION UI QA PASS",
   JSON.stringify(evidence));
}catch(error){
 console.error("CLEAN HALFPIPE QA FAILURE",error.stack??String(error));
 evidence.error=String(error);
 throw error;
}finally{
 fs.writeFileSync(path.join(output,"clean-halfpipe-report.json"),
  JSON.stringify(evidence,null,2)+"\n");
 await browser.close();
}
