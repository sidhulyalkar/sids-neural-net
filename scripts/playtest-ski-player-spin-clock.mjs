import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,"package.json"))("playwright");
const out=process.env.SKI_CLOCK_AUDIT_DIR??"artifacts/ski-player-spin-clock";
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
 args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]
});
const results=[];
const err=[];
async function attempt(degrees){
 const dir=path.join(out,String(degrees));
 fs.mkdirSync(dir,{recursive:true});
 const page=await browser.newPage({viewport:{width:850,height:610},deviceScaleFactor:.5});
 const trace=[],inputs=[],pageErrors=[];
 page.on("pageerror",e=>pageErrors.push(e.message));
 // Playwright fake-clock RAF sometimes stalls on full WebGL pages.
 // After world entry, only scheduling is intercepted. The production
 // frame callback and the 120 Hz physics execute without modification.
 await page.addInitScript(()=>{
  const nativeRAF=window.requestAnimationFrame.bind(window);
  const nativeCancel=window.cancelAnimationFrame.bind(window);
  const queue=new Map();
  let manual=false,stepping=false,clock=performance.now(),nextId=1000000000;
  window.requestAnimationFrame=callback=>{
   if(!manual)return nativeRAF(callback);
   if(!stepping)clock=performance.now();
   const id=nextId++;
   queue.set(id,callback);
   return id;
  };
  window.cancelAnimationFrame=id=>{
   if(id>=1000000000)queue.delete(id);
   else nativeCancel(id);
  };
  window.__skiFrameDriver={
   begin(){manual=true;},
   queued(){return queue.size;},
   step(count){
    if(!Number.isInteger(count)||count<1||count>60)
     throw Error("Invalid controlled frame count");
    for(let i=0;i<count;i++){
     if(queue.size===0)throw Error("World RAF stopped at controlled frame "+i);
     const batch=[...queue.values()];
     queue.clear();
     clock+=1000/60;
     stepping=true;
     try{for(const callback of batch)callback(clock);}
     finally{stepping=false;}
    }
    return {queue:queue.size,at:clock};
   }
  };
 });
 const advance=async(frames)=>page.evaluate(n=>window.__skiFrameDriver.step(n),frames);
 let result={degrees,qualified:false,reason:"not started"};
 let state=()=>page.locator('canvas[role="application"]').first().evaluate(c=>({...c.dataset}));
 const press=async(key)=>{
  const d=await state();inputs.push({key,type:"down",tick:Number(d.skiTick)});
  await page.keyboard.down(key);
 };
 const release=async(key)=>{
  const d=await state();inputs.push({key,type:"up",tick:Number(d.skiTick)});
  await page.keyboard.up(key);
 };
 const record=async()=>{
  const d=await state();
  trace.push({
   tick:Number(d.skiTick),phase:d.skiRidePhase,
   spin:Number(d.skiAirSpinRadians),omega:Number(d.skiAngularY),
   steer:Number(d.skiInputSteer),
   landing:d.skiLanding,score:d.skiTrickName,
   qualified:d.skiTrickQualified,
   inputTicks:Number(d.skiTrickInputTicks),
   impact:Number(d.skiLandingImpact),upright:Number(d.skiLandingUpright),
   align:Number(d.skiLandingAlignment),
   angularRate:Number(d.skiLandingAngularRate),
   oneSki:d.skiLandingOneSki,
   bigAir:d.bigAirPhase,drawCalls:Number(d.drawCalls),
   frameP95:Number(d.frameP95),dpr:Number(d.dpr)
  });
  return d;
 };
 // QA-only closed-loop KEYBOARD input, not an in-game stabilization
 // controller: compare the rider's actual world-space up vector against
 // the sampled landing slope; press W/S or Q/E as a human player could.
 // The renderer and ski solver receive no direct state manipulation.
 const attitudeHeld=new Set();
 const cross=(a,b)=>[
   a[1]*b[2]-a[2]*b[1],
   a[2]*b[0]-a[0]*b[2],
   a[0]*b[1]-a[1]*b[0]
 ];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const clamp=(v)=>Math.max(-1,Math.min(1,v));
 const orient=(d)=>{
   const q=d.skiRotation?.split(",").map(Number)??[];
   const [x,y,z,w]=q;
   const n=[Number(d.skiNormalX),Number(d.skiNormalY),Number(d.skiNormalZ)];
   if(q.length!==4||![...q,...n].every(Number.isFinite))return null;
   const rotate=v=>{
     const uv=cross([x,y,z],v);
     const uuv=cross([x,y,z],uv);
     return v.map((a,i)=>a+2*(w*uv[i]+uuv[i]));
   };
   const up=rotate([0,1,0]);
   const error=cross(up,n);
   const p=dot(error,rotate([1,0,0]));
   const r=dot(error,rotate([0,0,1]));
   return {upright:dot(up,n),pitch:p,roll:r};
 };
 const updateAttitude=async d=>{
   const o=orient(d);
   if(!o)return;
   trace[trace.length-1].uprightInFlight=o.upright;
   trace[trace.length-1].targetPitch=o.pitch;
   trace[trace.length-1].targetRoll=o.roll;
   const want=new Set();
   if(d.skiRidePhase==="air"){
     const pitchCmd=clamp(3.0*o.pitch-.70*Number(d.skiAngularX));
     const rollCmd=clamp(3.0*o.roll-.70*Number(d.skiAngularZ));
     if(pitchCmd>.12)want.add("w");
     if(pitchCmd<-.12)want.add("s");
     if(rollCmd>.12)want.add("q");
     if(rollCmd<-.12)want.add("e");
   }
   for(const key of [...attitudeHeld])if(!want.has(key)){
     await page.keyboard.up(key);
     inputs.push({key,type:"up",tick:Number(d.skiTick),attitude:true});
     attitudeHeld.delete(key);
   }
   for(const key of want)if(!attitudeHeld.has(key)){
     await page.keyboard.down(key);
     inputs.push({key,type:"down",tick:Number(d.skiTick),attitude:true});
     attitudeHeld.add(key);
   }
 };
 const screenshot=async(stage)=>{
  const d=await state();
  const buffer=await page.locator('canvas[role="application"]').first()
   .evaluate(c=>c.toDataURL("image/png").split(",")[1]);
  fs.writeFileSync(path.join(dir,stage+".png"),Buffer.from(buffer,"base64"));
  fs.writeFileSync(path.join(dir,stage+".json"),JSON.stringify(d,null,2));
 };
 try{
  // The exact production RAF callback is pumped at simulated 60 Hz.
  // Playwright delivers real keyboard events between physics frames.
  // This measures correctness, not physical GPU frame pacing.
  await page.goto(base,{timeout:120000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:120000});
  await page.getByRole("button",{name:"Skiing",exact:true}).click({timeout:60000});
  await page.waitForFunction(()=>document.querySelector('canvas[role="application"]')?.dataset.skiRidePhase==="riding",null,{timeout:60000});
  await page.evaluate(()=>window.__skiFrameDriver.begin());
  await page.waitForFunction(()=>window.__skiFrameDriver.queued()>0,
    null,{polling:200,timeout:120000});
  const start=await record();
  assert.equal(start.bigAirPhase,"idle");
  await press("Space");
  // 40 production frames = 2/3 simulated seconds, 80 fixed ski ticks.
  await advance(40);
  const charge=await record();
  assert.equal(charge.skiRidePhase,"charging");
  await screenshot("charge");
  await press("a");
  await release("Space");
  let mode="accelerate",airObserved=false;
  const goal=degrees*Math.PI/180;
  for(let i=0;i<160;i++){
    await advance(1);
    const d=await record();
    if(d.skiRidePhase==="air"&&!airObserved){
      airObserved=true;
      await screenshot("takeoff");
    }
    if(d.skiRidePhase!=="air"){
      await updateAttitude(d);
      if(airObserved&&d.skiLanding!=="none"){
        await screenshot("touchdown");
        result={
         degrees,qualified:d.skiTrickQualified==="true"&&d.skiTrickName===String(degrees)&&
          d.skiTrickLanding==="clean",
         reason:"touchdown",
         yaw:Number(d.skiAirSpinRadians),landing:d.skiLanding,
         score:d.skiTrickName,impact:Number(d.skiLandingImpact),
         upright:Number(d.skiLandingUpright),
         alignment:Number(d.skiLandingAlignment),
         angularRate:Number(d.skiLandingAngularRate),
         oneSki:d.skiLandingOneSki,
         inputSteeringTicks:Number(d.skiTrickInputTicks),tick:Number(d.skiTick)
        };
        break;
      }
      continue;
    }
    await updateAttitude(d);
    if(mode==="accelerate"){
      // Controlled countersteer has a ~0.4rad braking arc at full speed.
      // Keyboard timing comes from *observed* player physics, not from
      // directly changing velocity, rotation, collision, or the score.
      if(Math.abs(Number(d.skiAirSpinRadians))+
          Math.abs(Number(d.skiAngularY))*.05>=goal-.35){
        await release("a");
        await press("d");
        await screenshot("countersteer");
        mode="brake";
      }
    }else if(mode==="brake"&&Number(d.skiAngularY)<=.65){
      await release("d");
      mode="coast";
    }
    if(i===159)result.reason="no touchdown in 160 60Hz frames";
  }
  assert.ok(airObserved,"Space must produce genuine airborne motion");
  assert.equal(result.qualified,true,
    "player "+degrees+" requires clean touchdown, measured rotation and real key steering");
  assert.deepEqual(pageErrors,[]);
 }catch(e){
  result.reason=String(e?.message??e);
  err.push({degrees,reason:result.reason});
 }finally{
  for(const key of attitudeHeld)await page.keyboard.up(key).catch(()=>{});
  await page.keyboard.up("a").catch(()=>{});
  await page.keyboard.up("d").catch(()=>{});
  await page.keyboard.up("Space").catch(()=>{});
  fs.writeFileSync(path.join(dir,"trace.json"),JSON.stringify({
   schema:"iland-browser-player-spin-controlled-raf-v1",
   fixedRenderCadenceHz:60,solverHz:120,
   driver:"production RAF callback at controlled test timestamps",
   attitudeControls:"real W/S and Q/E keyboard events from read-only snow normals",
   hardwareTimingClaim:false,
   usesTrustedKeyboardEvents:true,
   inGameAssists:false,
   degrees,inputs,trace,pageErrors,result
  },null,2)+"\n");
  console.log("SKI-FIXED-CLOCK-TRICK",JSON.stringify(result));
  results.push(result);
  await page.close().catch(()=>{});
 }
}
try{
 for(const degrees of [180,360])await attempt(degrees);
}finally{
 await browser.close();
 fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify({
  schema:"iland-browser-player-spin-controlled-raf-v1",
  productionPhysicsUnmodified:true,
  hardwareGpuTimingMeasured:false,
  success:results.length===2&&results.every(x=>x.qualified),
  results,errors:err
 },null,2)+"\n");
}
assert.equal(results.length,2,"both input-executed rotations must be attempted");
assert.ok(results.every(x=>x.qualified),"fixed-cadence real keyboard 180 and 360 must qualify");
