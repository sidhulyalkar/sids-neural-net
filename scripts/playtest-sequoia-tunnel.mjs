import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw new Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/sequoia-tunnel-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[],trace=[];
let page;
const snapshot=async label=>{
 const d=await page.locator("canvas[role=application]").evaluate(el=>({...el.dataset}));
 const record={label,point:d.player,phase:d.skateTunnelPhase,surface:d.skateTunnelSurface,
  angle:Number(d.skateTunnelAngle),speed:Number(d.speed),
  lift:Number(d.skateTunnelWheelLift),entries:Number(d.skateTunnelEntries),
  completions:Number(d.skateTunnelCompletions),
  grinding:d.grinding,grindReady:d.grindReady,blocked:d.skateLogBlocked,
  wheelGap:d.rideRenderedWheelGap,renderCalls:Number(d.drawCalls)};
 trace.push(record);
 return record;
};
const capture=async label=>page.screenshot({path:path.join(out,label+".png")});
try{
 // A smaller SwiftShader framebuffer is enough to audit the full physical
 // log, without asking CI to rasterize the entire island at 1440x900.
 page=await browser.newPage({viewport:{width:1200,height:750}});
 page.on("pageerror",e=>errors.push("page: "+e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text().slice(0,240));});
 const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
 await page.goto(base+"/?skate-start=hollow-log");
 // Hydration and first WebGL frame may be slow on software GPUs. Once the
 // world is entered, the welcome button disappears; never click it twice.
 for(let attempt=0;attempt<5;attempt++){
  const alreadyExploring=await page.locator('[data-world-state="exploring"]').count()>0;
  if(alreadyExploring)break;
  const welcome=page.getByRole("button",{name:"Explore world",exact:true});
  await welcome.click({timeout:30000});
  try{
   await page.waitForFunction(()=>document.querySelector('[data-world-state]')?.getAttribute('data-world-state')==='exploring',null,{timeout:10000});
   break;
  }catch(e){if(attempt===4)throw e;}
 }
 await page.waitForFunction(()=>{
   const d=document.querySelector('canvas')?.dataset;
   const p=d?.player?.split(',').map(Number);
   return d?.activity==='skate'&&p?.length===2&&p[0]>7&&p[1]>57&&p[1]<61&&Number(d.drawCalls)>0;
 },null,{timeout:75000});
 const initial=await snapshot("east mouth approach");
 assert.equal(initial.phase,"free");
 assert.equal(initial.grinding,"false");
 await capture("01-eastern-open-mouth");
 const canvas=page.locator("canvas[role=application]");
 await canvas.focus();
 // Read the world state AND send real keyboard events inside the same browser
 // animation frame. On SwiftShader, a Playwright round trip can span the
 // entire 10m tunnel; separate waits accidentally observe the exit instead
 // of the entry that did occur.
 const journey=await canvas.evaluate(el=>new Promise((resolve,reject)=>{
  const start=performance.now(),pressed=new Set(),samples=[];
  let entered=null,curved=null,exit=null,frames=0;
  const send=(type,key)=>el.dispatchEvent(new KeyboardEvent(type,{
   key,code:"Key"+key.toUpperCase(),bubbles:true,cancelable:true}));
  const hold=(key,on)=>{
   if(on&&!pressed.has(key)){pressed.add(key);send("keydown",key);}
   else if(!on&&pressed.has(key)){pressed.delete(key);send("keyup",key);}
  };
  const release=()=>{for(const key of [...pressed])hold(key,false);};
  const sample=()=>{
   const d=el.dataset;
   return {point:d.player,phase:d.skateTunnelPhase,surface:d.skateTunnelSurface,
    angle:Number(d.skateTunnelAngle),speed:Number(d.speed),
    lift:Number(d.skateTunnelWheelLift),air:d.skateTunnelAir,
    entries:Number(d.skateTunnelEntries),grinding:d.grinding,
    grindReady:d.grindReady,blocked:d.skateLogBlocked,
    renderCalls:Number(d.drawCalls)};
  };
  const tick=()=>{
   frames++;
   const d=sample(),x=Number(d.point?.split(",")[0]);
   if(frames%15===0)samples.push(d);
   if(!Number.isFinite(x)||!Number.isFinite(d.speed)){
    release();reject(Error("Nonfinite log ride state "+JSON.stringify({d,samples})));return;
   }
   if(!entered&&d.entries>=1&&d.phase==="roll-through"&&d.surface==="inner"){
    entered={...d,label:"crossed east mouth on the floor"};
    // Steer immediately while *physically inside* the log, before the
    // remote browser driver can miss the whole ride.
    hold("a",true);
   }
   if(entered&&!curved&&d.surface==="inner"&&d.air==="false"&&
      Math.abs(d.angle)>.075){
    curved={...d,label:"rolling on inside curved wood"};
    hold("a",false);
   }
   if(entered&&d.phase==="free"&&x< -5.4){
    exit={...d,label:"west mouth exit"};
    release();
    resolve({entered,curved,exit,samples,frames});
    return;
   }
   if(performance.now()-start>160000){
    release();reject(Error("Tunnel movement timed out "+JSON.stringify({entered,curved,latest:d,samples})));return;
   }
   requestAnimationFrame(tick);
  };
  hold("w",true);
  requestAnimationFrame(tick);
 }));
 const mouth=journey.entered,curved=journey.curved,exit=journey.exit;
 trace.push(mouth);
 if(curved)trace.push(curved);
 trace.push(exit);
 assert.equal(mouth.grinding,"false");
 assert.equal(mouth.grindReady,"false");
 assert.equal(mouth.surface,"inner");
 assert.equal(mouth.blocked,"false");
 assert.ok(mouth.speed>0.25);
 assert.ok(mouth.lift>=0&&mouth.lift<=.3);
 assert.ok(curved,"wheels must remain on the real curved interior when steering");
 assert.ok(Math.abs(curved.angle)>.075);
 assert.ok(curved.lift>=0&&curved.lift<=.3);
 assert.equal(curved.grinding,"false");
 assert.equal(exit.grinding,"false");
 assert.ok(exit.speed>.15,"skating speed should survive the west exit");
 assert.ok(exit.renderCalls>20);
 await capture("04-free-roam-after-log");
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors},null,2)+"\n");
 console.log("SEQUOIA SMOOTH ROLL-IN AND REAL INNER-WHEEL CONTACT PASS",JSON.stringify({trace,errors}));
}catch(e){
 try{
  const browserState=await page.evaluate(()=>({
   world:document.querySelector("[data-world-state]")?.getAttribute("data-world-state"),
   canvasCount:document.querySelectorAll("canvas").length,
   render:document.querySelector("canvas")?.getAttribute("data-draw-calls"),
   location:document.querySelector("canvas")?.getAttribute("data-player"),
   activity:document.querySelector("canvas")?.getAttribute("data-activity"),
   fallback:document.body.innerText.includes("The 3D world couldn’t open on this device"),
  }));
  trace.push({label:"browser-state-on-failure",...browserState});
 }catch{}
 try{await snapshot("failure");}catch{}
 try{await capture("failure-scene");}catch{}
 fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors,error:String(e)},null,2)+"\n");
 console.error("SEQUOIA ROLL-IN FAILURE",String(e),JSON.stringify(trace));
 throw e;
}finally{await browser.close();}
