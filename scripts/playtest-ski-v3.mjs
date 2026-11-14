import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const {chromium}=createRequire(path.join(process.env.PLAYWRIGHT_MODULE_ROOT,"package.json"))("playwright");
const dir=process.env.WORLD_AUDIT_DIR ?? "artifacts/ski-v3";
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
const page=await browser.newPage({viewport:{width:850,height:610},recordVideo:{dir}});
const canvas=page.locator("canvas").first();
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
async function phase(value){
  await page.waitForFunction(s=>document.querySelector("canvas")?.dataset.skiRidePhase===s,value,{timeout:90000});
}
// Capture immediately after the world's render callback, while its WebGL
// drawing buffer and telemetry still describe the same frame. This observer
// never advances physics, pauses a frame or supplies gameplay input.
await page.addInitScript(()=>{
  const frames={}, history=[];
  window.skiEvidence={frames,history};
  let sawFlight=false,lastTick=-1;
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>raf(time=>{
    callback(time);
    const c=document.querySelector("canvas[data-ski-ride-phase]");
    if(!c || !c.dataset.skiRidePhase)return;
    const d=c.dataset,tick=Number(d.skiTick);
    if(tick===lastTick)return;
    lastTick=tick;
    const phase=d.skiRidePhase;
    history.push({tick,phase,omega:Number(d.skiAngularY),rotation:d.skiRotation,runout:d.skiRunout});
    const name=phase==="charging"?"charge":phase==="air" && Math.abs(Number(d.skiAngularY))>.05?"air":
      sawFlight && phase!=="air" && d.skiLanding!=="none"?"touchdown":null;
    if(phase==="air")sawFlight=true;
    if(name && !frames[name])frames[name]={data:{...d},png:c.toDataURL("image/png")};
  });
});
async function save(name){
  await page.waitForFunction(n=>!!window.skiEvidence.frames[n],name,{timeout:90000});
  const {data,png}=await page.evaluate(n=>window.skiEvidence.frames[n],name);
  assert.equal(data.bigAirPhase,"idle");
  assert.ok(data.skiRidePhase);
  if(name==="air")assert.equal(data.skiRidePhase,"air");
  if(name==="charge")assert.equal(data.skiRidePhase,"charging");
  if(name==="touchdown")assert.ok(["rough","clean","crash"].includes(data.skiLanding));
  fs.writeFileSync(path.join(dir,name+".png"),Buffer.from(png.split(",")[1],"base64"));
  fs.writeFileSync(path.join(dir,name+".json"),JSON.stringify(data,null,2));
}
try{
  await page.goto(process.env.WORLD_BASE_URL ?? "http://localhost:3000",{timeout:120000});
  await page.getByRole("button",{name:"Explore world",exact:true}).click({timeout:120000});
  await page.getByRole("button",{name:"Skiing",exact:true}).click();
  await phase("riding");
  await page.keyboard.down("Space");
  await save("charge");
  await page.keyboard.down("a");
  await page.keyboard.up("Space");
  await save("air");
  await page.keyboard.up("a");
  await save("touchdown");
  await page.getByRole("button",{name:"Trail running",exact:true}).click();
  await phase("");
  assert.deepEqual(errors,[]);
} finally {
  const history=await page.evaluate(()=>window.skiEvidence?.history ?? []).catch(()=>[]);
  fs.writeFileSync(path.join(dir,"frames.json"),JSON.stringify(history));
  fs.writeFileSync(path.join(dir,"errors.json"),JSON.stringify(errors));
  await page.close();await browser.close();
}
