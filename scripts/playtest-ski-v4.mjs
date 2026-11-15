import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/ski-v4/browser";
fs.mkdirSync(out,{recursive:true});
const url=new URL(base);
url.searchParams.set("ski-engine","v4");
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1100,height:740}});
const errors=[],frames=[];
page.on("pageerror",e=>errors.push(e.message));
const canvas=page.locator("canvas").first();
const snapshot=async stage=>{
  const data=await canvas.evaluate(el=>({...el.dataset}));
  frames.push({stage,time:Date.now(),engine:data.skiEngine,activity:data.activity,
    player:data.player,speed:data.speed,phase:data.skiRidePhase,
    awaiting:data.skiV4AwaitingStart,spawn:data.skiV4Spawn,
    edge:data.skiV4EdgeRadians,carve:data.skiV4CarveAcceleration,
    actualSlip:data.skiV4ActualSlipRadians,carveQuality:data.skiV4CarveQuality,
    contactCoverage:data.skiV4ContactCoverage,turnRegime:data.skiV4TurnRegime,
    actualTurnRate:data.skiV4ObservedTurnRate,turnRadius:data.skiV4ObservedTurnRadius,
    skid:data.skiV4SkidDeceleration,slip:data.skiV4AttackRadians,
    contact:data.skiV4ContactPatches,rigidMismatch:data.skiV4SoleMismatch,
    bigAir:data.bigAirPhase});
  await page.screenshot({path:path.join(out,stage+".png")});
  return data;
};
try{
  await page.goto(url.toString(),{waitUntil:"domcontentloaded",timeout:120000});
  const enter=page.getByRole("button",{name:"Explore world",exact:true});
  if(await enter.count()){
    await enter.waitFor({state:"visible",timeout:120000});
    await enter.click({timeout:120000});
  }
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>20,
    null,{timeout:120000});
  await page.getByRole("navigation",{name:"World movement and sports"})
    .getByRole("button",{name:"Skiing",exact:true}).click({timeout:30000});
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiEngine==="v4" && d.activity==="ski" && Number(d.skiTick)>12;
  },null,{timeout:120000});
  const entry=await snapshot("01-v4-entry");
  assert.equal(entry.skiEngine,"v4");
  assert.equal(entry.bigAirPhase,"idle","Ordinary Skiing never arms special Ski Jump");
  assert.match(entry.skiV4ContactPatches??"",/^\d+,\d+$/);
  // The player must enter snow with a genuine underlying layered pack.
  // A white-only terrain tint must not satisfy this gate.
  const powder=Number(entry.skiV4PowderDepth);
  const packed=Number(entry.skiV4PackedDepth);
  const depth=Number(entry.skiV4SnowDepth);
  assert.ok(powder>0&&packed>.05&&depth>.05,
    "Snowpack depth must be sampled from the rendered mountain, not invented by the HUD");
  assert.ok(Math.abs(depth-(powder+packed))<.004,
    "The displayed total snow depth must equal packed base plus powder");
  // Command-time spawn is captured before WebGL/frame-sampling overhead lets the rider descend.
  const [spawnX,spawnZ]=(entry.skiV4Spawn??"").split(",").map(Number);
  assert.ok(Math.abs(spawnX-7)<2.7 && spawnZ>-60.8 && spawnZ<-53,
    "Ski V4 must command an in-channel spawn before descent: "+entry.skiV4Spawn);
  assert.equal(entry.skiV4AwaitingStart,"true",
    "No gravity-driven ski escape before the first deliberate player control");
  const [entryX,entryZ]=(entry.player??"").split(",").map(Number);
  assert.ok(Math.abs(entryX-7)<1&&entryZ>-61&&entryZ<-55,
    "The first displayed skier must still be at Granite Ridge: "+entry.player);
  // Prove real snow braking FIRST, while still near the mountain start.
  // Software WebGL screenshots are intentionally deferred until after both
  // controls; otherwise several seconds of live simulation elapse off-snow.
  await page.keyboard.down("w");
  const glideHandle=await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiV4AwaitingStart==="false" && Number(d.speed)>1.5 &&
      Number(d.skiV4SnowCoverage)>.55 ? {...d}:false;
  },null,{timeout:20000});
  const glide=await glideHandle.jsonValue();
  frames.push({stage:"02-v4-snow-glide",player:glide.player,speed:glide.speed,
    surface:glide.skiV4SurfaceMode,snow:glide.skiV4SnowCoverage});
  await page.keyboard.up("w");
  const brakeEntrySpeed=Number(glide.speed);
  await page.keyboard.down("s");
  const brakeHandle=await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return Number(d?.skiV4SnowCoverage)>.5 &&
      Number(d?.skiV4BrakeEngagement)>.8 &&
      Number(d?.skiV4SkidDeceleration)>1 &&
      d?.skiV4TurnRegime==="skid" ? {...d}:false;
  },null,{timeout:20000});
  const braking=await brakeHandle.jsonValue();
  await page.waitForTimeout(800);
  const braked=await canvas.evaluate(el=>({...el.dataset}));
  frames.push({stage:"03-v4-snow-brake",player:braked.player,
    speed:braked.speed,skid:braking.skiV4SkidDeceleration,
    snow:braking.skiV4SnowCoverage,engagement:braking.skiV4BrakeEngagement,
    surface:braking.skiV4SurfaceMode,powder:braking.skiV4PowderDepth,
    packed:braking.skiV4PackedDepth,depth:braking.skiV4SnowDepth});
  await page.keyboard.up("s");
  assert.ok(Number(braking.skiV4SnowCoverage)>.5,
    "The snowplow proof must actually occur ON SNOW, never on Joshua dirt");
  assert.ok(Number(braking.skiV4SkidDeceleration)>1,
    "Held S must apply dissipative snow shearing while a real edge touches snow");
  assert.equal(braking.skiV4TurnRegime,"skid");
  assert.ok(Number(braked.speed)<brakeEntrySpeed||Number(braked.speed)<.4,
    "Snow braking must lower actual speed without a maximum-speed clamp");

  // A genuine player braking run uses up most of the short halfpipe.
  // Carving must be qualified in a NEW player-driven ski session, never by
  // teleporting an already-moving skier or injecting velocity into the solver.
  await page.goto(url.toString(),{waitUntil:"domcontentloaded",timeout:120000});
  const reenter=page.getByRole("button",{name:"Explore world",exact:true});
  if(await reenter.count()){
    await reenter.waitFor({state:"visible",timeout:120000});
    await reenter.click({timeout:120000});
  }
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>20,
    null,{timeout:120000});
  await page.getByRole("navigation",{name:"World movement and sports"})
    .getByRole("button",{name:"Skiing",exact:true}).click({timeout:30000});
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiEngine==="v4"&&d.activity==="ski" &&
      d.skiV4AwaitingStart==="true"&&Number(d.skiTick)>12;
  },null,{timeout:120000});
  const fresh=await canvas.evaluate(el=>({...el.dataset}));
  frames.push({stage:"04-v4-fresh-start",player:fresh.player,
    speed:fresh.speed,depth:fresh.skiV4SnowDepth,
    snow:fresh.skiV4SnowCoverage,ready:fresh.skiV4AwaitingStart});
  assert.ok(Number(fresh.speed)<.05&&Number(fresh.skiV4SnowCoverage)>.45,
    "Second ski run must begin truly stationary on Granite Ridge snow");
  await page.keyboard.down("w");
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return Number(d?.speed)>2&&Number(d?.skiV4SnowCoverage)>.55;
  },null,{timeout:25000});
  await page.keyboard.up("w");
  await page.keyboard.down("d");
  // Capture this exact animation tick. Re-reading after the matched event
  // can produce a later SKID frame even when the actual CARVE gate passed.
  const carvedHandle=await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiEngine==="v4" && Number(d?.skiInputSteer)>.5 &&
      Number(d?.skiV4SnowCoverage)>.45 &&
      Math.abs(Number(d?.skiV4EdgeRadians))>.25 &&
      Math.abs(Number(d?.skiV4CarveAcceleration))>.05 &&
      Math.abs(Number(d?.skiV4ActualSlipRadians))<.12 &&
      Number(d?.skiV4ContactCoverage)>.45 &&
      d?.skiV4TurnRegime==="carve" ? {...d}:false;
  },null,{timeout:25000});
  const carved=await carvedHandle.jsonValue();
  frames.push({stage:"04-v4-carve",player:carved.player,
    speed:carved.speed,surface:carved.skiV4SurfaceMode,
    snow:carved.skiV4SnowCoverage,depth:carved.skiV4SnowDepth,
    snowType:carved.skiV4SnowType,edge:carved.skiV4EdgeRadians,
    carve:carved.skiV4CarveAcceleration,steer:carved.skiInputSteer,
    slip:carved.skiV4ActualSlipRadians,contact:carved.skiV4ContactCoverage,
    regime:carved.skiV4TurnRegime,turnRate:carved.skiV4ObservedTurnRate,
    turnRadius:carved.skiV4ObservedTurnRadius});
  await page.keyboard.up("d");
  await page.screenshot({path:path.join(out,"04-v4-carve.png")});
  assert.ok(Number(carved.skiInputSteer)>.5 &&
    Math.abs(Number(carved.skiV4EdgeRadians))>.25);
  assert.equal(carved.skiV4TurnRegime,"carve");
  assert.ok(Number(carved.skiV4SnowCoverage)>.45,
    "An edge over bare rock cannot be classified as snow carving");
  assert.ok(Math.abs(Number(carved.skiV4ActualSlipRadians))<.12);
  assert.ok(Number(carved.skiV4ContactCoverage)>.45);
  assert.ok(Math.abs(Number(carved.skiV4ObservedTurnRate))>.01);
  assert.equal(braked.bigAirPhase,"idle");
  assert.deepEqual(errors,[],"No uncaught WebGL/browser exceptions");
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({url:url.toString(),
    exactEngine:"v4",frames,errors},null,2)+"\n");
  console.log("SKI V4 EXPERIMENTAL BROWSER PASS",JSON.stringify({frames,errors}));
}catch(e){
  try{await page.screenshot({path:path.join(out,"failure.png")});}catch{}
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({frames,errors,
    failure:e instanceof Error?e.stack:String(e)},null,2)+"\n");
  throw e;
}finally{await browser.close();}
