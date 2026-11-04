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
const enterSki=async(page)=>{
 await page.goto(base,{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 // The scene creates a large WebGL world on first entry. The dock is only
 // available once world initialization succeeds; don't confuse a slow CPU
 // software renderer with a missing activity control.
 try{
  await page.waitForFunction(()=>{
   const c=document.querySelector("canvas"),d=c?.dataset;
   const button=[...document.querySelectorAll("button")]
     .find(b=>b.getAttribute("aria-label")==="Skiing");
   return !!button&&!button.disabled&&Number(d?.drawCalls)>0;
  },null,{timeout:110000,polling:"raf"});
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
  console.error("CLEAN HALFPIPE INITIALIZATION DIAGNOSTIC",JSON.stringify(diag));
  throw error;
 }
 await page.getByRole("button",{name:"Skiing",exact:true}).click();
 await wait(page,()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.activity==="ski"&&d?.bigAirPhase==="idle"&&
   d?.mountainHalfpipe==="single-snow-face-v1"&&Number(d.drawCalls)>0;
 });
 await page.locator("canvas").first().focus();
};
try{
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 attachErrors(desktop,"desktop");
 await enterSki(desktop);
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
  let inPipe=false,highestSpeed=0;
  const tick=()=>{
   const d=c.dataset,p=d.player?.split(",").map(Number);
   if(!p?.every(Number.isFinite))return reject(Error("Nonfinite skier position"));
   const sample={x:p[0],z:p[1],speed:Number(d.speed),
    bigAir:d.bigAirPhase,ramp:d.rampId,
    pipe:d.mountainHalfpipeInside,authorized:d.mountainSkiJumpAuthorized};
   if(data.length>=30)data.shift();data.push(sample);
   inPipe||=sample.pipe==="true";
   highestSpeed=Math.max(highestSpeed,sample.speed);
   if(sample.bigAir!=="idle"||sample.authorized!=="false")
    return reject(Error("Unrequested Big Air launch: "+JSON.stringify(sample)));
   if(p[1]>-44){
    return resolve({start,finish:sample,inPipe,highestSpeed,trace:data});
   }
   if(performance.now()-began>75000)
     return reject(Error("Downhill halfpipe traversal failed: "+JSON.stringify(data)));
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
  await capture(desktop,"02-clean-halfpipe-downhill-run.png");
  await desktop.keyboard.press("Space");
  await wait(desktop,()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.airborne==="true"&&d.bigAirPhase==="idle";
  },13000);
  assert.equal((await observe(desktop)).authorized,"false");
  await capture(desktop,"03-intentional-ski-hop-without-big-air.png");
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

 // Reuse no desktop renderer here. The mobile world has an independent
 // WebGL context and should not acquire a giant new freestyle control bar.
 const mobile=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
 attachErrors(mobile,"mobile");
 await enterSki(mobile);
 const mobileState=await observe(mobile);
 assert.ok(mobileState.missingGlacier);
 assert.equal(mobileState.phase,"idle");
 assert.ok(mobileState.triangles>3000);
 evidence.mobile=mobileState;
 await capture(mobile,"05-mobile-clean-halfpipe.png");
 assert.deepEqual(evidence.errors,[]);
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
