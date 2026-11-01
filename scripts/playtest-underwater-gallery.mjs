import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/sea-glass";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[],snapshots=[],diagnostics=[],consoleErrors=[];
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
try{
 for(const scenario of ["gallery","airlock"]){
  const page=await browser.newPage({viewport:scenario==="gallery"?
   {width:1280,height:800}:{width:390,height:760}});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text());});
  page.on("requestfailed",request=>consoleErrors.push("request failed "+request.url()+" "+request.failure()?.errorText));
  await page.goto(base+"/?bunker-start="+scenario,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  await page.locator("canvas").waitFor({timeout:30000});
  try{
   await page.waitForFunction(expected=>{
    const d=document.querySelector("canvas")?.dataset;
    return d?.bunkerQaStart===expected&&d?.bunkerPhotoCount==="49"&&
     Number(d?.drawCalls)>0;
   },scenario,{timeout:45000,polling:400});
  }catch(error){
   const diag=await page.evaluate(()=>({
    state:document.querySelector('[data-world-state]')?.getAttribute('data-world-state'),
    session:document.querySelector('[data-world-state]')?.getAttribute('data-world-session'),
    canvas:document.querySelector('canvas')?{...document.querySelector('canvas').dataset}:null,
    text:document.body.innerText.slice(-500),
   }));
   diagnostics.push({scenario,stage:"scene",diag});
   await page.screenshot({path:path.join(out,scenario+"-diagnostic.png")}).catch(()=>{});
   console.error("SEA GLASS SCENE DIAGNOSTIC",JSON.stringify(diag),JSON.stringify(consoleErrors));
   throw error;
  }
  await page.waitForFunction(scenario=>{
   const d=document.querySelector("canvas")?.dataset;
   return scenario==="gallery"?
    d?.bunkerInside==="true"&&Number(d.bunkerLoadedTextures)>0:
    d?.bunkerHatchOpen==="true";
  },scenario,{timeout:35000,polling:300});
  const snapshot=await page.locator("canvas").evaluate((c,scenario)=>({
   scenario,qa:c.dataset.bunkerQaStart,inside:c.dataset.bunkerInside,
   photos:c.dataset.bunkerPhotoCount,capacity:c.dataset.bunkerPhotoCapacity,
   rooms:c.dataset.bunkerMazeRooms,hatch:c.dataset.bunkerHatchOpen,
   textures:c.dataset.bunkerLoadedTextures,missing:c.dataset.bunkerMissingTextures,
   drawCalls:c.dataset.drawCalls,fps:c.dataset.fps,zone:c.dataset.reef,
  }),scenario);
  assert.equal(snapshot.photos,"49");
  assert.ok(Number(snapshot.capacity)>=49);
  assert.equal(snapshot.rooms,"36");
  assert.ok(Number(snapshot.drawCalls)>0);
  snapshots.push(snapshot);
  await page.screenshot({path:path.join(out,scenario+"-render.png")});
  await page.close();
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"sea-glass.json"),
  JSON.stringify({snapshots,errors},null,2)+"\n");
 console.log("SEA GLASS UNDERWATER MAZE BROWSER PASS",JSON.stringify(snapshots));
}catch(error){
 fs.writeFileSync(path.join(out,"sea-glass.json"),
  JSON.stringify({snapshots,diagnostics,errors,consoleErrors,error:String(error)},null,2)+"\n");
 throw error;
}finally{await browser.close();}
