import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw new Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://localhost:3000";
const output=process.env.WORLD_AUDIT_DIR??"artifacts/world/skimboarding";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({
  headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"],
});
const errors=[],checks=[];
let page;
const snap=async(name)=>page.screenshot({path:path.join(output,name+".png")});
const canvas=()=>page.locator('canvas[role="application"]');
const attr=(key)=>canvas().getAttribute("data-"+key);
async function waitPhase(phase,timeout=10000){
  await page.waitForFunction(p=>document.querySelector('canvas[role="application"]')?.dataset.skimPhase===p,
    phase,{timeout});
}
try {
  page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",e=>errors.push("pageerror: "+e.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  page.on("requestfailed",request=>{
    if(request.url().includes("/_next/"))errors.push("request: "+request.url()+" "+request.failure()?.errorText);
  });
  await page.goto(base);
  // Next dev can show the server-rendered welcome screen before hydration
  // finishes. Early button clicks have no client handler, so confirm the
  // exploration transition and retry after hydration when necessary.
  for(let attempt=0;attempt<5;attempt++){
    await page.getByRole("button",{name:/Explore world/}).click();
    try{
      await page.waitForFunction(()=>
        document.querySelector("[data-world-state]")?.getAttribute("data-world-state")==="exploring",
        null,{timeout:5000});
      break;
    }catch{
      if(attempt===4)throw new Error("World entry never hydrated after five attempts");
    }
  }
  await page.waitForFunction(()=>Number(document.querySelector('canvas[role="application"]')?.dataset.drawCalls)>0,
    null,{timeout:30000});
  await page.getByRole("button",{name:"Open navigation menu"}).click();
  await page.getByRole("button",{name:/North shore Skimboarding/}).click();
  await page.waitForFunction(()=>{
    const c=document.querySelector('canvas[role="application"]');
    const p=c?.dataset.player?.split(",").map(Number);
    return p?.length===2&&Math.abs(p[0])<4&&p[1]>38;
  });
  assert.equal(await attr("aquatic"),"land");
  assert.equal(await attr("skim-wave-style"),"continuous-ribbon-v1");
  assert.equal(await attr("skim-wave-ribbons"),"5");
  const start=await page.locator("canvas").evaluate(c=>({
    biome:c.dataset.biome,drawCalls:Number(c.dataset.drawCalls),player:c.dataset.player,
    waves:c.dataset.skimWaveRibbons,
  }));
  assert.ok(start.drawCalls>0);
  await snap("01-north-shore");
  checks.push("North shore reachable; continuous wave surface rendered");
  const pickup=page.getByRole("button",{name:/Pick up aqua skimboard/});
  await pickup.waitFor({state:"visible"});
  await pickup.click();
  await waitPhase("ready");
  const hud=page.getByRole("complementary",{name:"North shore skimboarding heat"});
  assert.ok(await hud.isVisible());
  assert.match(await hud.textContent(),/Sh(v|uv)-it|Shift sprint/);
  assert.equal(await attr("aquatic"),"land");
  assert.equal(await attr("activity"),"run");
  checks.push("Equipment pickup enters run mode without swimming");
  await canvas().focus();
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  // Gate the drop on actual renderer speed, not wall-clock time.
  await page.waitForFunction(()=>
    Number(document.querySelector('canvas[role="application"]')?.dataset.speed)>4.2,
    null,{timeout:6500});
  await snap("02-run-up");
  await page.keyboard.press("Space");
  await waitPhase("riding",5500);
  // Test against the live phase without spending a long screenshot interval
  // before launching the aerial trick on a short surf run.
  const launch=await canvas().evaluate(c=>({
    phase:c.dataset.skimPhase,camera:c.dataset.skimCameraFollow,
    aquatic:c.dataset.aquatic,
  }));
  assert.deepEqual(launch,{phase:"riding",camera:"true",aquatic:"land"});
  await canvas().focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("q");
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  assert.match(await hud.textContent(),/Shuv-it · Q/);
  checks.push("Run + board drop launches skim without swimming or shifting camera modes");
  await page.waitForFunction(()=>document.querySelector('canvas[role="application"]')?.dataset.skimPendingTrick==="shuvit",
    null,{timeout:4000});
  await page.waitForFunction(()=>Number(document.querySelector('canvas[role="application"]')?.dataset.skimTrickSpin)>.25,
    null,{timeout:4000});
  await snap("02-ride-and-shuvit-air");
  await page.waitForFunction(()=>document.querySelector('canvas[role="application"]')?.dataset.skimLastTrick?.includes("Shuv-it landed"),
    null,{timeout:5000});
  checks.push("Q queues an airborne trick, spins visible geometry, and lands for points");
  await page.setViewportSize({width:390,height:844});
  const bounds=await hud.boundingBox();
  assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=391,
    "The mobile skim HUD must remain within the screen");
  await snap("04-mobile");
  await page.setViewportSize({width:1440,height:900});
  await canvas().focus();
  await page.keyboard.press("x");
  await waitPhase("off");
  assert.equal(await page.getByRole("button",{name:"Skateboarding"}).isVisible(),true);
  checks.push("Leaving skimboarding releases normal activity selection");
  await page.getByRole("button",{name:"Open navigation menu"}).click();
  await page.getByRole("button",{name:/Redwood grove A little about me/}).click();
  await page.waitForFunction(()=>document.querySelector('canvas[role="application"]')?.dataset.aquatic==="land"&&
    document.querySelector('canvas[role="application"]')?.dataset.skimPhase==="off");
  checks.push("Fast travel back into the island restores normal world state");
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,"qa.json"),JSON.stringify({checks,start,errors},null,2));
  console.log("SKIMBOARDING BROWSER QA PASS",checks.join("; "));
}catch(error){
  const diagnostic=page?await page.evaluate(()=>({
    world:document.querySelector("[data-world-state]")?.getAttribute("data-world-state"),
    canvasCount:document.querySelectorAll("canvas").length,
    canvases:[...document.querySelectorAll("canvas")].map(c=>({id:c.id,role:c.getAttribute("role"),dataset:{...c.dataset}})),
    text:document.body?.innerText.slice(0,2200),
    html:document.querySelector("[data-world-state]")?.outerHTML.slice(0,1500),
    location:window.location.href,
  })).catch(()=>null):null;
  fs.writeFileSync(path.join(output,"failure.json"),JSON.stringify({error:String(error),errors,diagnostic},null,2));
  if(page)await snap("failure").catch(()=>{});
  console.error("SKIMBOARDING BROWSER QA FAILED",error,
    JSON.stringify({errors,diagnostic},null,2));
  process.exitCode=1;
}finally{
  await browser.close();
}
