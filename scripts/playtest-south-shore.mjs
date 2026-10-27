import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw new Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/south-shore-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];const samples=[];
let page;
const sample=async(label)=>{
 const d=await page.locator("canvas").evaluate(c=>({...c.dataset}));
 const s={label,x:Number(d.player?.split(",")[0]),z:Number(d.player?.split(",")[1]),
  activity:d.activity,aquatic:d.aquatic,depth:Number(d.depth),
  maxDepth:Number(d.maxDepth),zone:d.reefZone,
  southShoreEntry:d.southShoreEntry,swimmable:d.southPassageSwimmable,
  southDiscovery:d.southDiscovery,renderCalls:Number(d.drawCalls),
  height:Number(d.height)};
 samples.push(s);return s;
};
const capture=async(name)=>page.screenshot({path:path.join(out,name+".png")});
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(process.env.WORLD_BASE_URL??"http://127.0.0.1:3000");
 for(let i=0;i<5;i++){
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  try{
   await page.waitForFunction(()=>document.querySelector("[data-world-state]")?.getAttribute("data-world-state")==="exploring",null,{timeout:6000});
   break;
  }catch(e){if(i===4)throw e;}
 }
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:/Arcade cavern/}).click();
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset,p=d?.player?.split(",").map(Number);
  return d?.activity==="run"&&p?.length===2&&Math.abs(p[0]-16)<2.5&&p[1]<-80;
 },null,{timeout:15000});
 const start=await sample("dry approach");
 assert.equal(start.aquatic,"land");
 assert.ok(start.z>-96&&start.z< -81);
 await capture("01-dry-south-approach");
 const canvas=page.locator("canvas");
 await canvas.focus();
 // Arcade arrival faces north toward its entrance. Backing away with S
 // is an ordinary visitor-controlled southbound run, not state injection.
 await page.keyboard.down("s");
 try {
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.aquatic==="surface"&&d.reefZone==="south-channel"&&
    d.southPassageSwimmable==="true"&&d.southShoreEntry==="true";
  },null,{timeout:110000});
 }finally{await page.keyboard.up("s");}
 const entered=await sample("direct shoreline entry");
 assert.ok(entered.z < -96&&entered.z>=-166);
 assert.ok(entered.x>-35&&entered.x<60);
 assert.equal(entered.activity,"run");
 assert.equal(entered.aquatic,"surface");
 assert.equal(entered.zone,"south-channel");
 await capture("02-surface-entry");
 // Continue through ordinary swimming controls until the seafloor safely
 // permits submerging. A dry-land teleport cannot satisfy this journey.
 await canvas.focus();
 await page.keyboard.down("s");
 try{
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.aquatic==="surface" && Number(d?.maxDepth)>1.4 &&
    Number(d?.player?.split(",")[1]) < -100;
  },null,{timeout:85000});
 }finally{await page.keyboard.up("s");}
 const offshore=await sample("offshore swimming");
 assert.ok(offshore.z<entered.z-3);
 await page.getByRole("button",{name:"Dive",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.aquatic==="dive",
  null,{timeout:15000});
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.depth)>.35,
  null,{timeout:25000});
 const dove=await sample("diving");
 assert.ok(dove.depth>0&&dove.depth<=dove.maxDepth+.03);
 assert.equal(dove.zone,"south-channel");
 await capture("03-south-dive");
 await page.getByRole("button",{name:"Surface",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.aquatic==="surface",
  null,{timeout:30000});
 const surfaced=await sample("surfaced");
 assert.ok(surfaced.depth<=.13);
 await canvas.focus();
 await page.keyboard.down("w");
 try{
  await page.waitForFunction(()=>{
   const d=document.querySelector("canvas")?.dataset;
   return d?.aquatic==="land"&&Number(d.player?.split(",")[1])>=-96;
  },null,{timeout:110000});
 }finally{await page.keyboard.up("w");}
 const returned=await sample("dry land return");
 assert.equal(returned.aquatic,"land");
 assert.ok(returned.z>=-96,"shore return restores original dry world bounds");
 assert.ok(Number.isFinite(returned.height));
 assert.ok(returned.renderCalls>0);
 await capture("04-returned-to-land");
 assert.deepEqual(errors,[],"no Three.js runtime errors on the entire snorkeling round trip");
 fs.writeFileSync(path.join(out,"journey.json"),JSON.stringify({samples,errors},null,2)+"\n");
 console.log("SOUTH SHORE PLAYABLE ENTRY AND RETURN PASS",JSON.stringify({samples,errors}));
}catch(e){
 try{await capture("failure-current-scene");}catch{}
 try{await sample("failure");}catch{}
 fs.writeFileSync(path.join(out,"journey.json"),JSON.stringify({samples,errors,error:String(e)},null,2)+"\n");
 console.error("SOUTH SHORE PLAYABLE ENTRY FAILURE",String(e),JSON.stringify(samples));
 throw e;
}finally{await browser.close();}
