import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw new Error("Set PLAYWRIGHT_MODULE_ROOT to an installed Playwright package directory");
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/disc-golf-playtest";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const report=[];
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push("pageerror: "+e.message));
 page.on("console",msg=>{if(msg.type()==="error")
  errors.push("console: "+msg.text().slice(0,350));});
 await page.goto(base);
 // World rendering is lazy: the welcome page intentionally has no canvas
 // before the visitor chooses Explore. Waiting for frames first deadlocks.
 for(let attempt=0;attempt<5;attempt++){
  await page.getByRole("button",{name:/Explore world/}).click();
  try{
   await page.waitForFunction(()=>document.querySelector("[data-world-state]")?.getAttribute("data-world-state")==="exploring",null,{timeout:5000});
   break;
  }catch(error){if(attempt===4)throw error;}
 }
 try{
  await page.waitForFunction(()=>
   Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
   null,{timeout:30000});
 }catch(err){
  const diagnostics=await page.evaluate(()=>{
   const element=document.querySelector("[data-world-state]");
   const canvas=document.querySelector("canvas");
   const test=document.createElement("canvas");
   let gl2=false,gl1=false;
   try{gl2=!!test.getContext("webgl2");}catch{}
   try{gl1=!!test.getContext("webgl");}catch{}
   return {worldState:element?.getAttribute("data-world-state"),
    worldText:element?.textContent?.slice(0,1500),
    canvasCount:document.querySelectorAll("canvas").length,
    canvasData:canvas?{...canvas.dataset}:null,
    webgl2:gl2,webgl1:gl1,userAgent:navigator.userAgent};
  });
  fs.writeFileSync(path.join(out,"boot-failure.json"),
   JSON.stringify({diagnostics,errors},null,2));
  await page.screenshot({path:path.join(out,"world-boot-failure.png")});
  console.error("WORLD BOOT DIAGNOSTICS",JSON.stringify({diagnostics,errors},null,2));
  throw err;
 }
 await page.getByRole("button",{name:/^Disc golf · (play|resume|scorecard)$/}).click();
 const canvas=page.locator("canvas");
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfPhase==="ready");
 // The resting HUD is a small edge-to-edge strip, not a right-side panel.
 const hud=page.getByRole("complementary",{name:"Disc golf controls"});
 const desktopHud=await hud.boundingBox();
 assert.ok(desktopHud,"Disc Golf bar must be rendered");
 assert.ok(desktopHud.width>=page.viewportSize().width*.93,
  "HUD must span nearly the entire width of the world");
 assert.ok(desktopHud.height<=110,
  "Idle bottom HUD must stay thin instead of blocking the player");
 assert.ok(desktopHud.y+desktopHud.height>=page.viewportSize().height-42,
  "HUD must sit near the bottom edge of the world");
 assert.equal(await page.getByRole("region",{name:"Disc throw tuning"}).count(),0,
  "Detailed disc controls should stay collapsed by default");
 await page.getByRole("button",{name:"Tune",exact:true}).click();
 assert.equal(await page.getByRole("region",{name:"Disc throw tuning"}).isVisible(),true);
 assert.equal(await page.locator("#disc-golf-disc-type").isVisible(),true);
 assert.equal(await page.locator("#disc-golf-spin").isVisible(),true);
 await page.getByRole("region",{name:"Disc throw tuning"})
  .getByRole("button",{name:"Close"}).click();
 await page.getByRole("button",{name:"Course",exact:true}).click();
 assert.equal(await page.getByRole("region",{name:"Nine-hole course and scorecard"}).isVisible(),true);
 assert.equal(await page.getByRole("group",{name:"Choose hole"}).getByRole("button").count(),9);
 await page.getByRole("region",{name:"Nine-hole course and scorecard"})
  .getByRole("button",{name:"Close"}).click();
 await page.setViewportSize({width:390,height:844});
 const mobileHud=await hud.boundingBox();
 assert.ok(mobileHud&&mobileHud.x>=0&&mobileHud.x+mobileHud.width<=390,
  "Mobile bar must remain within the viewport");
 assert.ok(mobileHud.height<=170,
  "Mobile HUD should remain compact even when it wraps into rows");
 await page.setViewportSize({width:1440,height:900});
 const powerRail=page.getByRole("slider",{name:/Throw power/});
 assert.ok(await powerRail.isVisible(),"Precision launch rail must be visible");
 assert.equal(await powerRail.getAttribute("aria-valuemin"),"4");
 assert.equal(await powerRail.getAttribute("aria-valuemax"),"100");
 const suggested=Number(await powerRail.getAttribute("aria-valuenow"));
 assert.ok(suggested>=4&&suggested<=100);
 await powerRail.focus();
 await page.keyboard.press("Home");
 assert.equal(await powerRail.getAttribute("aria-valuenow"),"4");
 await page.keyboard.press("ArrowRight");
 assert.equal(await powerRail.getAttribute("aria-valuenow"),"5",
  "Keyboard must adjust power, not the player's aim");
 await page.keyboard.press("Escape");
 assert.equal(Number(await powerRail.getAttribute("aria-valuenow")),suggested,
  "Escape resets custom power to the suggested target");
 const issues=await canvas.getAttribute("data-disc-golf-layout-issues");
 assert.equal(await canvas.getAttribute("data-disc-golf-layout-clear"),"true",
  "A procedural obstacle overlaps a tee or green: "+issues);
 const ids=["redwood-bend","scrub-crosswind","desert-drifter",
   "coastal-gust","redwood-needles","fern-falls","granite-climb",
   "joshua-chute","homeward-line"];
 for(let i=0;i<ids.length;i++){
  if(i>0){
   // The new bottom HUD keeps the nine-hole menu collapsed by default.
   await page.getByRole("button",{name:"Course",exact:true}).click();
   await page.getByRole("region",{name:"Nine-hole course and scorecard"})
    .getByRole("button",{name:new RegExp("^Play hole "+(i+1)+":")}).click();
  }
  await page.waitForFunction((id)=>{
   const c=document.querySelector("canvas");
   return c?.dataset.discGolfHole===id&&c?.dataset.discGolfPhase==="ready";
  },ids[i]);
  assert.equal(await canvas.getAttribute("data-disc-golf-last-shot"),"pending");
  assert.equal(await canvas.getAttribute("data-disc-golf-gates"),"0");
  assert.ok(Number(await canvas.getAttribute("data-disc-golf-gates-total"))>=1,
    "Every long hole needs an active mandatory gate");
  if(i===1){
   assert.equal(await canvas.getAttribute("data-disc-golf-gates-total"),"3",
    "Shore-to-backside Hole 2 needs three required gates");
  }
  const startAvatar=await canvas.evaluate(c=>({
   x:Number(c.dataset.discGolfAvatarX),z:Number(c.dataset.discGolfAvatarZ),
  }));
  if(i===1){
   // Keep the original click-to-throw coverage for the restored second tee.
   await page.getByRole("button",{name:"Space · Throw"}).click();
  }else if(i===2){
   // Dragging the engraved power grip must update strength LIVE and release
   // exactly one throw without needing to click the normal throw button.
   const bounds=await powerRail.boundingBox();
   assert.ok(bounds&&bounds.width>90);
   const y=bounds.y+bounds.height/2;
   await page.mouse.move(bounds.x+bounds.width*.3,y);
   await page.mouse.down();
   assert.equal(await powerRail.getAttribute("data-dragging"),"true");
   await page.mouse.move(bounds.x+bounds.width*.77,y,{steps:9});
   const adjusted=Number(await powerRail.getAttribute("data-power"));
   assert.ok(adjusted>=70&&adjusted<=85,
    "Drag should control strength in the correct direction");
   await page.screenshot({path:path.join(out,"hole-3-power-rail-charging.png")});
   await page.mouse.up();
   assert.equal(await powerRail.getAttribute("data-dragging"),"false");
  }else{
   await page.keyboard.down("Space");
   await page.waitForTimeout(85);
   await page.keyboard.up("Space");
  }
  await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.discGolfLastShot==="accepted",
   null,{timeout:5000});
  // The opening throw is also a camera-story regression. Shasta must
  // NOT steal attention mid-flight; see where the disc lands first.
  if(i===0){
   await page.waitForFunction(()=>
    document.querySelector("canvas")?.dataset.discGolfCinematicStage==="disc",
    null,{timeout:5000}).catch(()=>{
     throw new Error("First throw never entered disc-follow camera mode");
    });
  }
  await page.waitForFunction(()=>{
   const phase=document.querySelector("canvas")?.dataset.discGolfPhase;
   return phase==="landed"||phase==="holed"||phase==="water";
  },null,{timeout:15000});
  const phase=await canvas.getAttribute("data-disc-golf-phase");
  const strokes=Number(await canvas.getAttribute("data-disc-golf-strokes"));
  assert.notEqual(phase,"water","Default first throw should not be an immediate water redo on "+ids[i]);
  assert.equal(strokes,1,"First throw must count exactly one stroke on "+ids[i]);
  assert.equal(await canvas.getAttribute("data-disc-golf-handoff-pending"),"true",
   "landing cannot unlock the next throw before fetch");
  if(i===0){
   const assertNotMoved=async phaseName=>{
    const avatar=await canvas.evaluate(c=>({
     x:Number(c.dataset.discGolfAvatarX),
     z:Number(c.dataset.discGolfAvatarZ),
     pending:c.dataset.discGolfHandoffPending,
    }));
    assert.deepEqual({x:avatar.x,z:avatar.z},startAvatar,
     "Avatar moved before Shasta finished during "+phaseName);
    assert.equal(avatar.pending,"true");
   };
   await assertNotMoved("landing");
   await page.waitForFunction(()=>
    document.querySelector("canvas")?.dataset.discGolfCinematicStage==="landing",
    null,{timeout:2500});
   await page.screenshot({path:path.join(out,"hole-1-disc-landing.png")});
   await page.waitForFunction(()=>
    document.querySelector("canvas")?.dataset.discGolfCinematicStage==="chase",
    null,{timeout:3500});
   await assertNotMoved("chase");
   await page.screenshot({path:path.join(out,"hole-1-shasta-begins-chase.png")});
   // One continuous over-shoulder run is deliberate: avoid the old
   // eye-level POV cut, which made every tiny dog step fill the screen.
   const follow=await canvas.getAttribute("data-shasta-follow-mode");
   assert.equal(follow,"third-person");
   assert.ok(Number(await canvas.getAttribute("data-shasta-follow-boom"))>=10);
   await page.screenshot({path:path.join(out,"hole-1-shasta-wide-follow.png")});
  }
  await page.waitForFunction(()=>
   document.querySelector("canvas")?.dataset.discGolfHandoffPending==="false",
   null,{timeout:25000});
  if(i===0){
   assert.equal(await canvas.getAttribute("data-disc-golf-handoff"),"complete");
   assert.equal(await canvas.getAttribute("data-disc-golf-handoff-reason"),"found",
    "Shasta must actually find the disc before Hole 1 teleports the avatar");
   const final=await canvas.evaluate(c=>({
    x:Number(c.dataset.discGolfAvatarX),z:Number(c.dataset.discGolfAvatarZ),
    lieX:Number(c.dataset.discGolfLieX),lieZ:Number(c.dataset.discGolfLieZ),
   }));
   assert.deepEqual([final.x,final.z],[final.lieX,final.lieZ],
    "Avatar should arrive exactly at the committed throwing lie after Shasta finds it");
  }
  if(i===1||i===0||i===8){
   await page.screenshot({path:path.join(out,`hole-${i+1}-after-first-shot.png`)});
  }
  await page.waitForFunction(()=>{
   const d=document.querySelector('canvas[role="application"]')?.dataset;
   return d?.discGolfPlayerFramed==="true"&&d.discGolfRenderedCameraClear==="true";
  },null,{timeout:15000});
  const cameraEvidence=await canvas.evaluate(c=>({
   clear:c.dataset.discGolfRenderedCameraClear,framed:c.dataset.discGolfPlayerFramed,
   cutaways:Number(c.dataset.discGolfCameraCutaways),volumes:Number(c.dataset.discGolfRenderedVolumes),
  }));
  assert.ok(cameraEvidence.volumes>0,"rendered geometry must participate in camera selection");
  await page.screenshot({path:path.join(out,`hole-${i+1}-clear-rethrow.png`)});
  report.push({hole:i+1,id:ids[i],phase,strokes,camera:cameraEvidence});
 }
 assert.deepEqual(errors,[],"Browser should produce no runtime errors");
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({report,errors},null,2)+"\n");
 console.log(JSON.stringify({report,errors},null,2));
 await page.close();
}finally{await browser.close();}
