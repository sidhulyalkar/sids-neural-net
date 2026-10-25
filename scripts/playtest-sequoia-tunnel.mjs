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
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push("page: "+e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text().slice(0,240));});
 const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
 await page.goto(base+"/?skate-start=hollow-log");
 for(let attempt=0;attempt<5;attempt++){
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  try{
   await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    const p=d?.player?.split(",").map(Number);
    return d?.activity==="skate"&&p?.length===2&&p[0]>7&&p[1]>57&&p[1]<61&&
     Number(d.drawCalls)>0;
   },null,{timeout:8500});
   break;
  }catch(e){if(attempt===4)throw e;}
 }
 const initial=await snapshot("east mouth approach");
 assert.equal(initial.phase,"free");
 assert.equal(initial.grinding,"false");
 await capture("01-eastern-open-mouth");
 const canvas=page.locator("canvas[role=application]");
 await canvas.focus();
 await page.keyboard.down("w");
 try{
  // Approach via actual input and wheel-based movement, not a write to
  // position or collision state. Both end faces remain collision-only.
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return Number(d?.skateTunnelEntries)>0&&d?.skateTunnelSurface==="inner"&&
    d?.skateTunnelPhase==="roll-through";
  },null,{timeout:110000});
  const mouth=await snapshot("crossed east mouth on the floor");
  assert.equal(mouth.grinding,"false");
  assert.equal(mouth.grindReady,"false");
  assert.equal(mouth.surface,"inner");
  assert.equal(mouth.blocked,"false");
  assert.ok(mouth.speed>0.25);
  assert.ok(mouth.lift>=0&&mouth.lift<.3);
  await capture("02-wheels-on-inner-floor");
  // Gentle rider steering should smoothly climb the same wooden surface.
  await page.keyboard.down("a");
  try{
   await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skateTunnelSurface==="inner"&&
     Math.abs(Number(d.skateTunnelAngle))>.075 &&
     d.skateTunnelAir==="false";
   },null,{timeout:25000});
   const curved=await snapshot("rolling on inside curved wood");
   assert.ok(Math.abs(curved.angle)>.075);
   assert.ok(curved.lift>=0&&curved.lift<=.3);
   assert.equal(curved.grinding,"false");
   await capture("03-interior-curved-wheel-contact");
  }finally{await page.keyboard.up("a");}
  // An ordinary traversal cannot become stuck at the far exit.
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   const p=d?.player?.split(",").map(Number);
   return Number(d?.skateTunnelEntries)>=1&&
    d?.skateTunnelPhase==="free"&&p?.length===2&&p[0]<-5.4;
  },null,{timeout:120000});
 }finally{await page.keyboard.up("w");}
 const exit=await snapshot("west mouth exit");
 assert.equal(exit.grinding,"false");
 assert.ok(exit.speed>.15,"skating speed should survive the exit");
 assert.ok(exit.renderCalls>20);
 await capture("04-free-roam-after-log");
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors},null,2)+"\n");
 console.log("SEQUOIA SMOOTH ROLL-IN AND REAL INNER-WHEEL CONTACT PASS",JSON.stringify({trace,errors}));
}catch(e){
 try{await snapshot("failure");}catch{}
 try{await capture("failure-scene");}catch{}
 fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({trace,errors,error:String(e)},null,2)+"\n");
 console.error("SEQUOIA ROLL-IN FAILURE",String(e),JSON.stringify(trace));
 throw e;
}finally{await browser.close();}
