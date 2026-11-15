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
  // Command-time spawn is captured before WebGL/frame-sampling overhead lets the rider descend.
  const [spawnX,spawnZ]=(entry.skiV4Spawn??"").split(",").map(Number);
  assert.ok(Math.abs(spawnX-7)<2.7 && spawnZ>-60.8 && spawnZ<-53,
    "Ski V4 must command an in-channel spawn before descent: "+entry.skiV4Spawn);
  assert.equal(entry.skiV4AwaitingStart,"true",
    "No gravity-driven ski escape before the first deliberate player control");
  const [entryX,entryZ]=(entry.player??"").split(",").map(Number);
  assert.ok(Math.abs(entryX-7)<1&&entryZ>-61&&entryZ<-55,
    "The first displayed skier must still be at Granite Ridge: "+entry.player);
  // Read telemetry *before* taking slow software-WebGL screenshots.
  // This distinguishes actual input dynamics from screenshots of the coast.
  await page.keyboard.down("w");
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiV4AwaitingStart==="false"&&Number(d.speed)>1.5;
  },null,{timeout:20000});
  const glide=await canvas.evaluate(el=>({...el.dataset}));
  frames.push({stage:"02-v4-glide",time:Date.now(),player:glide.player,
    speed:glide.speed,awaiting:glide.skiV4AwaitingStart});
  await page.keyboard.up("w");
  await page.keyboard.down("d");
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiEngine==="v4"&&Number(d?.skiInputSteer)>.5 &&
      Math.abs(Number(d?.skiV4EdgeRadians))>.25 &&
      Math.abs(Number(d?.skiV4CarveAcceleration))>.05 &&
      Math.abs(Number(d?.skiV4ActualSlipRadians))<.12 &&
      Number(d?.skiV4ContactCoverage)>.45 &&
      d?.skiV4TurnRegime==="carve";
  },null,{timeout:20000});
  const carved=await canvas.evaluate(el=>({...el.dataset}));
  frames.push({stage:"03-v4-edge",time:Date.now(),player:carved.player,
    speed:carved.speed,edge:carved.skiV4EdgeRadians,
    carve:carved.skiV4CarveAcceleration,steer:carved.skiInputSteer,
    actualSlip:carved.skiV4ActualSlipRadians,carveQuality:carved.skiV4CarveQuality,
    contactCoverage:carved.skiV4ContactCoverage,regime:carved.skiV4TurnRegime,
    actualTurnRate:carved.skiV4ObservedTurnRate,turnRadius:carved.skiV4ObservedTurnRadius});
  assert.ok(Number(carved.skiInputSteer)>.5 &&
    Math.abs(Number(carved.skiV4EdgeRadians))>.25);
  assert.equal(carved.skiV4TurnRegime,"carve",
    "Requested edge force alone is not proof of actual ski carving");
  assert.ok(Math.abs(Number(carved.skiV4ActualSlipRadians))<.12,
    "True carving must have low velocity-relative ski slip");
  assert.ok(Number(carved.skiV4ContactCoverage)>.45,
    "Edge force without load-bearing contact cannot qualify as carving");
  assert.ok(Math.abs(Number(carved.skiV4ObservedTurnRate))>.01,
    "Carved turn must change actual velocity heading");
  await page.keyboard.up("d");
  const brakeEntrySpeed=Number(carved.speed);
  await page.keyboard.down("s");
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return Number(d?.skiV4BrakeEngagement)>.8 &&
      Number(d?.skiV4SkidDeceleration)>.1 &&
      Number(d?.skiV4SnowPower)>=0;
  },null,{timeout:20000});
  const braking=await canvas.evaluate(el=>({...el.dataset}));
  await page.waitForTimeout(1000);
  const braked=await canvas.evaluate(el=>({...el.dataset}));
  frames.push({stage:"04-v4-brake",time:Date.now(),player:braked.player,
    speed:braked.speed,skid:braking.skiV4SkidDeceleration,
    brakeEngagement:braked.skiV4BrakeEngagement});
  await page.screenshot({path:path.join(out,"04-v4-brake.png")});
  await page.keyboard.up("s");
  assert.equal(braking.skiV4TurnRegime,"skid",
    "Deliberate snowplow must be identified as skidding, not carving");
  assert.ok(Number(braking.skiV4SkidDeceleration)>.1,
    "Held S must apply a real positive snowplow resistance");
  assert.ok(Number(braked.speed)<brakeEntrySpeed||Number(braked.speed)<.4,
    "Snow braking must reduce measured speed without velocity clamping");
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
