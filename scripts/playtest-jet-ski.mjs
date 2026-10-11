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
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:30000});
 await page.getByRole("button",{name:"Open navigation menu"}).click();
 await page.getByRole("button",{name:"05 Lagoon reef South Pacific reef",exact:true}).click();
 await page.waitForFunction(()=>document.querySelector("canvas")?.dataset.aquatic==="land");
}
try{
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 await boot(desktop);
 const canvas=desktop.locator("canvas");
 assert.equal(await canvas.getAttribute("data-jet-ski-arches"),"2");
 assert.ok(Number(await canvas.getAttribute("data-jet-ski-rocks"))>=10);
 const dock=desktop.locator('[aria-label="Jet ski race status"]');
 await dock.waitFor({state:"visible"});
 assert.match(await dock.textContent(),/JET-SKI DOCK/);
 await canvas.focus();
 await desktop.keyboard.press("3");
 await desktop.keyboard.press("e");
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="racing");
 await desktop.screenshot({path:path.join(out,"01-dock-launch.png")});
 assert.match(await dock.textContent(),/START IN/);
 await desktop.waitForTimeout(3600);
 await desktop.keyboard.down("w");
 await desktop.keyboard.down("Shift");
 try{
  await desktop.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.jetSkiTurbo)<90,
   null,{timeout:6500});
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
 await desktop.screenshot({path:path.join(out,"02-race-boost.png")});
 results.push({desktop:driving});
 await desktop.keyboard.press("r");
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiTime==="0.0");
 assert.match(await dock.textContent(),/START IN/);
 await desktop.keyboard.press("Escape");
 await desktop.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="docked");
 results.push("Desktop board, countdown, throttle, boost, restart and dock pass");
 const phone=await browser.newPage({
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,
 });
 await boot(phone);
 const ride=phone.getByRole("button",{name:"Ride",exact:true});
 await ride.waitFor({state:"visible"});
 const craft=phone.getByRole("button",{name:"sport",exact:true});
 await craft.tap();
 await phone.getByRole("button",{name:"race",exact:true}).waitFor();
 await ride.tap();
 await phone.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="racing");
 assert.equal(await phone.getByRole("button",{name:"BOOST",exact:true}).isVisible(),true);
 await phone.screenshot({path:path.join(out,"03-touch-race.png")});
 await phone.getByRole("button",{name:"Dock",exact:true}).tap();
 await phone.waitForFunction(()=>document.querySelector("canvas")?.dataset.jetSkiStatus==="docked");
 results.push("Touch craft choice, boarding, boost presence and dock pass");
 assert.deepEqual(errors,[],"No browser console or runtime errors");
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({results,errors},null,2)+"\n");
 console.log(JSON.stringify({results,errors},null,2));
}finally{
 await browser.close();
}
