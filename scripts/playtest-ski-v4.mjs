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
    edge:data.skiV4EdgeRadians,carve:data.skiV4CarveAcceleration,
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
  const [spawnX,spawnZ]=(entry.player??"").split(",").map(Number);
  assert.ok(Math.abs(spawnX-7)<2.7 && spawnZ>-60.8 && spawnZ<-53,
    "Ski V4 must start inside Granite Ridge, not on an off-pipe shoulder: "+entry.player);
  // Record input history from actual browser locomotion, not injected state.
  await page.keyboard.down("w");
  await page.waitForTimeout(500);
  const glide=await snapshot("02-v4-glide");
  await page.keyboard.up("w");
  // Capture while the player is holding D. The edge relaxes quickly after release.
  await page.keyboard.down("d");
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.skiEngine==="v4" && Number(d?.skiInputSteer)>.5 &&
      Math.abs(Number(d?.skiV4EdgeRadians))>.25 &&
      Math.abs(Number(d?.skiV4CarveAcceleration))>.05;
  },null,{timeout:20000});
  const carved=await snapshot("03-v4-edge");
  assert.ok(Number(carved.skiInputSteer)>.5);
  assert.ok(Math.abs(Number(carved.skiV4EdgeRadians))>.25,
    "Held steering must produce real ski-edge engagement");
  await page.keyboard.up("d");
  const brakeEntrySpeed=Number(carved.speed);
  await page.keyboard.down("s");
  await page.waitForFunction(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return Number(d?.skiV4SkidDeceleration)>.1 && Number(d?.skiV4SnowPower)>0;
  },null,{timeout:20000});
  await page.waitForTimeout(1500);
  const braked=await snapshot("04-v4-brake");
  await page.keyboard.up("s");
  assert.ok(Number(braked.skiV4SkidDeceleration)>.1,
    "Held S must apply a real positive snowplow resistance");
  assert.ok(Number(braked.speed)<brakeEntrySpeed || Number(braked.speed)<.4,
    "S braking must reduce actual speed rather than just turning the visual skier");
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
