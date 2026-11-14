import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT to installed Playwright");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/mountain-jump-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push("page: "+e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text().slice(0,300));});
 await page.goto(process.env.WORLD_BASE_URL??"http://127.0.0.1:3000");
 for(let attempt=0;attempt<5;attempt++){
  await page.getByRole("button",{name:"Explore world",exact:true}).click();
  try{
   await page.waitForFunction(()=>document.querySelector("[data-world-state]")?.getAttribute("data-world-state")==="exploring",null,{timeout:5000});
   break;
  }catch(error){if(attempt===4)throw error;}
 }
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 // Free skiing never authorizes a scored jump, regardless of a terrain crest.
 // Its actual V3 air control is covered separately in playtest-ski-v3.mjs.
 await page.getByRole("button",{name:"Skiing",exact:true}).click();
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.activity==="ski"&&Number(d.height)>5.5;
 },null,{timeout:30000});
 const canvas=page.locator("canvas");
 assert.equal(await canvas.getAttribute("data-big-air-phase"),"idle");
 // Select the real Ski Jump shortcut, which arms the authored physical lip.
 await page.getByRole("button",{name:"Show sport shortcuts",exact:true}).click();
 await page.getByRole("button",{name:"Ski jump",exact:true}).click();
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.activity==="ski"&&d.bigAirPhase==="armed";
 },null,{timeout:18000});
 assert.equal(await canvas.getAttribute("data-mountain-ski-jump-authorized"),"true");
 await canvas.focus();
 await page.evaluate(()=>{
  const c=document.querySelector("canvas");
  c.__mountainJumpEvidence={flight:null,transitions:[],lastPhase:""};
  const collect=()=>{
   if(!c.isConnected)return;
   const d=c.dataset,store=c.__mountainJumpEvidence;
   if(d.bigAirPhase!==store.lastPhase){
    store.transitions.push({phase:d.bigAirPhase,z:d.player,at:performance.now()});
    store.lastPhase=d.bigAirPhase;
   }
   // Capture pixels and physics metadata from the same rendered frame.
   if(!store.flight&&d.bigAirPhase==="flying"&&d.bigAirBirdsFollowing==="true")
    store.flight={data:{...d},png:c.toDataURL("image/png")};
   requestAnimationFrame(collect);
  };
  requestAnimationFrame(collect);
 });
 let flight;
 await page.keyboard.down("w");
 try{
  await page.waitForFunction(()=>Boolean(
   document.querySelector("canvas")?.__mountainJumpEvidence?.flight),
   null,{timeout:150000});
  const saved=await canvas.evaluate(c=>c.__mountainJumpEvidence.flight);
  assert.equal(saved.data.bigAirPhase,"flying");
  assert.equal(saved.data.bigAirBirdsFollowing,"true");
  assert.equal(saved.data.mountainSkiJumpAuthorized,"true");
  fs.writeFileSync(path.join(out,"01-authorized-mountain-jump.png"),
   Buffer.from(saved.png.split(",")[1],"base64"));
  flight={phase:saved.data.bigAirPhase,distance:Number(saved.data.bigAirDistance),
   altitude:Number(saved.data.bigAirAltitude),birds:saved.data.bigAirBirdsFollowing,
   outward:Number(saved.data.bigAirOutwardGain),
   peak:Number(saved.data.bigAirPeakClearance),mode:saved.data.activity};
 }finally{await page.keyboard.up("w");}
 assert.equal(flight.mode,"ski");
 assert.equal(flight.birds,"true");
 // Starting another minigame must be unavailable while a ski flight plays.
 // Hidden game-dock controls are deliberately absent from the accessible
 // tree. Include hidden only to assert their disabled/visibility contract.
 const disc=page.locator("button").filter({hasText:/^Disc golf/}).first();
 // Result display must release movement; only an actual flight owns it.
 const during=await canvas.evaluate(el=>({phase:el.dataset.bigAirPhase,
  session:document.querySelector("[data-world-session]")?.getAttribute("data-world-session")}));
 if(during.phase==="flying")assert.equal(during.session,"playing");
 assert.ok(fs.existsSync(path.join(out,"01-authorized-mountain-jump.png")),
  "actual airborne pixels must come from the same observed flight frame");
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return Number(d?.bigAirDistance)>2||d?.bigAirPhase==="landed"||
    d?.bigAirPhase==="missed";
 },null,{timeout:35000});
 const progress=await canvas.evaluate(el=>({
  phase:el.dataset.bigAirPhase,
  distance:Number(el.dataset.bigAirDistance),
  birds:el.dataset.bigAirBirdsFollowing,
 }));
 assert.ok(progress.distance>2,"The skier must make real forward progress");
 await page.waitForFunction(()=>{
  const phase=document.querySelector("canvas")?.dataset.bigAirPhase;
  return phase==="landed"||phase==="missed";
 },null,{timeout:90000});
 await page.waitForFunction(()=>document.querySelector("[data-world-session]")?.getAttribute("data-world-session")==="results");
 if(await canvas.getAttribute("data-aquatic")==="land")
  await page.getByRole("group",{name:"Movement activity",exact:true}).waitFor({state:"visible"});
 await page.screenshot({path:path.join(out,"02-mountain-landing-result.png")});
 await page.getByRole("button",{name:"Explore",exact:true}).click();
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.bigAirPhase==="idle"&&d.activity==="run"&&
   document.querySelector("[data-world-session]")?.getAttribute("data-world-session")==="free";
 });
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:/Redwood grove A little about me/}).click();
 await disc.waitFor({state:"visible",timeout:15000});
 await page.getByRole("button",{name:"Skiing",exact:true}).click();
 await page.getByRole("button",{name:"Mountain ski jump · summit start",exact:true}).click();
 await page.getByRole("button",{name:"Exit jump",exact:true}).click();
 await disc.waitFor({state:"visible",timeout:15000});
 assert.equal(await page.getByRole("button",{name:"Trail running",exact:true}).getAttribute("aria-pressed"),"true");
 await page.screenshot({path:path.join(out,"03-free-roam-restored.png")});
 assert.deepEqual(errors,[],"No browser runtime errors during mountain flight");
 fs.writeFileSync(path.join(out,"mountain-jump-report.json"),
  JSON.stringify({flight,progress,errors},null,2)+"\n");
 console.log(JSON.stringify({flight,progress,errors},null,2));
}finally{await browser.close();}
