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
 const screenshot=async(stage)=>{
  const d=await state();
  const buffer=await page.locator('canvas[role="application"]').first()
   .evaluate(c=>c.toDataURL("image/png").split(",")[1]);
  fs.writeFileSync(path.join(dir,stage+".png"),Buffer.from(buffer,"base64"));
  fs.writeFileSync(path.join(dir,stage+".json"),JSON.stringify(d,null,2));
 };
 try{
  // Browser time control runs the *unmodified* production frame and 120 Hz
  // physics at predictable 60 FPS. Playwright's keyboard dispatches normal
  // user input events. No time-skipping, state mutation, automatic score,
  // in-game controller, or synthetic trick award is used.
  await page.clock.install();
  await page.goto(base,{timeout:120000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:120000});
  await page.getByRole("button",{name:"Skiing",exact:true}).click({timeout:60000});
  await page.waitForFunction(()=>document.querySelector('canvas[role="application"]')?.dataset.skiRidePhase==="riding",null,{timeout:60000});
  await page.clock.pauseAt(new Date(Date.now()+100));
  const start=await record();
  assert.equal(start.bigAirPhase,"idle");
  await press("Space");
  // Playwright clock runs 60 Hz RAF callbacks. The world still executes
  // independent 120 Hz fixed solver steps with no jumps in simulated time.
  await page.clock.runFor(650);
  const charge=await record();
  assert.equal(charge.skiRidePhase,"charging");
  await screenshot("charge");
  await press("a");
  await release("Space");
  let mode="accelerate",airObserved=false;
  const goal=degrees*Math.PI/180;
  for(let i=0;i<160;i++){
    await page.clock.runFor(17);
    const d=await record();
    if(d.skiRidePhase==="air"&&!airObserved){
      airObserved=true;
      await screenshot("takeoff");
    }
    if(d.skiRidePhase!=="air"){
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
  await page.keyboard.up("a").catch(()=>{});
  await page.keyboard.up("d").catch(()=>{});
  await page.keyboard.up("Space").catch(()=>{});
  fs.writeFileSync(path.join(dir,"trace.json"),JSON.stringify({
   schema:"iland-browser-player-spin-fixed-clock-v1",
   fixedRenderCadenceHz:60,solverHz:120,
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
  schema:"iland-browser-player-spin-fixed-clock-v1",
  productionPhysicsUnmodified:true,
  hardwareGpuTimingMeasured:false,
  success:results.length===2&&results.every(x=>x.qualified),
  results,errors:err
 },null,2)+"\n");
}
assert.equal(results.length,2,"both input-executed rotations must be attempted");
assert.ok(results.every(x=>x.qualified),"fixed-cadence real keyboard 180 and 360 must qualify");
