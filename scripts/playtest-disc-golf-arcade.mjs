import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT to installed Playwright");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/disc-golf-arcade-browser";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:820}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByRole("button",{name:/Explore world/}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
 await page.getByRole("button",{name:"Show sport shortcuts"}).click();
 await page.getByRole("button",{name:"Disc golf",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfPhase==="ready",
   null,{timeout:15000});
 const rail=page.getByRole("slider",{name:/Throw power/});
 assert.ok(await rail.isVisible(),"Throw slider must be accessible");
 await rail.focus();
 await page.keyboard.press("Home");
 await page.keyboard.press("End");
 assert.equal(await rail.getAttribute("aria-valuenow"),"100");
 // Revert to the suggested fairway strength after proving keyboard range.
 // Full power is allowed to overshoot the opening green into water.
 await page.keyboard.press("Escape");
 const suggested=Number(await rail.getAttribute("aria-valuenow"));
 assert.ok(suggested>=4&&suggested<=100);
 // Observe the state transition before releasing. Software WebGL can complete
 // a short phase during an awaited browser command or screenshot.
 await page.evaluate(()=>{
  const canvas=document.querySelector("canvas");
  const phases=[{phase:canvas.dataset.discGolfPhase,at:performance.now()}];
  canvas.__flightPhases=phases;
  const observer=new MutationObserver(()=>{
   const phase=canvas.dataset.discGolfPhase;
   if(phases.at(-1)?.phase!==phase)phases.push({phase,at:performance.now()});
  });
  observer.observe(canvas,{attributes:true,attributeFilter:["data-disc-golf-phase"]});
  canvas.__flightObserver=observer;
  // Start BEFORE launch: expensive screenshots must not make us miss the
  // chase phase. Capture actual per-frame gait and camera data throughout.
  const chaseFrames=[],chaseStages=[];
  canvas.__chaseFrames=chaseFrames;
  canvas.__chaseStages=chaseStages;
  let lastChaseStage="";
  const collect=()=>{
   if(!canvas.isConnected)return;
   const d=canvas.dataset,stage=d.dogFetchStage;
   if(stage!==lastChaseStage){
    chaseStages.push({stage,at:performance.now()});
    lastChaseStage=stage;
   }
   if(stage==="chase"&&chaseFrames.length<120){
    chaseFrames.push({
     stage,gait:d.dogGait,speed:Number(d.dogSpeed),
     bodyBob:Number(d.dogBodyBob),pawLift:Number(d.dogFootLiftMax),
     followMode:d.shastaFollowMode,followBoom:Number(d.shastaFollowBoom),
    });
   }
   requestAnimationFrame(collect);
  };
  requestAnimationFrame(collect);
 });
 // Use the same keyboard slider release that players use in the live game.
 await page.keyboard.press("Enter");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfLastShot==="accepted",
  null,{timeout:10000});
 assert.equal(await canvas.getAttribute("data-disc-golf-strokes"),"1");
 await page.waitForFunction(()=>document.querySelector("canvas")?.__flightPhases
  ?.some(entry=>entry.phase==="flying"),null,{timeout:5000});
 if(await canvas.getAttribute("data-disc-golf-phase")==="flying")
  await page.screenshot({path:path.join(out,"01-arcade-throw-in-flight.png")});
 // The transition observer proves actual flight even if a slow WebGL frame
 // advances the disc before Playwright's next round trip completes.
 await page.waitForFunction(()=>{
  const p=document.querySelector("canvas")?.dataset.discGolfPhase;
  return p==="landed"||p==="holed"||p==="water";
 },null,{timeout:14000});
 const result=await canvas.evaluate(c=>({
  phase:c.dataset.discGolfPhase,
  flightPhases:c.__flightPhases,
  strokes:c.dataset.discGolfStrokes,
  waterRedos:c.dataset.discGolfWaterRedos,
  handoff:c.dataset.discGolfHandoffPending,
 }));
 assert.ok(result.flightPhases.some(p=>p.phase==="flying"),
  "The disc must enter physical flight before landing");
 assert.notEqual(result.phase,"water","Regular first throw must not immediately splash out");
 assert.equal(result.strokes,"1");
 await page.screenshot({path:path.join(out,"02-arcade-landing.png")});
 // The footage-derived gait contract applies during Shasta's automatic
 // fetch, not just while following the player. Sample actual animation
 // frames; fixed scene screenshots cannot prove anti-hop behavior.
 try{
  await page.waitForFunction(()=>
   (document.querySelector("canvas")?.__chaseFrames?.length??0)>=6,
   null,{timeout:35000});
 }catch(error){
  const detail=await canvas.evaluate(c=>({
   dogFetchStage:c.dataset.dogFetchStage,
   fetchStages:c.__chaseStages,
   samples:c.__chaseFrames,
   flightPhases:c.__flightPhases,
   currentPhase:c.dataset.discGolfPhase,
   handoffPending:c.dataset.discGolfHandoffPending,
   handoff:c.dataset.discGolfHandoff,
   handoffReason:c.dataset.discGolfHandoffReason,
   dogSpeed:c.dataset.dogSpeed,
   dogDistanceTraveled:c.dataset.dogDistanceTraveled,
   dogGait:c.dataset.dogGait,
   follow:c.dataset.shastaFollowMode,
   player:c.dataset.player,
  }));
  fs.writeFileSync(path.join(out,"fetch-timeout.json"),
   JSON.stringify({detail,errors},null,2)+"\\n");
  await page.screenshot({path:path.join(out,"fetch-timeout.png")});
  throw new Error("Shasta did not deliver six distinct rendered chase samples: "+
   JSON.stringify(detail),{cause:error});
 }
 const fetchGait=await page.evaluate(()=>
  [...document.querySelector("canvas").__chaseFrames]);
 assert.ok(fetchGait.length>=6,
  "Actual multi-frame Shasta pursuit must occur, not a transient HUD label");
 assert.ok(fetchGait.every(s=>Number.isFinite(s.bodyBob)&&
   Math.abs(s.bodyBob)<.03),
  "Shasta's body cannot repeatedly bounce while fetching the disc");
 assert.ok(fetchGait.some(s=>s.speed>1),
  "Fetch must include Shasta actually travelling, not only idle posing");
 assert.ok(fetchGait.every(s=>Number.isFinite(s.pawLift)&&s.pawLift<.19));
 assert.equal(await canvas.getAttribute("data-shasta-leg-rig"),"straight-four",
  "Fetch must use the simplified Shasta rig, never articulated knees");
 assert.equal(await canvas.getAttribute("data-shasta-leg-count"),"4");
 assert.ok(Math.abs(Number(await canvas.getAttribute("data-shasta-leg-width"))-
  Number(await canvas.getAttribute("data-shasta-paw-width")))<.001,
  "Fetch paws must stay as narrow as the leg columns");
 assert.equal(await canvas.getAttribute("data-shasta-tail-tip"),"closed-white");
 assert.ok(fetchGait.some(s=>s.followMode==="third-person"&&s.followBoom>=7),
  "The fetch camera should stay far enough behind Shasta to show his gait");

 // Recreate the reported Hole 1 second-shot failure after Shasta has
 // delivered the disc to the new lie. Check BOTH the requested camera and
 // the actually rendered, interpolated lens, not only tree trunk clearance.
 await page.waitForFunction(()=>
  document.querySelector("canvas")?.dataset.discGolfHandoffPending==="false",
  null,{timeout:35000});
 await page.waitForFunction(()=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.discGolfRenderedCameraClear==="true"&&d.discGolfPlayerFramed==="true"&&
    (d.discGolfCameraClear==="true"||Number(d.discGolfCameraCutaways)>0);
 },null,{timeout:12000});
 await page.waitForTimeout(700);
 const secondShot=await canvas.evaluate(c=>({
  phase:c.dataset.discGolfPhase,
  cameraClear:c.dataset.discGolfCameraClear,
  renderedClear:c.dataset.discGolfRenderedCameraClear,
  cameraAdjusted:c.dataset.discGolfCameraAdjusted,
  cutaways:Number(c.dataset.discGolfCameraCutaways),
  framed:c.dataset.discGolfPlayerFramed,
  canopyVolumes:c.dataset.discGolfCameraVolumes,
  blockers:c.dataset.discGolfCameraBlockers,
 }));
 assert.ok(secondShot.cameraClear==="true"||secondShot.cutaways>0);
 assert.equal(secondShot.framed,"true");
 assert.equal(secondShot.renderedClear,"true");
 assert.ok(Number(secondShot.canopyVolumes)>0,
  "The camera must use the island's authored 3D foliage geometry");
 await page.screenshot({path:path.join(out,"03-wooded-second-shot-view.png")});
 // Second shot remains playable after automatic camera repositioning.
 await page.getByRole("button",{name:"Space · Throw"}).click();
 await page.waitForFunction(()=>
  document.querySelector("canvas")?.dataset.discGolfStrokes==="2",
  null,{timeout:6000});
 result.secondShot=secondShot;
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({result,errors},null,2)+"\n");
 assert.deepEqual(errors,[],"No uncaught browser runtime errors");
 console.log(JSON.stringify({result,errors}));
} finally {await browser.close();}
