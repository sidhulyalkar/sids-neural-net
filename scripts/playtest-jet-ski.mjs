import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("Set PLAYWRIGHT_MODULE_ROOT to the installed Playwright directory");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/jet-ski-playtest";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const results=[],errors=[];
async function boot(page){
 page.on("pageerror",e=>errors.push("page: "+e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text().slice(0,300));});
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 try{
  await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:45000});
 }catch(error){
  const diag=await page.evaluate(()=>({
    scene:document.querySelector("[data-world-state]")?.getAttribute("data-world-state"),
    canvasCount:document.querySelectorAll("canvas").length,
    canvasData:{...document.querySelector("canvas")?.dataset},
    userAgent:navigator.userAgent,
  }));
  fs.writeFileSync(path.join(out,"world-boot-failure.json"),JSON.stringify({diag,errors},null,2));
  await page.screenshot({path:path.join(out,"world-boot-failure.png")});
  console.error("WORLD BROWSER BOOT DIAGNOSTICS",JSON.stringify(diag));
  throw error;
 }
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:"05 Lagoon reef South Pacific reef",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.aquatic==="land");
 // Lagoon region spawns near the shoreline pier ramp; walk on the deck.
 const canvas=page.locator("canvas");
 await canvas.focus();
 // Walk FORWARD from the lagoon arrival along its pier-facing camera.
 // D is a camera-relative strafe and can send the player sideways into water.
 await page.keyboard.down("w");
 try{
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiPier==="true",
   null,{timeout:9000});
 }catch(err){
  const diagnostics=await canvas.evaluate(element=>({
   player:element.dataset.player,aquatic:element.dataset.aquatic,
   onPier:element.dataset.jetSkiPier,
   height:element.dataset.height,deckHeight:element.dataset.jetSkiDeckHeight,
   drawCalls:element.dataset.drawCalls,
  }));
  fs.writeFileSync(path.join(out,"pier-approach-failure.json"),
   JSON.stringify({diagnostics,errors},null,2));
  await page.screenshot({path:path.join(out,"pier-approach-failure.png")});
  console.error("PIER APPROACH DIAGNOSTICS",JSON.stringify(diagnostics));
  throw err;
 }finally{
  await page.keyboard.up("w");
 }
 assert.notEqual(await canvas.getAttribute("data-jet-ski-deck-height"),"");
 assert.equal(await canvas.getAttribute("data-aquatic"),"land");
}
try{
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 await boot(desktop);
 const canvas=desktop.locator("canvas");
 assert.equal(await canvas.getAttribute("data-jet-ski-arches"),"2");
 assert.ok(Number(await canvas.getAttribute("data-jet-ski-rocks"))>=10);
 const dock=desktop.locator('[aria-label="Jet ski race status"]');
 await dock.waitFor({state:"visible"});
 assert.match(await dock.textContent(),/JET-SKI PIER/);
 await canvas.focus();
 await desktop.keyboard.press("Enter");
 const chooser=desktop.getByRole("dialog",{name:"Choose a jet ski"});
 await chooser.waitFor({state:"visible"});
 // Boarding instructions must disappear while the chooser is displayed.
 await dock.waitFor({state:"hidden",timeout:15000});
 await desktop.screenshot({path:path.join(out,"01-ride-chooser.png")});
 await chooser.getByRole("button",{name:/^Race/}).click();
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="racing");
 await desktop.screenshot({path:path.join(out,"01-dock-launch.png")});
 // The countdown may complete before the first SwiftShader screenshot finishes.
 // Verify the durable race state instead of a transient HUD label.
 assert.equal(await canvas.getAttribute("data-jet-ski-status"),"racing");
 await desktop.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.jetSkiTime)>.08,
  null,{timeout:45000});
 // Shift alone accelerates the ski, with no simultaneous W press needed.
 await desktop.keyboard.down("Shift");
 try{
  await desktop.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.jetSkiTurbo)<94,
   null,{timeout:20000});
  assert.equal(await canvas.getAttribute("data-jet-ski-boosting"),"true");
  assert.ok(Number(await canvas.getAttribute("data-jet-ski-speed"))>0,
   "holding Shift alone must actually propel the ski");
 }finally{await desktop.keyboard.up("Shift");}
 await desktop.keyboard.down("w");
 await desktop.keyboard.down("Shift");
 try{
  await desktop.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.jetSkiTurbo)<90,
   null,{timeout:25000});
 }finally{
  await desktop.keyboard.up("Shift");
  await desktop.keyboard.up("w");
 }
 const driving=await canvas.evaluate(c=>({
  status:c.dataset.jetSkiStatus,
  speed:Number(c.dataset.jetSkiSpeed),
  turbo:Number(c.dataset.jetSkiTurbo),
  courseWater:c.dataset.jetSkiCourseWater,
 }));
 assert.equal(driving.courseWater,"true");
 assert.ok(driving.speed>1,JSON.stringify(driving));
 await desktop.keyboard.down("s");
 try{
  await desktop.waitForFunction(()=>
   Number(document.querySelector("canvas")?.dataset.jetSkiSpeed)<-.5,
   null,{timeout:35000});
 }finally{await desktop.keyboard.up("s");}
 assert.ok(Number(await canvas.getAttribute("data-jet-ski-speed"))<0,
  "Reverse must back the player out of narrow channels");

 await desktop.screenshot({path:path.join(out,"02-race-boost.png")});
 results.push({desktop:driving});
 const raceTimeBeforeRetry=Number(await canvas.getAttribute("data-jet-ski-time"));
 await desktop.keyboard.press("r");
 await desktop.waitForFunction(previous=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.jetSkiStatus==="racing"&&d.jetSkiLap==="1"&&d.jetSkiGate==="1"&&
   Number(d.jetSkiTime)<previous-.1;
 },raceTimeBeforeRetry,{timeout:25000});
 // Browser compositing can outlive the brief countdown on slow software GPUs;
 // assert the durable game reset, not a transitory HUD string.
 await desktop.keyboard.press("Escape");
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="docked");
 // Restart must preserve Free ride rather than unexpectedly launching a race.
 await canvas.focus();
 await desktop.keyboard.press("Enter");
 await chooser.waitFor({state:"visible"});
 await chooser.getByRole("button",{name:/^Free ride/}).click();
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiMode==="free");
 await desktop.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.jetSkiTime)>.5,
  null,{timeout:15000});
 const beforeFreeRestart=Number(await canvas.getAttribute("data-jet-ski-time"));
 await desktop.keyboard.press("r");
 await desktop.waitForFunction(previous=>{
  const d=document.querySelector("canvas")?.dataset;
  return d?.jetSkiMode==="free"&&d.jetSkiStatus==="racing"&&
   Number(d.jetSkiTime)<previous-.2;
 },beforeFreeRestart,{timeout:15000});
 await desktop.keyboard.press("Escape");
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="docked");
 results.push("Desktop walks onto pier, Enter chooser, solo-Shift boost, W+Shift boost, reverse, race/free-ride restart and dock");
 // Release desktop WebGL resources before starting a second SwiftShader scene.
 await desktop.close();
 const phone=await browser.newPage({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,
 });
 await boot(phone);
 const ride=phone.getByRole("button",{name:"Ride",exact:true});
 await ride.waitFor({state:"visible"});
 await ride.tap();
 const mobileChooser=phone.getByRole("dialog",{name:"Choose a jet ski"});
 await mobileChooser.waitFor({state:"visible"});
 await mobileChooser.getByRole("button",{name:/^Free ride/}).tap();
 await phone.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="racing");
 assert.equal(await phone.locator("canvas").getAttribute("data-jet-ski-mode"),"free");
 assert.equal(await phone.getByRole("button",{name:"BOOST",exact:true}).isVisible(),true);
 const touchLayout=await phone.evaluate(()=>{
   const hud=document.querySelector('[aria-label="Jet ski race status"]');
   const touch=document.querySelector('[aria-label="Jet ski touch controls"]');
   if(!hud||!touch)throw Error("Missing jet-ski HUD or touch controls");
   const status=hud.getBoundingClientRect(),controls=touch.getBoundingClientRect();
   const buttons=Array.from(touch.querySelectorAll("button"))
     .filter(button=>getComputedStyle(button).display!=="none")
     .map(button=>({label:button.textContent,rect:button.getBoundingClientRect()}));
   return {status:{x:status.x,y:status.y,right:status.right,bottom:status.bottom},
     controls:{x:controls.x,y:controls.y,right:controls.right,bottom:controls.bottom},
     viewport:{w:innerWidth,h:innerHeight},
     buttons:buttons.map(b=>({label:b.label,x:b.rect.x,y:b.rect.y,
       right:b.rect.right,bottom:b.rect.bottom}))};
 });
 assert.ok(touchLayout.status.bottom+5<touchLayout.controls.y,
  "Mobile status must never overlap touch buttons: "+JSON.stringify(touchLayout));
 assert.ok(touchLayout.controls.bottom<=touchLayout.viewport.h+1,
  "Touch steering must remain inside the viewport");
 for(const button of touchLayout.buttons){
   assert.ok(button.x>=0&&button.right<=touchLayout.viewport.w+1);
   assert.ok(button.y>=0&&button.bottom<=touchLayout.viewport.h+1);
 }
 for(let i=0;i<touchLayout.buttons.length;i++){
  for(let j=i+1;j<touchLayout.buttons.length;j++){
   const a=touchLayout.buttons[i],b=touchLayout.buttons[j];
   const xOverlap=Math.min(a.right,b.right)-Math.max(a.x,b.x);
   const yOverlap=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
   assert.ok(xOverlap<=1||yOverlap<=1,
    "Touch controls must not overlap each other: "+a.label+" and "+b.label);
  }
 }
 results.push({touchLayout});
 await phone.screenshot({path:path.join(out,"03-touch-race.png")});
 await phone.getByRole("button",{name:"Dock",exact:true}).tap();
 await phone.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="docked");
 results.push("Touch pier boarding, free ride selection, boost controls and docking");
 assert.deepEqual(errors,[],"No browser console or runtime errors");
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({results,errors},null,2)+"\n");
 console.log(JSON.stringify({results,errors},null,2));
}finally{
 await browser.close();
}
