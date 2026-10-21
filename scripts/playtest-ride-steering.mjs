import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
const root=process.env.PLAYWRIGHT_MODULE_ROOT;
if(!root)throw Error("PLAYWRIGHT_MODULE_ROOT is required");
const {chromium}=createRequire(path.join(root,"package.json"))("playwright");
const base=process.env.WORLD_BASE_URL??"http://127.0.0.1:3000";
const out=process.env.WORLD_AUDIT_DIR??"artifacts/world/ride-steering";
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
const observations=[],errors=[];
const read=async canvas=>canvas.evaluate(el=>({
 mode:el.dataset.activity,player:el.dataset.player,heading:el.dataset.skateHeading,
 speed:Number(el.dataset.speed),yawError:Number(el.dataset.rideVisualYawError),
 contact:Number(el.dataset.rideContactGap),recovery:el.dataset.rideRecovery,
 held:el.dataset.rideHeldKeys,input:el.dataset.rideInputVector,
 wipeout:el.dataset.rideWipeoutPhase,
}));
const heading=point=>(point.heading??"").split(",").map(Number);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base);
 await page.getByRole("button",{name:"Explore world",exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector("canvas")?.dataset.drawCalls)>0,
  null,{timeout:45000});
 const canvas=page.locator("canvas");
 for(const [name,activity] of [
   ["Skateboarding","skate"],
   ["Mountain biking","bike"],
   ["Skiing","ski"],
 ]){
  await page.getByRole("button",{name,exact:true}).click();
  await page.waitForFunction(mode=>
    document.querySelector("canvas")?.dataset.activity===mode,activity,{timeout:15000});
  await canvas.focus();
  // Real WASD input. Compare two opposite turns; checking position alone
  // cannot catch frozen mesh yaw with otherwise correct underlying travel.
  async function turn(direction){
   // Replicate the real case: the activity/menu button owns focus.
   // Gameplay movement must not depend on manually clicking the canvas.
   await page.getByRole("button",{name,exact:true}).focus();
   await page.keyboard.down("w");
   await page.keyboard.down(direction);
   let result;
   try{
     await page.waitForTimeout(activity==="skate"?5400:2000);
     result=await read(canvas);
   }finally{await page.keyboard.up(direction);await page.keyboard.up("w");}
   assert.ok(result.heading.split(",").length===2,"heading must be exposed");
   assert.ok(Number.isFinite(result.yawError)&&Math.abs(result.yawError)<.005,
     activity+" rider mesh is not facing the actual steering vector: "+JSON.stringify(result));
   assert.ok(Number.isFinite(result.contact),"wheel contact must stay finite");
   assert.ok(result.held?.includes(direction)&&result.held?.includes("w"),
     activity+" WASD input was lost on an activity control: "+JSON.stringify(result));
   return result;
  }
  const right=await turn("d");
  const left=await turn("a");
  const h0=heading(right),h1=heading(left);
  assert.ok(h0.every(Number.isFinite)&&h1.every(Number.isFinite),
   "both steering headings must remain finite");
  assert.ok(dot(h0,h1)<.94,
    activity+" A and D must produce noticeably different facing directions: "+JSON.stringify({right,left}));
  observations.push({activity,right,left,turnDot:dot(h0,h1)});
 }
 await page.screenshot({path:path.join(out,"steering-all-rides.png")});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"observations.json"),JSON.stringify(observations,null,2)+"\n");
 console.log("RIDE STEERING BROWSER PASS",JSON.stringify(observations));
}catch(err){
 console.error("RIDE STEERING BROWSER FAIL",String(err));
 console.log("RIDE STEERING EVIDENCE",JSON.stringify({observations,errors}));
 if(page)await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});
 process.exitCode=1;
}finally{await browser.close();}
