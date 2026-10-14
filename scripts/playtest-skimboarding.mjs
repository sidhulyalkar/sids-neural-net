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
  // The browser's software WebGL renderer can take longer to take a screenshot
  // than the entire aerial window. Exercise the real canvas key handlers in one
  // browser task and observe every phase through MutationObserver so the audit
  // cannot miss a fast landing between separate Playwright round trips.
  const trickTrace=await canvas().evaluate(async c=>{
    const trace={riding:false,airborne:false,spin:false,landed:false,clean:false,swimming:false,wake:false};
    const sample=()=>{
      const d=c.dataset;
      trace.riding ||= d.skimPhase==="riding";
      trace.airborne ||= d.skimPendingTrick==="shuvit";
      trace.spin ||= Number(d.skimTrickSpin)>.25;
      trace.landed ||= (d.skimLastTrick??"").includes("Shuv-it landed");
      trace.clean ||= (d.skimLastTrick??"").includes("Clean ride");
      trace.swimming ||= d.aquatic!=="land";
      trace.wake ||= d.skimWakeVisible==="true";
    };
    const observer=new MutationObserver(sample);
    observer.observe(c,{attributes:true,attributeFilter:[
      "data-skim-phase","data-skim-pending-trick","data-skim-trick-spin",
      "data-skim-last-trick","data-aquatic","data-skim-wake-visible",
    ]});
    // These are ordinary bubbling keyboard events routed to the same world
    // handler as physical Space/Q presses; no simulation shortcuts or state writes.
    const press=key=>c.dispatchEvent(new KeyboardEvent("keydown",{
      key,bubbles:true,cancelable:true,
    }));
    press(" "); // drop board at observed running speed
    press(" "); // pop
    press("q"); // shuv-it during flight
    sample();
    await new Promise(resolve=>setTimeout(resolve,2400));
    sample();observer.disconnect();
    return {...trace,finalPhase:c.dataset.skimPhase,
      lastTrick:c.dataset.skimLastTrick,score:Number(c.dataset.skimScore)};
  });
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  assert.equal(trickTrace.swimming,false,"skim should not switch into swimming");
  assert.equal(trickTrace.riding,true,"run-up should launch a genuine skim");
  assert.equal(trickTrace.airborne,true,"Q should queue an airborne shuv-it");
  assert.equal(trickTrace.spin,true,"the avatar should visibly rotate during the trick");
  assert.equal(trickTrace.wake,true,"board motion should produce a water-height-following wake");
  assert.equal(trickTrace.landed,true,"a completed shuv-it should land for points");
  await snap("02-ride-and-shuvit");
  await page.waitForFunction(()=>Number(
    document.querySelector('canvas[role="application"]')?.dataset.skimScore)>=130,
    null,{timeout:12000});
  const scored=Number(await attr("skim-score"));
  assert.ok(scored>=130,"landed shuv-it must contribute to committed ride score");
  // The HUD deliberately swaps the Q/E/F buttons back to "Drop" after a
  // completed ride. Never assert trick controls while the state is ready.
  if(await attr("skim-phase")==="ready"){
    assert.match(await hud.textContent(),/Drop board · Space/);
  }
  checks.push("Run + drop + Q trick registered airborne spin, touchdown score and no swim");

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
