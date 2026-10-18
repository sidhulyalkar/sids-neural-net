import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/ride-recovery";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
const metrics=[];
let page;
async function snapshot(stage){
 const reading=await page.locator("canvas").evaluate(el=>({
  player:el.dataset.player,altitude:Number(el.dataset.height),
  airborne:el.dataset.airborne==="true",
  airHeight:Number(el.dataset.rideAirHeight??0),
  activity:el.dataset.activity,
  phase:el.dataset.bigAirPhase,
  recovered:Number(el.dataset.rideRecoveryCount??0),
 }));
 assert.ok(Number.isFinite(reading.altitude),stage+" altitude must remain finite");
 const point=reading.player?.split(",").map(Number)??[];
 assert.ok(point.length===2&&point.every(Number.isFinite),
  stage+" x/z must remain finite: "+reading.player);
 metrics.push({stage,...reading});return reading;
}
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",err=>errors.push(err.message));
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 await page.getByRole("button",{name:"Skiing",exact:true}).click();
 await page.getByRole("button",{name:"Mountain ski jump · summit start",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.bigAirPhase==="armed",
  null,{timeout:15000});
 await page.locator("canvas").focus();
 await page.keyboard.down("w");
 // Capture AND click inside the browser's animation loop. Host-side screenshot
 // or locator polls can take several seconds with SwiftShader and would miss
 // the short flying interval, accidentally testing a finished jump instead.
 let transition;
 try{
  transition=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const canvas=document.querySelector("canvas");
   if(!canvas){reject(Error("World canvas missing"));return;}
   const started=performance.now();
   let before=null;
   const sample=()=>({
    player:canvas.dataset.player,altitude:Number(canvas.dataset.height),
    airHeight:Number(canvas.dataset.rideAirHeight??0),
    airborne:canvas.dataset.airborne==="true",
    phase:canvas.dataset.bigAirPhase,activity:canvas.dataset.activity,
    continuity:canvas.dataset.rideFlightContinuity,
   });
   function tick(){
    if(performance.now()-started>105000){
     reject(Error("Ski exit observation timed out "+JSON.stringify({
      before,current:sample(),
     })));return;
    }
    const current=sample();
    if(!before&&current.phase==="flying"&&current.airHeight>1.65){
     const exit=[...document.querySelectorAll("button")]
      .find(el=>el.textContent?.trim()==="Exit jump");
     if(exit){
      before=current;
      exit.click();
     }
    }else if(before&&current.activity==="run"&&current.phase==="idle"){
     resolve({before,after:current});return;
    }
    requestAnimationFrame(tick);
   }
   requestAnimationFrame(tick);
  }));
 }finally{await page.keyboard.up("w");}
 metrics.push({stage:"ski-flight",...transition.before});
 metrics.push({stage:"jump-exit",...transition.after});
 assert.ok(transition.before.airborne&&transition.before.airHeight>1.65,
  "must interrupt a real flight, not a grounded result state");
 assert.ok(transition.after.airborne||transition.after.airHeight<.08,
  "free-roam must preserve airtime or reach a natural contact");
 assert.ok(transition.after.altitude>transition.before.altitude-6,
  "jump exit may not instantly snap the rider onto a distant support plane");
 await page.screenshot({path:path.join(out,"02-exit-airborne.png")});
 const after=transition.after;
 // Real keyboard traversal across the same mountain. No debug pose injection.
 await page.locator("canvas").focus();
 await page.keyboard.down("w");
 try{
  await page.waitForFunction(old=>{
   const d=document.querySelector("canvas")?.dataset;
   if(!d?.player)return false;
   const [x,z]=d.player.split(",").map(Number);
   const [ox,oz]=old.split(",").map(Number);
   return Math.hypot(x-ox,z-oz)>.85;
  },after.player,{timeout:110000});
 }finally{await page.keyboard.up("w");}
 const walked=await snapshot("free-roam-after-exit");
 assert.ok(!errors.length,"browser should not throw during ski-game interruption: "+errors);
 // Skateboard and mountain bike use the same recovery service, but never
 // inherit ski-mode locks or lose their independent motion controls.
 for(const [name,activity] of [["Skateboarding","skate"],["Mountain biking","bike"]]){
  await page.getByRole("button",{name,exact:true}).click();
  await page.waitForFunction(a=>
   document.querySelector("canvas")?.dataset.activity===a,activity,
   {timeout:15000});
  await page.locator("canvas").focus();
  const start=await snapshot(activity+"-start");
  await page.keyboard.down("w");
  try{
   await page.waitForFunction(old=>{
    const p=(document.querySelector("canvas")?.dataset.player??"").split(",").map(Number);
    const q=old.split(",").map(Number);
    return p.length===2&&Math.hypot(p[0]-q[0],p[1]-q[1])>.5;
   },start.player,{timeout:110000});
  }finally{await page.keyboard.up("w");}
  await snapshot(activity+"-moved");
 }
 await page.screenshot({path:path.join(out,"03-sport-modes-recovered.png")});
 assert.deepEqual(errors,[]);
 console.log("RIDE RECOVERY BROWSER PASS",JSON.stringify(metrics));
}catch(err){
 console.error("RIDE RECOVERY BROWSER FAIL",String(err));
 console.log("RIDE RECOVERY TRACE",JSON.stringify({metrics,errors}));
 if(page)await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});
 process.exitCode=1;
}finally{await browser.close();}
