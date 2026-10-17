import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/canyon-rail-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
let evidence=null;
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(base);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>
   Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
  await page.getByRole("button",{name:"Skateboarding",exact:true}).click();
  await page.getByRole("button",{name:"Moss Canyon · flow trail",exact:true}).click();
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.activity==="skate"&&d?.skateGroveZone==="canyon-flow";
  },null,{timeout:20000});
  const canvas=page.locator("canvas");
  await canvas.focus();
  await page.screenshot({path:path.join(out,"01-moss-canyon-flow-overview.png")});

  evidence=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const el=document.querySelector("canvas");
   if(!el){reject(Error("No World canvas"));return;}
   const begun=performance.now(),pressed=new Set(),sampled=[],visited=[];
   let stage="approach",started=null,ended=null,frames=0,priorScore=0;
   const key=(type,key)=>el.dispatchEvent(new KeyboardEvent(type,{
    key,code:key===" "?"Space":"Key"+key.toUpperCase(),
    bubbles:true,cancelable:true,
   }));
   const hold=(k,down)=>{
    if(down&&!pressed.has(k)){key("keydown",k);pressed.add(k);}
    if(!down&&pressed.has(k)){key("keyup",k);pressed.delete(k);}
   };
   const release=()=>{for(const k of [...pressed])hold(k,false);};
   const sample=()=>{
    const d=el.dataset;
    return {stage,point:d.player?.split(",").map(Number)??[],
     speed:Number(d.speed),grindId:d.grindId,chain:d.grindChain,
     grind:d.grinding,ready:d.grindReady,meters:Number(d.grindMeters),
     gapPhase:d.skateGapPhase,gapId:d.skateGapId,
     gapEntries:Number(d.skateGapEntries),gapLandings:Number(d.skateGapLandings),
     score:Number(d.skateScore),result:d.skateLastResult,
     zone:d.skateGroveZone,activity:d.activity};
   };
   const fail=(msg,s)=>{
    release();
    reject(Error(msg+" "+JSON.stringify({last:s,sampled,visited})));
   };
   hold("w",true);
   const tick=()=>{
    frames++;const s=sample(),[x,z]=s.point;
    if(frames%15===0)sampled.push(s);
    if(performance.now()-begun>140000){
     fail("Canyon linked grind timed out",s);return;
    }
    if(!Number.isFinite(x)||!Number.isFinite(z)){
     fail("Player position invalid",s);return;
    }
    if(stage==="approach"&&s.speed>3.5&&s.ready==="true"&&
      x>8.72&&x<10.6){
     priorScore=s.score;
     hold("w",false);
     key("keydown"," ");key("keyup"," ");
     stage="grind";
    }
    if(stage==="grind"&&s.grind==="true"){
     started??=s;
     if(s.chain==="canyon-snake"&&!visited.includes(s.grindId))
      visited.push(s.grindId);
    }
    if(stage==="grind"&&started&&s.grind==="false"){
     if(s.gapPhase!=="airborne"||s.gapId!=="snake-root-transfer"){
      fail("Linked rail exited without taking its authored open-air gap",s);return;
     }
     stage="air-gap";
    }
    if(stage==="air-gap"&&s.gapLandings>=1&&s.grind==="true"){
     ended=s;release();
     resolve({started,ended,visited,sampled,frames,priorScore});
     return;
    }
    if(stage==="air-gap"&&s.gapPhase==="free"&&s.gapLandings===0){
     fail("Gap completed without catching the receiving rail",s);return;
    }
    if(stage==="approach"&&x>11.7){
     fail("Passed snake rail without entering grind range",s);return;
    }
    requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
  }));
  assert.equal(evidence.started?.chain,"canyon-snake",
   "Space should engage the connected snake line, not an incidental obstacle");
  assert.ok(evidence.visited.length>=3,
   "a single Space press must round multiple corners of the linked rail");
  assert.equal(evidence.ended?.grind,"true");
  assert.ok(evidence.ended?.grindId?.startsWith("canyon-root-curved"),
   "Airborne landing should actually attach to the separate root rail");
  assert.equal(evidence.ended?.gapLandings,1,
   "Every observed gap should land and count exactly once");
  assert.equal(evidence.ended?.activity,"skate");
  assert.ok(evidence.ended?.score>evidence.priorScore,
   "distance-scored grind should credit exactly after release");
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,"02-rail-to-rail-gap-landed.png")});
  console.log("MOSS CANYON RAIL-TO-RAIL GAP PASS",JSON.stringify({evidence,errors}));
 }catch(e){
  try{await page.evaluate(()=>{
   for(const k of ["w"," "])
    document.querySelector("canvas")?.dispatchEvent(new KeyboardEvent(
     "keyup",{key:k,code:k===" "?"Space":"KeyW",bubbles:true}));
  });}catch{/* scene may have disposed */}
  try{await page.screenshot({path:path.join(out,"rail-failure.png")});}
  catch{/* scene may have disposed */}
  console.error("MOSS CANYON RAIL FAILURE",String(e));
  throw e;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),
   JSON.stringify({evidence,errors},null,2)+"\n");
 }
}finally{await browser.close();}
