import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/sequoia-tunnel-browser";
const url=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
let trace=null;const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(url);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>
   Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
  await page.getByRole("button",{name:"Skateboarding",exact:true}).click();
  await page.getByRole("button",{name:"Skatepark · south meadow",exact:true}).click();
  await page.waitForFunction(()=>
   document.querySelector("canvas")?.dataset.skatePark==="true",
   null,{timeout:15000});
  await page.locator("canvas").focus();
  // This uses the SAME W / A / D / Q event handler as a human visitor.
  // Position feedback chooses ordinary steering, never writes game state.
  trace=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const canvas=document.querySelector("canvas");
   if(!canvas){reject(Error("Missing world canvas"));return;}
   const initial=performance.now(),pressed=new Set(),samples=[];
   let entered=null,ceiling=null,completed=null,resumed=null,stage="approach";
   const key=(type,k)=>canvas.dispatchEvent(new KeyboardEvent(type,{
    key:k,code:"Key"+k.toUpperCase(),bubbles:true,cancelable:true,
   }));
   const hold=(k,on)=>{
    if(on&&!pressed.has(k)){key("keydown",k);pressed.add(k);}
    if(!on&&pressed.has(k)){key("keyup",k);pressed.delete(k);}
   };
   const release=()=>{for(const k of [...pressed])hold(k,false);};
   const sample=()=>{const d=canvas.dataset;return{
    stage,point:d.player?.split(",").map(Number)??[],
    heading:d.skateHeading?.split(",").map(Number)??[],
    speed:Number(d.speed),angle:Number(d.skateTunnelAngle),
    phase:d.skateTunnelPhase,entries:Number(d.skateTunnelEntries),
    completions:Number(d.skateTunnelCompletions),
    result:d.skateLastResult,activity:d.activity,zone:d.skateGroveZone,
   };};
   const fail=(reason,s)=>{
    samples.push({...s,reason});release();
    reject(Error(reason+" "+JSON.stringify({samples,latest:s})));
   };
   hold("w",true);
   let frames=0;
   const tick=()=>{
    frames++;const s=sample(),[x,z]=s.point;
    if(frames%12===0)samples.push(s);
    if(!Number.isFinite(x)||!Number.isFinite(z)){
     fail("Non-finite wheel contact",s);return;
    }
    if(performance.now()-initial>210000){
     fail("Tunnel wall-ride never completed before browser time limit",s);
     return;
    }
    if(stage==="approach"){
     // First skate northwest across the real meadow. Correct small lateral
     // drift while turning west to enter the eastern log mouth at speed.
     hold("d",z>31.10);hold("a",z<30.30);
     const aligned=Math.abs(z-30.7)<.55&&
      x<(-11+5.35-.25)&&x>-12.3&&
      s.heading[0]<-.75&&s.speed>=4.2;
     if(aligned){
      hold("a",false);hold("d",false);
      key("keydown","q");key("keyup","q");
      stage="wall";
     }else if(x<-12.35){
      fail("Normal steering missed hollow log mouth",s);return;
     }
    }
    if(stage==="wall"&&s.entries>0){
     entered??=s;
     if(!ceiling&&s.phase==="wall-ride"&&s.angle>.45&&s.angle<.55)
      ceiling=s;
     if(s.completions>0){completed=s;stage="exit";}
    }
    if(stage==="exit"&&completed&&s.phase==="free"&&
      Math.hypot(x-completed.point[0],z-completed.point[1])>1.0){
     resumed=s;release();resolve({entered,ceiling,completed,resumed,samples,frames});
     return;
    }
    requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
  }));
  console.log("SEQUOIA TUNNEL RIDE TRACE",JSON.stringify({trace,errors}));
  assert.ok(trace.entered?.entries===1,"Q must capture the actual inner wood wall");
  assert.ok(trace.ceiling&&trace.ceiling.angle>.45&&trace.ceiling.angle<.55,
   "skateboard must actually ride inverted across the ceiling");
  assert.equal(trace.completed?.completions,1);
  assert.equal(trace.completed?.phase,"free");
  assert.match(trace.completed?.result??"",/Sequoia Hollow 360°/);
  assert.equal(trace.resumed?.activity,"skate");
  assert.ok(trace.resumed?.speed>1,"movement must resume after exiting the log");
  assert.equal(errors.length,0,"no renderer page errors");
  await page.screenshot({path:path.join(out,"sequoia-clean-ride-exit.png")});
  console.log("SEQUOIA TUNNEL FULL-SURFACE PASS",JSON.stringify({trace,errors}));
 }catch(error){
  try{await page.evaluate(()=>{
   const canvas=document.querySelector("canvas");
   for(const k of ["w","a","d","q"])
    canvas?.dispatchEvent(new KeyboardEvent("keyup",{
     key:k,code:"Key"+k.toUpperCase(),bubbles:true,cancelable:true,
    }));
  });}catch{/* Page may already have disposed. */}
  try{await page.screenshot({path:path.join(out,"tunnel-failure.png")});}
  catch{/* Renderer may have disposed. */}
  console.error("SEQUOIA TUNNEL FULL-SURFACE FAILURE",String(error));
  throw error;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),
   JSON.stringify({trace,errors},null,2)+"\n");
 }
}finally{await browser.close();}
