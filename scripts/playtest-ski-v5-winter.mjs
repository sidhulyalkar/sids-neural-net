/** Exact-browser Ski V5-W0 winter allocation/teardown evidence.
 * Never grants successful ski physics or halfpipe qualification.
 * Use PLAYWRIGHT_MODULE_ROOT (isolated npm install) and WORLD_BASE_URL.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/ski-v5/winter-browser";
fs.mkdirSync(out,{recursive:true});
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000/world";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1100,height:740}});
const errors=[],states=[];
page.on("pageerror",e=>errors.push(e.message));
const canvas=page.locator("canvas").first();
const sample=async stage=>{
  const d=await canvas.evaluate(c=>({...c.dataset}));
  states.push({stage,at:Date.now(),activity:d.activity,phase:d.winterPhase,
    blend:d.winterBlend,terrain:d.winterTerrain,particles:d.winterParticleCount,
    skiEngine:d.skiEngine,triangles:d.mountainHalfpipeTriangles});
  return d;
};
async function waitFor(predicate,message){
  await page.waitForFunction(predicate,null,{timeout:120000}).catch(e=>{throw Error(message+" "+e.message);});
}
try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:120000});
  const enter=page.getByRole("button",{name:"Explore world",exact:true});
  if(await enter.count())await enter.click({timeout:120000});
  await waitFor(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>20,
    "World must render before selecting Skiing");
  const normal=await sample("01-normal");
  assert.ok(!normal.winterTerrain||normal.winterTerrain==="none",
    "Normal world must not own a refined winter terrain");
  assert.equal(Number(normal.mountainHalfpipeTriangles??0),0,
    "Normal world must not refine snow triangles at startup");
  const nav=page.getByRole("navigation",{name:"World movement and sports"});
  await nav.getByRole("button",{name:"Skiing",exact:true}).click({timeout:30000});
  await waitFor(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.activity==="ski"&&d?.winterTerrain==="active"&&
      d?.winterPhase==="winter"&&Number(d?.winterBlend)>.98&&
      Number(d?.winterParticleCount)>0;
  },"Winter surface, particles and full snow appearance must become active");
  const winter=await sample("02-full-winter");
  assert.ok(Number(winter.mountainHalfpipeTriangles)>0);
  await page.screenshot({path:path.join(out,"02-full-winter.png")});
  await nav.getByRole("button",{name:"Trail running",exact:true}).click({timeout:30000});
  await waitFor(()=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.activity==="run"&&d?.winterPhase==="normal"&&
      d?.winterTerrain==="none"&&Number(d?.winterBlend)===0&&
      Number(d?.winterParticleCount)===0;
  },"Running must restore base geometry and release all winter GPU resources");
  const restored=await sample("03-restored");
  assert.equal(Number(restored.mountainHalfpipeTriangles),0);
  await page.screenshot({path:path.join(out,"03-restored.png")});
  // Rapidly interrupted second selection must not resurrect stale resources.
  await nav.getByRole("button",{name:"Skiing",exact:true}).click({timeout:30000});
  await waitFor(()=>document.querySelector("canvas")?.dataset.winterTerrain==="active",
    "Winter must reallocate cleanly");
  await nav.getByRole("button",{name:"Trail running",exact:true}).click({timeout:30000});
  await waitFor(()=>document.querySelector("canvas")?.dataset.winterTerrain==="none",
    "Interrupted second winter must also fully release");
  await sample("04-repeated-entry-exit");
  assert.deepEqual(errors,[],"No browser exceptions during winter allocation/teardown");
}finally{
  fs.writeFileSync(path.join(out,"states.json"),JSON.stringify(states,null,2));
  fs.writeFileSync(path.join(out,"page-errors.json"),JSON.stringify(errors,null,2));
  await page.close();await browser.close();
}
