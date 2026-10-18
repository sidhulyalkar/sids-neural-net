import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/sequoia-loop-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.WORLD_CHROMIUM_PATH||undefined,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
let evidence=null;
try{
 const page=await browser.newPage({viewport:{width:1024,height:720}});
 await page.exposeFunction("loopAuditInversion",data=>{fs.writeFileSync(path.join(out,"02-inverted-contact.png"),Buffer.from(data.split(",")[1],"base64"));});
 await page.exposeFunction("loopAuditProgress",s=>console.log("LOOP",JSON.stringify(s)));
 page.on("pageerror",error=>errors.push(error.message));
 const canvas=page.locator("canvas");
 try{
  await page.goto(base);
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
  await page.getByRole("button",{name:"Skateboarding",exact:true}).click();
  await page.getByRole("button",{name:"Loop · downhill roll-in",exact:true}).click();
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector("canvas")?.dataset.player?.split(",")[0])-29)<.1,
   null,{timeout:15000});
  await canvas.focus();
  assert.equal(await canvas.getAttribute("data-skate-grove-art"),"old-growth-stump-v2");
  await page.screenshot({path:path.join(out,"01-old-growth-skatepark-overview.png")});

  // A single frame observer owns BOTH real keyboard events and telemetry.
  // Host-side polling misses the ~2-second inversion window under SwiftShader,
  // and must never leave W held for 150s if a browser assertion times out.
  evidence=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const el=document.querySelector("canvas");
   if(!el){reject(Error("World canvas unavailable"));return;}
   const startTime=performance.now();
   const trace=[],pressed=new Set();
   let stage="loop-approach",aligned=null,entered=null,inverted=null,
       completed=null,resumed=null,frames=0;
   const point=()=>el.dataset.player?.split(",").map(Number)??[];
   const sample=()=>({
    stage,point:point(),speed:Number(el.dataset.speed),
    angle:Number(el.dataset.skateLoopAngle),
    entries:Number(el.dataset.skateLoopEntries),
    completions:Number(el.dataset.skateLoopCompletions),
    phase:el.dataset.skateLoopPhase,activity:el.dataset.activity,
    result:el.dataset.skateLastResult,zone:el.dataset.skateGroveZone,
   });
   const key=(kind,k)=>{
    if(kind==="keydown")pressed.add(k);else pressed.delete(k);
    el.dispatchEvent(new KeyboardEvent(kind,{
     key:k,code:k==="a"?"KeyA":"KeyW",bubbles:true,cancelable:true,
    }));
   };
   const release=()=>{for(const k of [...pressed])key("keyup",k);};
   const fail=message=>{
    const snapshot=sample();trace.push({...snapshot,note:message});
    release();reject(Error(message+" "+JSON.stringify({snapshot,trace})));
   };
   aligned=sample();key("keydown","w");
   const tick=()=>{
    frames++;
    const s=sample(),p=s.point;
    if(frames%18===0){trace.push(s);window.loopAuditProgress(s);}
    if(performance.now()-startTime>240000){
     fail("Timed out before completing a real full loop");return;
    }
    if(p.length!==2||!p.every(Number.isFinite)){
     fail("World player coordinates became invalid");return;
    }
    if(stage==="south-alignment"&&p[1]>=42.9){
     aligned=s;
     key("keyup","a");key("keydown","w");
     stage="loop-approach";
    }
    if(stage==="loop-approach"&&s.entries>=1){
     entered=s;stage="inverting";
    }
    // This must sample every rendered frame, not a stale host-side poll after
    // the vehicle has already passed the top of the loop.
    if(stage==="inverting"&&!inverted&&s.phase==="inverting"&&
       s.angle>=2.45&&s.angle<=4.05){inverted=s;window.loopAuditInversion(el.toDataURL("image/png"));}
    if(stage==="inverting"&&s.completions>=1){
     completed=s;stage="free-roam";
    }
    if(stage==="free-roam"&&completed&&s.phase==="free"&&
      Math.hypot(p[0]-completed.point[0],p[1]-completed.point[1])>1.15){
     resumed=s;release();
     resolve({aligned,entered,inverted,completed,resumed,trace,frames,
      seconds:(performance.now()-startTime)/1000});
     return;
    }
    requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
  }));
  assert.ok(evidence.aligned,"normal A control must reach the loop lane");
  assert.ok(evidence.aligned.point[0]>19&&Math.abs(evidence.aligned.point[1]-51)<.1,
   "alignment must stay east of the actual entry lane");
  assert.equal(evidence.entered?.entries,1,"the wheel must enter the real 3D track");
  assert.ok(evidence.inverted?.angle>=2.45&&evidence.inverted?.angle<=4.05,
   "the rendered ride must really pass upside down");
  assert.equal(evidence.completed?.completions,1,"one full revolution must complete");
  assert.equal(evidence.completed?.phase,"free","completion must release loop lock");
  assert.match(evidence.completed?.result??"",/Sequoia Loop 360°/);
  assert.equal(evidence.resumed?.activity,"skate");
  assert.equal(evidence.resumed?.phase,"free");
  assert.ok(evidence.resumed.speed>.5,"normal free-roam movement must resume");
  assert.ok(evidence.resumed.point[0]>-20,
   "return-control proof must happen before leaving the park");
  assert.deepEqual(errors,[],"no renderer exceptions during loop traversal");
  await page.screenshot({path:path.join(out,"02-after-real-360-loop.png")});
  await page.getByRole('button',{name:'Mountain biking',exact:true}).click();
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  await page.getByRole('button',{name:'02 Granite ridge Things I build',exact:true}).click();
  await canvas.focus();
  const bikeTrace=await page.evaluate(()=>new Promise(resolve=>{
   const el=document.querySelector('canvas'),samples=[];
   let frames=0;
   const key=(type,key)=>el.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true}));
   key('keydown','w');
   const tick=()=>{
    frames++;
    samples.push({point:el.dataset.player,error:Number(el.dataset.bikeContactError),
     pitch:Number(el.dataset.surfacePitch),activity:el.dataset.activity});
    if(frames===35){key('keyup','w');key('keydown','s');}
    if(frames===70){key('keyup','s');resolve(samples);return;}
    requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
  }));
  assert.ok(bikeTrace.every(s=>s.activity==='bike'&&Number.isFinite(s.pitch)&&s.error<.003));
  assert.ok(new Set(bikeTrace.map(s=>s.point)).size>20,'bike must actually move on mountain');
  await page.screenshot({path:path.join(out,'03-mountain-bike-contact.png')});
  evidence.bikeTrace=bikeTrace;
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  await page.getByRole('button',{name:/07 Moss canyon A quieter trail/}).click();
  await page.waitForFunction(()=>{const p=document.querySelector('canvas')?.dataset.player?.split(',').map(Number);return p&&Math.abs(p[0]-46)<.1&&Math.abs(p[1]+73)<.1;});
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.cameraTargetError)<.25);
  await page.screenshot({path:path.join(out,'04-relocated-moss-canyon.png')});
  assert.deepEqual(errors,[]);
  console.log("SEQUOIA LOOP RIDE PASS",JSON.stringify({evidence,errors}));
 }catch(error){
  try{await page.evaluate(()=>{
    for(const key of ["a","w"])
     document.querySelector("canvas")?.dispatchEvent(new KeyboardEvent("keyup",{
      key,code:key==="a"?"KeyA":"KeyW",bubbles:true,cancelable:true,
     }));
   });}catch{/* Nothing to release if world has disposed. */}
  try{await page.screenshot({path:path.join(out,"failure-frame.png")});}
  catch{/* Browser may already have closed. */}
  console.error("SEQUOIA LOOP RIDE FAILURE",String(error),JSON.stringify({evidence,errors}));
  throw error;
 }finally{
  fs.writeFileSync(path.join(out,"trace.json"),JSON.stringify({evidence,errors},null,2)+"\n");
 }
}finally{await browser.close();}
