import assert from "node:assert/strict";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT required");
const {chromium}=createRequire(join(root,"package.json"))("playwright");
const output=process.env.WORLD_AUDIT_DIR??"artifacts/ski-flex-visual";
const reportPath=process.env.SKI_FLEX_REPORT??"artifacts/ski-flex-sole/rigid-bounded-surface.json";
mkdirSync(output,{recursive:true});
const reference=JSON.parse(readFileSync(reportPath,"utf8"));
const tick=reference.worstBridgeTick;
assert.ok(Number.isInteger(tick)&&tick>0);
const url=process.env.WORLD_BASE_URL??"http://localhost:3000";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:800},deviceScaleFactor:1});
 page.on("pageerror",e=>errors.push(e.message));
 for(const mode of ["rigid","bounded","surface"]){
  const path=new URL("/dev/ski-lab",url);
  path.searchParams.set("five-carve","");
  path.searchParams.set("capture-tick",String(tick));
  path.searchParams.set("sole",mode);
  path.searchParams.set("view","contact");
  await page.goto(path.href,{waitUntil:"domcontentloaded",timeout:120000});
  await page.locator('canvas[data-capture-tick="'+tick+'"]').waitFor({timeout:120000});
  await page.waitForFunction(({tick,mode})=>{
   const status=document.querySelector("output")?.value??"";
   return status.includes("Tick "+tick+" ")&&status.includes("sole "+mode);
  },{tick,mode},{timeout:30000});
  const status=await page.locator("output").evaluate(o=>o.value);
  assert.ok(status.includes("Tick "+tick+" ")&&status.includes("sole "+mode),status);
  const visibility=await page.locator("canvas").evaluate(c=>({
   visible:c.dataset.skierVisible,occluded:c.dataset.skierOccluded,
   skisFramed:c.dataset.skisFramed,screen:c.dataset.skierScreen
  }));
  assert.equal(visibility.visible,"true","skier must be visible: "+JSON.stringify(visibility));
  assert.equal(visibility.skisFramed,"true","both ski tips and tails must be framed: "+JSON.stringify(visibility));
  await page.screenshot({path:join(output,"worst-"+mode+".png"),timeout:25000});
  results.push({mode,tick,status,visibility,viewport:"1100x800",view:"contact"});
 }
 // Capture the ordinary follow view separately. It is diagnostic, not a
 // substitute for the readable contact-inspection view.
 const followURL=new URL("/dev/ski-lab",url);
 followURL.searchParams.set("five-carve","");
 followURL.searchParams.set("capture-tick",String(tick));
 followURL.searchParams.set("sole","bounded");
 await page.goto(followURL.href,{waitUntil:"domcontentloaded",timeout:120000});
 await page.locator('canvas[data-capture-tick="'+tick+'"]').waitFor({timeout:120000});
 const followVisibility=await page.locator("canvas").evaluate(c=>({
  visible:c.dataset.skierVisible,occluded:c.dataset.skierOccluded,
  skisFramed:c.dataset.skisFramed,screen:c.dataset.skierScreen
 }));
 results.push({mode:"bounded",tick,view:"follow",visibility:followVisibility});
 await page.screenshot({path:join(output,"worst-follow.png"),timeout:25000});
 // Return to the contact camera for the portrait composition.
 const portraitURL=new URL("/dev/ski-lab",url);
 portraitURL.searchParams.set("five-carve","");
 portraitURL.searchParams.set("capture-tick",String(tick));
 portraitURL.searchParams.set("sole","surface");
 portraitURL.searchParams.set("view","contact");
 await page.goto(portraitURL.href,{waitUntil:"domcontentloaded",timeout:120000});
 await page.locator('canvas[data-capture-tick="'+tick+'"]').waitFor({timeout:120000});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:join(output,"worst-surface-portrait.png"),timeout:25000});
 assert.equal(errors.length,0,JSON.stringify(errors));
}finally{
 writeFileSync(join(output,"browser-report.json"),JSON.stringify({tick,results,errors,qualification:"VISUAL REVIEW OPEN"},null,2)+"\n");
 await browser.close();
}
